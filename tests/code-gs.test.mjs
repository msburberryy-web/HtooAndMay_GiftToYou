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
  assert.equal(r.data.emailStatus, 'queued', 'emails go out in the background');
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
  assert.equal(r.data.emailStatus, 'queued');
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

test('My selection shows delivery details partly hidden', () => {
  const s = setup(); s.setSetting('Open', true);
  const code = s.codeOf(2);
  s.post({action: 'submit', code, consent: true, data: {gift_id: 'hario-mug', recipient: 'Aye Aye', email: 'ayeaye@example.com', phone: '090-1234-5678', postal: '150-0001', address: 'Tokyo-to Shibuya-ku Jingumae 1-2-3 Sakura Mansion 405', note: 'Leave with concierge'}});
  const sel = s.post({action: 'lookup', code}).data.selection;
  assert.equal(sel.email, 'a•••@example.com');
  assert.equal(sel.phone, '•••-5678');
  assert.equal(sel.postal, '150-••••');
  assert.ok(sel.address.endsWith('•••') && !sel.address.includes('405'));
  assert.equal(sel.note, '••••');
  assert.equal(sel.masked, true);
  assert.equal(sel.recipient, 'Aye Aye');
  // the sheet keeps the full details
  const row = s.couples.data.find(r => r[0] === code);
  assert.equal(row[6], 'ayeaye@example.com');
  // organiser 'state' (token) is not masked
  const st = s.post({action: 'state', token: s.props.GIFT_TOKEN}).data.selections[0];
  assert.equal(st.email, 'ayeaye@example.com');
});

test('organiser is notified of NEW and CHANGED requests', () => {
  const s = setup(); s.setSetting('Open', true);
  const code = s.codeOf(2);
  const d = {gift_id: 'hario-mug', recipient: 'Aye Aye', email: 'ayeaye@example.com', phone: '090-1234-5678', postal: '1500001', address: 'Tokyo 1-2-3 Room 4', note: ''};
  s.post({action: 'submit', code, consent: true, data: d});
  assert.equal(s.notices.length, 1);
  assert.match(s.notices[0].subject, /^\[Gift NEW\] HM-0001 · Aye Aye & Ko Ko — HARIO — Tea & coffee brewer mug$/);
  assert.match(s.notices[0].body, /Recipient: Aye Aye/);
  assert.match(s.notices[0].body, /docs\.google\.com\/spreadsheets\/d\//);
  s.post({action: 'submit', code, consent: true, data: {...d, gift_id: 'hario-bowls'}});
  assert.equal(s.notices.length, 2);
  assert.match(s.notices[1].subject, /^\[Gift CHANGED\]/);
  assert.match(s.notices[1].body, /Previous gift: HARIO — Tea & coffee brewer mug/);
  s.props.NOTIFY_EMAIL = 'htoo@example.com, may@example.com';
  s.post({action: 'submit', code, consent: true, data: {...d, gift_id: 'hario-mug'}});
  assert.equal(s.mail.at(-1).to, 'htoo@example.com,may@example.com');
});

test('guest email: wedding style, monogram, View my gift link, masked code, escaped text', () => {
  const s = setup(); s.setSetting('Open', true);
  const code = s.codeOf(2);
  s.post({action: 'submit', code, consent: true, language: 'en', data: {gift_id: 'hario-mug', recipient: '<b>Aye</b>', email: 'ayeaye@example.com', phone: '090-1234-5678', postal: '1500001', address: 'Tokyo 1-2-3 Room 4', note: ''}});
  const m = s.mail[0];
  assert.equal(m.subject, 'Htoo & May — Your gift request is confirmed');
  assert.ok(m.htmlBody.includes('https://msburberryy-web.github.io/HtooAndMay_GiftToYou/branding/monogram.png'));
  assert.ok(m.htmlBody.includes('https://msburberryy-web.github.io/HtooAndMay_GiftToYou/#code=' + code + '&amp;view=order'));
  assert.ok(m.htmlBody.includes('View my gift'));
  assert.ok(m.htmlBody.includes(code.slice(0, 4) + '…' + code.slice(-4)));
  assert.ok(!m.htmlBody.includes('<b>Aye</b>') && m.htmlBody.includes('&lt;b&gt;Aye&lt;/b&gt;'));
  assert.match(m.body, /View my gift: https:\/\/msburberryy-web\.github\.io\/HtooAndMay_GiftToYou\/#code=/);
});

test('sheet IDs come from Script properties; missing ones are reported', () => {
  const s = setup();
  delete s.props.GIFT_SHEET_ID;
  const r = s.post({action: 'catalogue'});
  s.ctx.refreshCatalogueNow();
  assert.equal(s.post({action: 'catalogue'}).ok, false);
  const lines = []; s.ctx.console.log = m => lines.push(m);
  s.ctx.checkGiftSetup();
  assert.ok(lines.some(l => /❌ Script properties — Script property GIFT_SHEET_ID is not set/.test(l)), lines.join('\n'));
});

test('checkGiftSetup warns about short, guessable codes', () => {
  const s = setup();
  const h = s.rsvp.data[0];
  const row = h.map(() => ''); row[h.indexOf('Name')] = 'Short'; row[h.indexOf('Attending')] = 'Yes'; row[s.codeIndex] = 'ABC123';
  s.rsvp.data.push(row);
  const lines = []; s.ctx.console.log = m => lines.push(m);
  s.ctx.checkGiftSetup();
  assert.ok(lines.some(l => l.startsWith('⚠️ 1 code(s) are shorter than 12')), lines.join('\n'));
});

test('order history: every new or changed request is its own line with an order ID', () => {
  const s = setup(); s.setSetting('Open', true);
  const code = s.codeOf(2);
  const d = {gift_id: 'hario-mug', recipient: 'Aye Aye', email: 'ayeaye@example.com', phone: '090-1234-5678', postal: '1500001', address: 'Shibuya 1-2-3 Room 4', note: ''};
  const first = s.post({action: 'submit', code, consent: true, data: d});
  assert.equal(first.data.order_id, 'HM-0001');
  const second = s.post({action: 'submit', code, consent: true, data: {...d, gift_id: 'hario-bowls', address: 'Shinjuku 4-5-6 Room 7'}});
  assert.equal(second.data.order_id, 'HM-0002');
  // identical resubmission: same order, no new line, no extra emails
  const notices = s.notices.length, mails = s.mail.length;
  const again = s.post({action: 'submit', code, consent: true, data: {...d, gift_id: 'hario-bowls', address: 'Shinjuku 4-5-6 Room 7'}});
  assert.equal(again.data.order_id, 'HM-0002');
  assert.equal(s.notices.length, notices);
  assert.equal(s.mail.length, mails);
  const other = s.post({action: 'submit', code: s.codeOf(3), consent: true, data: {...d, recipient: 'Su Su'}});
  assert.equal(other.data.order_id, 'HM-0003');

  const hist = s.book.sheets['Order history'].data;
  assert.deepEqual(hist[0], ['Order ID','Type','Shared code','Couple','Gift ID','Gift','Recipient','Email','Phone','Postcode','Address','Delivery note','Language','Submitted at','Replaces','Superseded by']);
  assert.equal(hist.length, 4);
  assert.deepEqual(hist.slice(1).map(r => [r[0], r[1], r[4], r[10], r[14]]), [
    ['HM-0001', 'NEW', 'hario-mug', 'Shibuya 1-2-3 Room 4', ''],
    ['HM-0002', 'CHANGED', 'hario-bowls', 'Shinjuku 4-5-6 Room 7', 'HM-0001'],
    ['HM-0003', 'NEW', 'hario-mug', 'Shibuya 1-2-3 Room 4', ''],
  ]);
  // Couples holds the current order
  const row = s.couples.data.find(r => r[0] === code);
  assert.equal(s.couples.data[0][26], 'Current order ID');
  assert.equal(row[26], 'HM-0002');
  assert.equal(row[9], 'Shinjuku 4-5-6 Room 7');
  assert.equal(s.post({action: 'lookup', code}).data.selection.order_id, 'HM-0002');
  // shown in the guest email and the notification
  assert.ok(s.mail.at(-1).htmlBody.includes('HM-0003'));
  assert.match(s.notices.find(n => /HM-0002/.test(n.subject)).body, /Order ID: HM-0002 \(replaces HM-0001\)/);
});

test('setup gives earlier orders an ID in Order history', () => {
  const s = setup(); s.setSetting('Open', true);
  const code = s.codeOf(2);
  s.post({action: 'submit', code, consent: true, data: {gift_id: 'hario-mug', recipient: 'A', email: 'a@example.com', phone: '090-1234-5678', postal: '1500001', address: 'Shibuya 1-2-3 Room 4', note: ''}});
  // simulate an order made before order IDs existed
  s.couples.data.find(r => r[0] === code)[26] = '';
  s.book.sheets['Order history'].data.length = 1;
  s.ctx.setupGiftStandalone();
  assert.equal(s.couples.data.find(r => r[0] === code)[26], 'HM-0001');
  assert.equal(s.book.sheets['Order history'].data[1][14], 'imported');
  s.ctx.setupGiftStandalone();
  assert.equal(s.book.sheets['Order history'].data.length, 2, 'running setup again adds nothing');
});

const D = {gift_id: 'hario-mug', recipient: 'Aye Aye', email: 'ayeaye@example.com', phone: '090-1234-5678', postal: '1500001', address: 'Shibuya 1-2-3 Room 4', note: ''};
const editStatus = (s, row, value) => { s.couples.data[row - 1][11] = value; s.ctx.onGiftSheetEdit({range: s.couples.getRange(row, 12)}); };

test('safeguard: older order lines are marked "Superseded by"', () => {
  const s = setup(); s.setSetting('Open', true);
  const code = s.codeOf(2);
  s.post({action: 'submit', code, consent: true, data: D});
  s.post({action: 'submit', code, consent: true, data: {...D, gift_id: 'hario-bowls'}});
  s.post({action: 'submit', code, consent: true, data: {...D, gift_id: 'hario-teapot'}});
  const hist = s.book.sheets['Order history'].data;
  assert.deepEqual(hist.slice(1).map(r => [r[0], r[14], r[15]]), [['HM-0001', '', 'HM-0002'], ['HM-0002', 'HM-0001', 'HM-0003'], ['HM-0003', 'HM-0002', '']]);
});

test('safeguard: "Changes close at" is 48 hours after the first confirmation and does not move', () => {
  const s = setup(); s.setSetting('Open', true);
  const code = s.codeOf(2);
  const r1 = s.post({action: 'submit', code, consent: true, data: D});
  const row = () => s.couples.data.find(r => r[0] === code);
  assert.deepEqual(s.couples.data[0].slice(26, 29), ['Current order ID', 'Changes close at', 'Ordered order ID']);
  const expected = s.ctx.Utilities.formatDate(new Date(Date.parse(r1.data.first_submitted_at) + 48 * 3600000), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm');
  assert.equal(row()[27], expected);
  s.post({action: 'submit', code, consent: true, data: {...D, gift_id: 'hario-bowls'}});
  assert.equal(row()[27], expected);
  assert.match(s.notices[0].body, /Changes close at: .* \(order from the retailer after this time\)/);
});

test('safeguard: Status edits record which order they refer to; mismatch is flagged', () => {
  const s = setup(); s.setSetting('Open', true);
  const code = s.codeOf(2);
  s.post({action: 'submit', code, consent: true, data: D});
  const rowNo = s.couples.data.findIndex(r => r[0] === code) + 1;
  const row = () => s.couples.data[rowNo - 1];
  editStatus(s, rowNo, 'Ordered');
  assert.equal(row()[28], 'HM-0001');
  editStatus(s, rowNo, 'Shipped');
  assert.equal(row()[28], 'HM-0001', 'moving on to Shipped keeps the original order');
  // organiser moves it back to Requested; the guest changes → AC cleared, then set again for the new order
  editStatus(s, rowNo, 'Requested');
  assert.equal(row()[28], '');
  // edge case: Ordered set for HM-0001, then reverted by mistake while guest changes → mismatch visible via rule
  editStatus(s, rowNo, 'Ordered');
  s.couples.data[rowNo - 1][11] = 'Requested'; // reverted without the trigger (e.g. pasted value)
  s.post({action: 'submit', code, consent: true, data: {...D, gift_id: 'hario-bowls'}});
  assert.equal(row()[26], 'HM-0002');
  assert.equal(row()[28], 'HM-0001');
  const rule = s.couples.getConditionalFormatRules().find(r => r.formula === '=AND($AC2<>"",$AC2<>$AA2)');
  assert.ok(rule && rule.bg === '#f4c7c3', 'red highlight rule installed for column AC');
  // edits outside the Status column are ignored
  s.ctx.onGiftSheetEdit({range: s.couples.getRange(rowNo, 6)});
  assert.equal(row()[28], 'HM-0001');
});

test('safeguard: Status dropdown, edit trigger installed once, notification reminder', () => {
  const s = setup(); s.setSetting('Open', true);
  assert.equal(s.couples.validation.col, 12);
  assert.equal(JSON.stringify(s.couples.validation.rule.list), JSON.stringify(['Awaiting choice','Requested','Ordered','Shipped','Delivered']));
  assert.equal(s.couples.validation.rule.allowInvalid, false);
  assert.deepEqual(s.triggers.map(t => t.getHandlerFunction()).sort(), ['onGiftSheetEdit', 'onRsvpSheetEdit', 'processGiftEmailQueue']);
  s.ctx.setupGiftStandalone();
  assert.equal(s.triggers.length, 3, 'no duplicate triggers');
  assert.equal(s.couples.getConditionalFormatRules().length, 1, 'no duplicate highlight rule');
  const code = s.codeOf(2);
  s.post({action: 'submit', code, consent: true, data: D});
  s.post({action: 'submit', code, consent: true, data: {...D, gift_id: 'hario-bowls'}});
  assert.match(s.notices[1].body, /⚠ Reminder: If you already started ordering HM-0001, contact the guest before buying HM-0002\./);
  assert.doesNotMatch(s.notices[0].body, /Reminder/);
});

test('safeguard: setup upgrades an Order history tab created before "Superseded by"', () => {
  const s = setup(); s.setSetting('Open', true);
  const code = s.codeOf(2);
  s.post({action: 'submit', code, consent: true, data: D});
  s.post({action: 'submit', code, consent: true, data: {...D, gift_id: 'hario-bowls'}});
  const hist = s.book.sheets['Order history'].data;
  hist.forEach(r => { r.length = 15; }); // old 15-column tab
  s.ctx.setupGiftStandalone();
  assert.equal(hist[0][15], 'Superseded by');
  assert.equal(hist[1][15], 'HM-0002');
});

test('issueGiftCodesForAllGuests: codes for every named row, existing codes kept, short ones reported', () => {
  const s = setup();
  const h = s.rsvp.data[0];
  const before2 = s.codeOf(2);
  const add = (name, attending, code = '') => { const r = h.map(() => ''); r[h.indexOf('Name')] = name; r[h.indexOf('Attending')] = attending; r[s.codeIndex] = code; s.rsvp.data.push(r); return s.rsvp.data.length; };
  const declined = add('Declined Guest', 'No');
  const shortRow = add('Test', 'Yes', 'TEST01');
  const lines = []; s.ctx.console.log = m => lines.push(m);
  s.ctx.issueGiftCodesForAllGuests();
  assert.equal(s.codeOf(2), before2, 'existing code kept');
  assert.match(s.codeOf(4), /^[A-F0-9]{20}$/, 'row 4 (declined, named) gets a code');
  assert.match(s.codeOf(declined), /^[A-F0-9]{20}$/);
  assert.equal(s.codeOf(5), '', 'row without any name gets nothing');
  assert.equal(s.codeOf(shortRow), 'TEST01');
  assert.equal(s.rsvp.data[declined - 1][h.indexOf('Gift QR link')], 'https://msburberryy-web.github.io/HtooAndMay_GiftToYou/#code=' + s.codeOf(declined));
  assert.ok(lines.some(l => /^Issued 2 new gift code/.test(l)), lines.join('\n'));
  assert.ok(lines.some(l => l.includes('row(s) ' + shortRow + ' have a short code')));
  // declined guests cannot log in, attending ones can
  assert.equal(s.post({action: 'lookup', code: s.codeOf(declined)}).reason, 'not_found');
  const codes = new Set(s.rsvp.data.slice(1).map(r => r[s.codeIndex]).filter(Boolean));
  assert.equal(codes.size, s.rsvp.data.slice(1).filter(r => r[s.codeIndex]).length, 'all codes unique');
  // running again changes nothing
  const snapshot = JSON.stringify(s.rsvp.data);
  s.ctx.issueGiftCodesForAllGuests();
  assert.equal(JSON.stringify(s.rsvp.data), snapshot);
});

const D2 = {gift_id: 'hario-mug', recipient: 'Aye Aye', email: 'ayeaye@example.com', phone: '090-1234-5678', postal: '1500001', address: 'Shibuya 1-2-3 Room 4', note: ''};

test('speed: code checks are answered from the cache; organiser edits apply at once', () => {
  const s = setup(); s.setSetting('Open', true);
  const code = s.codeOf(2);
  s.post({action: 'submit', code, consent: true, data: D2});
  assert.equal(s.post({action: 'lookup', code}).data.selection.status, 'Requested');
  const rowNo = s.couples.data.findIndex(r => r[0] === code) + 1;
  // organiser sets Ordered by hand: cached answer until the edit trigger runs…
  s.couples.data[rowNo - 1][11] = 'Ordered';
  s.couples.data[rowNo - 1][12] = 'TRACK-123';
  assert.equal(s.post({action: 'lookup', code}).data.selection.status, 'Requested', 'served from cache');
  s.ctx.onGiftSheetEdit({range: s.couples.getRange(rowNo, 12, 1, 2)});
  const fresh = s.post({action: 'lookup', code}).data.selection;
  assert.equal(fresh.status, 'Ordered');
  assert.equal(fresh.tracking, 'TRACK-123');
});

test('speed: RSVP edits (names, Gift enabled) apply at once through the RSVP edit trigger', () => {
  const s = setup();
  const code = s.codeOf(2);
  assert.equal(s.post({action: 'lookup', code}).data.label, 'Aye Aye & Ko Ko');
  const h = s.rsvp.data[0];
  s.rsvp.data[1][h.indexOf('Gift display name')] = 'Aye Aye & Ko Ko (Mandalay)';
  assert.equal(s.post({action: 'lookup', code}).data.label, 'Aye Aye & Ko Ko', 'cached');
  s.ctx.onRsvpSheetEdit();
  assert.equal(s.post({action: 'lookup', code}).data.label, 'Aye Aye & Ko Ko (Mandalay)');
  s.rsvp.data[1][h.indexOf('Gift enabled')] = 'No';
  s.ctx.onRsvpSheetEdit();
  assert.equal(s.post({action: 'lookup', code}).reason, 'not_found', 'disabled code stops working at once');
});

test('speed: the guest\'s own changes are visible immediately (submit, saved gifts)', () => {
  const s = setup(); s.setSetting('Open', true);
  const code = s.codeOf(3);
  assert.equal(s.post({action: 'lookup', code}).data.selection, null);
  s.post({action: 'save', code, saved: ['hario-mug']});
  assert.deepEqual(s.post({action: 'lookup', code}).data.saved, ['hario-mug']);
  s.post({action: 'submit', code, consent: true, data: D2});
  assert.equal(s.post({action: 'lookup', code}).data.selection.order_id, 'HM-0001');
  s.post({action: 'submit', code, consent: true, data: {...D2, gift_id: 'hario-bowls'}});
  assert.equal(s.post({action: 'lookup', code}).data.selection.gift_id, 'hario-bowls');
});

test('speed: emails are queued and sent by the background job, once', () => {
  const s = setup({noQueueRun: true}); s.setSetting('Open', true);
  const code = s.codeOf(2);
  const r = s.post({action: 'submit', code, consent: true, language: 'my', data: D2});
  assert.equal(r.data.emailStatus, 'queued');
  assert.equal(s.mail.length + s.notices.length, 0, 'nothing sent during the request');
  const row = () => s.couples.data.find(x => x[0] === code);
  assert.equal(row()[16], 'Queued');
  assert.equal(Object.keys(s.props).filter(k => k.startsWith('MAILQ_')).length, 1);
  s.post({action: 'submit', code, consent: true, data: {...D2, gift_id: 'hario-bowls'}});
  s.ctx.processGiftEmailQueue();
  assert.equal(s.mail.length, 1, 'one guest email with the latest details');
  assert.match(s.mail[0].htmlBody, /Lidded glass bowls/);
  assert.equal(s.notices.length, 2, 'NEW and CHANGED notifications, each with its own details');
  assert.match(s.notices[0].subject, /\[Gift NEW\] HM-0001 .* Tea & coffee brewer mug/);
  assert.match(s.notices[1].subject, /\[Gift CHANGED\] HM-0002 .* Lidded glass bowls/);
  assert.match(row()[16], /^Sent/);
  assert.equal(Object.keys(s.props).filter(k => k.startsWith('MAILQ_')).length, 0);
  s.ctx.processGiftEmailQueue();
  assert.equal(s.mail.length + s.notices.length, 3, 'running again sends nothing');
});

test('speed: without the background trigger (setup not re-run) emails are sent straight away', () => {
  const s = setup({noQueueRun: true}); s.setSetting('Open', true);
  delete s.props.MAIL_TRIGGER;
  const r = s.post({action: 'submit', code: s.codeOf(2), consent: true, data: D2});
  assert.equal(r.data.emailStatus, 'sent');
  assert.equal(s.mail.length, 1);
  assert.equal(s.notices.length, 1);
});
