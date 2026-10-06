// Runs setup/Code.gs against an in-memory fake of the Apps Script services (see gas-harness.mjs).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {setup} from './gas-harness.mjs';

const delivery = {gift_id: 'hario-mug', recipient: 'Aye Aye', email: 'aye@example.com', phone: '+81 90-1234-5678', postal: '123-4567', address: 'Tokyo, Shibuya 1-2-3, Room 4', note: ''};

test('setup creates tabs and issues codes with QR links', () => {
  const s = setup();
  assert.ok(s.book.sheets.Catalogue && s.book.sheets['Gift settings']);
  assert.match(s.codeOf(2), /^[A-F0-9]{20}$/);
  assert.notEqual(s.codeOf(2), s.codeOf(3));
  assert.equal(s.rsvp.data[1][s.rsvp.data[0].indexOf('Gift QR link')], 'https://msburberryy-web.github.io/HtooAndMay_GiftToYou/#code=' + s.codeOf(2));
  assert.equal(s.couples.data[0][19], 'First submitted at');
  assert.equal(s.couples.data[0][16], 'Email status');
});

test('catalogue is public, closed by default, and lists enabled gifts', () => {
  const s = setup();
  const r = s.post({action: 'catalogue'});
  assert.equal(r.ok, true);
  assert.equal(r.data.open, false);
  assert.equal(r.data.deadline, '2027-01-16');
  assert.equal(r.data.gifts.filter(g => g.enabled).length, 7);
});

test('deadline stored as a Date by Sheets is read as YYYY-MM-DD', () => {
  const s = setup();
  s.setSetting('Deadline', vm.runInContext("new Date('2027-01-15T15:00:00Z')", s.ctx)); // a Date from the script's own realm, as Sheets returns
  assert.equal(s.post({action: 'catalogue'}).data.deadline, '2027-01-16');
});

test('lookup: valid code, codes with spaces/lowercase, unknown codes', () => {
  const s = setup();
  const code = s.codeOf(2);
  const r = s.post({action: 'lookup', code});
  assert.equal(r.ok, true);
  assert.equal(r.data.label, 'Aye Aye & Ko Ko');
  assert.equal(r.data.selection, null);
  assert.equal(s.post({action: 'lookup', code: code.toLowerCase().replace(/(.{5})/g, '$1 ')}).ok, true);
  const bad = s.post({action: 'lookup', code: 'ZZZZZZZZ'});
  assert.deepEqual([bad.ok, bad.status, bad.reason], [false, 404, 'not_found']);
  assert.equal(s.post({action: 'lookup'}).reason, 'not_found');
  assert.equal(s.couples.getLastRow(), 1, 'lookup must not write to the sheet');
});

test('submit is refused while closed, then saves and emails once opened', () => {
  const s = setup();
  const code = s.codeOf(2);
  const closed = s.post({action: 'submit', code, consent: true, language: 'en', data: delivery});
  assert.equal(closed.reason, 'closed');
  s.setSetting('Open', true);
  const r = s.post({action: 'submit', code, consent: true, language: 'en', data: delivery});
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.emailStatus, 'sent');
  assert.equal(r.data.gift_name, 'HARIO — Tea & coffee brewer mug');
  const row = s.couples.data[1];
  assert.equal(row[0], code);
  assert.equal(row[8], '123-4567');
  assert.equal(row[11], 'Requested');
  assert.equal(row[6], 'aye@example.com');
  assert.equal(s.mail.length, 1);
  assert.match(s.mail[0].body, /JST/);
  const again = s.post({action: 'lookup', code});
  assert.equal(again.data.selection.gift_id, 'hario-mug');
  assert.equal(again.data.selection.first_submitted_at, r.data.first_submitted_at);
});

test('postcode without hyphen and full-width digits are accepted', () => {
  const s = setup(); s.setSetting('Open', true);
  const r = s.post({action: 'submit', code: s.codeOf(2), consent: true, data: {...delivery, postal: '１２３４５６７'}});
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(s.couples.data[1][8], '123-4567');
});

test('server validates consent, details, and gift availability', () => {
  const s = setup(); s.setSetting('Open', true);
  const code = s.codeOf(2);
  assert.equal(s.post({action: 'submit', code, consent: false, data: delivery}).reason, 'invalid');
  assert.equal(s.post({action: 'submit', code, consent: true, data: {...delivery, postal: '12-34'}}).reason, 'invalid');
  assert.equal(s.post({action: 'submit', code, consent: true, data: {...delivery, email: 'nope'}}).reason, 'invalid');
  assert.equal(s.post({action: 'submit', code, consent: true, data: {...delivery, gift_id: 'kinto'}}).reason, 'unavailable', 'disabled gift');
  assert.equal(s.post({action: 'submit', code, consent: true, data: {...delivery, gift_id: 'made-up'}}).reason, 'unavailable');
  assert.equal(s.post({action: 'submit', code: 'ZZZZZZZZ', consent: true, data: delivery}).reason, 'not_found');
  assert.equal(s.mail.length, 0);
});

test('deadline passed blocks submit', () => {
  const s = setup(); s.setSetting('Open', true); s.setSetting('Deadline', '2020-01-01');
  assert.equal(s.post({action: 'submit', code: s.codeOf(2), consent: true, data: delivery}).reason, 'ended');
});

test('changes allowed within 48h without restarting window; locked after 48h or when ordered', () => {
  const s = setup(); s.setSetting('Open', true);
  const code = s.codeOf(2);
  const first = s.post({action: 'submit', code, consent: true, data: delivery});
  const second = s.post({action: 'submit', code, consent: true, data: {...delivery, gift_id: 'hario-bowls'}});
  assert.equal(second.ok, true);
  assert.equal(second.data.first_submitted_at, first.data.first_submitted_at);
  assert.equal(s.mail.length, 2, 'changed details send a new confirmation');
  s.post({action: 'submit', code, consent: true, data: {...delivery, gift_id: 'hario-bowls'}});
  assert.equal(s.mail.length, 2, 'identical resubmission does not resend');
  s.couples.data[1][19] = new Date(Date.now() - 49 * 3600000).toISOString();
  assert.equal(s.post({action: 'submit', code, consent: true, data: delivery}).reason, 'locked');
  s.couples.data[1][19] = new Date().toISOString();
  s.couples.data[1][11] = 'Ordered';
  assert.equal(s.post({action: 'submit', code, consent: true, data: delivery}).reason, 'locked');
});

test('email quota failure keeps the order and is retried later', () => {
  const s = setup({mailQuota: 0}); s.setSetting('Open', true);
  const r = s.post({action: 'submit', code: s.codeOf(3), consent: true, language: 'my', data: delivery});
  assert.equal(r.ok, true);
  assert.equal(r.data.emailStatus, 'failed');
  assert.match(s.couples.data[1][16], /^Failed/);
  s.ctx.MailApp.getRemainingDailyQuota = () => 10;
  s.ctx.retryGiftEmails();
  assert.equal(s.mail.length, 1);
  assert.match(s.couples.data[1][16], /^Sent/);
  assert.match(s.mail[0].subject, /အတည်ပြု/);
});

test('organiser actions need the token; guests cannot use them', () => {
  const s = setup();
  assert.equal(s.post({action: 'state'}).status, 403);
  assert.equal(s.post({action: 'status', code: s.codeOf(2), status: 'Ordered'}).status, 403);
  const state = s.post({action: 'state', token: s.props.GIFT_TOKEN});
  assert.equal(state.ok, true);
  assert.equal(state.data.invitations.length, 2);
});

test('a duplicated RSVP code is blocked without breaking other guests', () => {
  const s = setup();
  const code = s.codeOf(2);
  const h = s.rsvp.data[0];
  const dup = []; dup[h.indexOf('Name')] = 'Copy'; dup[h.indexOf('Attending')] = 'Yes'; dup[s.codeIndex] = code;
  s.rsvp.data.push(dup.map(v => v ?? ''));
  assert.equal(s.post({action: 'lookup', code}).reason, 'not_found');
  assert.equal(s.post({action: 'lookup', code: s.codeOf(3)}).ok, true);
});

test('bad JSON and unknown actions fail cleanly', () => {
  const s = setup();
  assert.equal(JSON.parse(s.ctx.doPost({postData: {contents: '{'}}).text).reason, 'invalid');
  assert.equal(s.post({action: 'drop-tables'}).reason, 'invalid');
  assert.equal(JSON.parse(s.ctx.doGet().text).ok, true);
});

test('checkGiftSetup reports success, and names the broken part', () => {
  const s = setup();
  const lines = [];
  s.ctx.console.log = m => lines.push(m);
  s.ctx.checkGiftSetup();
  assert.match(lines.at(-1), /All checks passed/, lines.join('\n'));
  assert.ok(lines.some(l => /2 guest code\(s\) can log in/.test(l)));
  s.book.sheets.Catalogue.data[0][0] = 'Gift ID';
  lines.length = 0;
  s.ctx.checkGiftSetup();
  assert.ok(lines.some(l => l.startsWith('❌ Catalogue tab')), lines.join('\n'));
  assert.match(lines.at(-1), /problem/);
});

test('refused requests are written to the Executions log', () => {
  const s = setup();
  const warnings = [];
  s.ctx.console.warn = m => warnings.push(m);
  s.post({action: 'lookup', code: 'ZZZZZZZZ'});
  assert.match(warnings[0], /^doPost lookup refused: 404 not_found/);
});

test('visits are recorded per couple without creating duplicate rows', () => {
  const s = setup();
  const code = s.codeOf(2);
  assert.equal(s.post({action: 'track', code, event: 'visit'}).ok, true);
  assert.equal(s.post({action: 'track', code, event: 'visit'}).ok, true);
  const rows = s.couples.data.filter(r => r[0] === code);
  assert.equal(rows.length, 1);
  assert.deepEqual(s.couples.data[0].slice(20, 26), ['First visited at','Last visited at','Visits','Cart gift','Cart updated at','Saved gifts']);
  assert.match(rows[0][20], /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  assert.equal(rows[0][22], '2');
  assert.equal(s.post({action: 'track', code: 'ZZZZZZZZ', event: 'visit'}).reason, 'not_found');
  assert.equal(s.post({action: 'track', code, event: 'hack'}).reason, 'invalid');
});

test('cart changes are recorded with the gift name, and cleared on removal', () => {
  const s = setup();
  const code = s.codeOf(2);
  s.post({action: 'track', code, event: 'cart', giftId: 'hario-mug'});
  const row = () => s.couples.data.find(r => r[0] === code);
  assert.equal(row()[23], 'HARIO — Tea & coffee brewer mug');
  assert.ok(row()[24]);
  s.post({action: 'track', code, event: 'cart', giftId: ''});
  assert.equal(row()[23], '');
  assert.equal(s.post({action: 'track', code, event: 'cart', giftId: 'made-up'}).reason, 'invalid');
});

test('saved gifts: up to 5 known gifts, returned by lookup', () => {
  const s = setup();
  const code = s.codeOf(3);
  assert.deepEqual(s.post({action: 'lookup', code}).data.saved, []);
  const ids = ['hario-mug', 'hario-bowls', 'kinto-350-white'];
  assert.deepEqual(s.post({action: 'save', code, saved: ids}).data.saved, ids);
  assert.deepEqual(s.post({action: 'lookup', code}).data.saved, ids);
  assert.equal(s.post({action: 'save', code, saved: ['hario-mug','hario-bowls','hario-teapot','hario-coffee','kinto-350-white','kinto-350-khaki']}).reason, 'limit');
  assert.equal(s.post({action: 'save', code, saved: ['nope']}).reason, 'unavailable');
  assert.equal(s.post({action: 'save', code, saved: ['hario-mug', 'hario-mug']}).reason, 'invalid');
  assert.equal(s.post({action: 'save', code, saved: 'hario-mug'}).reason, 'invalid');
  assert.deepEqual(s.post({action: 'save', code, saved: []}).data.saved, []);
});

test('guest list is cached; new codes still work at once', () => {
  const s = setup();
  s.post({action: 'lookup', code: s.codeOf(2)});
  // Rename in RSVPs: the cached label stays until refresh…
  s.rsvp.data[1][s.rsvp.data[0].indexOf('Name')] = 'Renamed';
  assert.equal(s.post({action: 'lookup', code: s.codeOf(2)}).data.label, 'Aye Aye & Ko Ko');
  s.ctx.refreshCatalogueNow();
  assert.equal(s.post({action: 'lookup', code: s.codeOf(2)}).data.label, 'Renamed & Ko Ko');
  // …but a code typed into the sheet by hand is found immediately.
  const h = s.rsvp.data[0];
  const row = h.map(() => ''); row[h.indexOf('Name')] = 'New Guest'; row[h.indexOf('Attending')] = 'Yes'; row[s.codeIndex] = 'NEWCODE123';
  s.rsvp.data.push(row);
  assert.equal(s.post({action: 'lookup', code: 'NEWCODE123'}).data.label, 'New Guest');
});

test('submit still works after activity columns exist', () => {
  const s = setup(); s.setSetting('Open', true);
  const code = s.codeOf(2);
  s.post({action: 'track', code, event: 'visit'});
  s.post({action: 'save', code, saved: ['hario-mug']});
  const r = s.post({action: 'submit', code, consent: true, data: {gift_id: 'hario-mug', recipient: 'A', email: 'a@example.com', phone: '090-1234-5678', postal: '1234567', address: 'Tokyo 1-2-3 Room 4', note: ''}});
  assert.equal(r.ok, true, JSON.stringify(r));
  const row = s.couples.data.find(x => x[0] === code);
  assert.equal(row[11], 'Requested');
  assert.equal(row[25], 'hario-mug');
});
