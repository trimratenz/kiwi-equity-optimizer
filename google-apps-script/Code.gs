/** TrimRate Google Sheets receiver. Deploy as a Web app that runs as you. */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const request = JSON.parse(e.postData.contents || '{}');
    const secret = PropertiesService.getScriptProperties().getProperty('TRIMRATE_WEBHOOK_SECRET');
    const spreadsheetId = PropertiesService.getScriptProperties().getProperty('TRIMRATE_SPREADSHEET_ID');
    if (!secret || !spreadsheetId || !request.payload || !request.signature) return reply({ ok: false, error: 'Server not configured.' });
    const expected = Utilities.computeHmacSha256Signature(request.payload, secret).map(byte => ('0' + (byte & 255).toString(16)).slice(-2)).join('');
    if (!constantTimeEquals(expected, request.signature)) return reply({ ok: false, error: 'Invalid signature.' });
    const message = JSON.parse(request.payload);
    const age = Math.abs(Date.now() - new Date(message.timestamp).getTime());
    if (!message.timestamp || Number.isNaN(age) || age > 5 * 60 * 1000) return reply({ ok: false, error: 'Expired request.' });
    const book = SpreadsheetApp.openById(spreadsheetId);
    if (message.action === 'lead') saveLead(book, message.data || {});
    else if (message.action === 'activity') saveActivity(book, message.data || {});
    else return reply({ ok: false, error: 'Unsupported action.' });
    return reply({ ok: true });
  } catch (error) { console.error(error); return reply({ ok: false, error: 'Unable to save record.' }); }
  finally { try { lock.releaseLock(); } catch (_) {} }
}

function saveLead(book, data) {
  book.getSheetByName('Leads').appendRow([data.id, data.session_id, data.created_at, data.name, data.email, data.phone, data.property_address, data.current_bank, data.preferred_contact_method, 'Consented', stringify(data.loan_details), stringify(data.calculated_summary), stringify(data.market_comparison), stringify(data.ocr_forecast_summary), data.user_notes, data.referral_status || 'New']);
  if (data.session_id) linkLead(book, data.session_id, data.id);
}

function saveActivity(book, data) {
  const sheet = book.getSheetByName('Activity');
  const now = data.created_at || new Date().toISOString();
  const eventKey = [data.event_name || 'activity_updated', data.page_path || '/', data.step_number || ''].join(':');
  const row = findSessionRow(sheet, data.session_id);
  const activity = data.activity || {};
  if (!row) {
    sheet.appendRow([data.session_id, data.visitor_id, now, now, data.event_name === 'page_view' ? 1 : 0, data.page_path || '/', data.step_number || '', stringify(activity.inputs), stringify([eventKey]), stringify(activity.outputs), stringify(errorsFor(data)), completionFor(data), 'Not consented', '']);
    return;
  }
  const existing = sheet.getRange(row, 1, 1, 14).getValues()[0];
  const changes = parseJson(existing[8], []);
  const isNewEvent = changes.indexOf(eventKey) === -1;
  if (isNewEvent) changes.push(eventKey);
  const errors = parseJson(existing[10], []);
  errorsFor(data).forEach(error => { if (errors.indexOf(error) === -1) errors.push(error); });
  const pageViews = Number(existing[4] || 0) + (isNewEvent && data.event_name === 'page_view' ? 1 : 0);
  const values = [[data.session_id, data.visitor_id || existing[1], existing[2] || now, now, pageViews, data.page_path || existing[5], data.step_number || existing[6], stringify(activity.inputs || parseJson(existing[7], {})), stringify(changes.slice(-40)), stringify(activity.outputs || parseJson(existing[9], {})), stringify(errors.slice(-20)), completionFor(data, existing[11]), existing[12] || 'Not consented', existing[13] || '']];
  sheet.getRange(row, 1, 1, 14).setValues(values);
}

function linkLead(book, sessionId, leadId) {
  const sheet = book.getSheetByName('Activity');
  const row = findSessionRow(sheet, sessionId);
  if (row) sheet.getRange(row, 13, 1, 2).setValues([['Consented', leadId]]);
  else sheet.appendRow([sessionId, '', '', new Date().toISOString(), 0, '', '', '{}', '[]', '{}', '[]', 'Lead submitted', 'Consented', leadId]);
}

function findSessionRow(sheet, sessionId) { if (!sessionId) return 0; const cell = sheet.getRange('A2:A').createTextFinder(sessionId).matchEntireCell(true).findNext(); return cell ? cell.getRow() : 0; }
function errorsFor(data) { return /failed|error/i.test(data.event_name || '') ? [data.event_name] : []; }
function completionFor(data, existing) { if (data.event_name === 'lead_submitted') return 'Lead submitted'; if (data.event_name === 'step_6_completed' || data.event_name === 'summary_viewed') return 'Calculator completed'; return existing || 'In progress'; }
function parseJson(value, fallback) { try { return value ? JSON.parse(value) : fallback; } catch (_) { return fallback; } }
function stringify(value) { return JSON.stringify(value || {}); }
function reply(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
function constantTimeEquals(a, b) { if (a.length !== b.length) return false; let result = 0; for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i); return result === 0; }
