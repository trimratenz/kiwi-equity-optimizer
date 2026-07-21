/** TrimRate Google Sheets receiver. Deploy as a Web app that runs as you. */
const LEAD_LEGACY_HEADERS = ['Lead ID', 'Session ID', 'Created At', 'Name', 'Email', 'Phone', 'Property Address', 'Current Bank', 'Preferred Contact Method', 'Consent Status', 'Loan Details JSON', 'Calculated Summary JSON', 'Market Comparison JSON', 'OCR Forecast Summary JSON', 'User Notes', 'Referral Status'];
const LEAD_ADDITIONAL_HEADERS = ['Visitor ID', 'Page Path', 'Device Type', 'Referrer', 'UTM Source', 'UTM Medium', 'UTM Campaign', 'Consent Timestamp', 'Consent Text', 'Submission Timestamp', 'Summary Version', 'Calculation Engine Version', 'Market Rate Snapshot ID', 'Market Rate Snapshot Metadata JSON', 'OCR Forecast Snapshot ID', 'OCR Forecast Snapshot Metadata JSON', 'Loan Balance', 'Monthly Repayment', 'Weighted Interest Rate', 'Fixed Term Months', 'Next Refix Months', 'Scenario Repayment Change Monthly', 'Market Repayment Change Monthly'];
const ACTIVITY_LEGACY_HEADERS = ['Session ID', 'Visitor ID', 'First Seen At', 'Last Seen At', 'Page Views', 'Last Page Path', 'Last Step Number', 'Inputs JSON', 'Event Keys JSON', 'Outputs JSON', 'Errors JSON', 'Completion Status', 'Consent Status', 'Lead ID'];
const ACTIVITY_ADDITIONAL_HEADERS = ['Last Event Name', 'Last Device Type', 'Last Referrer', 'UTM Source', 'UTM Medium', 'UTM Campaign', 'Market Rate Snapshot ID', 'Market Rate Snapshot Metadata JSON', 'OCR Forecast Snapshot ID', 'OCR Forecast Snapshot Metadata JSON'];
const ACTIVITY_EVENT_HEADERS = ['Event ID', 'Event Timestamp', 'Session ID', 'Visitor ID', 'Page Path', 'Event Name', 'Step Number', 'Step Name', 'Device Type', 'Referrer', 'UTM Source', 'UTM Medium', 'UTM Campaign', 'Inputs JSON', 'Outputs JSON', 'Market Rate Snapshot ID', 'Market Rate Snapshot Metadata JSON', 'OCR Forecast Snapshot ID', 'OCR Forecast Snapshot Metadata JSON'];

function doGet() { return reply({ ok: true, status: 'TrimRate webhook is online. Send signed POST requests to save data.' }); }

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    // Clicking Run in the Apps Script editor does not provide an event object.
    // This endpoint is intentionally invoked only by a deployed Web App POST.
    if (!e || !e.postData || !e.postData.contents) return reply({ ok: false, error: 'Use the deployed Web App URL for POST tests; the editor Run button does not send request data.' });
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
    ensureTrimRateWorkbook(book);
    if (message.action === 'lead') saveLead(book, message.data || {});
    else if (message.action === 'activity') saveActivity(book, message.data || {});
    else return reply({ ok: false, error: 'Unsupported action.' });
    return reply({ ok: true });
  } catch (error) { console.error(error); return reply({ ok: false, error: 'Unable to save record.' }); }
  finally { try { lock.releaseLock(); } catch (_) {} }
}

/** Run manually once after setting Script Properties. It only creates missing tabs/headers and never clears existing data. */
function setupTrimRateWorkbook() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('TRIMRATE_SPREADSHEET_ID');
  if (!spreadsheetId) throw new Error('Set TRIMRATE_SPREADSHEET_ID in Script Properties first.');
  ensureTrimRateWorkbook(SpreadsheetApp.openById(spreadsheetId));
}

function ensureTrimRateWorkbook(book) {
  ensureSchemaSheet(book, 'Leads', LEAD_LEGACY_HEADERS, LEAD_ADDITIONAL_HEADERS);
  ensureSchemaSheet(book, 'Activity', ACTIVITY_LEGACY_HEADERS, ACTIVITY_ADDITIONAL_HEADERS);
  ensureSchemaSheet(book, 'Activity Events', ACTIVITY_EVENT_HEADERS, []);
  ensureDashboardTemplate(book);
}

function ensureSchemaSheet(book, name, legacyHeaders, additionalHeaders) {
  let sheet = book.getSheetByName(name);
  if (!sheet) sheet = book.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, legacyHeaders.length + additionalHeaders.length).setValues([legacyHeaders.concat(additionalHeaders)]);
    sheet.setFrozenRows(1);
    return sheet;
  }
  // Existing workbooks keep their original columns and order. New fields are appended only.
  const existingHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getDisplayValues()[0];
  additionalHeaders.forEach(header => {
    if (existingHeaders.indexOf(header) === -1) {
      const column = sheet.getLastColumn() + 1;
      sheet.getRange(1, column).setValue(header);
      existingHeaders.push(header);
    }
  });
  return sheet;
}

function saveLead(book, data) {
  const sheet = book.getSheetByName('Leads');
  const base = [data.id, data.session_id, toSheetDate(data.created_at), data.name, data.email, data.phone, data.property_address, data.current_bank, data.preferred_contact_method, data.consent_given ? 'Consented' : '', stringify(data.loan_details), stringify(data.calculated_summary), stringify(data.market_comparison), stringify(data.ocr_forecast_summary), data.user_notes, data.referral_status || 'New'];
  const derived = leadDerived(data);
  const extra = [data.visitor_id, data.page_path, data.device_type, data.referrer, data.utm_source, data.utm_medium, data.utm_campaign, toSheetDate(data.consent_timestamp), data.consent_text, toSheetDate(data.submission_timestamp || data.created_at), data.summary_version, data.calculation_engine_version, data.market_rate_snapshot_id, stringify(data.market_rate_snapshot), data.ocr_forecast_snapshot_id, stringify(data.ocr_forecast_snapshot), derived.loanBalance, derived.monthlyRepayment, derived.weightedRate, derived.fixedTermMonths, derived.nextRefixMonths, derived.scenarioRepaymentChange, derived.marketRepaymentChange];
  appendLegacyAndAdditional(sheet, base, LEAD_ADDITIONAL_HEADERS, extra);
  if (data.session_id) linkLead(book, data.session_id, data.id);
}

function saveActivity(book, data) {
  const sheet = book.getSheetByName('Activity');
  const now = toSheetDate(data.created_at);
  const eventKey = [data.event_name || 'activity_updated', data.page_path || '/', data.step_number || ''].join(':');
  const row = findSessionRow(sheet, data.session_id);
  const activity = sanitizeActivity(data.activity || {});
  if (!row) {
    const base = [data.session_id, data.visitor_id, now, now, data.event_name === 'page_view' ? 1 : 0, data.page_path || '/', data.step_number || '', stringify(activity.inputs), stringify([eventKey]), stringify(activity.outputs), stringify(errorsFor(data)), completionFor(data), 'Not consented', ''];
    const extra = activityExtras(data);
    appendLegacyAndAdditional(sheet, base, ACTIVITY_ADDITIONAL_HEADERS, extra);
  } else {
    const existing = sheet.getRange(row, 1, 1, Math.max(sheet.getLastColumn(), 14)).getValues()[0];
    const changes = parseJson(existing[8], []);
    const isNewEvent = changes.indexOf(eventKey) === -1;
    if (isNewEvent) changes.push(eventKey);
    const errors = parseJson(existing[10], []);
    errorsFor(data).forEach(error => { if (errors.indexOf(error) === -1) errors.push(error); });
    const pageViews = Number(existing[4] || 0) + (isNewEvent && data.event_name === 'page_view' ? 1 : 0);
    const base = [data.session_id, data.visitor_id || existing[1], existing[2] || now, now, pageViews, data.page_path || existing[5], data.step_number || existing[6], stringify(activity.inputs || parseJson(existing[7], {})), stringify(changes.slice(-40)), stringify(activity.outputs || parseJson(existing[9], {})), stringify(errors.slice(-20)), completionFor(data, existing[11]), existing[12] || 'Not consented', existing[13] || ''];
    writeLegacyAndAdditional(sheet, row, base, ACTIVITY_ADDITIONAL_HEADERS, activityExtras(data));
  }
  // Event-level data is additive and deliberately excludes direct contact details.
  book.getSheetByName('Activity Events').appendRow([data.id, now, data.session_id, data.visitor_id, data.page_path || '/', data.event_name, data.step_number || '', data.step_name || '', data.device_type || '', data.referrer || '', data.utm_source || '', data.utm_medium || '', data.utm_campaign || '', stringify(activity.inputs), stringify(activity.outputs), data.market_rate_snapshot_id || '', stringify(data.market_rate_snapshot), data.ocr_forecast_snapshot_id || '', stringify(data.ocr_forecast_snapshot)]);
}

function linkLead(book, sessionId, leadId) {
  const sheet = book.getSheetByName('Activity');
  const row = findSessionRow(sheet, sessionId);
  if (row) sheet.getRange(row, 13, 1, 2).setValues([['Consented', leadId]]);
  else appendLegacyAndAdditional(sheet, [sessionId, '', '', new Date(), 0, '', '', '{}', '[]', '{}', '[]', 'Lead submitted', 'Consented', leadId], ACTIVITY_ADDITIONAL_HEADERS, activityExtras({ event_name: 'lead_submitted' }));
}

function appendLegacyAndAdditional(sheet, base, additionalHeaders, extras) {
  const row = sheet.getLastRow() + 1;
  writeLegacyAndAdditional(sheet, row, base, additionalHeaders, extras);
}

function writeLegacyAndAdditional(sheet, row, base, additionalHeaders, extras) {
  const width = Math.max(sheet.getLastColumn(), base.length);
  const values = Array(width).fill('');
  base.forEach((value, index) => { values[index] = value; });
  const headers = sheet.getRange(1, 1, 1, width).getDisplayValues()[0];
  additionalHeaders.forEach((header, index) => {
    const column = headers.indexOf(header);
    if (column >= 0) values[column] = extras[index] === undefined ? '' : extras[index];
  });
  sheet.getRange(row, 1, 1, width).setValues([values]);
}

function activityExtras(data) { return [data.event_name || '', data.device_type || '', data.referrer || '', data.utm_source || '', data.utm_medium || '', data.utm_campaign || '', data.market_rate_snapshot_id || '', stringify(data.market_rate_snapshot), data.ocr_forecast_snapshot_id || '', stringify(data.ocr_forecast_snapshot)]; }
function leadDerived(data) {
  const input = data.loan_details || {};
  const output = data.calculated_summary || {};
  const parts = Array.isArray(input.loanParts) ? input.loanParts : [];
  const fixedTerms = parts.map(part => numberOrBlank(part.fixedTermMonths)).filter(value => value !== '');
  const refixMonths = parts.map(part => numberOrBlank(part.fixedEndsInMonths)).filter(value => value !== '' && value >= 0);
  const marketRows = (data.market_comparison || {}).rows || [];
  return {
    loanBalance: numberOrBlank(input.loanBalance),
    monthlyRepayment: numberOrBlank(output.currentMonthlyRepayment),
    weightedRate: numberOrBlank(output.weightedAverageRate),
    fixedTermMonths: fixedTerms.length ? fixedTerms[0] : '',
    nextRefixMonths: refixMonths.length ? Math.min.apply(null, refixMonths) : '',
    scenarioRepaymentChange: numberOrBlank((data.ocr_forecast_summary || {}).estimatedMonthlyImpact),
    marketRepaymentChange: numberOrBlank(marketRows[0] && marketRows[0].estimatedMonthlyImpact)
  };
}
function numberOrBlank(value) { const number = Number(value); return Number.isFinite(number) ? number : ''; }
function sanitizeActivity(value) { return { inputs: removePersonalData(value.inputs || {}), outputs: removePersonalData(value.outputs || {}) }; }
function removePersonalData(value) {
  if (Array.isArray(value)) return value.map(removePersonalData);
  if (!value || typeof value !== 'object') return value;
  const clean = {};
  Object.keys(value).forEach(key => { if (!/(name|email|phone|address|contact|property)/i.test(key)) clean[key] = removePersonalData(value[key]); });
  return clean;
}
function toSheetDate(value) { const date = new Date(value || Date.now()); return Number.isNaN(date.getTime()) ? new Date() : date; }

function ensureDashboardTemplate(book) {
  let sheet = book.getSheetByName('Dashboard');
  if (sheet) return; // Never overwrite a manually maintained dashboard.
  sheet = book.insertSheet('Dashboard');
  const rows = [
    ['TrimRate aggregate reporting dashboard', ''],
    ['Use only aggregate results when sharing with mortgage brokers. Do not expose names, email addresses, phone numbers, property addresses, or other personal details without explicit permission.', ''],
    ['', ''],
    ['Metric', 'Value'],
    ['Total calculator sessions', '=COUNTA(Activity!A2:A)'],
    ['Completed lead requests', '=COUNTA(Leads!A2:A)'],
    ['Lead conversion rate', '=IFERROR(B6/B5,0)'],
    ['Last submission/activity', '=IFERROR(MAX(Leads!C2:C,Activity!D2:D),"")'],
    ['', ''],
    ['Leads by current bank', ''],
    ['Current bank', 'Lead requests'],
    ['=QUERY(Leads!A2:P,"select H, count(A) where H is not null group by H label H \'Current bank\', count(A) \'Lead requests\'",0)', ''],
    ['', ''],
    ['Loan balance distribution', ''],
    ['Loan balance', 'Lead requests'],
    ['=QUERY(Leads!AG2:AG,"select AG, count(AG) where AG is not null group by AG label AG \'Loan balance\', count(AG) \'Lead requests\'",0)', ''],
    ['', ''],
    ['Repayment, rate, fixed-term and refix-time distributions', ''],
    ['Monthly repayment', 'Weighted rate'],
    ['=QUERY({Leads!AH2:AH,Leads!AI2:AI},"select Col1, Col2 where Col1 is not null label Col1 \'Monthly repayment\', Col2 \'Weighted rate\'",0)', ''],
    ['Fixed term months', 'Next refix months'],
    ['=QUERY({Leads!AJ2:AJ,Leads!AK2:AK},"select Col1, Col2 where Col1 is not null label Col1 \'Fixed term months\', Col2 \'Next refix months\'",0)', ''],
    ['', ''],
    ['Average repayment change by scenario', ''],
    ['Scenario monthly change', '=IFERROR(AVERAGE(Leads!AL2:AL),"")'],
    ['Market comparison monthly change', '=IFERROR(AVERAGE(Leads!AM2:AM),"")'],
    ['', ''],
    ['Activity trend by week', ''],
    ['Year / Week / Events', ''],
    ['=QUERY({\'Activity Events\'!B2:B,\'Activity Events\'!C2:C},"select year(Col1), week(Col1), count(Col2) where Col1 is not null group by year(Col1), week(Col1) label year(Col1) \'Year\', week(Col1) \'Week\', count(Col2) \'Events\'",0)', ''],
    ['', ''],
    ['Activity trend by month', ''],
    ['Year / Month / Events', ''],
    ['=QUERY({\'Activity Events\'!B2:B,\'Activity Events\'!C2:C},"select year(Col1), month(Col1), count(Col2) where Col1 is not null group by year(Col1), month(Col1) label year(Col1) \'Year\', month(Col1) \'Month\', count(Col2) \'Events\'",0)', '']
  ];
  sheet.getRange(1, 1, rows.length, 2).setValues(rows);
  sheet.getRange('B7').setNumberFormat('0.0%');
  sheet.getRange('B8').setNumberFormat('yyyy-mm-dd hh:mm');
  sheet.setFrozenRows(4);
  sheet.autoResizeColumns(1, 2);
}

function findSessionRow(sheet, sessionId) { if (!sessionId) return 0; const cell = sheet.getRange('A2:A').createTextFinder(sessionId).matchEntireCell(true).findNext(); return cell ? cell.getRow() : 0; }
function errorsFor(data) { return /failed|error/i.test(data.event_name || '') ? [data.event_name] : []; }
function completionFor(data, existing) { if (data.event_name === 'lead_submitted') return 'Lead submitted'; if (data.event_name === 'step_6_completed' || data.event_name === 'summary_viewed') return 'Calculator completed'; return existing || 'In progress'; }
function parseJson(value, fallback) { try { return value ? JSON.parse(value) : fallback; } catch (_) { return fallback; } }
function stringify(value) { return JSON.stringify(value || {}); }
function reply(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
function constantTimeEquals(a, b) { if (a.length !== b.length) return false; let result = 0; for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i); return result === 0; }
