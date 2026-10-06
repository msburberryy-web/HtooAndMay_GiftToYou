// In-memory fake of the Apps Script services used by setup/Code.gs.
// It checks the backend logic only; a live test against the real deployment is still required.
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';

const source = readFileSync(new URL('../setup/Code.gs', import.meta.url), 'utf8');

class Range {
  constructor(sheet, row, col, rows, cols) { Object.assign(this, {sheet, row, col, rows, cols}); }
  getValues() { return Array.from({length: this.rows}, (_, r) => Array.from({length: this.cols}, (_, c) => this.sheet.get(this.row + r, this.col + c))); }
  setValues(values) {
    if (values.length !== this.rows || values.some(v => v.length !== this.cols)) throw new Error('setValues size mismatch');
    values.forEach((v, r) => v.forEach((x, c) => this.sheet.set(this.row + r, this.col + c, x)));
    return this;
  }
  setValue(v) { this.sheet.set(this.row, this.col, v); return this; }
  setNumberFormat() { return this; }
  insertCheckboxes() { return this; }
  getRow() { return this.row; }
  getNumRows() { return this.rows; }
}
class Sheet {
  constructor(name, rows = [], maxCols = 26) { this.name = name; this.data = rows.map(r => [...r]); this.maxCols = Math.max(maxCols, ...rows.map(r => r.length)); this.maxRows = 1000; }
  get(r, c) { if (c > this.maxCols) throw new Error(`column ${c} out of bounds in ${this.name}`); const v = this.data[r - 1]?.[c - 1]; return v === undefined ? '' : v; }
  set(r, c, v) { if (c > this.maxCols) throw new Error(`column ${c} out of bounds in ${this.name}`); while (this.data.length < r) this.data.push([]); this.data[r - 1][c - 1] = typeof v === 'string' && v.startsWith("'") ? v.slice(1) : v; }
  getRange(r, c, rows = 1, cols = 1) { if (rows < 1 || cols < 1) throw new Error('empty range'); return new Range(this, r, c, rows, cols); }
  getLastRow() { for (let i = this.data.length; i > 0; i--) if ((this.data[i - 1] || []).some(v => v !== '' && v != null)) return i; return 0; }
  getLastColumn() { return Math.max(0, ...this.data.map(r => { for (let i = r.length; i > 0; i--) if (r[i - 1] !== '' && r[i - 1] != null) return i; return 0; })); }
  getMaxColumns() { return this.maxCols; }
  getMaxRows() { return this.maxRows; }
  insertColumnsAfter(_, n) { this.maxCols += n; }
  insertRowsAfter(_, n) { this.maxRows += n; }
  getDataRange() { return this.getRange(1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); }
  setFrozenRows() {} setFrozenColumns() {}
}
class Book {
  constructor(id, sheets) { this.id = id; this.sheets = sheets; }
  getId() { return this.id; }
  getSheetByName(n) { return this.sheets[n] || null; }
  insertSheet(n) { return (this.sheets[n] = new Sheet(n)); }
  setSpreadsheetTimeZone() {}
}

export const OWNER = 'owner@example.com';
const GIFT_ID = '1r9ngeMlOthZEMOjPIqVODOOtd2RxbtFa0ljARPOyiTQ';
const RSVP_ID = '11SA4KyupcO7ElvLnXRSngOxbMIb6G035OtWJqGE_tdM';
const COUPLES = ['Shared code','Partner one','Partner two','Gift ID','Gift','Recipient','Email','Phone','Postcode','Address','Delivery note','Status','Tracking','Created at','Updated at','QR link'];

export function setup({mailQuota = 100, extraRsvpRows = []} = {}) {
  // Same columns as the real RSVP sheet ("Shared code" holds the gift code).
  const H = ['Timestamp','Language','Attending','Shared code','Relationship','Name','Kana / Reading','Party size','Guest name(s)','Kids','Station','Allergy / dietary notes','2次会 (afterparty)','Message'];
  const guest = (name, partner, attending, party) => H.map(h => ({Name: name, 'Guest name(s)': partner, Attending: attending, 'Party size': party, Language: 'en'})[h] ?? '');
  const rsvp = new Sheet('RSVPs', [
    H,
    guest('Aye Aye', 'Ko Ko', 'Yes', '2'),
    guest('Su Su', '', 'Yes, happily', '1'),
    guest('Not Coming', '', 'No', '1'),
    guest('', '', 'Yes', '2'),
    ...extraRsvpRows,
  ]);
  const couples = new Sheet('Couples', [COUPLES], 16);
  const books = {[GIFT_ID]: new Book(GIFT_ID, {Couples: couples}), [RSVP_ID]: new Book(RSVP_ID, {RSVPs: rsvp})};
  const props = {GIFT_SHEET_ID: GIFT_ID, RSVP_SHEET_ID: RSVP_ID}, cache = {}, mail = [], notices = [];
    const ctx = {
    console: {log() {}, warn() {}, error() {}},
    SpreadsheetApp: {openById: id => books[id], flush() {}},
    LockService: {getScriptLock: () => { let held = false; return {tryLock: () => (held = true), waitLock: () => { held = true; }, hasLock: () => held, releaseLock: () => { held = false; }}; }},
    PropertiesService: {getScriptProperties: () => ({getProperty: k => props[k] ?? null, setProperty: (k, v) => { props[k] = v; }})},
    CacheService: {getScriptCache: () => ({get: k => cache[k] ?? null, put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; }, removeAll: ks => ks.forEach(k => { delete cache[k]; })})},
    MailApp: {getRemainingDailyQuota: () => mailQuota - mail.length, sendEmail: m => { if (ctx.MailApp.getRemainingDailyQuota() < 1) throw new Error('quota'); (m.to === OWNER ? notices : mail).push(m); }},
    Session: {getEffectiveUser: () => ({getEmail: () => OWNER})},
    Utilities: {getUuid: () => randomUUID(), formatDate: (d, tz, fmt) => {
      const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).formatToParts(d).map(x => [x.type, x.value]));
      return fmt.replace('yyyy', p.year).replace('MM', p.month).replace('dd', p.day).replace('HH', p.hour).replace('mm', p.minute);
    }},
    ContentService: {MimeType: {JSON: 'json'}, createTextOutput: s => ({setMimeType() { return this; }, text: s})},
  };
  vm.createContext(ctx);
  vm.runInContext(source.replace('const GIFT_ROWS_TO_ISSUE = [];', 'var GIFT_ROWS_TO_ISSUE = [2,3];'), ctx);
  ctx.setupGiftStandalone();
  ctx.issueGiftCodesForConfiguredRows();
  const book = books[GIFT_ID];
  const post = body => JSON.parse(ctx.doPost({postData: {contents: JSON.stringify(body)}}).text);
  const header = rsvp.data[0];
  const codeIndex = header.indexOf('Shared code');
  const codeOf = row => rsvp.data[row - 1][codeIndex];
  const setSetting = (key, value) => { const s = book.sheets['Gift settings']; const r = s.data.findIndex(x => x[0] === key); s.data[r][1] = value; ctx.refreshCatalogueNow(); };
  return {ctx, books, book, rsvp, couples, props, mail, notices, post, codeOf, codeIndex, setSetting};
}
