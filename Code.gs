const PLACEMENT_CONFIG = Object.freeze({
  spreadsheetId: '1aTftCK6eF_gLPYueH-TH7nt4Pc0Ew247xfF49a91eK4',
  pdfFolderId: '171mw0cN5K22tjsTfAHrKhqPbD7ZjPV9W',
  sessionsSheet: 'Sessions',
  payloadsSheet: 'StagePayloads',
  logSheet: 'SyncLog'
});

const SESSION_HEADERS = [
  'submission_id', 'sync_token_hash', 'student_name', 'exact_age', 'age_range',
  'audience', 'parent_email', 'branch', 'registered_at', 'session_status',
  'child_confirmed', 'guardian_confirmed', 'consent_accepted_at', 'terms_version',
  'current_stage', 'current_question', 'last_activity_at', 'stage1_status',
  'stage1_completed_at', 'stage2_status', 'stage2_completed_at', 'stage3_status',
  'stage3_completed_at', 'assigned_module', 'potential_module', 'assigned_level',
  'lv3_candidate', 'final_status', 'final_completed_at', 'pdf_file_id',
  'pdf_file_url', 'email_status', 'email_sent_at', 'last_error', 'updated_at'
];

const PAYLOAD_HEADERS = [
  'operation_id', 'submission_id', 'stage', 'status', 'revision',
  'payload_json', 'saved_at', 'received_at'
];

const LOG_HEADERS = [
  'received_at', 'operation_id', 'submission_id', 'action',
  'status', 'message'
];

function setupPlacementStorage() {
  const spreadsheet = SpreadsheetApp.openById(PLACEMENT_CONFIG.spreadsheetId);
  const sessions = ensureSheet_(spreadsheet, PLACEMENT_CONFIG.sessionsSheet, SESSION_HEADERS);
  const payloads = ensureSheet_(spreadsheet, PLACEMENT_CONFIG.payloadsSheet, PAYLOAD_HEADERS);
  const log = ensureSheet_(spreadsheet, PLACEMENT_CONFIG.logSheet, LOG_HEADERS);

  [sessions, payloads, log].forEach(sheet => {
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, sheet.getLastColumn())
      .setFontWeight('bold')
      .setBackground('#e8eaed')
      .setWrap(true);
    sheet.autoResizeColumns(1, sheet.getLastColumn());
    if (!sheet.getFilter()) {
      sheet.getRange(1, 1, Math.max(sheet.getMaxRows(), 2), sheet.getLastColumn()).createFilter();
    }
  });

  return {
    spreadsheetUrl: spreadsheet.getUrl(),
    sheets: [sessions.getName(), payloads.getName(), log.getName()]
  };
}

function doGet(event) {
  const action = event?.parameter?.action;
  if (action === 'get_branches' || action === 'get_dropdowns') {
    try {
      const spreadsheet = SpreadsheetApp.openById(PLACEMENT_CONFIG.spreadsheetId);
      const sheet = spreadsheet.getSheetByName('DROPDOWNS');
      if (!sheet) throw new Error('Sheet DROPDOWNS not found');
      const lastRow = sheet.getLastRow();
      if (lastRow < 5) return json_({ ok: true, branches: ['Online'] });
      // Branch names start at row 5 in Column A
      const data = sheet.getRange(5, 1, lastRow - 4, 1).getValues();
      const branches = data
        .map(r => String(r[0] || '').trim())
        .filter(val => val !== '' && val !== 'BAC/EAC Branch Name');
      return json_({ ok: true, branches: branches });
    } catch (error) {
      return json_({ ok: false, error: String(error.message || error) });
    }
  }

  if (action === 'get_branch_results') {
    try {
      const token = event?.parameter?.token;
      const result = getBranchResults_({ token });
      return json_({ ok: true, ...result });
    } catch (error) {
      return json_({ ok: false, error: String(error.message || error) });
    }
  }

  return json_({
    ok: true,
    service: 'Kalananti Placement Test',
    version: 2,
    capabilities: {
      visualPdfAttachment: true,
      legacyPdfFallback: false,
      branchDashboard: true
    }
  });
}

function doPost(event) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  let operation = null;
  try {
    operation = JSON.parse(event?.postData?.contents || '{}');
    const action = operation.action;

    // Handle branch dashboard actions
    if (action === 'request_dashboard_access') {
      const result = requestDashboardAccess_(operation);
      return json_({ ok: true, ...result });
    } else if (action === 'login_dashboard') {
      const result = loginDashboard_(operation);
      return json_({ ok: true, ...result });
    } else if (action === 'get_branch_results') {
      const result = getBranchResults_(operation);
      return json_({ ok: true, ...result });
    } else if (action === 'update_email_status') {
      const result = updateEmailStatus_(operation);
      return json_({ ok: true, ...result });
    } else if (action === 'logout_dashboard') {
      const result = logoutDashboard_(operation);
      return json_({ ok: true, ...result });
    }

    // Default placement test operations
    validateOperation_(operation);

    let result;
    if (action === 'register') result = register_(operation);
    else if (action === 'save_stage') result = saveStage_(operation);
    else if (action === 'finalize') result = finalize_(operation);
    else throw new Error('unsupported_action');

    appendLog_(operation, 'success', '');
    return json_({ ok: true, ...result });
  } catch (error) {
    if (operation?.submissionId) appendLog_(operation, 'error', String(error.message || error));
    return json_({ ok: false, error: String(error.message || error) });
  } finally {
    lock.releaseLock();
  }
}

function register_(operation) {
  const registration = operation.payload || {};
  const student = registration.student || registration;
  const consent = registration.consent || {};
  const sheet = getSheet_(PLACEMENT_CONFIG.sessionsSheet);
  const found = findSession_(sheet, operation.submissionId);
  const now = new Date().toISOString();
  const values = {
    submission_id: operation.submissionId,
    sync_token_hash: hash_(operation.syncToken),
    student_name: student.name || '',
    exact_age: Number(student.exactAge) || '',
    age_range: student.ageRange || '',
    audience: student.audienceGroup || '',
    parent_email: student.parentEmail || '',
    branch: student.branch || '',
    registered_at: registration.registeredAt || now,
    session_status: 'in_progress',
    child_confirmed: consent.childConfirmed === true ? 'TRUE' : 'FALSE',
    guardian_confirmed: consent.guardianConfirmed === true ? 'TRUE' : 'FALSE',
    consent_accepted_at: consent.acceptedAt || now,
    terms_version: consent.termsVersion || 'placement-tnc-v1',
    current_stage: 1,
    current_question: 0,
    last_activity_at: now,
    updated_at: now
  };
  upsertSession_(sheet, found, values);
  return { registered: true, submissionId: operation.submissionId };
}

function saveStage_(operation) {
  const sheet = getSheet_(PLACEMENT_CONFIG.sessionsSheet);
  const found = requireAuthorizedSession_(sheet, operation);
  if (operationExists_(operation.operationId)) {
    return { saved: true, duplicate: true, stage: operation.stage };
  }

  const payload = operation.payload || {};
  const stage = Number(operation.stage || payload.stage);
  if (![1, 2, 3].includes(stage)) throw new Error('invalid_stage');

  getSheet_(PLACEMENT_CONFIG.payloadsSheet).appendRow([
    operation.operationId,
    operation.submissionId,
    stage,
    payload.status || 'completed',
    String(operation.revision || ''),
    JSON.stringify(payload.data || payload),
    payload.savedAt || '',
    new Date().toISOString()
  ]);

  const data = payload.data || {};
  const values = {
    session_status: 'in_progress',
    current_stage: payload.status === 'completed' ? Math.min(stage + 1, 3) : stage,
    current_question: Number(data.currentQuestionIndex ?? data.index ?? data.current ?? 0),
    last_activity_at: payload.savedAt || new Date().toISOString(),
    [`stage${stage}_status`]: payload.status || 'completed',
    updated_at: new Date().toISOString()
  };
  if (payload.status === 'completed') {
    values[`stage${stage}_completed_at`] = data.completedAt || payload.savedAt || new Date().toISOString();
  }
  if (stage === 1) {
    values.assigned_module = data.assignedModule || data.recommendedModule || '';
    values.potential_module = data.potentialModule || '';
  }
  if (stage === 2) {
    values.assigned_level = data.assignedLevel || data.level || data.automaticPlacement || '';
    values.lv3_candidate = data.lv3Candidate === true;
  }
  upsertSession_(sheet, found, values);
  return { saved: true, duplicate: false, stage };
}

function finalize_(operation) {
  const sheet = getSheet_(PLACEMENT_CONFIG.sessionsSheet);
  const found = requireAuthorizedSession_(sheet, operation);
  const row = sessionObject_(sheet, found.row);
  const payload = operation.payload || {};
  const hasVisualPdf = Boolean(payload?.pdfAttachment?.base64);
  if (row.final_status === 'completed' && row.pdf_file_url) {
    let existingIsLegacyPdf = false;
    try {
      const existingName = row.pdf_file_id
        ? DriveApp.getFileById(row.pdf_file_id).getName()
        : '';
      existingIsLegacyPdf = /^Placement Test - /i.test(existingName);
    } catch (error) {}
    if (!(hasVisualPdf && existingIsLegacyPdf)) {
      return {
        finalized: true,
        duplicate: true,
        pdfUrl: row.pdf_file_url,
        pdfSource: existingIsLegacyPdf ? 'legacy_fallback' : 'browser_attachment'
      };
    }
  }

  const parentEmail = payload.parentEmail || row.parent_email;
  if (!parentEmail) throw new Error('missing_parent_email');
  if (!hasVisualPdf) throw new Error('missing_visual_pdf_attachment');

  const pdf = createResultPdf_(operation.submissionId, row, payload);
  
  // Note: Email is NOT sent automatically upon test completion.
  // Default status is 'not sent' until triggered via Spreadsheet Column AF or Dashboard dropdown.
  const emailStatus = 'not sent';
  const emailSentAt = '';
  const emailError = '';

  upsertSession_(sheet, found, {
    session_status: 'completed',
    final_status: 'completed',
    final_completed_at: payload.completedAt || new Date().toISOString(),
    pdf_file_id: pdf.fileId,
    pdf_file_url: pdf.url,
    email_status: emailStatus,
    email_sent_at: emailSentAt,
    last_error: emailError,
    updated_at: new Date().toISOString()
  });

  return {
    finalized: true,
    duplicate: false,
    pdfUrl: pdf.url,
    emailStatus,
    pdfSource: 'browser_attachment'
  };
}

function sendParentEmail_(sheet, rowNumber) {
  const row = sessionObject_(sheet, rowNumber);
  const parentEmail = String(row.parent_email || '').trim();
  if (!parentEmail) {
    upsertSession_(sheet, { row: rowNumber, exists: true }, {
      email_status: 'failed',
      last_error: 'missing_parent_email',
      updated_at: new Date().toISOString()
    });
    throw new Error('missing_parent_email');
  }

  let pdfBlob = null;
  if (row.pdf_file_id) {
    try {
      pdfBlob = DriveApp.getFileById(row.pdf_file_id).getBlob();
    } catch (e) {
      console.warn('Failed to retrieve PDF file by ID: ' + e);
    }
  }

  const pdfUrl = row.pdf_file_url || '';
  const emailBody = buildEmailBody_(row, pdfUrl, null);
  const attachments = pdfBlob ? [pdfBlob] : [];

  try {
    MailApp.sendEmail({
      to: parentEmail,
      subject: `Hasil Placement Test Kalananti - ${row.student_name || 'Siswa'}`,
      htmlBody: emailBody,
      attachments: attachments,
      name: 'Kalananti Placement Test'
    });

    const now = new Date().toISOString();
    upsertSession_(sheet, { row: rowNumber, exists: true }, {
      email_status: 'sent',
      email_sent_at: now,
      last_error: '',
      updated_at: now
    });
    return { sent: true, emailSentAt: now };
  } catch (error) {
    const errorMsg = String(error.message || error);
    upsertSession_(sheet, { row: rowNumber, exists: true }, {
      email_status: 'failed',
      last_error: errorMsg,
      updated_at: new Date().toISOString()
    });
    throw error;
  }
}

function onEdit(e) {
  if (!e || !e.range) return;
  try {
    const sheet = e.range.getSheet();
    if (sheet.getName() !== PLACEMENT_CONFIG.sessionsSheet) return;
    
    // Column 32 is 'email_status' (Column AF)
    const colIndex = SESSION_HEADERS.indexOf('email_status') + 1; // 32
    if (e.range.getColumn() !== colIndex) return;

    const rowNumber = e.range.getRow();
    if (rowNumber <= 1) return; // Skip header

    const val = String(e.value || e.range.getValue() || '').trim().toLowerCase();
    if (val === 'sent' || val === 'send') {
      sendParentEmail_(sheet, rowNumber);
    } else if (val === 'not sent' || val === 'not_sent') {
      upsertSession_(sheet, { row: rowNumber, exists: true }, {
        email_status: 'not sent',
        email_sent_at: '',
        last_error: '',
        updated_at: new Date().toISOString()
      });
    }
  } catch (err) {
    console.error('onEdit trigger error: ' + err);
  }
}

function createResultPdf_(submissionId, row, payload) {
  const folder = DriveApp.getFolderById(PLACEMENT_CONFIG.pdfFolderId);
  const safeName = String(row.student_name || 'Siswa').replace(/[^\w\- ]+/g, '').trim() || 'Siswa';
  const requestedName = String(payload?.pdfAttachment?.filename || '').trim();
  const attachmentName = requestedName
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\.pdf$/i, '')
    .trim();
  const fileName = attachmentName
    ? `${attachmentName} - ${submissionId}.pdf`
    : `Placement Test - ${safeName} - ${submissionId}.pdf`;
  const existing = folder.getFilesByName(fileName);
  if (existing.hasNext()) {
    const file = existing.next();
    return { fileId: file.getId(), url: file.getUrl(), blob: file.getBlob() };
  }

  if (!payload?.pdfAttachment) throw new Error('missing_visual_pdf_attachment');
  const pdfBlob = pdfBlobFromAttachment_(payload.pdfAttachment, fileName);
  const file = folder.createFile(pdfBlob);
  return { fileId: file.getId(), url: file.getUrl(), blob: file.getBlob() };
}

function pdfBlobFromAttachment_(attachment, fileName) {
  if (String(attachment?.mimeType || '') !== MimeType.PDF) {
    throw new Error('invalid_pdf_mime_type');
  }

  const base64 = String(attachment?.base64 || '').replace(/\s+/g, '');
  if (!base64) throw new Error('missing_pdf_attachment');
  if (base64.length > 20 * 1024 * 1024) throw new Error('pdf_attachment_too_large');

  let bytes;
  try {
    bytes = Utilities.base64Decode(base64);
  } catch (error) {
    throw new Error('invalid_pdf_base64');
  }
  if (
    bytes.length < 5
    || bytes[0] !== 37
    || bytes[1] !== 80
    || bytes[2] !== 68
    || bytes[3] !== 70
    || bytes[4] !== 45
  ) {
    throw new Error('invalid_pdf_signature');
  }

  return Utilities.newBlob(bytes, MimeType.PDF, fileName);
}

function buildPdfHtml_(row, payload) {
  const result = payload.result || payload;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif;color:#17324f;padding:34px;line-height:1.55}
    h1{color:#265e9b;margin-bottom:6px}h2{margin-top:24px;color:#1a4576}
    .badge{display:inline-block;background:#fff4bd;padding:7px 12px;border-radius:16px;font-weight:bold}
    .card{border:1px solid #c9ddf1;border-radius:14px;padding:18px;margin-top:14px}
    table{width:100%;border-collapse:collapse}td{padding:8px;border-bottom:1px solid #e6eef6}
  </style></head><body>
    <div class="badge">KALANANTI PLACEMENT TEST</div>
    <h1>Hasil Placement Test ${escapeHtml_(row.student_name || 'Siswa')}</h1>
    <p>Submission ID: ${escapeHtml_(row.submission_id)}</p>
    <div class="card"><table>
      <tr><td>Audience</td><td>${escapeHtml_(row.audience)}</td></tr>
      <tr><td>Assigned Module</td><td>${escapeHtml_(result.assignedModule || row.assigned_module)}</td></tr>
      <tr><td>Potential Module</td><td>${escapeHtml_(result.potentialModule || row.potential_module)}</td></tr>
      <tr><td>Assigned Level</td><td>${escapeHtml_(result.assignedLevel || result.level || row.assigned_level)}</td></tr>
      <tr><td>Status Lv3</td><td>${result.lv3Candidate === true || row.lv3_candidate === true ? 'Kandidat review' : 'Tidak kandidat'}</td></tr>
    </table></div>
    <h2>Ringkasan</h2>
    <p>${escapeHtml_(result.summary || 'Placement test telah diselesaikan. Rekomendasi ini menjadi titik awal perjalanan belajar siswa.')}</p>
    <h2>Learning Path</h2>
    <p>${escapeHtml_((result.learningPathModules || result.learning_path_modules || []).join(' → ') || result.learningPathName || '-')}</p>
  </body></html>`;
}

function buildEmailBody_(row, pdfUrl, payload) {
  const result = (payload && (payload.result || payload)) || {};
  const studentName = escapeHtml_(row.student_name || 'Siswa');
  const submissionId = escapeHtml_(row.submission_id || '-');
  const assignedModule = escapeHtml_(result.assignedModule || row.assigned_module || '-');
  const potentialModule = escapeHtml_(result.potentialModule || row.potential_module || '-');
  const assignedLevel = escapeHtml_(result.assignedLevel || result.level || row.assigned_level || '-');
  const isCandidate = result.lv3Candidate === true || row.lv3_candidate === true || String(row.lv3_candidate).toLowerCase() === 'true';
  const safePdfUrl = escapeHtml_(pdfUrl || '#');
  const summaryText = escapeHtml_(result.summary || 'Placement test telah diselesaikan. Rekomendasi ini menjadi titik awal perjalanan belajar siswa.');

  const statusText = isCandidate
    ? 'KANDIDAT REVIEW EMERGING — Lv3'
    : (assignedLevel.includes('FOUNDATIONAL')
      ? 'STATUS: SIAP MEMBANGUN FONDASI'
      : 'STATUS: SIAP MENGEMBANGKAN KEMAMPUAN MELALUI PROYEK');

  const displayLevel = isCandidate ? 'KANDIDAT REVIEW — Lv3' : assignedLevel;

  const lv3InstructionSection = isCandidate ? `
    <!-- SPECIAL INSTRUCTION CARD FOR LEVEL 3 CANDIDATES -->
    <tr>
      <td style="padding: 24px 24px 0;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f5edff; border: 2px solid #d8b4fe; border-radius: 16px; padding: 20px; text-align: left;">
          <tr>
            <td>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td width="36" valign="top" style="padding-right: 12px;">
                    <span style="font-size: 26px; line-height: 1;">🌟</span>
                  </td>
                  <td valign="top">
                    <strong style="font-size: 16px; color: #5b21b6; display: block; margin-bottom: 6px;">
                      Instruksi Khusus Kandidat Level 3 (Review Portofolio)
                    </strong>
                    <span style="font-size: 14px; color: #4c1d95; line-height: 1.6; display: block;">
                      Selamat Ayah / Bunda! Ananda <strong>${studentName}</strong> terpilih sebagai kandidat untuk langsung masuk ke <strong>Level 3</strong> pada modul <strong>${assignedModule}</strong>.<br><br>
                      Untuk menuntaskan proses evaluasi dan verifikasi Level 3, mohon Ayah / Bunda dapat <strong>membalas (reply) email ini</strong> dengan melampirkan <strong>portofolio atau hasil karya terbaik Ananda</strong> pada modul <strong>${assignedModule}</strong> (seperti foto/video proyek, tangkapan layar karya, file kodingan, atau karya digital yang pernah dibuat Ananda). Tim Akademik Kalananti akan segera melakukan peninjauan.
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>` : '';

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; display: block; }
    body { margin: 0; padding: 0; width: 100% !important; background-color: #e8f2ff; font-family: 'Inter', Arial, sans-serif; color: #17324f; }
  </style>
</head>
<body style="margin: 0; padding: 20px 0; background-color: #e8f2ff; font-family: 'Inter', Arial, sans-serif; color: #17324f;">

  <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width: 640px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 12px 32px rgba(16, 52, 92, 0.12);">
    
    <!-- Top Greeting Banner -->
    <tr>
      <td style="padding: 24px 28px 16px; background-color: #ffffff; text-align: left;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td>
              <p style="margin: 0; font-size: 16px; line-height: 1.5; color: #17324f; font-weight: 600;">
                Halo Ayah / Bunda,
              </p>
              <p style="margin: 8px 0 0; font-size: 15px; line-height: 1.6; color: #365d83;">
                Terima kasih telah mengikutkan <strong style="color: #17324f;">${studentName}</strong> dalam <strong>Placement Test Kalananti</strong>. Seluruh proses evaluasi dan pemetaan potensi belajar Ananda telah berhasil dilakukan.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Pure CSS Space Star Background Header (No Image Dependencies) -->
    <tr>
      <td style="padding: 0 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #173f73 linear-gradient(135deg, #102d56 0%, #265e9b 60%, #2d8fb5 100%); border-radius: 18px; padding: 32px 24px; text-align: center; color: #ffffff;">
          
          <!-- Logo & Meta Row -->
          <tr>
            <td style="padding-bottom: 16px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="left" valign="middle">
                    <img src="https://cdn-web-2.ruangguru.com/landing-pages/assets/545c0426-169c-406f-8775-93afcacef50a.png" alt="Kalananti Logo" width="140" style="background: rgba(255,255,255,0.95); padding: 8px 12px; border-radius: 12px; display: block; border: 0;">
                  </td>
                  <td align="right" valign="middle" style="font-size: 12px; color: #eaf4ff; font-weight: 700; line-height: 1.4;">
                    PLACEMENT REPORT<br>
                    <span style="color: #f9c013;">KALANANTI ACADEMICS</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Status Badge -->
          <tr>
            <td align="center" style="padding-top: 4px;">
              <span style="display: inline-block; padding: 6px 14px; background-color: #eef8f5; color: #287d73; border: 1px solid #a3d9d3; border-radius: 999px; font-size: 12px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">
                ${statusText}
              </span>
            </td>
          </tr>

          <!-- Main Title & Student Name -->
          <tr>
            <td align="center" style="padding-top: 14px;">
              <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #ffffff; line-height: 1.3;">
                Hasil &amp; Rekomendasi Belajar<br>
                <span style="color: #f9c013; font-size: 26px; display: inline-block; margin-top: 4px;">${studentName}</span>
              </h1>
            </td>
          </tr>

          <!-- Badges Placement (Module & Level) -->
          <tr>
            <td align="center" style="padding-top: 18px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                <tr>
                  <td style="padding: 4px;">
                    <span style="display: inline-block; padding: 10px 18px; background-color: #eaf4ff; color: #265e9b; border: 2px solid #bfdbfe; border-radius: 12px; font-size: 15px; font-weight: 800;">
                      ${assignedModule}
                    </span>
                  </td>
                  <td style="padding: 4px;">
                    <span style="display: inline-block; padding: 10px 18px; background-color: #f9c013; color: #5a3f00; border-radius: 12px; font-size: 15px; font-weight: 800;">
                      ${displayLevel}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Subtitle / Summary Copy -->
          <tr>
            <td align="center" style="padding-top: 16px;">
              <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #eaf4ff; max-width: 500px;">
                ${summaryText}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>

    ${lv3InstructionSection}

    <!-- Detail Breakdown Section -->
    <tr>
      <td style="padding: 24px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border: 1.5px solid #c9ddf1; border-radius: 16px; overflow: hidden;">
          <tr>
            <td style="padding: 16px 20px; background-color: #f4f8fc; border-bottom: 1.5px solid #c9ddf1;">
              <h2 style="margin: 0; font-size: 16px; color: #17324f; font-weight: 700;">
                📌 Ringkasan Hasil Evaluasi
              </h2>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 20px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eef4fb; color: #58799b; font-size: 14px; width: 40%;">Nama Siswa</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eef4fb; color: #17324f; font-size: 14px; font-weight: 700;">${studentName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eef4fb; color: #58799b; font-size: 14px;">Submission ID</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eef4fb; color: #17324f; font-size: 14px; font-weight: 600; font-family: monospace;">${submissionId}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eef4fb; color: #58799b; font-size: 14px;">Modul Rekomendasi</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eef4fb; color: #265e9b; font-size: 14px; font-weight: 700;">${assignedModule}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eef4fb; color: #58799b; font-size: 14px;">Modul Potensial</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eef4fb; color: #17324f; font-size: 14px; font-weight: 600;">${potentialModule}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #58799b; font-size: 14px;">Level Rekomendasi</td>
                  <td style="padding: 8px 0; color: #866200; font-size: 14px; font-weight: 700;">${displayLevel}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- PDF Attachment Callout Box -->
    <tr>
      <td style="padding: 0 24px 24px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #fff9e6; border: 1.5px dashed #f0b400; border-radius: 16px; padding: 20px; text-align: left;">
          <tr>
            <td>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td width="36" valign="top" style="padding-right: 12px;">
                    <span style="font-size: 24px; line-height: 1;">📄</span>
                  </td>
                  <td valign="top">
                    <strong style="font-size: 15px; color: #704f00; display: block; margin-bottom: 4px;">
                      Laporan Lengkap Terlampir (PDF)
                    </strong>
                    <span style="font-size: 13px; color: #5a3f00; line-height: 1.5; display: block;">
                      Dokumen PDF laporan hasil placement test lengkap (termasuk grafik Radar Kemampuan &amp; detail Learning Path) telah kami sertakan sebagai lampiran file pada email ini.
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Call to Action Buttons -->
    <tr>
      <td style="padding: 0 24px 24px;" align="center">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
          <tr>
            <td align="center" style="border-radius: 12px; background: #265e9b;">
              <a href="${safePdfUrl}" target="_blank" style="display: inline-block; padding: 14px 24px; font-size: 14px; color: #ffffff; text-decoration: none; font-weight: 700; border-radius: 12px; background-color: #265e9b;">
                🔗 Buka Laporan di Google Drive
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Footer Section -->
    <tr>
      <td style="padding: 20px 24px; background-color: #f4f8fc; border-top: 1px solid #e1ebf5; text-align: center;">
        <p style="margin: 0 0 6px; font-size: 13px; color: #58799b; font-weight: 600;">
          Tim Akademik Kalananti
        </p>
        <p style="margin: 0; font-size: 12px; color: #8ba2bd;">
          Created by Kalananti Academics · © 2026
        </p>
      </td>
    </tr>

  </table>

</body>
</html>`;
}

function ensureSheet_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    const sheets = spreadsheet.getSheets();
    if (name === PLACEMENT_CONFIG.sessionsSheet && sheets.length === 1 && sheets[0].getLastRow() === 0) {
      sheet = sheets[0].setName(name);
    } else {
      sheet = spreadsheet.insertSheet(name);
    }
  }
  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  }
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  return sheet;
}

function getSheet_(name) {
  const sheet = SpreadsheetApp.openById(PLACEMENT_CONFIG.spreadsheetId).getSheetByName(name);
  if (!sheet) throw new Error(`missing_sheet_${name}`);
  return sheet;
}

function validateOperation_(operation) {
  if (!operation || typeof operation !== 'object') throw new Error('invalid_payload');
  if (!operation.operationId || !operation.submissionId || !operation.syncToken) throw new Error('missing_identity');
}

function findSession_(sheet, submissionId) {
  const match = sheet.getRange('A:A').createTextFinder(submissionId).matchEntireCell(true).findNext();
  return match ? { row: match.getRow(), exists: true } : { row: sheet.getLastRow() + 1, exists: false };
}

function requireAuthorizedSession_(sheet, operation) {
  const found = findSession_(sheet, operation.submissionId);
  if (!found.exists) throw new Error('session_not_registered');
  const storedHash = sheet.getRange(found.row, SESSION_HEADERS.indexOf('sync_token_hash') + 1).getValue();
  if (storedHash !== hash_(operation.syncToken)) throw new Error('invalid_sync_token');
  return found;
}

function operationExists_(operationId) {
  const sheet = getSheet_(PLACEMENT_CONFIG.payloadsSheet);
  return Boolean(sheet.getRange('A:A').createTextFinder(operationId).matchEntireCell(true).findNext());
}

function upsertSession_(sheet, found, values) {
  const rowValues = found.exists
    ? sheet.getRange(found.row, 1, 1, SESSION_HEADERS.length).getValues()[0]
    : Array(SESSION_HEADERS.length).fill('');
  Object.entries(values).forEach(([key, value]) => {
    const index = SESSION_HEADERS.indexOf(key);
    if (index >= 0) rowValues[index] = value;
  });
  sheet.getRange(found.row, 1, 1, SESSION_HEADERS.length).setValues([rowValues]);
}

function sessionObject_(sheet, rowNumber) {
  const values = sheet.getRange(rowNumber, 1, 1, SESSION_HEADERS.length).getValues()[0];
  return Object.fromEntries(SESSION_HEADERS.map((header, index) => [header, values[index]]));
}

function appendLog_(operation, status, message) {
  try {
    getSheet_(PLACEMENT_CONFIG.logSheet).appendRow([
      new Date().toISOString(),
      operation.operationId || '',
      operation.submissionId || '',
      operation.action || '',
      status,
      message || ''
    ]);
  } catch (error) {}
}

function hash_(value) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value || ''));
  return bytes.map(byte => (`0${(byte & 255).toString(16)}`).slice(-2)).join('');
}

function escapeHtml_(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

// ====================================================
// BRANCH DASHBOARD AUTHENTICATION & DATA FETCHING
// ====================================================

function parseBranchCellEntries_(cellText) {
  const text = String(cellText || '').trim();
  if (!text) return [];

  const rawParts = text.split(/,|\n/);
  const entries = [];

  for (let i = 0; i < rawParts.length; i++) {
    const part = rawParts[i].trim();
    if (!part) continue;

    const dashIdx = part.lastIndexOf('-');
    if (dashIdx > 0) {
      const name = part.substring(0, dashIdx).trim();
      const email = part.substring(dashIdx + 1).trim();
      entries.push({ name: name || 'User', email: email });
    } else {
      const emailMatch = part.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) {
        entries.push({ name: part.replace(emailMatch[0], '').trim() || 'User', email: emailMatch[0] });
      } else {
        entries.push({ name: part, email: part });
      }
    }
  }
  return entries;
}

function requestDashboardAccess_(operation) {
  const branch = String(operation.branch || '').trim();
  const name = String(operation.name || '').trim();
  const email = String(operation.email || '').trim().toLowerCase();
  const rawRole = String(operation.role || '').trim();

  if (!name || !email) {
    throw new Error('Nama, Email, dan Peran wajib diisi.');
  }

  const isBM = /BM|Branch\s*Manager/i.test(rawRole);
  const targetCol = isBM ? 5 : 6; // Column E (5) for BM (All Access), Column F (6) for SA Kids (All Access)
  const roleLabel = isBM ? 'Branch Manager (BM)' : 'SA Kids';

  const spreadsheet = SpreadsheetApp.openById(PLACEMENT_CONFIG.spreadsheetId);
  const dropdownSheet = spreadsheet.getSheetByName('DROPDOWNS');
  if (!dropdownSheet) throw new Error('Sheet DROPDOWNS tidak ditemukan.');

  const lastRow = dropdownSheet.getLastRow();
  const maxSearchRow = Math.max(lastRow, 5);

  // Read target column (Col E or F) starting from row 5
  const colValues = dropdownSheet.getRange(5, targetCol, maxSearchRow - 4, 1).getValues();
  let isAlready = false;
  let firstEmptyRow = -1;

  for (let i = 0; i < colValues.length; i++) {
    const val = String(colValues[i][0] || '').trim();
    if (val) {
      const parsed = parseBranchCellEntries_(val);
      if (parsed.some(e => e.email.toLowerCase() === email)) {
        isAlready = true;
        break;
      }
    } else if (firstEmptyRow === -1) {
      firstEmptyRow = 5 + i;
    }
  }

  if (firstEmptyRow === -1 && !isAlready) {
    firstEmptyRow = 5 + colValues.length;
  }

  const formattedEntry = `${name} - ${email}`;

  if (isAlready) {
    recordAccessRequest_(spreadsheet, branch || 'All Access', name, email, roleLabel, 'approved');
    return {
      requested: true,
      alreadyRegistered: true,
      message: 'Oke, request kamu sedang direview oleh tim HQ. Coba lagi login menggunakan email terdaftar dalam 2 menit, ya.'
    };
  }

  // Set formatted entry in the empty cell in Column E/F
  dropdownSheet.getRange(firstEmptyRow, targetCol).setValue(formattedEntry);

  // Record timestamp in AccessRequests sheet
  recordAccessRequest_(spreadsheet, branch || 'All Access', name, email, roleLabel, 'pending_2min');

  return {
    requested: true,
    alreadyRegistered: false,
    message: 'Oke, request kamu sedang direview oleh tim HQ. Coba lagi login menggunakan email terdaftar dalam 2 menit, ya.'
  };
}

function recordAccessRequest_(spreadsheet, branch, name, email, role, status) {
  let reqSheet = spreadsheet.getSheetByName('AccessRequests');
  if (!reqSheet) {
    reqSheet = spreadsheet.insertSheet('AccessRequests');
    reqSheet.appendRow(['requested_at', 'branch', 'name', 'email', 'role', 'status']);
    reqSheet.setFrozenRows(1);
    reqSheet.getRange(1, 1, 1, 6).setFontWeight('bold').setBackground('#e8eaed');
  }
  reqSheet.appendRow([new Date().toISOString(), branch, name, email, role, status || 'pending_2min']);
}

function loginDashboard_(operation) {
  const branch = String(operation.branch || 'All Access').trim();
  const email = String(operation.email || '').trim().toLowerCase();

  if (!email) {
    throw new Error('Email wajib diisi.');
  }

  const spreadsheet = SpreadsheetApp.openById(PLACEMENT_CONFIG.spreadsheetId);
  const dropdownSheet = spreadsheet.getSheetByName('DROPDOWNS');
  if (!dropdownSheet) throw new Error('Sheet DROPDOWNS tidak ditemukan.');

  const lastRow = dropdownSheet.getLastRow();
  if (lastRow < 5) throw new Error('Data cabang tidak ditemukan.');

  // Read Columns A through F from Row 5
  const dropdownData = dropdownSheet.getRange(5, 1, lastRow - 4, 6).getValues();
  let userRole = null;
  let targetBranchName = branch;
  let potentialTypoMatch = null;

  // 1. Check All Access lists (Columns E & F) across all rows 5+
  for (let i = 0; i < dropdownData.length; i++) {
    const bmVal = String(dropdownData[i][4] || '').trim(); // Col E
    const saVal = String(dropdownData[i][5] || '').trim(); // Col F

    const allBmEntries = parseBranchCellEntries_(bmVal);
    const allSaEntries = parseBranchCellEntries_(saVal);

    for (let j = 0; j < allBmEntries.length; j++) {
      if (allBmEntries[j].email.toLowerCase() === email) {
        userRole = 'Branch Manager (BM)';
        break;
      }
    }
    if (userRole) break;

    for (let j = 0; j < allSaEntries.length; j++) {
      if (allSaEntries[j].email.toLowerCase() === email) {
        userRole = 'SA Kids';
        break;
      }
    }
    if (userRole) break;
  }

  // 2. If not found in All Access, check branch-specific columns B & C for matching branch
  if (!userRole) {
    for (let i = 0; i < dropdownData.length; i++) {
      const bName = String(dropdownData[i][0] || '').trim();
      const cleanBName = bName.toLowerCase().replace(/[\u2013\u2014]/g, '-').replace(/\s+/g, ' ');
      const cleanBranch = branch.toLowerCase().replace(/[\u2013\u2014]/g, '-').replace(/\s+/g, ' ');

      if (cleanBName === cleanBranch) {
        targetBranchName = bName;
        const bmCellText = String(dropdownData[i][1] || ''); // Col B
        const saCellText = String(dropdownData[i][2] || ''); // Col C

        const bmEntries = parseBranchCellEntries_(bmCellText);
        const saEntries = parseBranchCellEntries_(saCellText);

        for (let j = 0; j < bmEntries.length; j++) {
          if (bmEntries[j].email.toLowerCase() === email) {
            userRole = 'Branch Manager (BM)';
            break;
          }
        }
        if (!userRole) {
          for (let j = 0; j < saEntries.length; j++) {
            if (saEntries[j].email.toLowerCase() === email) {
              userRole = 'SA Kids';
              break;
            }
          }
        }

        // Check for typo in username
        if (!userRole) {
          const inputUsername = email.split('@')[0].trim();
          for (let j = 0; j < bmEntries.length; j++) {
            const entryUsername = bmEntries[j].email.split('@')[0].trim().toLowerCase();
            if (entryUsername && entryUsername === inputUsername) {
              potentialTypoMatch = { name: bmEntries[j].name, email: bmEntries[j].email, role: 'Branch Manager (BM)' };
              break;
            }
          }
          if (!potentialTypoMatch) {
            for (let j = 0; j < saEntries.length; j++) {
              const entryUsername = saEntries[j].email.split('@')[0].trim().toLowerCase();
              if (entryUsername && entryUsername === inputUsername) {
                potentialTypoMatch = { name: saEntries[j].name, email: saEntries[j].email, role: 'SA Kids' };
                break;
              }
            }
          }
        }
        break;
      }
    }
  }

  if (!userRole) {
    if (potentialTypoMatch) {
      throw new Error(`Email "${email}" tidak ditemukan. Di cabang ini terdaftar atas nama ${potentialTypoMatch.name} (${potentialTypoMatch.email}). Apakah kamu salah ketik email atau orang yang berbeda?`);
    } else {
      throw new Error('Email belum terdaftar untuk cabang ini. Silakan klik "Minta Akses" terlebih dahulu.');
    }
  }

  // Check 2-minute cooldown ONLY for newly pending requests
  const reqSheet = spreadsheet.getSheetByName('AccessRequests');
  if (reqSheet && reqSheet.getLastRow() > 1) {
    const reqData = reqSheet.getRange(2, 1, reqSheet.getLastRow() - 1, 6).getValues();
    let newestPendingTime = 0;
    for (let i = reqData.length - 1; i >= 0; i--) {
      const rTime = new Date(reqData[i][0]).getTime();
      const rEmail = String(reqData[i][3] || '').trim().toLowerCase();
      const rStatus = String(reqData[i][5] || '').trim();

      if (rEmail === email && (rStatus === 'pending_5min' || rStatus === 'pending_2min') && !isNaN(rTime)) {
        if (rTime > newestPendingTime) newestPendingTime = rTime;
      }
    }

    if (newestPendingTime > 0) {
      const now = Date.now();
      const diffMs = now - newestPendingTime;
      const twoMinsMs = 2 * 60 * 1000;
      if (diffMs < twoMinsMs) {
        const remainingSecs = Math.ceil((twoMinsMs - diffMs) / 1000);
        const minsLeft = Math.floor(remainingSecs / 60);
        const secsLeft = remainingSecs % 60;
        const timeStr = minsLeft > 0 ? `${minsLeft}m ${secsLeft}s` : `${secsLeft}s`;
        throw new Error(`Oke, request kamu sedang direview oleh tim HQ. Coba lagi login menggunakan email terdaftar dalam 2 menit, ya (sisa waktu: ${timeStr}).`);
      }
    }
  }

  // Generate Session Token
  const token = hash_(`${targetBranchName}:${email}:${Date.now()}:${Math.random()}`);
  saveDashboardSession_(spreadsheet, token, targetBranchName, email, userRole);

  return {
    authenticated: true,
    token: token,
    branch: targetBranchName,
    userEmail: email,
    role: userRole
  };
}

function saveDashboardSession_(spreadsheet, token, branch, email, role) {
  let sessSheet = spreadsheet.getSheetByName('DashboardSessions');
  if (!sessSheet) {
    sessSheet = spreadsheet.insertSheet('DashboardSessions');
    sessSheet.appendRow(['token', 'branch', 'email', 'role', 'created_at', 'expires_at']);
    sessSheet.setFrozenRows(1);
    sessSheet.getRange(1, 1, 1, 6).setFontWeight('bold').setBackground('#e8eaed');
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(); // 24-hour token
  sessSheet.appendRow([token, branch, email, role, now.toISOString(), expiresAt]);
}

function getBranchResults_(operation) {
  const token = String(operation.token || '').trim();
  if (!token) throw new Error('Token sesi tidak valid. Silakan login kembali.');

  const spreadsheet = SpreadsheetApp.openById(PLACEMENT_CONFIG.spreadsheetId);
  const sessSheet = spreadsheet.getSheetByName('DashboardSessions');
  if (!sessSheet || sessSheet.getLastRow() <= 1) {
    throw new Error('Sesi tidak ditemukan. Silakan login kembali.');
  }

  const sessData = sessSheet.getRange(2, 1, sessSheet.getLastRow() - 1, 6).getValues();
  let authorizedBranch = null;
  let userEmail = null;
  let userRole = null;

  for (let i = sessData.length - 1; i >= 0; i--) {
    const t = String(sessData[i][0] || '').trim();
    if (t === token) {
      const expiresAt = new Date(sessData[i][5]).getTime();
      if (!isNaN(expiresAt) && Date.now() > expiresAt) {
        throw new Error('Sesi telah kadaluarsa. Silakan login kembali.');
      }
      authorizedBranch = String(sessData[i][1] || '').trim();
      userEmail = String(sessData[i][2] || '').trim();
      userRole = String(sessData[i][3] || '').trim();
      break;
    }
  }

  if (!authorizedBranch) {
    throw new Error('Sesi tidak terautentikasi.');
  }

  // Read Sessions Sheet
  const sessionsSheet = spreadsheet.getSheetByName(PLACEMENT_CONFIG.sessionsSheet);
  if (!sessionsSheet || sessionsSheet.getLastRow() <= 1) {
    return {
      branch: authorizedBranch,
      userEmail: userEmail,
      role: userRole,
      results: []
    };
  }

  const data = sessionsSheet.getRange(2, 1, sessionsSheet.getLastRow() - 1, SESSION_HEADERS.length).getValues();
  const filtered = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const studentBranch = String(row[SESSION_HEADERS.indexOf('branch')] || '').trim();

    filtered.push({
      placement_id: row[SESSION_HEADERS.indexOf('submission_id')] || '-',
      student_name: row[SESSION_HEADERS.indexOf('student_name')] || '-',
      student_age: row[SESSION_HEADERS.indexOf('exact_age')] || '-',
      audience: row[SESSION_HEADERS.indexOf('audience')] || '-',
      parent_email: row[SESSION_HEADERS.indexOf('parent_email')] || '-',
      branch: studentBranch || 'Online',
      child_confirmed: row[SESSION_HEADERS.indexOf('child_confirmed')] === 'TRUE' || row[SESSION_HEADERS.indexOf('child_confirmed')] === true,
      guardian_confirmed: row[SESSION_HEADERS.indexOf('guardian_confirmed')] === 'TRUE' || row[SESSION_HEADERS.indexOf('guardian_confirmed')] === true,
      assigned_module: row[SESSION_HEADERS.indexOf('assigned_module')] || '-',
      potential_module: row[SESSION_HEADERS.indexOf('potential_module')] || '-',
      assigned_level: row[SESSION_HEADERS.indexOf('assigned_level')] || '-',
      final_status: row[SESSION_HEADERS.indexOf('final_status')] || 'in_progress',
      pdf_file_url: row[SESSION_HEADERS.indexOf('pdf_file_url')] || '',
      email_status: row[SESSION_HEADERS.indexOf('email_status')] || 'not sent'
    });
  }

  return {
    branch: authorizedBranch,
    userEmail: userEmail,
    role: userRole,
    results: filtered
  };
}

function updateEmailStatus_(operation) {
  const token = String(operation.token || '').trim();
  const submissionId = String(operation.submissionId || '').trim();
  const requestedStatus = String(operation.emailStatus || operation.status || '').trim().toLowerCase();

  if (!token) throw new Error('Token sesi tidak valid. Silakan login kembali.');
  if (!submissionId) throw new Error('submissionId wajib diisi.');

  const spreadsheet = SpreadsheetApp.openById(PLACEMENT_CONFIG.spreadsheetId);
  const sessSheet = spreadsheet.getSheetByName('DashboardSessions');
  if (!sessSheet || sessSheet.getLastRow() <= 1) throw new Error('Sesi tidak ditemukan. Silakan login kembali.');

  const sessData = sessSheet.getRange(2, 1, sessSheet.getLastRow() - 1, 6).getValues();
  let isAuthenticated = false;

  for (let i = sessData.length - 1; i >= 0; i--) {
    const t = String(sessData[i][0] || '').trim();
    if (t === token) {
      const expiresAt = new Date(sessData[i][5]).getTime();
      if (!isNaN(expiresAt) && Date.now() > expiresAt) {
        throw new Error('Sesi telah kadaluarsa. Silakan login kembali.');
      }
      isAuthenticated = true;
      break;
    }
  }

  if (!isAuthenticated) throw new Error('Sesi tidak terautentikasi.');

  const sessionsSheet = spreadsheet.getSheetByName(PLACEMENT_CONFIG.sessionsSheet);
  const found = findSession_(sessionsSheet, submissionId);
  if (!found.exists) throw new Error(`Submission ID ${submissionId} tidak ditemukan.`);

  if (requestedStatus === 'sent' || requestedStatus === 'send') {
    const result = sendParentEmail_(sessionsSheet, found.row);
    return {
      submissionId,
      emailStatus: 'sent',
      emailSentAt: result.emailSentAt
    };
  } else {
    upsertSession_(sessionsSheet, found, {
      email_status: 'not sent',
      email_sent_at: '',
      last_error: '',
      updated_at: new Date().toISOString()
    });
    return {
      submissionId,
      emailStatus: 'not sent'
    };
  }
}

function logoutDashboard_(operation) {
  const token = String(operation.token || '').trim();
  if (token) {
    try {
      const spreadsheet = SpreadsheetApp.openById(PLACEMENT_CONFIG.spreadsheetId);
      const sessSheet = spreadsheet.getSheetByName('DashboardSessions');
      if (sessSheet && sessSheet.getLastRow() > 1) {
        const finder = sessSheet.getRange('A:A').createTextFinder(token).matchEntireCell(true).findNext();
        if (finder) {
          sessSheet.deleteRow(finder.getRow());
        }
      }
    } catch (e) {}
  }
  return { loggedOut: true };
}
