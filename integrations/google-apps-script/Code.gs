// Deploy this as a Google Apps Script web app executing as the sheet owner.
// The deployment must be accessible to anyone who scans the QR.
const SPREADSHEET_ID = '1Uaqxyh7Y5EjUj-5hjf67N79x0Mw2OraxFjlJ9TY7qvM';
const SHEET_NAME = 'Responses';
// Only this destination is used; arbitrary redirects are never accepted.
const APP_BASE = 'https://susanthavfx-art.github.io/WebAR01/';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (!UUID.test(p.p || '') || !UUID.test(p.state || '') || !['0', '1'].includes(p.camera)) {
    return HtmlService.createHtmlOutput('This AR link is incomplete. Please scan the QR again.');
  }
  const view = HtmlService.createTemplateFromFile('Index');
  view.publicationId = p.p;
  view.state = p.state;
  view.camera = p.camera;
  return view.evaluate().setTitle('Welcome to WonderLab').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function safeText(value) {
  // Sheets treats strings beginning with = as formulas. Also protect other
  // spreadsheet formula prefixes, including phone numbers beginning with +.
  const str = String(value || '').trim();
  return /^[=+\-@]/.test(str) ? "'" + str : str;
}

function submitVisitor(input) {
  if (!input || !UUID.test(input.publicationId || '') || !UUID.test(input.state || '') || !['0', '1'].includes(input.camera)) throw new Error('Invalid AR link. Please scan the QR again.');
  const name = String(input.name || '').trim();
  const job = String(input.job || '').trim();
  let phone = String(input.whatsapp || '').replace(/[\s()-]/g, '');
  if (/^0\d{9}$/.test(phone)) phone = '+94' + phone.slice(1);
  if (!name || name.length > 100 || !job || job.length > 100 || /[\r\n]/.test(name + job)) throw new Error('Please enter your name and job or role (up to 100 characters each).');
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error('Enter a valid WhatsApp number, for example 0771234567 or +94771234567.');
  if (input.adult !== true) throw new Error('An adult must complete this form.');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('Response sheet not found.');
    // Deduplicate retries after a timeout. The random state is unique per visit.
    const last = sheet.getLastRow();
    const previous = last > 1 ? sheet.getRange(2, 7, last - 1, 1).getValues().flat() : [];
    if (!previous.includes(input.state)) {
      sheet.appendRow([new Date(), safeText(name), safeText(job), safeText(phone), input.marketing === true ? 'Yes' : 'No', input.publicationId, input.state]);
      SpreadsheetApp.flush();
    }
  } finally { lock.releaseLock(); }
  return APP_BASE + '#page=collection&p=' + encodeURIComponent(input.publicationId) + '&camera=' + input.camera + '&visitorComplete=' + encodeURIComponent(input.state);
}
