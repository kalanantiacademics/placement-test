(function placementSyncBootstrap(global) {
  'use strict';

  const CONFIG = {
    webAppUrl: String(
      global.PLACEMENT_WEB_APP_URL
      || 'https://script.google.com/macros/s/AKfycbxYga6HmAaTkAjVnwMX-AVJ7shYdg8JWeiLfcExhV0Lv1y6lxL0qr0oQIvYQkaLRznh/exec'
    ).trim(),
    queueKey: 'pt_sync_queue_v1',
    tokenKey: 'pt_sync_token_v1',
    cleanupKey: 'pt_cleanup_after_v1',
    cleanupDelayMs: 60 * 60 * 1000,
    retryDelayMs: 15 * 1000
  };

  let retryTimer = null;
  const reportPdfCache = new WeakMap();
  const visualFinalizeRetryTimers = new Map();
  const html2PdfLoads = new WeakMap();
  const HTML2PDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';

  function readJson(key, fallback = null) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function randomToken() {
    if (global.crypto?.randomUUID) return global.crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  }

  function getRegistration() {
    return readJson('pt_student_registration') || readJson('pt_student_profile');
  }

  function getSubmissionId() {
    const registration = getRegistration();
    return registration?.submissionId || registration?.student?.submissionId || '';
  }

  function getSyncToken() {
    let token = localStorage.getItem(CONFIG.tokenKey);
    if (!token) {
      token = randomToken();
      localStorage.setItem(CONFIG.tokenKey, token);
    }
    return token;
  }

  function getQueue() {
    return readJson(CONFIG.queueKey, []);
  }

  function setQueue(queue) {
    writeJson(CONFIG.queueKey, queue);
  }

  function queueOperation(action, payload, options = {}) {
    const submissionId = options.submissionId || getSubmissionId() || payload?.submissionId;
    if (!submissionId) return Promise.resolve({ queued: false, reason: 'missing_submission_id' });

    const queue = getQueue();
    const rawRevision = options.revision || payload?.revision || Date.now();
    const numericRevision = Number(rawRevision);
    const parsedRevision = Date.parse(String(rawRevision));
    const revision = Number.isFinite(numericRevision)
      ? numericRevision
      : Number.isFinite(parsedRevision)
        ? parsedRevision
        : Date.now();
    const operation = {
      operationId: `${submissionId}:${action}:${options.stage || payload?.stage || 'session'}:${revision}`,
      action,
      submissionId,
      syncToken: getSyncToken(),
      stage: options.stage || payload?.stage || null,
      revision,
      payload,
      queuedAt: new Date().toISOString(),
      attempts: 0
    };

    const existingIndex = queue.findIndex(item => item.operationId === operation.operationId);
    if (existingIndex >= 0) queue[existingIndex] = operation;
    else queue.push(operation);
    setQueue(queue);
    return flush();
  }

  async function send(operation) {
    if (!CONFIG.webAppUrl) return { ok: false, queued: true, reason: 'web_app_url_not_configured' };
    const response = await fetch(CONFIG.webAppUrl, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(operation)
    });
    if (!response.ok) throw new Error(`sync_http_${response.status}`);
    const result = await response.json();
    if (!result?.ok) throw new Error(result?.error || 'sync_rejected');
    return result;
  }

  async function flush() {
    if (!CONFIG.webAppUrl) return { ok: false, queued: getQueue().length, reason: 'web_app_url_not_configured' };
    const queue = getQueue();
    if (!queue.length) return { ok: true, queued: 0 };

    const remaining = [];
    let lastResult = null;
    for (const operation of queue) {
      try {
        lastResult = await send(operation);
        if (operation.action === 'finalize' && lastResult?.finalized) scheduleCleanup();
      } catch (error) {
        remaining.push({
          ...operation,
          attempts: Number(operation.attempts || 0) + 1,
          lastAttemptAt: new Date().toISOString(),
          lastError: String(error?.message || error)
        });
      }
    }
    setQueue(remaining);
    if (remaining.length) scheduleRetry();
    return { ok: remaining.length === 0, queued: remaining.length, lastResult };
  }

  function scheduleRetry() {
    if (retryTimer || !CONFIG.webAppUrl) return;
    retryTimer = global.setTimeout(async () => {
      retryTimer = null;
      await flush();
    }, CONFIG.retryDelayMs);
  }

  function scheduleCleanup() {
    const cleanupAt = Date.now() + CONFIG.cleanupDelayMs;
    localStorage.setItem(CONFIG.cleanupKey, String(cleanupAt));
    global.setTimeout(clearCompletedSessionIfDue, CONFIG.cleanupDelayMs + 250);
  }

  function clearCompletedSessionIfDue() {
    const cleanupAt = Number(localStorage.getItem(CONFIG.cleanupKey));
    if (!cleanupAt || Date.now() < cleanupAt || getQueue().length) return false;

    if (global.PlacementSession?.destroyCurrent) {
      return global.PlacementSession.destroyCurrent();
    }

    const keysToRemove = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key && (key.startsWith('pt_') || key.startsWith('kalananti-'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    return true;
  }

  function register(registration) {
    return queueOperation('register', registration, {
      submissionId: registration?.submissionId,
      revision: registration?.timestamp || Date.now()
    });
  }

  function saveStage(stage, payload, status = 'completed') {
    return queueOperation('save_stage', {
      stage,
      status,
      data: payload,
      savedAt: new Date().toISOString()
    }, {
      stage,
      revision: payload?.revision || payload?.completedAt || Date.now()
    });
  }

  function checkpoint(stage, payload) {
    return saveStage(stage, payload, 'in_progress');
  }

  function finalize(payload) {
    return queueOperation('finalize', {
      ...payload,
      completedAt: payload?.completedAt || new Date().toISOString()
    }, {
      revision: payload?.completedAt || Date.now()
    });
  }

  function loadHtml2Pdf(targetDocument = document) {
    const targetWindow = targetDocument.defaultView || global;
    if (typeof targetWindow.html2pdf === 'function') {
      return Promise.resolve(targetWindow.html2pdf);
    }
    const pending = html2PdfLoads.get(targetDocument);
    if (pending) return pending;

    const promise = new Promise((resolve, reject) => {
      const existing = targetDocument.querySelector('script[data-placement-html2pdf]');
      const script = existing || targetDocument.createElement('script');
      const onLoad = () => {
        if (typeof targetWindow.html2pdf === 'function') resolve(targetWindow.html2pdf);
        else reject(new Error('html2pdf_unavailable'));
      };
      script.addEventListener('load', onLoad, { once: true });
      script.addEventListener('error', () => reject(new Error('html2pdf_load_failed')), { once: true });
      if (!existing) {
        script.dataset.placementHtml2pdf = 'true';
        script.src = HTML2PDF_URL;
        script.crossOrigin = 'anonymous';
        targetDocument.head.appendChild(script);
      }
    }).catch(error => {
      html2PdfLoads.delete(targetDocument);
      throw error;
    });

    html2PdfLoads.set(targetDocument, promise);
    return promise;
  }

  function collectPrintCss(sourceDocument = document) {
    const rules = [];
    const sourceWindow = sourceDocument.defaultView || global;
    for (const sheet of Array.from(sourceDocument.styleSheets || [])) {
      let cssRules;
      try {
        cssRules = sheet.cssRules;
      } catch (error) {
        continue;
      }
      for (const rule of Array.from(cssRules || [])) {
        if (
          rule.type === sourceWindow.CSSRule?.MEDIA_RULE
          && String(rule.conditionText || '').toLowerCase().includes('print')
        ) {
          for (const childRule of Array.from(rule.cssRules || [])) {
            rules.push(childRule.cssText);
          }
        }
      }
    }
    return rules.join('\n');
  }

  function installPdfExportStyle(sourceDocument = document, report = null) {
    const isKidsReport = Boolean(report?.classList?.contains('kids-report'));
    report?.classList?.add('placement-pdf-exporting');
    const style = sourceDocument.createElement('style');
    style.dataset.placementPdfExportStyle = 'true';
    style.textContent = `${isKidsReport ? '' : collectPrintCss(sourceDocument)}
      .placement-pdf-exporting .rc-footer-actions,
      .placement-pdf-exporting .teen-report-actions,
      .placement-pdf-exporting .kids-report-actions,
      .placement-pdf-exporting button,
      .placement-pdf-exporting .no-print { display: none !important; }
      .placement-report.placement-pdf-exporting,
      .teen-report.placement-pdf-exporting,
      .placement-pdf-exporting .placement-report,
      .placement-pdf-exporting .teen-report {
        opacity: 1 !important;
        visibility: visible !important;
        filter: none !important;
        transform: none !important;
        width: 794px !important;
        max-width: 794px !important;
        margin: 0 auto !important;
        padding: 14px 18px !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        background: #ffffff !important;
      }
      .placement-pdf-exporting .teen-print-continuation,
      .placement-pdf-exporting .rc-print-continuation {
        display: flex !important;
        page-break-before: always !important;
        break-before: page !important;
        margin-top: 0 !important;
        margin-bottom: 10px !important;
        padding-top: 0 !important;
      }
      .placement-pdf-exporting .teen-section,
      .placement-pdf-exporting .rc-section {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      .placement-pdf-exporting .teen-report-head,
      .placement-pdf-exporting .rc-header {
        page-break-after: avoid !important;
        break-after: avoid !important;
      }
      .placement-pdf-exporting .teen-two-col,
      .placement-pdf-exporting .rc-grid-2,
      .placement-pdf-exporting .teen-pillar-grid {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      .placement-report.placement-pdf-exporting:not(.kids-report),
      .teen-report.placement-pdf-exporting,
      .placement-pdf-exporting .placement-report:not(.kids-report),
      .placement-pdf-exporting .teen-report {
        position: relative !important;
        min-height: auto !important;
        max-height: none !important;
        box-sizing: border-box !important;
        background: #e8f2ff !important;
      }
      .placement-report.placement-pdf-exporting:not(.kids-report)::after,
      .teen-report.placement-pdf-exporting::after,
      .placement-pdf-exporting .placement-report:not(.kids-report)::after,
      .placement-pdf-exporting .teen-report::after {
        content: "Created by Kalananti Academics · © 2026";
        position: absolute !important;
        right: 0 !important;
        bottom: 12px !important;
        left: 0 !important;
        display: block !important;
        width: 100% !important;
        box-sizing: border-box !important;
        color: rgba(38, 94, 155, 0.62) !important;
        font-family: 'Space Grotesk', 'Inter', system-ui, sans-serif !important;
        font-size: 0.68rem !important;
        font-weight: 750 !important;
        letter-spacing: 0.08em !important;
        line-height: 1.3 !important;
        text-align: center !important;
        text-transform: uppercase !important;
      }
      .placement-pdf-exporting .rc-print-continuation {
        min-height: 54px !important;
        align-items: center !important;
        justify-content: space-between !important;
        gap: 14px !important;
        padding: 10px 18px !important;
        border-radius: 14px !important;
        background: #173f73 !important;
        color: #ffffff !important;
      }
      .placement-pdf-exporting .rc-print-continuation strong {
        color: #ffffff !important;
        font-family: 'Orbitron', 'Space Grotesk', sans-serif !important;
        font-size: 0.96rem !important;
      }
      .placement-pdf-exporting .rc-print-continuation span {
        color: #d9eaff !important;
        font-size: 0.68rem !important;
        font-weight: 750 !important;
        letter-spacing: 0.04em !important;
        text-transform: uppercase !important;
      }
      .placement-report.placement-pdf-exporting:not(.kids-report),
      .placement-pdf-exporting .placement-report:not(.kids-report) {
        color: #17324f !important;
        font-family: 'Space Grotesk', 'Inter', system-ui, sans-serif !important;
        font-size: 13px !important;
        line-height: 1.4 !important;
      }
      .placement-pdf-exporting .placement-report:not(.kids-report) *,
      .placement-pdf-exporting .placement-report:not(.kids-report) *::before,
      .placement-pdf-exporting .placement-report:not(.kids-report) *::after {
        box-sizing: border-box !important;
      }
      .placement-pdf-exporting .placement-report:not(.kids-report) h1,
      .placement-pdf-exporting .placement-report:not(.kids-report) h2 {
        font-family: 'Orbitron', 'Space Grotesk', sans-serif !important;
      }
      .placement-pdf-exporting .placement-report:not(.kids-report) .rc-header {
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        margin: 0 0 10px !important;
        padding: 16px 20px 18px !important;
        border: 1.5px solid rgba(255, 255, 255, 0.42) !important;
        border-radius: 20px !important;
        background: #173f73 !important;
        color: #ffffff !important;
        text-align: center !important;
        box-shadow: 0 14px 28px -20px rgba(16, 52, 92, 0.62) !important;
      }
      .placement-pdf-exporting .placement-report:not(.kids-report) .rc-badge-status {
        margin: 0 0 6px !important;
        padding: 4px 10px !important;
        border: 1px solid #a3d9d3 !important;
        border-radius: 999px !important;
        background: #eef8f5 !important;
        color: #287d73 !important;
        font-size: 0.65rem !important;
        font-weight: 900 !important;
        letter-spacing: 0.04em !important;
        text-transform: uppercase !important;
      }
      .placement-pdf-exporting .placement-report:not(.kids-report) .rc-header h1 {
        max-width: 720px !important;
        margin: 0 0 6px !important;
        color: #ffffff !important;
        font-size: 1.42rem !important;
        line-height: 1.2 !important;
      }
      .placement-pdf-exporting .placement-report:not(.kids-report) .rc-main-rec {
        display: flex !important;
        justify-content: center !important;
        gap: 8px !important;
        margin: 0 0 8px !important;
      }
      .placement-pdf-exporting .placement-report:not(.kids-report) .rc-main-rec span {
        padding: 6px 14px !important;
        border-radius: 11px !important;
        font-size: 0.88rem !important;
        font-weight: 900 !important;
      }
      .placement-pdf-exporting .placement-report:not(.kids-report) .rc-modul {
        border: 2px solid #bfdbfe !important;
        background: #eaf4ff !important;
        color: #265e9b !important;
      }
      .placement-pdf-exporting .placement-report:not(.kids-report) .rc-level {
        border: 0 !important;
        background: #f9c013 !important;
        color: #5a3f00 !important;
      }
      .placement-pdf-exporting .placement-report:not(.kids-report) .rc-main-copy {
        max-width: 700px !important;
        margin: 0 !important;
        color: #eaf4ff !important;
        font-size: 0.78rem !important;
        line-height: 1.38 !important;
      }
      .placement-pdf-exporting .placement-report:not(.kids-report) .rc-section {
        margin: 0 0 10px !important;
        padding: 12px 14px !important;
        border: 1.5px solid rgba(38, 94, 155, 0.18) !important;
        border-radius: 16px !important;
        background: rgba(255, 255, 255, 0.96) !important;
        color: #17324f !important;
        box-shadow: none !important;
      }
      .placement-pdf-exporting .placement-report:not(.kids-report) .rc-section-title {
        display: block !important;
        margin: 0 0 6px !important;
        padding: 0 0 4px !important;
        border-bottom: 2px solid rgba(38, 94, 155, 0.1) !important;
        color: #17324f !important;
        font-size: 0.95rem !important;
        line-height: 1.25 !important;
      }
      .placement-pdf-exporting .rc-profile-chart,
      .placement-pdf-exporting .teen-profile-chart,
      .placement-pdf-exporting .kids-profile-chart {
        width: 320px !important;
        max-width: 320px !important;
        height: 185px !important;
        margin: 0 auto 4px !important;
      }
      .placement-pdf-exporting .rc-profile-chart svg,
      .placement-pdf-exporting .rc-profile-chart img,
      .placement-pdf-exporting .teen-profile-chart svg,
      .placement-pdf-exporting .teen-profile-chart img,
      .placement-pdf-exporting .kids-profile-chart svg,
      .placement-pdf-exporting .kids-profile-chart img {
        display: block !important;
        width: 100% !important;
        height: 100% !important;
        max-height: none !important;
        margin: 0 auto !important;
        object-fit: contain !important;
      }
      .placement-pdf-exporting .placement-report:not(.kids-report) .rc-pillars {
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        gap: 8px !important;
      }
      .placement-pdf-exporting .placement-report:not(.kids-report) .rc-pillar-card {
        padding: 8px 10px !important;
        border: 1px solid #c8ddf2 !important;
        border-radius: 12px !important;
        background: #ffffff !important;
      }
      .placement-pdf-exporting .placement-report:not(.kids-report) .rc-pillar-head {
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        gap: 6px !important;
        margin: 0 0 4px !important;
      }
      .placement-pdf-exporting .placement-report:not(.kids-report) .rc-pillar-name {
        color: #17324f !important;
        font-size: 0.82rem !important;
        font-weight: 850 !important;
      }
      .placement-pdf-exporting .placement-report:not(.kids-report) .rc-band {
        padding: 2px 5px !important;
        border-radius: 6px !important;
        font-size: 0.6rem !important;
        font-weight: 900 !important;
      }
      .placement-pdf-exporting .placement-report:not(.kids-report) .rc-pillar-card p {
        margin: 0 !important;
        color: #365d83 !important;
        font-size: 0.72rem !important;
        line-height: 1.28 !important;
      }
      .placement-pdf-exporting .placement-report:not(.kids-report) .rc-grid-2 {
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        gap: 10px !important;
        margin-bottom: 0 !important;
      }
      .placement-pdf-exporting .placement-report:not(.kids-report) .rc-grid-2 .rc-section {
        padding: 10px 12px !important;
      }
      .placement-pdf-exporting .placement-report:not(.kids-report) .rc-section p,
      .placement-pdf-exporting .placement-report:not(.kids-report) .rc-section li {
        font-size: 0.76rem !important;
        line-height: 1.38 !important;
      }
      .placement-pdf-exporting .placement-report:not(.kids-report) .rc-journey {
        display: grid !important;
        grid-template-columns: repeat(3, 1fr) !important;
        gap: 8px !important;
      }
      .placement-pdf-exporting .placement-report:not(.kids-report) .rc-journey-step {
        display: block !important;
        min-width: 0 !important;
        padding: 8px 10px !important;
        border: 1.5px solid #7f96ad !important;
        border-radius: 14px !important;
        background: #ffffff !important;
      }
      .placement-pdf-exporting .placement-report:not(.kids-report) .rc-j-header {
        display: block !important;
      }
      .placement-pdf-exporting .placement-report:not(.kids-report) .rc-j-label {
        display: flex !important;
        align-items: center !important;
        gap: 5px !important;
        color: #17324f !important;
        font-size: 0.78rem !important;
        font-weight: 850 !important;
      }
      .placement-pdf-exporting .placement-report:not(.kids-report) .rc-j-label-num {
        display: inline-flex !important;
        width: 18px !important;
        height: 18px !important;
        align-items: center !important;
        justify-content: center !important;
        border-radius: 50% !important;
        background: #265e9b !important;
        color: #ffffff !important;
        font-size: 0.62rem !important;
      }
      .placement-pdf-exporting .placement-report:not(.kids-report) .rc-j-status {
        display: inline-block !important;
        margin-top: 5px !important;
        padding: 3px 6px !important;
        border-radius: 6px !important;
        background: #f1f5f9 !important;
        color: #58799b !important;
        font-size: 0.58rem !important;
        font-weight: 800 !important;
      }
      .placement-pdf-exporting .placement-report:not(.kids-report) .rc-j-status.active {
        background: #eef8f5 !important;
        color: #287d73 !important;
      }
      .placement-pdf-exporting .placement-report:not(.kids-report) .rc-j-status.potential {
        background: #fff8e1 !important;
        color: #866200 !important;
      }
      .placement-pdf-exporting .placement-report:not(.kids-report) .rc-journey-step p {
        margin: 4px 0 0 !important;
        color: #4d7298 !important;
        font-size: 0.64rem !important;
        line-height: 1.28 !important;
      }
      .kids-report.placement-pdf-exporting,
      .placement-pdf-exporting .kids-report {
        width: 794px !important;
        max-width: 794px !important;
        margin: 0 auto !important;
        padding: 14px 18px !important;
        box-sizing: border-box !important;
        border-radius: 0 !important;
        background: #e8f2ff !important;
        color: #17324f !important;
        font-family: 'Space Grotesk', 'Inter', system-ui, sans-serif !important;
        font-size: 13px !important;
        line-height: 1.4 !important;
      }
      .kids-report.placement-pdf-exporting::after,
      .placement-pdf-exporting .kids-report::after {
        content: "Created by Kalananti Academics · © 2026";
        display: flex !important;
        width: 100% !important;
        height: 60px !important;
        align-items: flex-end !important;
        justify-content: center !important;
        padding: 0 16px 12px !important;
        box-sizing: border-box !important;
        background: #e8f2ff !important;
        color: rgba(38, 94, 155, 0.62) !important;
        font-family: 'Space Grotesk', 'Inter', system-ui, sans-serif !important;
        font-size: 0.68rem !important;
        font-weight: 750 !important;
        letter-spacing: 0.08em !important;
        text-transform: uppercase !important;
      }
      .placement-pdf-exporting .kids-report *,
      .placement-pdf-exporting .kids-report *::before,
      .placement-pdf-exporting .kids-report *::after {
        box-sizing: border-box !important;
      }
      .placement-pdf-exporting .kids-report h1,
      .placement-pdf-exporting .kids-report h2,
      .placement-pdf-exporting .kids-path-name {
        font-family: 'Orbitron', 'Space Grotesk', sans-serif !important;
      }
      .placement-pdf-exporting .kids-report-head {
        margin: 0 0 10px !important;
        padding: 16px 20px 18px !important;
        border-radius: 20px !important;
        border: 1.5px solid rgba(255, 255, 255, 0.42) !important;
        break-inside: avoid !important;
        page-break-inside: avoid !important;
        box-shadow: 0 14px 28px -20px rgba(16, 52, 92, 0.62) !important;
      }
      .placement-pdf-exporting .kids-report-brand {
        margin-bottom: 12px !important;
      }
      .placement-pdf-exporting .kids-report-brand img {
        height: 38px !important;
      }
      .placement-pdf-exporting .kids-report-meta {
        font-size: 0.74rem !important;
        line-height: 1.35 !important;
      }
      .placement-pdf-exporting .kids-report-status {
        padding: 4px 10px !important;
        font-size: 0.65rem !important;
      }
      .placement-pdf-exporting .kids-report-head h1 {
        margin: 8px 0 6px !important;
        font-size: 1.42rem !important;
        line-height: 1.2 !important;
      }
      .placement-pdf-exporting .kids-report-head .report-student-name {
        display: block !important;
        max-width: 100% !important;
        margin: 0.12em auto 0 !important;
        overflow-wrap: anywhere !important;
        word-break: break-word !important;
        line-height: 1.06 !important;
      }
      .placement-pdf-exporting .report-name-long .report-student-name {
        font-size: 0.78em !important;
        letter-spacing: -0.01em !important;
      }
      .placement-pdf-exporting .report-name-xlong .report-student-name {
        font-size: 0.64em !important;
        line-height: 1.02 !important;
        letter-spacing: -0.02em !important;
      }
      .placement-pdf-exporting .report-name-xxlong .report-student-name {
        font-size: 0.52em !important;
        line-height: 1 !important;
        letter-spacing: -0.025em !important;
      }
      .placement-pdf-exporting .kids-report-placement {
        margin: 8px 0 !important;
        gap: 8px !important;
      }
      .placement-pdf-exporting .kids-report-placement span {
        padding: 6px 14px !important;
        border-radius: 11px !important;
        font-size: 0.88rem !important;
      }
      .placement-pdf-exporting .kids-level {
        background: #f9c013 !important;
      }
      .placement-pdf-exporting .kids-report-head .subtitle {
        max-width: 700px !important;
        font-size: 0.78rem !important;
        line-height: 1.38 !important;
      }
      .placement-pdf-exporting .kids-section {
        margin: 0 0 10px !important;
        padding: 12px 14px !important;
        border-radius: 16px !important;
        border: 1.5px solid rgba(38, 94, 155, 0.18) !important;
        background: rgba(255, 255, 255, 0.96) !important;
        box-shadow: none !important;
      }
      .placement-pdf-exporting .kids-section h2 {
        margin: 0 0 6px !important;
        padding: 0 0 4px !important;
        font-size: 0.95rem !important;
        line-height: 1.25 !important;
      }
      .placement-pdf-exporting .kids-profile-layout {
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        gap: 10px !important;
      }
      .placement-pdf-exporting .kids-pillar-grid {
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        gap: 8px !important;
        width: 100% !important;
      }
      .placement-pdf-exporting .kids-pillar {
        min-height: 0 !important;
        padding: 8px 10px !important;
        border-radius: 12px !important;
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
      .placement-pdf-exporting .kids-pillar-head {
        margin-bottom: 4px !important;
      }
      .placement-pdf-exporting .kids-pillar strong {
        font-size: 0.82rem !important;
      }
      .placement-pdf-exporting .kids-band {
        padding: 2px 5px !important;
        font-size: 0.6rem !important;
      }
      .placement-pdf-exporting .kids-pillar p {
        margin: 0 !important;
        font-size: 0.72rem !important;
        line-height: 1.28 !important;
      }
      .placement-pdf-exporting .kids-print-continuation {
        display: flex !important;
        position: relative !important;
        min-height: 54px !important;
        align-items: stretch !important;
        margin: 10px 0 12px !important;
        padding: 0 !important;
        border-radius: 14px !important;
        overflow: hidden !important;
        break-before: page !important;
        page-break-before: always !important;
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
      .placement-pdf-exporting .kids-print-continuation > div:last-child {
        width: 100% !important;
        min-height: 54px !important;
        padding: 10px 18px !important;
        border-radius: 14px !important;
      }
      .placement-pdf-exporting .kids-print-continuation strong {
        color: #ffffff !important;
        font-family: 'Orbitron', 'Space Grotesk', sans-serif !important;
      .placement-pdf-exporting .kids-print-continuation span {
        color: #d9eaff !important;
        font-size: 0.68rem !important;
      }
      .placement-pdf-exporting .kids-two-col {
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        gap: 10px !important;
      }
      .placement-pdf-exporting .kids-two-col .kids-section,
      .placement-pdf-exporting .teen-two-col .teen-section {
        margin-bottom: 8px !important;
        padding: 8px 10px !important;
      }
      .placement-pdf-exporting .kids-two-col p,
      .placement-pdf-exporting .kids-two-col li,
      .placement-pdf-exporting .teen-two-col p,
      .placement-pdf-exporting .teen-two-col li {
        font-size: 0.72rem !important;
        line-height: 1.32 !important;
      }
      .placement-pdf-exporting .kids-path-name,
      .placement-pdf-exporting .teen-path-name {
        margin: 2px auto 6px !important;
        padding: 4px 12px !important;
        border-radius: 10px !important;
        font-size: 0.92rem !important;
      }
      .placement-pdf-exporting .kids-current-module,
      .placement-pdf-exporting .teen-current-module {
        margin: 0 auto 6px !important;
        padding: 3px 10px !important;
        font-size: 0.72rem !important;
      }
      .placement-pdf-exporting .kids-track,
      .placement-pdf-exporting .teen-track {
        justify-content: center !important;
        overflow: visible !important;
        gap: 6px !important;
        padding: 2px 0 4px !important;
      }
      .placement-pdf-exporting .kids-track-step,
      .placement-pdf-exporting .teen-track-step {
        flex: 1 1 0 !important;
        min-width: 0 !important;
        min-height: 52px !important;
        padding: 6px 8px !important;
        border-radius: 999px !important;
        font-size: 0.74rem !important;
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
      .placement-pdf-exporting .kids-track-step.is-assigned,
      .placement-pdf-exporting .teen-track-step.is-assigned {
        background: #f9c013 !important;
      }
      .placement-pdf-exporting .kids-track-step.is-assigned::after,
      .placement-pdf-exporting .teen-track-step.is-assigned::after {
        top: -7px !important;
        right: 12px !important;
        width: 20px !important;
        height: 20px !important;
        font-size: 0.68rem !important;
      }
      .placement-pdf-exporting .kids-track-arrow,
      .placement-pdf-exporting .teen-track-arrow {
        font-size: 1.1rem !important;
      }
      .placement-pdf-exporting .teen-report-note,
      .placement-pdf-exporting .kids-report-note {
        display: block !important;
        margin-top: 6px !important;
        padding-top: 5px !important;
        border-top: 1px dashed #cbd5e1 !important;
        font-size: 0.65rem !important;
        line-height: 1.25 !important;
        color: #475569 !important;
      }
      .placement-pdf-exporting .kids-report.kids-report-long-name .kids-report-head .subtitle {
        font-size: 0.74rem !important;
        line-height: 1.34 !important;
      }
      .placement-pdf-exporting .kids-report.kids-report-long-name .kids-profile-layout {
        gap: 8px !important;
      }
      .placement-pdf-exporting .kids-report.kids-report-long-name .kids-profile-chart {
        height: 175px !important;
      }
      .placement-pdf-exporting .kids-report.kids-report-long-name .kids-pillar {
        padding: 7px 9px !important;
      }
      .placement-pdf-exporting .kids-report.kids-report-long-name .kids-pillar p {
        font-size: 0.68rem !important;
        line-height: 1.25 !important;
      }`;
    sourceDocument.head.appendChild(style);
    sourceDocument.documentElement.classList.add('placement-pdf-exporting');
    sourceDocument.body.classList.add('placement-pdf-exporting');
    return style;
  }

  function nextPaint(targetWindow = global) {
    const requestFrame = targetWindow.requestAnimationFrame?.bind(targetWindow)
      || global.requestAnimationFrame.bind(global);
    return new Promise(resolve => requestFrame(
      () => requestFrame(resolve)
    ));
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
      reader.onerror = () => reject(reader.error || new Error('pdf_read_failed'));
      reader.readAsDataURL(blob);
    });
  }

  function settleWithin(promise, timeoutMs = 5000) {
    return Promise.race([
      Promise.resolve(promise).catch(() => undefined),
      new Promise(resolve => global.setTimeout(resolve, timeoutMs))
    ]);
  }

  function waitForReportAssets(reportElement) {
    if (!reportElement) return Promise.resolve();
    const images = Array.from(reportElement.querySelectorAll('img'));
    const pending = images
      .filter(img => !img.complete)
      .map(img => new Promise(resolve => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      }));
    return settleWithin(Promise.all(pending), 5000);
  }

  async function rasterizeProfileCharts(reportElement) {
    if (!reportElement) return () => {};
    const chartContainers = Array.from(
      reportElement.querySelectorAll('.rc-profile-chart, .teen-profile-chart, .kids-profile-chart')
    );
    if (!chartContainers.length) return () => {};

    const chartWindow = reportElement.ownerDocument?.defaultView || global;
    const restoredItems = [];

    for (const container of chartContainers) {
      const svg = container.querySelector('svg');
      if (!svg) continue;
      try {
        const svgString = new chartWindow.XMLSerializer().serializeToString(svg);
        const svgBlob = new chartWindow.Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = chartWindow.URL.createObjectURL(svgBlob);
        const img = new chartWindow.Image();
        img.crossOrigin = 'anonymous';

        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = url;
        });

        const rect = container.getBoundingClientRect();
        const dpr = chartWindow.devicePixelRatio || 2;
        const width = Math.max(Math.round(rect.width || 320), 320);
        const height = Math.max(Math.round(rect.height || 185), 185);

        const canvas = reportElement.ownerDocument.createElement('canvas');
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        canvas.style.display = 'block';
        canvas.style.margin = '0 auto';

        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        ctx.drawImage(img, 0, 0, width, height);

        chartWindow.URL.revokeObjectURL(url);
        svg.style.display = 'none';
        container.appendChild(canvas);

        restoredItems.push(() => {
          canvas.remove();
          svg.style.display = '';
        });
      } catch (e) {
        console.warn('SVG rasterization failed, retaining live vector chart.', e);
      }
    }

    return () => restoredItems.forEach(restore => restore());
  }

  async function createReportPdf(options = {}) {
    const frameDoc = document.getElementById('frame')?.contentDocument || document.querySelector('iframe')?.contentDocument;
    const sourceDocument = options.document?.querySelector
      ? options.document
      : (frameDoc || document);
    const report = options.element || (
      typeof options.selector === 'string'
        ? sourceDocument.querySelector(options.selector)
          || document.querySelector(options.selector)
          || (frameDoc ? frameDoc.querySelector(options.selector) : null)
        : null
    );

    if (!report) {
      throw new Error('placement_report_not_found');
    }

    if (reportPdfCache.has(report)) return reportPdfCache.get(report);

    const reportDocument = report.ownerDocument || sourceDocument;
    const reportWindow = reportDocument.defaultView || global;
    const filename = String(options.filename || 'Laporan Placement Test Kalananti.pdf');
    const promise = (async () => {
      const html2Pdf = await loadHtml2Pdf(reportDocument);
      const exportStyle = installPdfExportStyle(reportDocument, report);
      let restoreCharts = () => {};
      try {
        if (reportDocument.fonts?.ready) {
          await settleWithin(reportDocument.fonts.ready, 5000);
        }
        await waitForReportAssets(report);
        await nextPaint(reportWindow);
        restoreCharts = await rasterizeProfileCharts(report);
        await nextPaint(reportWindow);
        const isKidsReport = report.classList.contains('kids-report');
        const isTeensReport = report.classList.contains('teen-report');
        const isJuniorReport = (
          report.classList.contains('placement-report') && !isKidsReport
        );
        const isFullBleedReport = isKidsReport || isTeensReport || isJuniorReport;
        const captureWindowWidth = Math.max(
          794,
          Number(reportWindow.innerWidth) || 0,
          Number(reportDocument.documentElement?.scrollWidth) || 0,
          Number(reportDocument.body?.scrollWidth) || 0
        );
        const worker = html2Pdf().set({
          margin: isFullBleedReport ? 0 : 4,
          filename,
          image: { type: 'jpeg', quality: 0.96 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            allowTaint: false,
            backgroundColor: isFullBleedReport ? '#e8f2ff' : '#ffffff',
            logging: false,
            imageTimeout: 15000,
            scrollX: 0,
            scrollY: 0,
            windowWidth: captureWindowWidth
          },
          jsPDF: {
            unit: 'mm',
            format: 'a4',
            orientation: 'portrait',
            compress: true
          },
          pagebreak: {
            mode: ['css', 'legacy'],
            before: ['.rc-print-continuation', '.teen-print-continuation', '.kids-print-continuation'],
            avoid: ['.rc-header', '.rc-section', '.teen-report-head', '.teen-section', '.teen-two-col', '.teen-pillar-grid', '.kids-report-head', '.kids-pillar', '.kids-track-step', '.kids-section', '.kids-two-col']
          }
        }).from(report);
        const generatedBlob = await worker.toPdf().outputPdf('blob');
        if (!(generatedBlob instanceof reportWindow.Blob) || generatedBlob.size < 1000) {
          throw new Error('invalid_generated_pdf');
        }
        const blob = generatedBlob instanceof global.Blob
          ? generatedBlob
          : new global.Blob(
              [await generatedBlob.arrayBuffer()],
              { type: 'application/pdf' }
            );
        return { blob, filename };
      } finally {
        restoreCharts();
        exportStyle.remove();
        report.classList.remove('placement-pdf-exporting');
        reportDocument.documentElement.classList.remove('placement-pdf-exporting');
        reportDocument.body.classList.remove('placement-pdf-exporting');
      }
    })();

    reportPdfCache.set(report, promise);
    promise.catch(() => reportPdfCache.delete(report));
    return promise;
  }

  async function downloadReportPdf(options = {}) {
    const generated = await createReportPdf(options);
    const url = URL.createObjectURL(generated.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = generated.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    global.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { downloaded: true, filename: generated.filename, size: generated.blob.size };
  }

  async function finalizeWithReport(payload, options = {}) {
    const retryKey = `${getSubmissionId() || 'session'}:${options.filename || 'report'}`;
    try {
      const generated = await createReportPdf(options);
      const base64 = await blobToBase64(generated.blob);
      if (!base64) throw new Error('empty_pdf_attachment');
      const pendingRetry = visualFinalizeRetryTimers.get(retryKey);
      if (pendingRetry) {
        global.clearTimeout(pendingRetry);
        visualFinalizeRetryTimers.delete(retryKey);
      }
      return await finalize({
        ...payload,
        pdfAttachment: {
          filename: generated.filename,
          mimeType: 'application/pdf',
          base64
        }
      });
    } catch (error) {
      console.error('[Placement PDF] Lampiran visual belum siap; email tidak dikirim dan akan dicoba ulang.', error);
      localStorage.setItem('pt_pdf_generation_error_v1', JSON.stringify({
        message: String(error?.message || error),
        recordedAt: new Date().toISOString()
      }));
      if (!visualFinalizeRetryTimers.has(retryKey)) {
        const timer = global.setTimeout(() => {
          visualFinalizeRetryTimers.delete(retryKey);
          finalizeWithReport(payload, options);
        }, CONFIG.retryDelayMs);
        visualFinalizeRetryTimers.set(retryKey, timer);
      }
      return { finalized: false, queued: false, reason: 'visual_pdf_generation_failed' };
    }
  }

  function configure(options = {}) {
    const requestedUrl = typeof options.webAppUrl === 'string'
      ? options.webAppUrl.trim()
      : '';
    if (requestedUrl) CONFIG.webAppUrl = requestedUrl;
    clearCompletedSessionIfDue();
    if (CONFIG.webAppUrl) flush();
  }

  global.PlacementSync = {
    configure,
    register,
    saveStage,
    checkpoint,
    finalize,
    finalizeWithReport,
    createReportPdf,
    downloadReportPdf,
    flush,
    clearCompletedSessionIfDue,
    getQueue,
    getSubmissionId
  };

  global.addEventListener('online', flush);
  clearCompletedSessionIfDue();
})(window);
