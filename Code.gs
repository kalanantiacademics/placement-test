const PLACEMENT_CONFIG = Object.freeze({
  spreadsheetId: '1aTftCK6eF_gLPYueH-TH7nt4Pc0Ew247xfF49a91eK4',
  pdfFolderId: '171mw0cN5K22tjsTfAHrKhqPbD7ZjPV9W',
  sessionsSheet: 'Sessions',
  payloadsSheet: 'StagePayloads',
  logSheet: 'SyncLog',
  dashboardSessionHours: 24,
  accessReviewMinutes: 1,
  stalledHours: 24,
  academicReplyToProperty: 'PLACEMENT_ACADEMIC_REPLY_TO'
});

const DASHBOARD_SESSION_HEADERS = [
  'token_hash', 'authorized_branch', 'email', 'role', 'data_scope',
  'column_access', 'created_at', 'expires_at', 'revoked_at'
];

const ACCESS_REQUEST_HEADERS = [
  'request_id', 'requested_at', 'branch', 'name', 'email', 'role',
  'status', 'reviewed_at', 'reviewed_by'
];

const DASHBOARD_AUDIT_HEADERS = [
  'timestamp', 'event', 'email', 'authorized_branch', 'submission_id',
  'status', 'detail'
];

// Production still contains access records in both B/C and F/G. Read both
// layouts so existing users keep working, but write every newly approved
// request to the current mapping: B = BM and C = SA Kids.
const DROPDOWN_ACCESS_COLUMNS = Object.freeze({
  hq: [5],
  bmRead: [2, 6],
  saKidsRead: [3, 7],
  bmWrite: 2,
  saKidsWrite: 3
});

const SESSION_HEADERS = [
  'submission_id', 'sync_token_hash', 'student_name', 'exact_age', 'age_range',
  'audience', 'parent_email', 'branch', 'registered_at', 'session_status',
  'child_confirmed', 'guardian_confirmed', 'consent_accepted_at', 'terms_version',
  'current_stage', 'current_question', 'last_activity_at', 'stage1_status',
  'stage1_completed_at', 'stage2_status', 'stage2_completed_at', 'stage3_status',
  'stage3_completed_at', 'assigned_module', 'potential_module', 'assigned_level',
  'lv3_candidate', 'final_status', 'final_completed_at', 'pdf_file_id',
  'pdf_file_url', 'email_status', 'email_sent_at', 'last_error', 'updated_at',
  'assessment_version', 'can_read_independently', 'routing_reason',
  'placement_review_status', 'placement_reviewed_at', 'placement_reviewed_by'
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
  ensureAccessRequestSheet_(spreadsheet);
  ensureDashboardSessionSheet_(spreadsheet);
  ensureDashboardSheet_(spreadsheet, 'DashboardAuditLog', DASHBOARD_AUDIT_HEADERS);

  [sessions, payloads, log].forEach(sheet => {
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, Math.min(sheet.getLastColumn(), SESSION_HEADERS.length))
      .setFontWeight('bold')
      .setBackground('#e8eaed')
      .setWrap(true);
  });

  return {
    spreadsheetUrl: spreadsheet.getUrl(),
    sheets: [sessions.getName(), payloads.getName(), log.getName()]
  };
}

function installPlacementOnEditTrigger() {
  let removedDuplicates = 0;
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'onEdit') {
      ScriptApp.deleteTrigger(trigger);
      removedDuplicates += 1;
    }
  });

  ScriptApp.newTrigger('onEdit')
    .forSpreadsheet(PLACEMENT_CONFIG.spreadsheetId)
    .onEdit()
    .create();

  return {
    installed: true,
    spreadsheetId: PLACEMENT_CONFIG.spreadsheetId,
    removedDuplicates
  };
}

function doGet(event) {
  const action = event?.parameter?.action;

  if (action === 'get_branches' || action === 'get_dropdowns' || action === 'get_offline_branches') {
    try {
      const spreadsheet = SpreadsheetApp.openById(PLACEMENT_CONFIG.spreadsheetId);
      const offlineOnly = action === 'get_offline_branches' || event?.parameter?.offline_only === 'true';
      return json_({ ok: true, branches: getBranchRows_(spreadsheet)
        .map(item => item.branch)
        .filter(branch => !offlineOnly || normalizeBranch_(branch) !== 'online') });
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
      branchDashboard: true,
      delayedEmailLogin: true,
      hqAnalytics: true
    }
  });
}

function doPost(event) {
  let operation = null;
  let lock = null;
  try {
    operation = JSON.parse(event?.postData?.contents || '{}');
    const action = operation.action;
    const readOnlyActions = ['get_access_requests', 'get_branch_results', 'get_hq_overview'];
    if (!readOnlyActions.includes(action)) {
      lock = LockService.getScriptLock();
      lock.waitLock(20000);
    }

    if (action === 'request_dashboard_access') {
      const result = requestDashboardAccess_(operation);
      return json_({ ok: true, ...result });
    } else if (action === 'login_dashboard') {
      const result = loginDashboard_(operation);
      return json_({ ok: true, ...result });
    } else if (action === 'approve_dashboard_access') {
      const result = approveDashboardAccess_(operation);
      return json_({ ok: true, ...result });
    } else if (action === 'get_access_requests') {
      const result = getAccessRequests_(operation);
      return json_({ ok: true, ...result });
    } else if (action === 'get_branch_results') {
      const result = getBranchResults_(operation);
      return json_({ ok: true, ...result });
    } else if (action === 'get_hq_overview') {
      const result = getHqOverview_(operation);
      return json_({ ok: true, ...result });
    } else if (action === 'update_email_status') {
      const result = updateEmailStatus_(operation);
      return json_({ ok: true, ...result });
    } else if (action === 'approve_and_send_result') {
      const result = approveAndSendResult_(operation);
      return json_({ ok: true, ...result });
    } else if (action === 'update_result_review') {
      const result = updateResultReview_(operation);
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
    const dashboardActions = [
      'request_dashboard_access', 'login_dashboard',
      'approve_dashboard_access', 'get_access_requests', 'get_branch_results',
      'get_hq_overview', 'update_email_status', 'approve_and_send_result',
      'update_result_review', 'logout_dashboard'
    ];
    if (dashboardActions.includes(operation?.action)) {
      try {
        const spreadsheet = SpreadsheetApp.openById(PLACEMENT_CONFIG.spreadsheetId);
        auditDashboard_(spreadsheet, `${operation.action}_failed`, operation.email || '', operation.branch || '', operation.submissionId || '', 'failed', String(error.message || error));
      } catch (auditError) {}
    }
    return json_({ ok: false, error: String(error.message || error) });
  } finally {
    if (lock) lock.releaseLock();
  }
}

function register_(operation) {
  const registration = operation.payload || {};
  const student = registration.student || registration;
  const consent = registration.consent || {};
  const sheet = getSheet_(PLACEMENT_CONFIG.sessionsSheet);
  const found = findSession_(sheet, operation.submissionId);
  const now = new Date().toISOString();
  const studentName = validateStudentName_(student.name);
  const branch = validateRegistrationBranch_(student.branch);
  const values = {
    submission_id: operation.submissionId,
    sync_token_hash: hash_(operation.syncToken),
    student_name: studentName,
    exact_age: Number(student.exactAge) || '',
    age_range: student.ageRange || '',
    audience: student.audienceGroup || '',
    parent_email: student.parentEmail || '',
    branch,
    registered_at: registration.registeredAt || now,
    session_status: 'in_progress',
    child_confirmed: consent.childConfirmed === true ? 'TRUE' : 'FALSE',
    guardian_confirmed: consent.guardianConfirmed === true ? 'TRUE' : 'FALSE',
    consent_accepted_at: consent.acceptedAt || now,
    terms_version: consent.termsVersion || 'placement-tnc-v1',
    assessment_version: registration.assessmentVersion || 'placement-v1',
    can_read_independently: Number(student.exactAge) === 7
      ? (student.canReadIndependently === true ? 'TRUE' : 'FALSE')
      : '',
    routing_reason: student.routingReason || '',
    placement_review_status: 'submitted',
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
    placement_review_status: row.lv3_candidate === true || String(row.lv3_candidate).toLowerCase() === 'true'
      ? 'lv3_candidate'
      : 'submitted',
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
  if (String(row.email_status || '').trim().toLowerCase() === 'sent') {
    return {
      sent: true,
      alreadySent: true,
      emailStatus: 'sent',
      emailSentAt: row.email_sent_at || ''
    };
  }
  const parentEmail = String(row.parent_email || '').trim();
  if (!parentEmail) {
    upsertSession_(sheet, { row: rowNumber, exists: true }, {
      email_status: 'failed',
      last_error: 'missing_parent_email',
      updated_at: new Date().toISOString()
    });
    throw new Error('missing_parent_email');
  }

  const spreadsheet = sheet.getParent();
  const branchRecipients = getBranchNotificationRecipients_(spreadsheet, row.branch);
  if (!branchRecipients.length) {
    const now = new Date().toISOString();
    upsertSession_(sheet, { row: rowNumber, exists: true }, {
      email_status: 'waiting_branch_recipient',
      last_error: 'missing_branch_bm_sa_recipient',
      updated_at: now
    });
    return { sent: false, held: true, emailStatus: 'waiting_branch_recipient' };
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
    const mailOptions = {
      to: parentEmail,
      bcc: branchRecipients.join(','),
      subject: `Hasil Placement Test Kalananti - ${row.student_name || 'Siswa'}`,
      htmlBody: emailBody,
      attachments: attachments,
      name: 'Kalananti Placement Test'
    };
    const replyTo = getAcademicReplyTo_();
    if (replyTo) mailOptions.replyTo = replyTo;
    MailApp.sendEmail(mailOptions);

    const now = new Date().toISOString();
    upsertSession_(sheet, { row: rowNumber, exists: true }, {
      email_status: 'sent',
      email_sent_at: now,
      last_error: '',
      updated_at: now
    });
    return { sent: true, emailSentAt: now, bccCount: branchRecipients.length };
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

    if (sheet.getName() === 'DROPDOWNS') {
      const col = e.range.getColumn();
      const row = e.range.getRow();
      // Existing production uses F/G; B/C are retained for compatibility.
      if (row >= 1 && [2, 3, 5, 6, 7].includes(col)) {
        const val = String(e.value || e.range.getValue() || '').trim();
        if (val) {
          const parsed = parseBranchCellEntries_(val);
          if (parsed.length > 0) {
            parsed.forEach(entry => {
              if (entry.email) {
                if (DROPDOWN_ACCESS_COLUMNS.hq.includes(col)) grantRootFolderAccess_(entry.email);
                else {
                  const branch = String(sheet.getRange(row, 1).getValue() || '').trim();
                  if (branch) grantBranchFolderAccess_(entry.email, branch);
                }
              }
            });
          }
        }
      }
      return;
    }

    if (sheet.getName() !== PLACEMENT_CONFIG.sessionsSheet) return;

    // Result email is intentionally not triggered by editing a spreadsheet
    // status cell. V1 requires an authenticated, scoped dashboard session and
    // the explicit approve_and_send_result action so reviewer identity is kept.
    return;
  } catch (err) {
    console.error('onEdit trigger error: ' + err);
  }
}

function createResultPdf_(submissionId, row, payload) {
  const folder = getOrCreateBranchFolder_(normalizeBranchForAudit_(row.branch));
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

function formatCleanLevel_(levelStr) {
  if (!levelStr) return '-';
  const str = String(levelStr).trim();
  if (!str || str === '-') return '-';
  if (/(lv1|level\s*1|foundational)/i.test(str)) return 'Level 1';
  if (/(lv2|level\s*2|basic)/i.test(str)) return 'Level 2';
  if (/(lv3|level\s*3|intermediate)/i.test(str)) return 'Level 3';
  if (/(lv4|level\s*4|advanced)/i.test(str)) return 'Level 4';
  return str.replace(/^(FOUNDATIONAL|BASIC|INTERMEDIATE|ADVANCED)\s*[—\-]\s*/i, '');
}

function buildEmailBody_(row, pdfUrl, payload) {
  const result = (payload && (payload.result || payload)) || {};
  const studentName = escapeHtml_(row.student_name || 'Siswa');
  const submissionId = escapeHtml_(row.submission_id || '-');
  const assignedModule = escapeHtml_(result.assignedModule || row.assigned_module || '-');
  const potentialModule = escapeHtml_(result.potentialModule || row.potential_module || '-');
  const rawAssignedLevel = result.assignedLevel || result.level || row.assigned_level || '-';
  const assignedLevel = escapeHtml_(formatCleanLevel_(rawAssignedLevel));
  const isCandidate = result.lv3Candidate === true || row.lv3_candidate === true || String(row.lv3_candidate).toLowerCase() === 'true';
  const safePdfUrl = escapeHtml_(pdfUrl || '#');
  const summaryText = escapeHtml_(result.summary || 'Placement test telah diselesaikan. Rekomendasi ini menjadi titik awal perjalanan belajar siswa.');

  const statusText = isCandidate
    ? 'KANDIDAT REVIEW EMERGING — Level 3'
    : (assignedLevel === 'Level 1'
      ? 'STATUS: SIAP MEMBANGUN FONDASI'
      : 'STATUS: SIAP MENGEMBANGKAN KEMAMPUAN MELALUI PROYEK');

  const displayLevel = isCandidate ? 'Level 2' : assignedLevel;

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
                      Selamat Ayah / Bunda! Ananda <strong>${studentName}</strong> terpilih sebagai <strong>kandidat review Level 3</strong> pada modul <strong>${assignedModule}</strong>. Penempatan yang berlaku saat ini tetap <strong>Level 2</strong> sampai Academic Team menyelesaikan review dan memberikan persetujuan eksplisit.<br><br>
                      Untuk menuntaskan verifikasi Level 3, mohon Ayah / Bunda <strong>membalas (reply) email ini</strong> dengan portofolio terbaik Ananda. <strong>Source code atau file proyek yang dapat diedit wajib disertakan</strong> agar Tim Akademik dapat meninjau cara kerja proyek.<br><br>
                      Format yang dapat dikirim: Scratch berupa file <strong>.sb3</strong> atau shared link; Roblox Studio berupa file <strong>.rbxl/.rbxlx</strong>, project link, dan source <strong>.lua</strong>; Python berupa file <strong>.py</strong> atau repository beserta README. Screenshot atau video boleh ditambahkan sebagai pendukung, tetapi tidak menggantikan source code/file proyek.
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
  const spreadsheet = SpreadsheetApp.openById(PLACEMENT_CONFIG.spreadsheetId);
  const expectedHeaders = name === PLACEMENT_CONFIG.sessionsSheet
    ? SESSION_HEADERS
    : name === PLACEMENT_CONFIG.payloadsSheet
      ? PAYLOAD_HEADERS
      : name === PLACEMENT_CONFIG.logSheet
        ? LOG_HEADERS
        : null;
  const sheet = expectedHeaders
    ? ensureSheet_(spreadsheet, name, expectedHeaders)
    : spreadsheet.getSheetByName(name);
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
// BRANCH DASHBOARD AUTHENTICATION, AUTHORIZATION & HQ ANALYTICS
// ====================================================

function normalizeEmail_(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeBranch_(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeBranchForAudit_(value) {
  const branch = String(value || '').trim();
  return !branch || branch === '-' ? 'Legacy/Unknown' : branch;
}

function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));
}

function parseBranchCellEntries_(cellText) {
  return String(cellText || '').split(/,|\n/).map(part => part.trim()).filter(Boolean).map(part => {
    const match = part.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (!match) return null;
    return {
      name: part.replace(match[0], '').replace(/[-–—\s]+$/, '').trim() || 'User',
      email: normalizeEmail_(match[0])
    };
  }).filter(Boolean);
}

function getBranchNotificationRecipients_(spreadsheet, branch) {
  const sheet = spreadsheet.getSheetByName('DROPDOWNS');
  if (!sheet) return [];
  const branchMatch = getBranchRows_(spreadsheet)
    .find(item => normalizeBranch_(item.branch) === normalizeBranch_(branch));
  if (!branchMatch) return [];

  // V1 notification policy is intentionally strict: BM in column B and
  // SA in column C for the exact branch row (including the Online row).
  const values = sheet.getRange(branchMatch.row, 2, 1, 2).getValues()[0];
  const recipients = values
    .flatMap(value => parseBranchCellEntries_(value))
    .map(entry => normalizeEmail_(entry.email))
    .filter(isValidEmail_);
  return [...new Set(recipients)];
}

function getAcademicReplyTo_() {
  const configured = String(
    PropertiesService.getScriptProperties().getProperty(PLACEMENT_CONFIG.academicReplyToProperty)
    || ''
  ).trim();
  if (isValidEmail_(configured)) return configured;
  const ownerEmail = String(Session.getEffectiveUser().getEmail() || '').trim();
  return isValidEmail_(ownerEmail) ? ownerEmail : '';
}

function getBranchRows_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName('DROPDOWNS');
  if (!sheet) throw new Error('Sheet DROPDOWNS tidak ditemukan.');
  const lastRow = sheet.getLastRow();
  if (lastRow < 1) return [];
  const values = sheet.getRange(1, 1, lastRow, 1).getValues();
  const seen = {};
  const rows = [];
  values.forEach((item, index) => {
    const branch = String(item[0] || '').trim();
    const key = normalizeBranch_(branch);
    if (!branch || key === 'bac/eac branch name' || key === 'branch' || seen[key]) return;
    seen[key] = true;
    rows.push({ row: index + 1, branch });
  });
  return rows;
}

function validateRegistrationBranch_(value) {
  const branch = String(value || '').trim();
  if (!branch || branch === '-') throw new Error('invalid_branch');
  if (normalizeBranch_(branch) === 'online') return 'Online';
  const spreadsheet = SpreadsheetApp.openById(PLACEMENT_CONFIG.spreadsheetId);
  const match = getBranchRows_(spreadsheet).find(item => normalizeBranch_(item.branch) === normalizeBranch_(branch));
  if (!match || normalizeBranch_(match.branch) === 'online') throw new Error('invalid_offline_branch');
  return match.branch;
}

function validateStudentName_(value) {
  const name = String(value || '').trim().replace(/\s+/g, ' ');
  if (name.length < 3 || name.length > 100 || !/\p{L}/u.test(name)) {
    throw new Error('invalid_student_full_name');
  }
  return name;
}

function ensureDashboardSheet_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  else sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#e8eaed');
  return sheet;
}

function ensureAccessRequestSheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName('AccessRequests');
  if (!sheet) return ensureDashboardSheet_(spreadsheet, 'AccessRequests', ACCESS_REQUEST_HEADERS);
  const legacyHeaders = ['requested_at', 'branch', 'name', 'email', 'role', 'status'];
  const currentLegacyHeaders = sheet.getRange(1, 1, 1, legacyHeaders.length).getValues()[0].map(String);
  const isLegacy = legacyHeaders.every((header, index) => currentLegacyHeaders[index] === header);
  if (isLegacy) sheet.insertColumnBefore(1);

  if (sheet.getMaxColumns() < ACCESS_REQUEST_HEADERS.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), ACCESS_REQUEST_HEADERS.length - sheet.getMaxColumns());
  }
  const currentHeaders = sheet.getRange(1, 1, 1, ACCESS_REQUEST_HEADERS.length).getValues()[0].map(String);
  const isEmpty = currentHeaders.every(header => !header.trim());
  const isCurrent = ACCESS_REQUEST_HEADERS.every((header, index) => currentHeaders[index] === header);
  if (!isLegacy && !isEmpty && !isCurrent) {
    throw new Error('Struktur AccessRequests tidak dikenali; setup dihentikan agar data existing tidak tertimpa.');
  }
  sheet.getRange(1, 1, 1, ACCESS_REQUEST_HEADERS.length).setValues([ACCESS_REQUEST_HEADERS]);

  // Legacy requests had no request_id. Assign IDs without changing their
  // timestamps, profiles, or statuses.
  if (sheet.getLastRow() > 1) {
    const idRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1);
    const ids = idRange.getValues();
    const rowData = sheet.getRange(2, 2, sheet.getLastRow() - 1, 6).getValues();
    let changed = false;
    ids.forEach((row, index) => {
      if (!String(row[0] || '').trim() && rowData[index].some(value => String(value || '').trim())) {
        row[0] = `access_${Utilities.getUuid()}`;
        changed = true;
      }
    });
    if (changed) idRange.setValues(ids);
  }
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, ACCESS_REQUEST_HEADERS.length).setFontWeight('bold').setBackground('#e8eaed');
  return sheet;
}

function ensureDashboardSessionSheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName('DashboardSessions');
  if (!sheet) return ensureDashboardSheet_(spreadsheet, 'DashboardSessions', DASHBOARD_SESSION_HEADERS);

  const legacyHeaders = ['token', 'branch', 'email', 'role', 'created_at', 'expires_at'];
  const legacyHeaderValues = sheet.getRange(1, 1, 1, legacyHeaders.length).getValues()[0].map(String);
  const isLegacy = legacyHeaders.every((header, index) => legacyHeaderValues[index] === header);
  if (sheet.getMaxColumns() < DASHBOARD_SESSION_HEADERS.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), DASHBOARD_SESSION_HEADERS.length - sheet.getMaxColumns());
  }
  const currentHeaders = sheet.getRange(1, 1, 1, DASHBOARD_SESSION_HEADERS.length).getValues()[0].map(String);
  const isEmpty = currentHeaders.every(header => !header.trim());
  const isCurrent = DASHBOARD_SESSION_HEADERS.every((header, index) => currentHeaders[index] === header);
  if (!isLegacy && !isEmpty && !isCurrent) {
    throw new Error('Struktur DashboardSessions tidak dikenali; setup dihentikan agar data existing tidak tertimpa.');
  }

  if (sheet.getLastRow() > 1 && (isLegacy || isCurrent)) {
    const width = isLegacy ? legacyHeaders.length : DASHBOARD_SESSION_HEADERS.length;
    const source = sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getValues();
    const migrated = source.map(row => {
      const looksCurrent = !isLegacy && ['all', 'branch'].includes(String(row[4] || '').toLowerCase());
      if (looksCurrent || !String(row[0] || '').trim()) {
        return DASHBOARD_SESSION_HEADERS.map((_, index) => row[index] || '');
      }
      const role = String(row[3] || '');
      const branch = String(row[1] || '');
      const dataScope = role.toUpperCase() === 'HQ' || normalizeBranch_(branch) === 'all access' ? 'all' : 'branch';
      const columnAccess = dataScope === 'all' || normalizeBranch_(branch) === 'online' ? 'full' : 'restricted';
      return [hash_(row[0]), branch, normalizeEmail_(row[2]), role, dataScope, columnAccess, row[4] || '', row[5] || '', ''];
    });
    sheet.getRange(2, 1, migrated.length, DASHBOARD_SESSION_HEADERS.length).setValues(migrated);
  }
  sheet.getRange(1, 1, 1, DASHBOARD_SESSION_HEADERS.length).setValues([DASHBOARD_SESSION_HEADERS]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, DASHBOARD_SESSION_HEADERS.length).setFontWeight('bold').setBackground('#e8eaed');
  return sheet;
}

function auditDashboard_(spreadsheet, event, email, branch, submissionId, status, detail) {
  try {
    const sheet = ensureDashboardSheet_(spreadsheet, 'DashboardAuditLog', DASHBOARD_AUDIT_HEADERS);
    sheet.appendRow([new Date().toISOString(), event, normalizeEmail_(email), branch || '', submissionId || '', status, detail || '']);
  } catch (error) {
    console.error('dashboard audit failed: ' + error);
  }
}

function enforceRateLimit_(action, identity, limit, windowSeconds) {
  const key = `rate:${action}:${hash_(normalizeEmail_(identity) || 'anonymous')}`;
  const cache = CacheService.getScriptCache();
  const count = Number(cache.get(key) || 0);
  if (count >= limit) throw new Error('Terlalu banyak percobaan. Silakan tunggu beberapa menit.');
  cache.put(key, String(count + 1), windowSeconds);
}

function requestDashboardAccess_(operation) {
  const branchInput = String(operation.branch || '').trim();
  const name = String(operation.name || '').trim();
  const email = normalizeEmail_(operation.email);
  const roleInput = String(operation.role || '').trim();
  if (!branchInput || !name || !email || !roleInput) throw new Error('Cabang, nama, email, dan peran wajib diisi.');
  if (!isValidEmail_(email)) throw new Error('Format email tidak valid.');
  const role = /^BM$/i.test(roleInput) || /^Branch Manager/i.test(roleInput) ? 'BM'
    : /^SA Kids$/i.test(roleInput) ? 'SA Kids' : '';
  if (!role) throw new Error('Peran hanya boleh BM atau SA Kids.');
  enforceRateLimit_('access_request', email, 3, 15 * 60);
  enforceRateLimit_('access_request_client', operation.clientId || email, 10, 15 * 60);

  const spreadsheet = SpreadsheetApp.openById(PLACEMENT_CONFIG.spreadsheetId);
  const branchMatch = getBranchRows_(spreadsheet).find(item => normalizeBranch_(item.branch) === normalizeBranch_(branchInput));
  if (!branchMatch) throw new Error('Cabang tidak valid. Muat ulang daftar cabang dan coba lagi.');
  const sheet = ensureAccessRequestSheet_(spreadsheet);
  const data = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, ACCESS_REQUEST_HEADERS.length).getValues() : [];
  const duplicateIndex = data.findIndex(row => normalizeBranch_(row[2]) === normalizeBranch_(branchMatch.branch)
    && normalizeEmail_(row[4]) === email && String(row[5]) === role);
  if (duplicateIndex >= 0 && String(data[duplicateIndex][6]).toLowerCase() === 'approved') {
    return {
      requested: false,
      requestId: String(data[duplicateIndex][0]),
      status: 'approved',
      reviewWaitSeconds: 0,
      reviewAvailableAt: new Date().toISOString(),
      message: 'Akses ini sudah aktif. Silakan login menggunakan email terdaftar.'
    };
  }
  const requestId = duplicateIndex >= 0 ? String(data[duplicateIndex][0]) : `access_${Utilities.getUuid()}`;
  const now = new Date().toISOString();
  const values = [requestId, now, branchMatch.branch, name, email, role, 'pending', '', ''];
  if (duplicateIndex >= 0) sheet.getRange(duplicateIndex + 2, 1, 1, values.length).setValues([values]);
  else sheet.appendRow(values);
  auditDashboard_(spreadsheet, 'access_request', email, branchMatch.branch, '', 'pending', role);
  const reviewWaitSeconds = PLACEMENT_CONFIG.accessReviewMinutes * 60;
  return {
    requested: true,
    requestId,
    status: 'pending',
    reviewWaitSeconds,
    reviewAvailableAt: new Date(Date.now() + reviewWaitSeconds * 1000).toISOString(),
    message: `Request tersimpan. Sistem akan memeriksa akses secara otomatis setelah sekitar ${PLACEMENT_CONFIG.accessReviewMinutes} menit.`
  };
}

function findDashboardIdentity_(spreadsheet, email) {
  const cleanEmail = normalizeEmail_(email);
  const sheet = spreadsheet.getSheetByName('DROPDOWNS');
  if (!sheet) throw new Error('Sheet DROPDOWNS tidak ditemukan.');
  const lastRow = sheet.getLastRow();
  const data = lastRow ? sheet.getRange(1, 1, lastRow, 7).getValues() : [];
  const hq = data.some(row => parseBranchCellEntries_(row[4]).some(entry => entry.email === cleanEmail));
  if (hq) return { email: cleanEmail, role: 'HQ', authorizedBranch: 'All Access', dataScope: 'all', columnAccess: 'full' };

  const matches = [];
  data.forEach(row => {
    const branch = String(row[0] || '').trim();
    if (!branch || normalizeBranch_(branch) === 'bac/eac branch name') return;
    if (DROPDOWN_ACCESS_COLUMNS.bmRead.some(column => parseBranchCellEntries_(row[column - 1]).some(entry => entry.email === cleanEmail))) {
      matches.push({ branch, role: 'BM' });
    }
    if (DROPDOWN_ACCESS_COLUMNS.saKidsRead.some(column => parseBranchCellEntries_(row[column - 1]).some(entry => entry.email === cleanEmail))) {
      matches.push({ branch, role: 'SA Kids' });
    }
  });
  const branches = Array.from(new Set(matches.map(match => normalizeBranch_(match.branch))));
  if (branches.length > 1) throw new Error('Konfigurasi akses ambigu: email terdaftar pada lebih dari satu cabang. Hubungi HQ.');
  if (!matches.length) throw new Error('Email belum memiliki akses yang disetujui HQ.');
  const match = matches[0];
  return {
    email: cleanEmail,
    role: match.role,
    authorizedBranch: match.branch,
    dataScope: 'branch',
    columnAccess: normalizeBranch_(match.branch) === 'online' ? 'full' : 'restricted'
  };
}

function loginDashboard_(operation) {
  const email = normalizeEmail_(operation.email);
  if (!isValidEmail_(email)) throw new Error('Masukkan email terdaftar yang valid.');
  enforceRateLimit_('dashboard_login', email, 8, 15 * 60);
  enforceRateLimit_('dashboard_login_client', operation.clientId || email, 20, 15 * 60);
  const spreadsheet = SpreadsheetApp.openById(PLACEMENT_CONFIG.spreadsheetId);
  let identity;
  let approvedFromPending = false;
  try {
    identity = findDashboardIdentity_(spreadsheet, email);
  } catch (accessError) {
    const pending = findPendingAccessForLogin_(spreadsheet, email);
    if (!pending) throw accessError;
    const availableAt = new Date(pending.requestedAt).getTime() + PLACEMENT_CONFIG.accessReviewMinutes * 60 * 1000;
    if (!Number.isFinite(availableAt) || Date.now() < availableAt) {
      auditDashboard_(spreadsheet, 'login_waiting_review', email, pending.branch, '', 'pending', pending.requestId);
      throw new Error('Permintaan akses sedang direview tim HQ. Silakan tunggu sekitar 1 menit sebelum mencoba login kembali.');
    }
    activateAccessRequest_(spreadsheet, pending.row, 'system:auto-approved-after-1-min');
    approvedFromPending = true;
    identity = findDashboardIdentity_(spreadsheet, email);
  }
  const token = `${Utilities.getUuid()}${Utilities.getUuid()}`.replace(/-/g, '');
  saveDashboardSession_(spreadsheet, token, identity);
  auditDashboard_(spreadsheet, 'login', email, identity.authorizedBranch, '', 'success', identity.role);
  return {
    authenticated: true,
    token,
    branch: identity.authorizedBranch,
    userEmail: email,
    role: identity.role,
    dataScope: identity.dataScope,
    columnAccess: identity.columnAccess,
    accessLevel: identity.columnAccess === 'restricted' ? 'restricted' : 'all',
    reviewCompleted: true,
    approvedFromPending
  };
}

function findPendingAccessForLogin_(spreadsheet, email) {
  const sheet = ensureAccessRequestSheet_(spreadsheet);
  if (sheet.getLastRow() <= 1) return null;
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, ACCESS_REQUEST_HEADERS.length).getValues();
  const matches = data.map((row, index) => ({
    row: index + 2, requestId: String(row[0]), requestedAt: row[1], branch: String(row[2]),
    email: normalizeEmail_(row[4]), role: String(row[5]), status: String(row[6]).toLowerCase()
  })).filter(item => item.email === normalizeEmail_(email) && item.status === 'pending');
  const branches = Array.from(new Set(matches.map(item => normalizeBranch_(item.branch))));
  if (branches.length > 1) throw new Error('Request akses ambigu: email meminta lebih dari satu cabang. Hubungi HQ.');
  return matches.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())[0] || null;
}

function activateAccessRequest_(spreadsheet, requestRow, reviewer) {
  const sheet = ensureAccessRequestSheet_(spreadsheet);
  const values = sheet.getRange(requestRow, 1, 1, ACCESS_REQUEST_HEADERS.length).getValues()[0];
  if (String(values[6]).toLowerCase() !== 'pending') throw new Error('Request sudah pernah diproses.');
  const branch = String(values[2]);
  const name = String(values[3]) || 'User';
  const email = normalizeEmail_(values[4]);
  const role = String(values[5]);
  const branchMatch = getBranchRows_(spreadsheet).find(item => normalizeBranch_(item.branch) === normalizeBranch_(branch));
  if (!branchMatch) throw new Error('Cabang request tidak lagi tersedia.');
  const dropdown = spreadsheet.getSheetByName('DROPDOWNS');
  const readColumns = role === 'BM' ? DROPDOWN_ACCESS_COLUMNS.bmRead
    : role === 'SA Kids' ? DROPDOWN_ACCESS_COLUMNS.saKidsRead : [];
  const targetCol = role === 'BM' ? DROPDOWN_ACCESS_COLUMNS.bmWrite
    : role === 'SA Kids' ? DROPDOWN_ACCESS_COLUMNS.saKidsWrite : 0;
  if (!targetCol) throw new Error('Role request tidak valid.');
  const alreadyRegistered = readColumns.some(column => parseBranchCellEntries_(dropdown.getRange(branchMatch.row, column).getValue())
    .some(entry => entry.email === email));
  const entries = parseBranchCellEntries_(dropdown.getRange(branchMatch.row, targetCol).getValue());
  if (!alreadyRegistered) {
    entries.push({ name, email });
    dropdown.getRange(branchMatch.row, targetCol).setValue(entries.map(entry => `${entry.name} - ${entry.email}`).join(', '));
  }
  grantBranchFolderAccess_(email, branchMatch.branch);
  sheet.getRange(requestRow, 7, 1, 3).setValues([['approved', new Date().toISOString(), reviewer]]);
  auditDashboard_(spreadsheet, 'access_activated', email, branchMatch.branch, '', 'approved', `${role}; reviewer=${reviewer}`);
  return { email, branch: branchMatch.branch, role };
}

function saveDashboardSession_(spreadsheet, token, identity) {
  const sheet = ensureDashboardSessionSheet_(spreadsheet);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + PLACEMENT_CONFIG.dashboardSessionHours * 60 * 60 * 1000);
  sheet.appendRow([hash_(token), identity.authorizedBranch, identity.email, identity.role, identity.dataScope, identity.columnAccess, now.toISOString(), expiresAt.toISOString(), '']);
}

function requireDashboardSession_(spreadsheet, token) {
  const cleanToken = String(token || '').trim();
  if (!cleanToken) throw new Error('Token sesi tidak valid. Silakan login kembali.');
  const sheet = ensureDashboardSessionSheet_(spreadsheet);
  const tokenHash = hash_(cleanToken);
  const data = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, DASHBOARD_SESSION_HEADERS.length).getValues() : [];
  for (let i = data.length - 1; i >= 0; i--) {
    if (String(data[i][0]) !== tokenHash) continue;
    if (data[i][8]) throw new Error('Sesi telah dicabut. Silakan login kembali.');
    if (Date.now() > new Date(data[i][7]).getTime()) throw new Error('Sesi telah kadaluarsa. Silakan login kembali.');
    const session = {
      row: i + 2,
      tokenHash,
      branch: String(data[i][1]),
      email: normalizeEmail_(data[i][2]),
      role: String(data[i][3]),
      dataScope: String(data[i][4]) === 'all' ? 'all' : 'branch',
      columnAccess: String(data[i][5]) === 'full' ? 'full' : 'restricted',
      accessLevel: String(data[i][5]) === 'restricted' ? 'restricted' : 'all'
    };
    const currentIdentity = findDashboardIdentity_(spreadsheet, session.email);
    if (normalizeBranch_(currentIdentity.authorizedBranch) !== normalizeBranch_(session.branch)
      || currentIdentity.dataScope !== session.dataScope
      || currentIdentity.columnAccess !== session.columnAccess) {
      sheet.getRange(session.row, 9).setValue(new Date().toISOString());
      throw new Error('Hak akses berubah atau dicabut. Silakan login kembali.');
    }
    return session;
  }
  throw new Error('Sesi tidak terautentikasi.');
}

function requireHqSession_(spreadsheet, token) {
  const session = requireDashboardSession_(spreadsheet, token);
  if (session.dataScope !== 'all' || session.role !== 'HQ') throw new Error('Endpoint ini hanya dapat diakses HQ.');
  return session;
}

function approveDashboardAccess_(operation) {
  const spreadsheet = SpreadsheetApp.openById(PLACEMENT_CONFIG.spreadsheetId);
  const hq = requireHqSession_(spreadsheet, operation.token);
  const requestId = String(operation.requestId || '').trim();
  const decision = String(operation.decision || 'approved').toLowerCase();
  if (!requestId || !['approved', 'rejected'].includes(decision)) throw new Error('Request atau keputusan tidak valid.');
  const sheet = ensureAccessRequestSheet_(spreadsheet);
  const finder = sheet.getRange('A:A').createTextFinder(requestId).matchEntireCell(true).findNext();
  if (!finder || finder.getRow() <= 1) throw new Error('Request akses tidak ditemukan.');
  const requestRow = finder.getRow();
  const values = sheet.getRange(requestRow, 1, 1, ACCESS_REQUEST_HEADERS.length).getValues()[0];
  if (String(values[6]).toLowerCase() !== 'pending') throw new Error('Request sudah pernah diproses.');
  const branch = String(values[2]);
  const email = normalizeEmail_(values[4]);
  const role = String(values[5]);
  if (decision === 'approved') {
    activateAccessRequest_(spreadsheet, requestRow, hq.email);
  } else {
    sheet.getRange(requestRow, 7, 1, 3).setValues([[decision, new Date().toISOString(), hq.email]]);
    auditDashboard_(spreadsheet, 'access_review', email, branch, '', decision, `${role}; reviewer=${hq.email}`);
  }
  return { requestId, status: decision };
}

function getAccessRequests_(operation) {
  const spreadsheet = SpreadsheetApp.openById(PLACEMENT_CONFIG.spreadsheetId);
  requireHqSession_(spreadsheet, operation.token);
  const sheet = ensureAccessRequestSheet_(spreadsheet);
  const status = String(operation.status || 'pending').toLowerCase();
  const data = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, ACCESS_REQUEST_HEADERS.length).getValues() : [];
  return { requests: data.filter(row => !status || String(row[6]).toLowerCase() === status).map(row => ({
    requestId: row[0], requestedAt: row[1], branch: row[2], name: row[3], email: row[4], role: row[5], status: row[6]
  })).reverse() };
}

function getSessionRows_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(PLACEMENT_CONFIG.sessionsSheet);
  if (!sheet || sheet.getLastRow() <= 1) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, SESSION_HEADERS.length).getValues()
    .map(row => Object.fromEntries(SESSION_HEADERS.map((header, index) => [header, row[index]])));
}

function requireRowScope_(session, row) {
  if (session.dataScope === 'all') return true;
  if (normalizeBranch_(row.branch) !== normalizeBranch_(session.branch)) throw new Error('Data berada di luar scope cabang Anda.');
  return true;
}

function filterSessionRows_(rows, session, filters) {
  const f = filters || {};
  return rows.filter(row => {
    if (session.dataScope !== 'all' && normalizeBranch_(row.branch) !== normalizeBranch_(session.branch)) return false;
    const branch = normalizeBranchForAudit_(row.branch);
    const mode = normalizeBranch_(branch) === 'online' ? 'online' : 'offline';
    const date = new Date(row.registered_at);
    const query = String(f.query || '').toLowerCase().trim();
    const searchValues = session.columnAccess === 'restricted'
      ? [row.submission_id, row.student_name, row.parent_email]
      : [row.submission_id, row.student_name, row.parent_email, branch, row.assigned_module, row.assigned_level];
    if (query && !searchValues
      .some(value => String(value || '').toLowerCase().includes(query))) return false;
    if (f.branch && normalizeBranch_(branch) !== normalizeBranch_(f.branch)) return false;
    if (f.mode && String(f.mode).toLowerCase() !== mode) return false;
    if (f.audience && normalizeBranch_(row.audience) !== normalizeBranch_(f.audience)) return false;
    if (f.status && normalizeBranch_(row.final_status || 'in_progress') !== normalizeBranch_(f.status)) return false;
    if (f.module && !String(row.assigned_module || '').toLowerCase().includes(String(f.module).toLowerCase())) return false;
    if (f.level && !String(row.assigned_level || '').toLowerCase().includes(String(f.level).toLowerCase())) return false;
    if (f.pdf === 'ready' && (!row.pdf_file_id || !row.pdf_file_url)) return false;
    if (f.pdf === 'missing' && row.pdf_file_id && row.pdf_file_url) return false;
    if (f.emailStatus && normalizeBranch_(row.email_status || 'not sent') !== normalizeBranch_(f.emailStatus)) return false;
    if (f.dateFrom && (!Number.isFinite(date.getTime()) || date < new Date(`${f.dateFrom}T00:00:00`))) return false;
    if (f.dateTo && (!Number.isFinite(date.getTime()) || date > new Date(`${f.dateTo}T23:59:59`))) return false;
    return true;
  });
}

function safePdfUrlForSession_(row, session) {
  const url = String(row.pdf_file_url || '');
  if (!url || session.dataScope === 'all') return url;
  try {
    const expectedFolder = findBranchFolder_(session.branch);
    if (!expectedFolder) return '';
    const parents = DriveApp.getFileById(String(row.pdf_file_id || '')).getParents();
    while (parents.hasNext()) if (parents.next().getId() === expectedFolder.getId()) return url;
  } catch (error) {}
  return '';
}

function fullDashboardResult_(row, session) {
  return {
    placement_id: row.submission_id || '-', student_name: row.student_name || '-', student_age: row.exact_age || '-',
    audience: row.audience || '-', parent_email: row.parent_email || '-', test_date: row.registered_at || '',
    branch: normalizeBranchForAudit_(row.branch), child_confirmed: row.child_confirmed === 'TRUE' || row.child_confirmed === true,
    guardian_confirmed: row.guardian_confirmed === 'TRUE' || row.guardian_confirmed === true,
    assigned_module: row.assigned_module || '-', potential_module: row.potential_module || '-', assigned_level: row.assigned_level || '-',
    final_status: row.final_status || 'in_progress', pdf_file_url: safePdfUrlForSession_(row, session),
    placement_review_status: row.placement_review_status || 'submitted',
    email_status: row.email_status || 'not sent', current_stage: row.current_stage || 1, last_activity_at: row.last_activity_at || '',
    last_error: row.last_error || ''
  };
}

function restrictedDashboardResult_(row, session) {
  return {
    placement_id: row.submission_id || '-', student_name: row.student_name || '-', parent_email: row.parent_email || '-',
    final_status: row.final_status || 'in_progress', pdf_file_url: safePdfUrlForSession_(row, session),
    placement_review_status: row.placement_review_status || 'submitted',
    email_status: row.email_status || 'not sent'
  };
}

function getBranchResults_(operation) {
  const spreadsheet = SpreadsheetApp.openById(PLACEMENT_CONFIG.spreadsheetId);
  const session = requireDashboardSession_(spreadsheet, operation.token);
  const filters = operation.filters || {};
  if (session.columnAccess === 'restricted') {
    const forbidden = ['branch', 'mode', 'audience', 'module', 'level', 'dateFrom', 'dateTo'];
    if (forbidden.some(key => String(filters[key] || '').trim())) throw new Error('Filter tersebut tidak tersedia untuk akses restricted.');
  }
  const page = Math.max(1, Number(operation.page || 1));
  const pageSize = Math.min(100, Math.max(10, Number(operation.pageSize || 25)));
  const rows = filterSessionRows_(getSessionRows_(spreadsheet), session, filters)
    .sort((a, b) => new Date(b.registered_at).getTime() - new Date(a.registered_at).getTime());
  const start = (page - 1) * pageSize;
  const mapper = session.columnAccess === 'full' ? fullDashboardResult_ : restrictedDashboardResult_;
  const results = rows.slice(start, start + pageSize).map(row => mapper(row, session));
  auditDashboard_(spreadsheet, 'data_access', session.email, session.branch, '', 'success', `page=${page}; count=${results.length}`);
  return {
    branch: session.branch, userEmail: session.email, role: session.role, dataScope: session.dataScope,
    columnAccess: session.columnAccess, accessLevel: session.accessLevel, page, pageSize,
    total: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / pageSize)), results
  };
}

function getHqOverview_(operation) {
  const spreadsheet = SpreadsheetApp.openById(PLACEMENT_CONFIG.spreadsheetId);
  const session = requireHqSession_(spreadsheet, operation.token);
  const rows = filterSessionRows_(getSessionRows_(spreadsheet), session, operation.filters);
  const now = Date.now();
  const stalledBefore = now - PLACEMENT_CONFIG.stalledHours * 60 * 60 * 1000;
  const completed = rows.filter(row => normalizeBranch_(row.final_status) === 'completed');
  const stalled = rows.filter(row => normalizeBranch_(row.final_status) !== 'completed' && new Date(row.last_activity_at || row.registered_at).getTime() < stalledBefore);
  const online = rows.filter(row => normalizeBranch_(row.branch) === 'online');
  const offline = rows.filter(row => normalizeBranch_(row.branch) !== 'online');
  const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
  const startWeek = new Date(startToday); startWeek.setDate(startWeek.getDate() - ((startWeek.getDay() + 6) % 7));
  const startMonth = new Date(startToday.getFullYear(), startToday.getMonth(), 1);
  const isAfter = (row, date) => new Date(row.registered_at).getTime() >= date.getTime();
  const branchMap = {};
  rows.forEach(row => {
    const branch = normalizeBranchForAudit_(row.branch);
    if (!branchMap[branch]) branchMap[branch] = { branch, total: 0, completed: 0, stage1: 0, stage2: 0, stage3: 0, stalled: 0, lastActivity: '' };
    const item = branchMap[branch];
    item.total += 1;
    if (normalizeBranch_(row.final_status) === 'completed') item.completed += 1;
    if (normalizeBranch_(row.stage1_status) === 'completed') item.stage1 += 1;
    if (normalizeBranch_(row.stage2_status) === 'completed') item.stage2 += 1;
    if (normalizeBranch_(row.stage3_status) === 'completed') item.stage3 += 1;
    if (normalizeBranch_(row.final_status) !== 'completed' && new Date(row.last_activity_at || row.registered_at).getTime() < stalledBefore) item.stalled += 1;
    if (!item.lastActivity || new Date(row.last_activity_at) > new Date(item.lastActivity)) item.lastActivity = row.last_activity_at || row.registered_at;
  });
  const branches = Object.values(branchMap).map(item => ({ ...item, incomplete: item.total - item.completed, completionRate: item.total ? Math.round(item.completed * 1000 / item.total) / 10 : 0 }));
  const topBy = key => branches.slice().sort((a, b) => b[key] - a[key] || b.total - a.total).slice(0, 3);
  const countStage = stage => rows.filter(row => normalizeBranch_(row[`stage${stage}_status`]) === 'completed').length;
  const funnelValues = [rows.length, countStage(1), countStage(2), countStage(3), completed.length];
  const funnelNames = ['Registrasi', 'Stage 1', 'Stage 2', 'Stage 3', 'Final'];
  const funnel = funnelNames.map((name, index) => ({ name, count: funnelValues[index], percent: rows.length ? Math.round(funnelValues[index] * 1000 / rows.length) / 10 : 0, dropOff: index ? funnelValues[index - 1] - funnelValues[index] : 0 }));
  const trendMap = {};
  rows.forEach(row => {
    const date = new Date(row.registered_at);
    if (!Number.isFinite(date.getTime())) return;
    const key = Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    if (!trendMap[key]) trendMap[key] = { date: key, total: 0, completed: 0 };
    trendMap[key].total += 1;
    if (normalizeBranch_(row.final_status) === 'completed') trendMap[key].completed += 1;
  });
  const alertItems = {
    syncFailed: rows.filter(row => String(row.last_error || '').trim()).slice(0, 10).map(row => row.submission_id),
    stalled: stalled.slice(0, 10).map(row => row.submission_id),
    finalWithoutPdf: completed.filter(row => !row.pdf_file_id || !row.pdf_file_url).slice(0, 10).map(row => row.submission_id),
    emailPendingOrFailed: completed.filter(row => normalizeBranch_(row.email_status) !== 'sent').slice(0, 10).map(row => row.submission_id)
  };
  auditDashboard_(spreadsheet, 'hq_overview', session.email, 'All Access', '', 'success', `count=${rows.length}`);
  return {
    generatedAt: new Date().toISOString(),
    kpis: {
      total: rows.length, completed: completed.length, completedPercent: rows.length ? Math.round(completed.length * 1000 / rows.length) / 10 : 0,
      incomplete: rows.length - completed.length, incompletePercent: rows.length ? Math.round((rows.length - completed.length) * 1000 / rows.length) / 10 : 0,
      stalled: stalled.length, activeBranches: Object.keys(branchMap).filter(branch => branch !== 'Legacy/Unknown').length,
      online: online.length, offline: offline.length, today: rows.filter(row => isAfter(row, startToday)).length,
      thisWeek: rows.filter(row => isAfter(row, startWeek)).length, thisMonth: rows.filter(row => isAfter(row, startMonth)).length
    },
    funnel, trends: Object.values(trendMap).sort((a, b) => a.date.localeCompare(b.date)).slice(-30),
    topBranches: { byVolume: topBy('total'), byCompleted: topBy('completed'), byCompletionRate: topBy('completionRate') },
    branches: branches.sort((a, b) => b.total - a.total),
    alerts: Object.fromEntries(Object.entries(alertItems).map(([key, ids]) => [key, { count: key === 'stalled' ? stalled.length : key === 'syncFailed' ? rows.filter(row => String(row.last_error || '').trim()).length : key === 'finalWithoutPdf' ? completed.filter(row => !row.pdf_file_id || !row.pdf_file_url).length : completed.filter(row => normalizeBranch_(row.email_status) !== 'sent').length, submissionIds: ids }]))
  };
}

function updateEmailStatus_(operation) {
  const submissionId = String(operation.submissionId || '').trim();
  const requestedStatus = String(operation.emailStatus || operation.status || '').trim().toLowerCase();
  if (!submissionId) throw new Error('submissionId wajib diisi.');
  if (!['sent', 'send', 'not sent', 'not_sent'].includes(requestedStatus)) throw new Error('Status email tidak valid.');
  const spreadsheet = SpreadsheetApp.openById(PLACEMENT_CONFIG.spreadsheetId);
  const session = requireDashboardSession_(spreadsheet, operation.token);
  const sheet = spreadsheet.getSheetByName(PLACEMENT_CONFIG.sessionsSheet);
  const found = findSession_(sheet, submissionId);
  if (!found.exists) throw new Error(`Submission ID ${submissionId} tidak ditemukan.`);
  const row = sessionObject_(sheet, found.row);
  requireRowScope_(session, row);
  let response;
  if (requestedStatus === 'sent' || requestedStatus === 'send') {
    throw new Error('Gunakan action approve_and_send_result setelah review hasil.');
  } else {
    if (String(row.email_status || '').trim().toLowerCase() === 'sent') {
      throw new Error('Email yang sudah terkirim tidak dapat di-reset melalui endpoint status lama.');
    }
    upsertSession_(sheet, found, { email_status: 'not sent', email_sent_at: '', last_error: '', updated_at: new Date().toISOString() });
    response = { submissionId, emailStatus: 'not sent' };
  }
  auditDashboard_(spreadsheet, 'email_status_update', session.email, session.branch, submissionId, 'success', response.emailStatus);
  return response;
}

function approveAndSendResult_(operation) {
  const submissionId = String(operation.submissionId || '').trim();
  if (!submissionId) throw new Error('submissionId wajib diisi.');
  const spreadsheet = SpreadsheetApp.openById(PLACEMENT_CONFIG.spreadsheetId);
  const session = requireDashboardSession_(spreadsheet, operation.token);
  const sheet = spreadsheet.getSheetByName(PLACEMENT_CONFIG.sessionsSheet);
  const found = findSession_(sheet, submissionId);
  if (!found.exists) throw new Error(`Submission ID ${submissionId} tidak ditemukan.`);
  const row = sessionObject_(sheet, found.row);
  requireRowScope_(session, row);
  if (!row.pdf_file_id || !row.pdf_file_url) throw new Error('PDF hasil belum siap.');

  const isLv3Candidate = row.lv3_candidate === true || String(row.lv3_candidate).toLowerCase() === 'true';
  const now = new Date().toISOString();
  upsertSession_(sheet, found, {
    placement_review_status: isLv3Candidate ? 'lv3_candidate' : 'approved',
    placement_reviewed_at: now,
    placement_reviewed_by: session.email,
    updated_at: now
  });

  const sendResult = sendParentEmail_(sheet, found.row);
  const emailStatus = sendResult.held ? 'waiting_branch_recipient' : 'sent';
  auditDashboard_(spreadsheet, 'approve_and_send_result', session.email, session.branch, submissionId, emailStatus, `review=${isLv3Candidate ? 'lv3_candidate' : 'approved'}`);
  return {
    submissionId,
    approved: true,
    reviewStatus: isLv3Candidate ? 'lv3_candidate' : 'approved',
    held: sendResult.held === true,
    emailStatus,
    emailSentAt: sendResult.emailSentAt || '',
    alreadySent: sendResult.alreadySent === true
  };
}

function updateResultReview_(operation) {
  const allowed = [
    'submitted', 'under_review', 'approved', 'needs_manual_review',
    'lv3_candidate', 'lv3_approved', 'lv3_not_approved'
  ];
  const submissionId = String(operation.submissionId || '').trim();
  const status = String(operation.reviewStatus || operation.status || '').trim().toLowerCase();
  if (!submissionId) throw new Error('submissionId wajib diisi.');
  if (!allowed.includes(status)) throw new Error('Status review placement tidak valid.');

  const spreadsheet = SpreadsheetApp.openById(PLACEMENT_CONFIG.spreadsheetId);
  const session = requireDashboardSession_(spreadsheet, operation.token);
  const sheet = spreadsheet.getSheetByName(PLACEMENT_CONFIG.sessionsSheet);
  const found = findSession_(sheet, submissionId);
  if (!found.exists) throw new Error(`Submission ID ${submissionId} tidak ditemukan.`);
  const row = sessionObject_(sheet, found.row);
  requireRowScope_(session, row);

  const now = new Date().toISOString();
  upsertSession_(sheet, found, {
    placement_review_status: status,
    placement_reviewed_at: now,
    placement_reviewed_by: session.email,
    updated_at: now
  });
  auditDashboard_(spreadsheet, 'result_review_update', session.email, session.branch, submissionId, status, '');
  return { submissionId, reviewStatus: status, reviewedAt: now, reviewedBy: session.email };
}

function getOrCreateBranchFolder_(branch) {
  const root = DriveApp.getFolderById(PLACEMENT_CONFIG.pdfFolderId);
  const safeBranch = normalizeBranchForAudit_(branch).replace(/[\\/:*?"<>|]+/g, '-').trim();
  const name = `Placement Test - ${safeBranch}`;
  const existing = root.getFoldersByName(name);
  return existing.hasNext() ? existing.next() : root.createFolder(name);
}

function findBranchFolder_(branch) {
  const root = DriveApp.getFolderById(PLACEMENT_CONFIG.pdfFolderId);
  const safeBranch = normalizeBranchForAudit_(branch).replace(/[\\/:*?"<>|]+/g, '-').trim();
  const existing = root.getFoldersByName(`Placement Test - ${safeBranch}`);
  return existing.hasNext() ? existing.next() : null;
}

function grantFolderViewer_(folder, email) {
  try {
    folder.addViewer(email);
    return true;
  } catch (error) {
    console.error(`Failed to grant folder access to ${email}: ${error}`);
    return false;
  }
}

function grantBranchFolderAccess_(email, branch) {
  return grantFolderViewer_(getOrCreateBranchFolder_(branch), email);
}

function grantRootFolderAccess_(email) {
  return grantFolderViewer_(DriveApp.getFolderById(PLACEMENT_CONFIG.pdfFolderId), email);
}

function migratePlacementPdfsToBranchFolders() {
  const spreadsheet = SpreadsheetApp.openById(PLACEMENT_CONFIG.spreadsheetId);
  const rows = getSessionRows_(spreadsheet);
  let moved = 0;
  let skipped = 0;
  rows.forEach(row => {
    if (!row.pdf_file_id) { skipped += 1; return; }
    try {
      DriveApp.getFileById(String(row.pdf_file_id)).moveTo(getOrCreateBranchFolder_(normalizeBranchForAudit_(row.branch)));
      moved += 1;
    } catch (error) {
      skipped += 1;
    }
  });
  return { moved, skipped };
}

function logoutDashboard_(operation) {
  const token = String(operation.token || '').trim();
  if (!token) return { loggedOut: true };
  const spreadsheet = SpreadsheetApp.openById(PLACEMENT_CONFIG.spreadsheetId);
  try {
    const session = requireDashboardSession_(spreadsheet, token);
    const sheet = spreadsheet.getSheetByName('DashboardSessions');
    sheet.getRange(session.row, 9).setValue(new Date().toISOString());
    auditDashboard_(spreadsheet, 'logout', session.email, session.branch, '', 'success', '');
  } catch (error) {}
  return { loggedOut: true };
}
