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
    cleanupDelayMs: 2 * 60 * 60 * 1000,
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
    touchSessionExpiry();
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
    // A successful finalize means the server already has the report; local student data can go.
    const cleanupAt = Date.now();
    localStorage.setItem(CONFIG.cleanupKey, String(cleanupAt));
    global.setTimeout(clearCompletedSessionIfDue, 250);
  }

  function touchSessionExpiry() {
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
      #pt-loader, .pt-loader,
      .placement-pdf-exporting .rc-footer-actions,
      .placement-pdf-exporting .teen-report-actions,
      .placement-pdf-exporting .kids-report-actions,
      .placement-pdf-exporting button,
      .placement-pdf-exporting .no-print { display: none !important; }

      .a4-container.placement-pdf-exporting,
      .placement-pdf-exporting .a4-container,
      .placement-report.placement-pdf-exporting,
      .teen-report.placement-pdf-exporting,
      .kids-report.placement-pdf-exporting {
        opacity: 1 !important;
        visibility: visible !important;
        filter: none !important;
        transform: none !important;
        width: 794px !important;
        max-width: 794px !important;
        min-height: 297mm !important;
        height: auto !important;
        max-height: none !important;
        margin: 0 !important;
        padding: 16px 18px 18px 18px !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        background: #e8f2ff !important;
        position: relative !important;
        box-sizing: border-box !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 14px !important;
        overflow: hidden !important;
        color: #17324f !important;
        font-family: 'Space Grotesk', 'Inter', system-ui, sans-serif !important;
        font-size: 13px !important;
        line-height: 1.4 !important;
      }

      .placement-pdf-exporting .report-footer {
        width: 100% !important;
        text-align: center !important;
        color: rgba(38, 94, 155, 0.62) !important;
        font-family: 'Space Grotesk', 'Inter', sans-serif !important;
        font-size: 0.7rem !important;
        font-weight: 750 !important;
        letter-spacing: 0.08em !important;
        text-transform: uppercase !important;
        padding-top: 14px !important;
        border-top: 1px dashed rgba(38, 94, 155, 0.25) !important;
        margin-top: 12px !important;
        flex-shrink: 0 !important;
      }

      .placement-pdf-exporting .teen-report-head,
      .placement-pdf-exporting .kids-report-head,
      .placement-pdf-exporting .rc-header {
        position: relative !important;
        isolation: isolate !important;
        overflow: hidden !important;
        padding: 18px 22px 20px !important;
        border: 1.5px solid rgba(255, 255, 255, 0.42) !important;
        border-radius: 20px !important;
        background: #173f73 !important;
        color: #ffffff !important;
        text-align: center !important;
        box-shadow: 0 14px 28px -20px rgba(16, 52, 92, 0.62) !important;
      }

      .placement-pdf-exporting .teen-report-head > *:not(.report-space-art) {
        position: relative !important;
        z-index: 2 !important;
      }

      .placement-pdf-exporting .report-space-art {
        position: absolute !important;
        inset: 0 !important;
        z-index: 0 !important;
        overflow: hidden !important;
        pointer-events: none !important;
      }

      .placement-pdf-exporting .report-space-art svg {
        position: absolute !important;
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
      }

      .placement-pdf-exporting .report-art-planet {
        position: absolute !important;
        left: -20px !important;
        bottom: -30px !important;
        width: 105px !important;
        opacity: 0.92 !important;
      }

      .placement-pdf-exporting .report-art-planet-right {
        position: absolute !important;
        right: -25px !important;
        top: 50% !important;
        transform: translateY(-50%) !important;
        width: 110px !important;
        opacity: 0.92 !important;
        pointer-events: none !important;
      }

      .placement-pdf-exporting .teen-report-brand,
      .placement-pdf-exporting .kids-report-brand {
        display: flex !important;
        width: 100% !important;
        align-items: center !important;
        justify-content: space-between !important;
        margin-bottom: 10px !important;
      }

      .placement-pdf-exporting .teen-report-brand img,
      .placement-pdf-exporting .kids-report-brand img {
        margin: 0 !important;
        padding: 6px 12px !important;
        border-radius: 12px !important;
        background: rgba(255, 255, 255, 0.94) !important;
        box-shadow: 0 6px 16px rgba(4, 26, 55, 0.15) !important;
        height: 38px !important;
      }

      .placement-pdf-exporting .teen-report-meta,
      .placement-pdf-exporting .kids-report-meta {
        font-size: 0.74rem !important;
        color: #eaf4ff !important;
        text-align: right !important;
        font-weight: 700 !important;
        line-height: 1.35 !important;
        letter-spacing: 0.03em !important;
      }

      .placement-pdf-exporting .teen-report-status,
      .placement-pdf-exporting .kids-report-status {
        display: inline-block !important;
        margin: 0 0 6px !important;
        padding: 4px 12px !important;
        border: 1px solid #a3d9d3 !important;
        border-radius: 999px !important;
        background: #eef8f5 !important;
        color: #287d73 !important;
        font-size: 0.65rem !important;
        font-weight: 900 !important;
        letter-spacing: 0.04em !important;
        text-transform: uppercase !important;
      }

      .placement-pdf-exporting .teen-report-head h1,
      .placement-pdf-exporting .kids-report-head h1 {
        max-width: 720px !important;
        margin: 4px auto 6px !important;
        color: #ffffff !important;
        font-family: 'Orbitron', sans-serif !important;
        font-size: 1.38rem !important;
        font-weight: 800 !important;
        line-height: 1.2 !important;
        text-shadow: 0 2px 8px rgba(4, 26, 55, 0.3) !important;
      }

      .placement-pdf-exporting .report-student-name {
        display: inline-block !important;
        max-width: 100% !important;
        margin: 2px auto 10px !important;
        padding: 4px 18px !important;
        border-radius: 999px !important;
        background: rgba(249, 192, 19, 0.18) !important;
        border: 1.5px solid rgba(249, 192, 19, 0.5) !important;
        color: #f9c013 !important;
        font-family: 'Orbitron', sans-serif !important;
        font-size: 1.05rem !important;
        font-weight: 800 !important;
        text-shadow: 0 2px 8px rgba(4, 26, 55, 0.3) !important;
        word-break: break-word !important;
      }

      .placement-pdf-exporting .teen-report-placement,
      .placement-pdf-exporting .kids-report-placement {
        display: flex !important;
        justify-content: center !important;
        gap: 8px !important;
        margin: 6px 0 8px !important;
      }

      .placement-pdf-exporting .teen-report-placement span,
      .placement-pdf-exporting .kids-report-placement span {
        padding: 6px 14px !important;
        border-radius: 11px !important;
        font-family: 'Space Grotesk', sans-serif !important;
        font-size: 0.88rem !important;
        font-weight: 900 !important;
      }

      .placement-pdf-exporting .teen-module,
      .placement-pdf-exporting .kids-module {
        border: 2px solid #bfdbfe !important;
        background: #eaf4ff !important;
        color: #265e9b !important;
      }

      .placement-pdf-exporting .teen-level,
      .placement-pdf-exporting .kids-level {
        border: 0 !important;
        background: linear-gradient(135deg, #f9c013, #e5ab00) !important;
        color: #5a3f00 !important;
      }

      .placement-pdf-exporting .teen-report-head .subtitle,
      .placement-pdf-exporting .kids-report-head .subtitle {
        max-width: 700px !important;
        margin: 0 auto !important;
        color: #eaf4ff !important;
        font-size: 0.76rem !important;
        line-height: 1.36 !important;
      }

      .placement-pdf-exporting .teen-section,
      .placement-pdf-exporting .kids-section,
      .placement-pdf-exporting .rc-section {
        padding: 14px 16px !important;
        border: 1.5px solid rgba(38, 94, 155, 0.18) !important;
        border-radius: 18px !important;
        background: rgba(255, 255, 255, 0.96) !important;
        color: #17324f !important;
        margin-bottom: 14px !important;
        box-shadow: none !important;
      }

      .placement-pdf-exporting .teen-section h2,
      .placement-pdf-exporting .kids-section h2 {
        display: block !important;
        margin: 0 0 8px !important;
        padding: 0 0 5px !important;
        border-bottom: 2px solid rgba(38, 94, 155, 0.1) !important;
        color: #17324f !important;
        font-family: 'Orbitron', sans-serif !important;
        font-size: 0.95rem !important;
        line-height: 1.25 !important;
        font-weight: 800 !important;
      }

      .placement-pdf-exporting .teen-profile-layout,
      .placement-pdf-exporting .kids-profile-layout {
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        gap: 12px !important;
      }

      .placement-pdf-exporting .teen-profile-chart,
      .placement-pdf-exporting .kids-profile-chart {
        width: 100% !important;
        max-width: 540px !important;
        height: 240px !important;
        margin: 0 auto 4px !important;
      }

      .placement-pdf-exporting .teen-pillar-grid,
      .placement-pdf-exporting .kids-pillar-grid {
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        gap: 10px !important;
        width: 100% !important;
        margin-bottom: 14px !important;
      }

      .placement-pdf-exporting .teen-pillar,
      .placement-pdf-exporting .kids-pillar {
        padding: 10px 12px !important;
        border: 1px solid #c8ddf2 !important;
        border-radius: 14px !important;
        background: #ffffff !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: space-between !important;
      }

      .placement-pdf-exporting .teen-pillar:nth-child(1),
      .placement-pdf-exporting .kids-pillar:nth-child(1) { background: #eef6ff !important; border-top: 2.5pt solid #3979bd !important; }
      .placement-pdf-exporting .teen-pillar:nth-child(2),
      .placement-pdf-exporting .kids-pillar:nth-child(2) { background: #fff8df !important; border-top: 2.5pt solid #e3aa00 !important; }
      .placement-pdf-exporting .teen-pillar:nth-child(3),
      .placement-pdf-exporting .kids-pillar:nth-child(3) { background: #edf9f6 !important; border-top: 2.5pt solid #32988d !important; }
      .placement-pdf-exporting .teen-pillar:nth-child(4),
      .placement-pdf-exporting .kids-pillar:nth-child(4) { background: #fff1f5 !important; border-top: 2.5pt solid #db6d91 !important; }

      .placement-pdf-exporting .teen-pillar-head,
      .placement-pdf-exporting .kids-pillar-head {
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        gap: 6px !important;
        margin-bottom: 6px !important;
      }

      .placement-pdf-exporting .teen-pillar-head strong,
      .placement-pdf-exporting .kids-pillar-head strong {
        color: #17324f !important;
        font-size: 0.84rem !important;
        font-weight: 850 !important;
      }

      .placement-pdf-exporting .teen-band,
      .placement-pdf-exporting .kids-band {
        padding: 2px 7px !important;
        border-radius: 6px !important;
        font-size: 0.62rem !important;
        font-weight: 900 !important;
      }

      .placement-pdf-exporting .teen-pillar .pillar-body,
      .placement-pdf-exporting .kids-pillar .pillar-body {
        margin: 0 !important;
        color: #365d83 !important;
        font-size: 0.72rem !important;
        line-height: 1.32 !important;
      }

      .placement-pdf-exporting .teen-pillar .pillar-item,
      .placement-pdf-exporting .kids-pillar .pillar-item {
        margin-bottom: 4px !important;
      }

      .placement-pdf-exporting .tag-good { color: #1e615b !important; font-weight: 750 !important; }
      .placement-pdf-exporting .tag-grow { color: #866200 !important; font-weight: 750 !important; }

      .placement-pdf-exporting .teen-print-continuation,
      .placement-pdf-exporting .kids-print-continuation,
      .placement-pdf-exporting .rc-print-continuation {
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        gap: 14px !important;
        min-height: 52px !important;
        padding: 10px 18px !important;
        border-radius: 14px !important;
        background: linear-gradient(135deg, #102d56 0%, #173f73 60%, #2d8fb5 100%) !important;
        color: #ffffff !important;
        position: relative !important;
        isolation: isolate !important;
        overflow: hidden !important;
        box-shadow: 0 10px 24px rgba(16, 52, 92, 0.15) !important;
        border: 1.5px solid rgba(255, 255, 255, 0.25) !important;
        margin-top: 14px !important;
        margin-bottom: 14px !important;
      }

      .placement-pdf-exporting .report-continuation-art {
        position: absolute !important;
        inset: 0 !important;
        z-index: -1 !important;
        overflow: hidden !important;
      }

      .placement-pdf-exporting .teen-print-continuation strong,
      .placement-pdf-exporting .kids-print-continuation strong {
        color: #ffffff !important;
        font-family: 'Orbitron', sans-serif !important;
        font-size: 0.96rem !important;
        font-weight: 800 !important;
        letter-spacing: 0.02em !important;
      }

      .placement-pdf-exporting .teen-print-continuation span,
      .placement-pdf-exporting .kids-print-continuation span {
        color: #d9eaff !important;
        font-size: 0.68rem !important;
        font-weight: 800 !important;
        letter-spacing: 0.04em !important;
        text-transform: uppercase !important;
        background: rgba(255, 255, 255, 0.15) !important;
        padding: 4px 12px !important;
        border-radius: 999px !important;
      }

      .placement-pdf-exporting .teen-two-col,
      .placement-pdf-exporting .kids-two-col {
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        gap: 10px !important;
        margin-bottom: 14px !important;
      }

      .placement-pdf-exporting .teen-two-col .teen-section:nth-child(1),
      .placement-pdf-exporting .kids-two-col .kids-section:nth-child(1) {
        background: #eff6ff !important;
        border-color: #9fc5ea !important;
      }

      .placement-pdf-exporting .teen-two-col .teen-section:nth-child(2),
      .placement-pdf-exporting .kids-two-col .kids-section:nth-child(2) {
        background: #fff8e1 !important;
        border-color: #efd06b !important;
      }

      .placement-pdf-exporting .teen-section p,
      .placement-pdf-exporting .teen-section li,
      .placement-pdf-exporting .kids-section p,
      .placement-pdf-exporting .kids-section li {
        font-size: 0.75rem !important;
        line-height: 1.38 !important;
        color: #17324f !important;
      }

      .placement-pdf-exporting .teen-priority,
      .placement-pdf-exporting .kids-priority {
        margin: 0 !important;
        padding-left: 18px !important;
      }

      .placement-pdf-exporting .teen-priority li,
      .placement-pdf-exporting .kids-priority li {
        margin-bottom: 4px !important;
      }

      .placement-pdf-exporting .teen-path-name,
      .placement-pdf-exporting .kids-path-name {
        display: table !important;
        margin: 2px auto 8px !important;
        padding: 6px 18px !important;
        border: 2px solid #f0b400 !important;
        border-radius: 12px !important;
        background: #fff7d6 !important;
        box-shadow: 0 6px 16px rgba(240, 180, 0, 0.18) !important;
        font-family: 'Orbitron', sans-serif !important;
        font-size: 1rem !important;
        font-weight: 900 !important;
        color: #265e9b !important;
        text-align: center !important;
      }

      .placement-pdf-exporting .teen-current-module,
      .placement-pdf-exporting .kids-current-module {
        display: flex !important;
        width: max-content !important;
        max-width: 100% !important;
        align-items: center !important;
        gap: 6px !important;
        margin: 0 auto 10px !important;
        padding: 4px 12px !important;
        border: 1.5px solid #f0b400 !important;
        border-radius: 999px !important;
        background: #fff9d8 !important;
        color: #704f00 !important;
        font-size: 0.72rem !important;
        font-weight: 850 !important;
      }

      .placement-pdf-exporting .teen-track,
      .placement-pdf-exporting .kids-track {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 8px !important;
        padding: 4px 0 8px !important;
      }

      .placement-pdf-exporting .teen-track-step,
      .placement-pdf-exporting .kids-track-step {
        position: relative !important;
        flex: 1 1 0 !important;
        min-width: 0 !important;
        min-height: 52px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 6px 10px !important;
        border: 2px solid #7f96ad !important;
        border-radius: 999px !important;
        background: #ffffff !important;
        color: #17324f !important;
        text-align: center !important;
        font-family: 'Space Grotesk', sans-serif !important;
        font-size: 0.76rem !important;
        font-weight: 850 !important;
      }

      .placement-pdf-exporting .teen-track-step.is-assigned,
      .placement-pdf-exporting .kids-track-step.is-assigned {
        border-color: #f0a800 !important;
        background: linear-gradient(135deg, #ffe45c, #f9c013) !important;
        color: #4b3500 !important;
        box-shadow: 0 8px 20px rgba(240, 168, 0, 0.28) !important;
      }

      .placement-pdf-exporting .teen-track-step.is-assigned::after,
      .placement-pdf-exporting .kids-track-step.is-assigned::after {
        content: '✓' !important;
        position: absolute !important;
        top: -7px !important;
        right: 12px !important;
        display: grid !important;
        width: 22px !important;
        height: 22px !important;
        place-items: center !important;
        border: 2px solid #ffffff !important;
        border-radius: 50% !important;
        background: #22a06b !important;
        color: #ffffff !important;
        font-size: 0.68rem !important;
        font-weight: 900 !important;
        box-shadow: 0 4px 8px rgba(34, 160, 107, 0.25) !important;
      }

      .placement-pdf-exporting .teen-track-arrow,
      .placement-pdf-exporting .kids-track-arrow {
        flex: 0 0 auto !important;
        color: #7f96ad !important;
        font-size: 1.1rem !important;
        font-weight: 900 !important;
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
      .placement-report.placement-pdf-exporting::after,
      .teen-report.placement-pdf-exporting::after,
      .kids-report.placement-pdf-exporting::after,
      .placement-pdf-exporting .placement-report::after,
      .placement-pdf-exporting .teen-report::after,
      .placement-pdf-exporting .kids-report::after {
        content: "CREATED BY KALANANTI ACADEMICS · © 2026";
        position: absolute !important;
        right: 0 !important;
        bottom: 16px !important;
        left: 0 !important;
        display: block !important;
        width: 100% !important;
        box-sizing: border-box !important;
        color: rgba(38, 94, 155, 0.65) !important;
        font-family: 'Space Grotesk', 'Inter', system-ui, sans-serif !important;
        font-size: 0.72rem !important;
        font-weight: 800 !important;
        letter-spacing: 0.08em !important;
        line-height: 1.3 !important;
        text-align: center !important;
        text-transform: uppercase !important;
        background: #e8f2ff !important;
        padding: 8px 0 !important;
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
        width: 100% !important;
        max-width: 620px !important;
        height: 380px !important;
        margin: 0 auto 14px !important;
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
        margin: 0 !important;
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
      }
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
        const width = Math.max(Math.round(rect.width || 320), 1);
        const height = Math.max(Math.round(rect.height || 240), 1);

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
        svg.replaceWith(canvas);

        restoredItems.push(() => {
          if (canvas.isConnected) canvas.replaceWith(svg);
        });
      } catch (e) {
        console.warn('SVG rasterization failed, retaining live vector chart.', e);
      }
    }

    return () => restoredItems.forEach(restore => restore());
  }

  const MASTER_SKILL_MAP = {
    logic: {
      label: 'Logika',
      skills: {
        'Efisiensi': { strong: 'menyusun urutan perintah yang aman & efisien', grow: 'memilih rute & efisiensi langkah' },
        'Pola': { strong: 'mengenali pola berulang & struktur urutan', grow: 'menganalisis pola logika berulang' },
        'Kondisi': { strong: 'memahami percabangan logika bersyarat (JIKA-MAKA)', grow: 'penerapan logika percabangan bersyarat' },
        'Looping': { strong: 'menggunakan perulangan (looping) untuk penyederhanaan', grow: 'menggunakan instruksi perulangan (looping)' },
        'Debugging': { strong: 'menemukan & memperbaiki kesalahan alur/kode (debugging)', grow: 'menemukan lokasi error dan perbaikan alur (debugging)' }
      }
    },
    creativity: {
      label: 'Kreativitas',
      skills: {
        'Prediksi Visual': { strong: 'memprediksi alur animasi & reaksi objek', grow: 'memprediksi alur animasi & reaksi visual' },
        'Layering': { strong: 'memahami struktur penumpukan objek (layering/hirarki)', grow: 'penataan susunan layer objek (depan/belakang)' },
        'Estetika Warna': { strong: 'memilih kombinasi warna kontras & nyaman dibaca', grow: 'pemilihan kontras warna antarmuka' },
        'Animasi Frame': { strong: 'merancang urutan frame animasi secara natural', grow: 'penyusunan alur frame gerakan animasi' },
        'Layout UI': { strong: 'menyusun tata letak (layout UI) terstruktur', grow: 'penyusunan hirarki & layout antarmuka' }
      }
    },
    spatial: {
      label: 'Spasial',
      skills: {
        'Rotasi': { strong: 'memahami perubahan arah objek dari hasil rotasi', grow: 'visualisasi rotasi & arah objek' },
        'Perspektif': { strong: 'membayangkan wujud objek dari berbagai sudut pandang (3D)', grow: 'pemahaman sudut pandang perspektif 3D' },
        'Koordinat': { strong: 'menentukan lokasi pada sistem titik koordinat X-Y', grow: 'pemetaan lokasi titik koordinat X-Y' },
        'Bangun Ruang': { strong: 'menghitung volume & susunan blok ruang 3D', grow: 'perhitungan volume & susunan ruang 3D' },
        'Relasi': { strong: 'memahami batas area & hubungan antar-objek', grow: 'pemahaman batas area (hitbox) & relasi objek' }
      }
    },
    digital: {
      label: 'Literasi Digital',
      skills: {
        'Hardware & Input': { strong: 'menggunakan perangkat input (mouse/keyboard) dengan presisi', grow: 'penggunaan perangkat keras input' },
        'Ikon UI': { strong: 'mengenali fungsi ikon & tombol antarmuka standar', grow: 'pengenalan ikon & simbol aplikasi' },
        'Struktur Data': { strong: 'mengelompokkan jenis file & folder dengan teratur', grow: 'organisasi file & struktur folder' },
        'Troubleshooting': { strong: 'menangani masalah teknis sederhana secara mandiri', grow: 'kemandirian penanganan kendala teknis (troubleshooting)' },
        'File System': { strong: 'mengelola sistem penyimpanan file & navigasi', grow: 'navigasi direktori & sistem file' }
      }
    }
  };

  function buildReportAllElement(customData = {}, targetDocument = document) {
    const registration = getRegistration() || {};
    const student = registration.student || registration || {};
    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
    const safeArray = value => Array.isArray(value) ? value : [];
    const clamp = value => Math.max(0, Math.min(1, Number(value) || 0));
    const pillarOrder = ['logic', 'creativity', 'spatial', 'digital'];
    const pillarAliases = {
      logic: 'logic', logika: 'logic',
      creativity: 'creativity', kreativitas: 'creativity',
      spatial: 'spatial', spasial: 'spatial',
      digital: 'digital', 'literasi digital': 'digital'
    };
    const normalizePillar = value => pillarAliases[String(value || '').trim().toLowerCase()] || String(value || '').trim().toLowerCase();
    const evidence = customData.assessmentEvidence || {};
    const name = String(customData.studentName || student.name || 'Siswa').trim();
    const age = Number(customData.age || student.exactAge || student.age || 16);
    const audience = String(customData.audience || evidence.audience || (
      age <= 7 ? 'junior' : age <= 15 ? 'kids' : 'teens'
    )).toLowerCase();
    const reportDate = customData.reportDate || new Date().toLocaleDateString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
    const assignedModule = String(customData.assignedModule || 'Belum ditentukan');
    const potentialModule = String(customData.potentialModule || '');
    const level = String(customData.level || 'Level 1');
    const lv3Candidate = Boolean(customData.lv3Candidate);
    const pathName = String(customData.pathName || 'Interactive Creator Path');
    const confirmedInterest = String(customData.confirmedInterest || evidence.stage3?.confirmedInterest || '');
    const stage2AssessmentModule = String(customData.stage2AssessmentModule || evidence.stage2?.assessmentModule || '');
    const robloxReadiness = customData.robloxReadiness || evidence.stage3?.robloxReadiness || null;
    const learningModules = safeArray(customData.learningModules).length
      ? safeArray(customData.learningModules)
      : [assignedModule];

    const normalizeAnswer = (item, stage, index) => {
      const submittedValue = item?.responseText ?? item?.answerText ?? item?.selectedText ?? item?.submittedValue;
      const responseText = Array.isArray(submittedValue)
        ? submittedValue.join(' → ')
        : (submittedValue && typeof submittedValue === 'object'
          ? JSON.stringify(submittedValue)
          : String(submittedValue ?? ''));
      const correctValue = item?.correct ?? item?.isCorrect ?? item?.finalSubmissionCorrect;
      return {
        stage,
        questionId: String(item?.questionId || item?.challengeId || `${stage}-${index + 1}`),
        number: Number(item?.questionNumber ?? item?.questionIndex ?? item?.question ?? index) + (
          item?.questionNumber ? 0 : item?.questionIndex !== undefined ? 1 : item?.question !== undefined ? 0 : 1
        ),
        pillar: normalizePillar(item?.pillar),
        focus: String(item?.focus || item?.skill || item?.title || `Aktivitas ${index + 1}`),
        prompt: String(item?.prompt || item?.questionText || ''),
        responseText,
        correct: typeof correctValue === 'boolean' ? correctValue : null,
        firstSubmissionCorrect: item?.firstSubmissionCorrect,
        finalSubmissionCorrect: item?.finalSubmissionCorrect,
        submissionAttemptCount: Number(item?.submissionAttemptCount || item?.attempts || 1),
        difficulty: item?.difficulty,
        technicalError: item?.technicalError === true
      };
    };

    let stage1AItems = safeArray(
      evidence.stage1A?.answers || evidence.stage1A?.answerTrail || evidence.stage1A
    ).map((item, index) => normalizeAnswer(item, 'Stage 1A', index));
    let stage1BItems = safeArray(
      evidence.stage1B?.answers || evidence.stage1B?.answerTrail || evidence.stage1B
    ).map((item, index) => normalizeAnswer(item, 'Stage 1B', index));
    if (!stage1AItems.length && safeArray(customData.questionResults).length) {
      stage1AItems = customData.questionResults.map((item, index) => normalizeAnswer(item, 'Stage 1A', index));
    }

    const scoreFromFallback = pillar => {
      const raw = Number(customData.scores?.[pillar]);
      if (!Number.isFinite(raw)) return 0;
      if (customData.scoreScale === 'raw5') return clamp(raw / 5);
      return raw > 1 ? clamp(raw / 100) : clamp(raw);
    };
    const pillarBreakdown = {};
    const scores = {};
    pillarOrder.forEach(pillar => {
      const stage1A = stage1AItems.filter(item => item.pillar === pillar && item.correct !== null && !item.technicalError);
      const stage1B = stage1BItems.filter(item => item.pillar === pillar && item.correct !== null && !item.technicalError);
      const stage1ARatio = stage1A.length
        ? stage1A.filter(item => item.correct).length / stage1A.length
        : null;
      const stage1BRatio = stage1B.length
        ? stage1B.filter(item => item.correct).length / stage1B.length
        : null;
      const ratio = stage1ARatio !== null
        ? (stage1BRatio !== null ? (stage1ARatio * 0.6) + (stage1BRatio * 0.4) : stage1ARatio)
        : scoreFromFallback(pillar);
      const correctItems = [...stage1A, ...stage1B].filter(item => item.correct);
      const growthItems = [...stage1A, ...stage1B].filter(item => !item.correct);
      scores[pillar] = clamp(ratio);
      pillarBreakdown[pillar] = {
        score: scores[pillar],
        stage1A,
        stage1B,
        correctItems,
        growthItems,
        strongSkills: [...new Set(correctItems.map(item => (
          MASTER_SKILL_MAP[pillar]?.skills[item.focus]?.strong || item.focus
        )))],
        growthSkills: [...new Set(growthItems.map(item => (
          MASTER_SKILL_MAP[pillar]?.skills[item.focus]?.grow || item.focus
        )))]
      };
    });

    const sortedPillars = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const topKey = sortedPillars[0]?.[0] || 'logic';
    const bottomKey = sortedPillars[sortedPillars.length - 1]?.[0] || 'digital';
    const topName = MASTER_SKILL_MAP[topKey].label;
    const bottomName = MASTER_SKILL_MAP[bottomKey].label;
    const hasQuestionEvidence = stage1AItems.length + stage1BItems.length > 0;
    const metaTag = audience === 'junior'
      ? 'PLACEMENT REPORT · JUNIOR 5–7'
      : audience === 'teens'
        ? 'PLACEMENT REPORT · TEENS 16–18'
        : age >= 12
          ? 'PLACEMENT REPORT · KIDS UPPER 12–15'
          : 'PLACEMENT REPORT · KIDS 8–11';
    const statusText = lv3Candidate
      ? 'KANDIDAT REVIEW EMERGING — Lv3'
      : level.startsWith('FOUNDATIONAL')
        ? 'DIREKOMENDASIKAN MEMBANGUN FONDASI'
        : 'SIAP MENGEMBANGKAN KEMAMPUAN MELALUI PROYEK';
    const mainSubtitle = `${escapeHtml(name)} direkomendasikan memulai <strong>${escapeHtml(assignedModule)}</strong> pada <strong>${escapeHtml(level)}</strong>.<br>Kekuatan utama terlihat pada pilar <strong>${escapeHtml(topName)}</strong>, dengan fokus perkembangan berikutnya pada <strong>${escapeHtml(bottomName)}</strong>.`;

    function getBandInfo(ratio) {
      if (ratio >= 0.8) return { label: 'Kekuatan Utama', bg: '#eaf8f3', color: '#1e615b' };
      if (ratio >= 0.65) return { label: 'Berkembang Baik', bg: '#eff6ff', color: '#265e9b' };
      if (ratio >= 0.45) return { label: 'Sedang Bertumbuh', bg: '#fff8e1', color: '#866200' };
      return { label: 'Perlu Pendampingan', bg: '#fff1f2', color: '#9f1239' };
    }

    const cx = 360, cy = 265, r = 185;
    const l = scores.logic, c = scores.creativity, s = scores.spatial, d = scores.digital;
    const svgChart = `
      <svg width="100%" height="100%" viewBox="0 0 720 535" style="display:block;margin:0 auto;max-width:650px">
        <polygon points="${cx},${cy-r} ${cx+r},${cy} ${cx},${cy+r} ${cx-r},${cy}" fill="#fff" stroke="#cbd5e1" stroke-width="2"/>
        ${[0.75, 0.5, 0.25].map(scale => `<polygon points="${cx},${cy-r*scale} ${cx+r*scale},${cy} ${cx},${cy+r*scale} ${cx-r*scale},${cy}" fill="none" stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="6,6"/>`).join('')}
        <line x1="${cx}" y1="${cy-r}" x2="${cx}" y2="${cy+r}" stroke="#cbd5e1" stroke-width="2"/>
        <line x1="${cx-r}" y1="${cy}" x2="${cx+r}" y2="${cy}" stroke="#cbd5e1" stroke-width="2"/>
        <polygon points="${cx},${cy-r*l} ${cx+r*c},${cy} ${cx},${cy+r*s} ${cx-r*d},${cy}" fill="rgba(38,94,155,.25)" stroke="#265e9b" stroke-width="3.5" stroke-linejoin="round"/>
        ${[[cx,cy-r*l],[cx+r*c,cy],[cx,cy+r*s],[cx-r*d,cy]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="7" fill="#f9c013" stroke="#fff" stroke-width="2.5"/>`).join('')}
        <text x="${cx}" y="${cy-r-16}" text-anchor="middle" font-family="'Orbitron',sans-serif" font-size="16" font-weight="800" fill="#17324f">LOGIKA</text>
        <text x="${cx+r+16}" y="${cy+5}" text-anchor="start" font-family="'Orbitron',sans-serif" font-size="16" font-weight="800" fill="#17324f">KREATIVITAS</text>
        <text x="${cx}" y="${cy+r+30}" text-anchor="middle" font-family="'Orbitron',sans-serif" font-size="16" font-weight="800" fill="#17324f">SPASIAL</text>
        <text x="${cx-r-16}" y="${cy+5}" text-anchor="end" font-family="'Orbitron',sans-serif" font-size="16" font-weight="800" fill="#17324f">DIGITAL</text>
      </svg>`;

    const pillarCardsHtml = pillarOrder.map(key => {
      const breakdown = pillarBreakdown[key];
      const band = getBandInfo(breakdown.score);
      const strongList = breakdown.strongSkills.length > 0 ? breakdown.strongSkills.join(', ') : 'Pemahaman konsep dasar';
      const growthList = breakdown.growthSkills.length > 0 ? breakdown.growthSkills.join(', ') : 'Pengembangan tingkat lanjut';
      return `
        <article class="teen-pillar">
          <div class="teen-pillar-head">
            <strong>${MASTER_SKILL_MAP[key].label}</strong>
            <span class="teen-band" style="background:${band.bg};color:${band.color};border:1px solid ${band.color}">${band.label}</span>
          </div>
          <div class="pillar-body">
            <div class="pillar-item"><span class="tag-good">✓ Kekuatan:</span> ${escapeHtml(strongList)}.</div>
            <div class="pillar-item" style="margin-top:3px;"><span class="tag-grow">⚡ Area Latihan:</span> ${escapeHtml(growthList)}.</div>
          </div>
        </article>`;
    }).join('');

    const whyLevelText = stage2AssessmentModule && assignedModule !== stage2AssessmentModule
      ? `Stage 2 V1 menguji ${escapeHtml(stage2AssessmentModule)}. Karena modul akhir adalah ${escapeHtml(assignedModule)}, titik mulainya ditetapkan di Level 1 agar penempatan tetap aman.`
      : level.startsWith('FOUNDATIONAL')
      ? `Rekomendasi ini bertujuan memperkuat fondasi logika &amp; algoritma dasar pilar ${escapeHtml(bottomName)} sebelum masuk ke proyek ${escapeHtml(assignedModule)} yang lebih kompleks.`
      : `Siswa telah siap untuk level BASIC. Fokus berikutnya adalah mengembangkan solusi mandiri pada proyek ${escapeHtml(assignedModule)}.`;

    const studentReason = String(evidence.stage3?.reason || customData.studentReason || 'Belum diisi.');
    const robloxGaps = safeArray(robloxReadiness?.gaps).join(' dan ');
    const interestAlignmentText = confirmedInterest === 'Roblox Studio' && robloxReadiness?.passed === true
      ? `${name} memilih Roblox Studio dan memenuhi ambang kesiapan V1: Logika ${Number(robloxReadiness.logicScore || 0)}/5 serta Spasial ${Number(robloxReadiness.spatialScore || 0)}/5. Rekomendasi Roblox Studio dimulai dari Level 1 karena Stage 2 V1 menilai Scratch.`
      : confirmedInterest === 'Roblox Studio' && robloxReadiness && robloxReadiness.passed !== true
        ? `${name} memilih Roblox Studio, tetapi ${robloxGaps || 'Logika dan Spasial'} masih perlu diperkuat hingga minimal 3/5. ${assignedModule} menjadi titik mulai yang aman dan Roblox Studio tetap menjadi tujuan berikutnya.`
        : `Jalur belajar ${pathName} disesuaikan dengan minat siswa pada proyek interaktif.`;

    const learningTrackHtml = learningModules.map((module, index) => {
      const isAssigned = module === assignedModule;
      return `${index ? '<span class="teen-track-arrow" aria-hidden="true">→</span>' : ''}<div class="teen-track-step${isAssigned ? ' is-assigned' : ''}">${index + 1}. ${escapeHtml(module)}</div>`;
    }).join('');

    const allGrowth = pillarOrder.flatMap(pillar => pillarBreakdown[pillar].growthSkills);
    const focusListHtml = (allGrowth.length ? [...new Set(allGrowth)].slice(0, 3) : [
      'Algoritma & pseudocode terstruktur',
      'Variabel, kondisi, & perulangan',
      'Debugging mandiri'
    ]).map(skill => `<li>${escapeHtml(skill.charAt(0).toUpperCase() + skill.slice(1))}.</li>`).join('');

    const container = targetDocument.createElement('div');
    container.className = 'a4-container placement-pdf-exporting';
    container.id = 'reportPaper';
    container.innerHTML = `
      <header class="teen-report-head">
        <div class="report-space-art" aria-hidden="true">
          <svg viewBox="0 0 1000 420" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="reportSky" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#102d56"/><stop offset=".58" stop-color="#265e9b"/><stop offset="1" stop-color="#2d8fb5"/></linearGradient><pattern id="reportStars" width="92" height="92" patternUnits="userSpaceOnUse"><circle cx="12" cy="18" r="2" fill="#fff" opacity=".68"/><circle cx="70" cy="36" r="1.4" fill="#f9c013" opacity=".9"/></pattern></defs><rect width="1000" height="420" fill="url(#reportSky)"/><rect width="1000" height="420" fill="url(#reportStars)"/></svg>
          <img class="report-art-planet" src="https://cdn-web-2.ruangguru.com/landing-pages/assets/e77f536b-e591-4ba8-b5b8-f5b2a3d3b33b.png" alt="">
          <img class="report-art-planet-right" src="https://cdn-web-2.ruangguru.com/landing-pages/assets/5f93f855-0466-47b3-ba85-bbaabbad7a2e.png" alt="">
        </div>
        <div class="teen-report-brand"><img src="https://cdn-web-2.ruangguru.com/landing-pages/assets/545c0426-169c-406f-8775-93afcacef50a.png" alt="Kalananti Logo"><span class="teen-report-meta">${metaTag}<br>${escapeHtml(reportDate)} · USIA ${age} TAHUN</span></div>
        <span class="teen-report-status">${statusText}</span>
        <h1>Profil Potensi dan Rekomendasi Belajar</h1>
        <div class="report-student-name">${escapeHtml(name)}</div>
        <div class="teen-report-placement"><span class="teen-module">${escapeHtml(assignedModule)}</span><span class="teen-level">${escapeHtml(level)}</span></div>
        <p class="subtitle">${mainSubtitle}</p>
      </header>
      <section class="teen-section">
        <h2>Profil Kemampuan ${escapeHtml(name)}</h2>
        <div class="teen-profile-layout"><div class="teen-profile-chart">${svgChart}</div><div class="teen-pillar-grid">${pillarCardsHtml}</div></div>
      </section>
      <div class="teen-print-continuation"><strong>Rekomendasi &amp; Learning Path Siswa</strong><span>KALANANTI ACADEMICS</span></div>
      <div class="teen-two-col">
        <section class="teen-section"><h2>Mengapa Mulai dari Level Ini?</h2><p>${whyLevelText}</p></section>
        <section class="teen-section"><h2>Fokus Perkembangan Awal</h2><ul class="teen-priority">${focusListHtml}</ul></section>
      </div>
      <section class="teen-section">
        <h2>Learning Path Siswa</h2>
        <div class="teen-path-name">${escapeHtml(pathName)}</div>
        <div class="teen-current-module"><span>✦ Rekomendasi modul saat ini: <strong>${escapeHtml(assignedModule)}</strong></span></div>
        <div class="teen-track">${learningTrackHtml}</div>
      </section>
      <section class="teen-section" style="background:#eef8f5;border-color:#8bcfc5">
        <h2>Arah Belajar Berdasarkan Minat</h2>
        <p>${escapeHtml(interestAlignmentText)}</p>
        <p style="margin-top:6px"><strong>Alasan siswa:</strong> ${escapeHtml(studentReason)}</p>
        <p class="teen-report-note">Hasil placement ini digunakan sebagai rekomendasi titik mulai belajar. Perkembangan siswa tetap dipantau melalui proses belajar dan umpan balik mentor.</p>
      </section>
      <footer class="report-footer">CREATED BY KALANANTI ACADEMICS · © 2026</footer>`;
    return container;
  }

  async function createReportPdf(options = {}) {
    const frameDoc = document.getElementById('frame')?.contentDocument || document.querySelector('iframe')?.contentDocument;
    const sourceDocument = options.document?.querySelector
      ? options.document
      : (frameDoc || document);

    let report = options.element || (
      typeof options.selector === 'string'
        ? sourceDocument.querySelector(options.selector)
          || document.querySelector(options.selector)
          || (frameDoc ? frameDoc.querySelector(options.selector) : null)
        : null
    );

    // If reportData or report-all template requested or report missing, build report-all.html container
    if (options.reportData || options.useReportAllTemplate || !report) {
      report = buildReportAllElement(options.reportData || options, sourceDocument);
    }

    if (reportPdfCache.has(report)) return reportPdfCache.get(report);

    const reportDocument = report.ownerDocument || sourceDocument;
    const reportWindow = reportDocument.defaultView || global;
    const filename = String(options.filename || 'Laporan Placement Test Kalananti.pdf');
    const promise = (async () => {
      const html2Pdf = await loadHtml2Pdf(reportDocument);

      const offscreenContainer = reportDocument.createElement('div');
      offscreenContainer.className = 'placement-pdf-sandbox placement-pdf-exporting';
      offscreenContainer.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;z-index:-9999;background:#e8f2ff;overflow:visible;display:block!important;';

      const reportClone = report.cloneNode(true);
      reportClone.classList.add('placement-pdf-exporting');
      offscreenContainer.appendChild(reportClone);
      reportDocument.body.appendChild(offscreenContainer);

      const exportStyle = installPdfExportStyle(reportDocument, reportClone);
      let restoreCharts = () => {};
      try {
        if (reportDocument.fonts?.ready) {
          await settleWithin(reportDocument.fonts.ready, 5000);
        }
        await waitForReportAssets(reportClone);
        await nextPaint(reportWindow);
        restoreCharts = await rasterizeProfileCharts(reportClone);
        await nextPaint(reportWindow);
        const isKidsReport = reportClone.classList.contains('kids-report');
        const isTeensReport = reportClone.classList.contains('teen-report');
        const isJuniorReport = (
          reportClone.classList.contains('placement-report') && !isKidsReport
        );
        const isFullBleedReport = isKidsReport || isTeensReport || isJuniorReport;
        const captureWindowWidth = Math.max(
          960,
          Number(reportWindow.innerWidth) || 0,
          Number(reportDocument.documentElement?.scrollWidth) || 0,
          Number(reportDocument.body?.scrollWidth) || 0
        );
        const isMultiPageDocument = Boolean(reportClone.querySelector('.a4-page, .report-page-break'));
        const containerWidthPx = reportClone.offsetWidth || 794;
        const containerHeightPx = reportClone.offsetHeight || reportClone.scrollHeight || 1000;
        const pxToMm = 210 / containerWidthPx;
        const contentHeightMm = Math.max(297, Math.ceil(containerHeightPx * pxToMm) + 10);

        const jsPdfFormat = isMultiPageDocument
          ? 'a4'
          : [210, contentHeightMm];

        const pagebreakConfig = isMultiPageDocument
          ? {
            mode: ['css', 'legacy'],
            before: '.report-page-break',
            avoid: [
              '.teen-report-head',
              '.teen-pillar',
              '.report-evidence-card',
              '.report-challenge-card',
              '.report-interest-row'
            ]
          }
          : { mode: [] };

        const worker = html2Pdf().set({
          margin: 0,
          filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            allowTaint: false,
            backgroundColor: '#e8f2ff',
            logging: false,
            imageTimeout: 15000,
            scrollX: 0,
            scrollY: 0,
            windowWidth: captureWindowWidth
          },
          jsPDF: {
            unit: 'mm',
            format: jsPdfFormat,
            orientation: 'portrait',
            compress: true
          },
          pagebreak: pagebreakConfig
        }).from(reportClone);
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
        offscreenContainer.remove();
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
      console.error('[Placement PDF] Lampiran visual belum siap; laporan PDF belum dapat disinkronkan dan akan dicoba ulang.', error);
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
    buildReportAllElement,
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
