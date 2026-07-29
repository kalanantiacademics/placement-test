(function placementSessionBootstrap(global) {
  'use strict';

  const nativeStorage = global.localStorage;
  const TAB_SESSION_KEY = 'pt_tab_submission_id';
  const LAST_SESSION_KEY = 'placement_last_submission_id_v1';
  const SESSION_PREFIX = 'pt_session::';
  const REGISTRY_PREFIX = 'pt_registration::';
  let activeSubmissionId = '';
  let installed = false;

  function isPlacementKey(key) {
    return key === 'placement_test_build_version'
      || key.startsWith('pt_')
      || key.startsWith('kalananti-');
  }

  function scopedPrefix(submissionId = activeSubmissionId) {
    return `${SESSION_PREFIX}${submissionId}::`;
  }

  function scopedKey(key) {
    return isPlacementKey(key) && activeSubmissionId
      ? `${scopedPrefix()}${key}`
      : key;
  }

  function visibleKeys() {
    const keys = [];
    const prefix = scopedPrefix();
    for (let index = 0; index < nativeStorage.length; index += 1) {
      const key = nativeStorage.key(index);
      if (!key) continue;
      if (activeSubmissionId && key.startsWith(prefix)) {
        keys.push(key.slice(prefix.length));
      } else if (!key.startsWith(SESSION_PREFIX) && !key.startsWith(REGISTRY_PREFIX) && !isPlacementKey(key)) {
        keys.push(key);
      }
    }
    return [...new Set(keys)];
  }

  const facade = {
    get length() {
      return visibleKeys().length;
    },
    key(index) {
      return visibleKeys()[index] ?? null;
    },
    getItem(key) {
      return nativeStorage.getItem(scopedKey(String(key)));
    },
    setItem(key, value) {
      nativeStorage.setItem(scopedKey(String(key)), String(value));
    },
    removeItem(key) {
      nativeStorage.removeItem(scopedKey(String(key)));
    },
    clear() {
      if (!activeSubmissionId) return;
      const prefix = scopedPrefix();
      const removals = [];
      for (let index = 0; index < nativeStorage.length; index += 1) {
        const key = nativeStorage.key(index);
        if (key?.startsWith(prefix)) removals.push(key);
      }
      removals.forEach(key => nativeStorage.removeItem(key));
    }
  };

  function installFacade() {
    if (installed) return;
    Object.defineProperty(global, 'localStorage', {
      configurable: false,
      enumerable: true,
      value: facade
    });
    installed = true;
  }

  function activate(submissionId) {
    const cleanId = String(submissionId || '').trim();
    if (!cleanId) return false;
    activeSubmissionId = cleanId;
    global.sessionStorage.setItem(TAB_SESSION_KEY, cleanId);
    nativeStorage.setItem(LAST_SESSION_KEY, cleanId);
    installFacade();

    const registration = nativeStorage.getItem(`${REGISTRY_PREFIX}${cleanId}`);
    if (registration && !facade.getItem('pt_student_registration')) {
      facade.setItem('pt_student_registration', registration);
      facade.setItem('pt_student_profile', registration);
    }
    return true;
  }

  function create(registration) {
    const submissionId = String(registration?.submissionId || '').trim();
    if (!submissionId) throw new Error('missing_submission_id');
    nativeStorage.setItem(`${REGISTRY_PREFIX}${submissionId}`, JSON.stringify(registration));
    activate(submissionId);
    facade.setItem('pt_student_registration', JSON.stringify(registration));
    facade.setItem('pt_student_profile', JSON.stringify(registration));
    return submissionId;
  }

  function destroyCurrent() {
    if (!activeSubmissionId) return false;
    const submissionId = activeSubmissionId;
    facade.clear();
    nativeStorage.removeItem(`${REGISTRY_PREFIX}${submissionId}`);
    global.sessionStorage.removeItem(TAB_SESSION_KEY);
    if (nativeStorage.getItem(LAST_SESSION_KEY) === submissionId) {
      nativeStorage.removeItem(LAST_SESSION_KEY);
    }
    activeSubmissionId = '';
    return true;
  }

  function getActiveSubmissionId() {
    return activeSubmissionId;
  }

  global.PlacementSession = {
    activate,
    create,
    destroyCurrent,
    getActiveSubmissionId
  };

  let requestedSession = null;
  try {
    const params = new URLSearchParams(global.location.search);
    requestedSession = params.get('sid')
      || global.sessionStorage.getItem(TAB_SESSION_KEY)
      || nativeStorage.getItem(LAST_SESSION_KEY);
  } catch (e) {}

  if (!requestedSession && global.parent && global.parent.PlacementSession) {
    try {
      requestedSession = global.parent.PlacementSession.getActiveSubmissionId();
    } catch (e) {}
  }
  
  if (requestedSession) activate(requestedSession);
})(window);
