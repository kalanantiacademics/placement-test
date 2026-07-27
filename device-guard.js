/**
 * Kalananti Placement Test - Device Guard Script
 * Restricts access on Mobile Phones (HP) & Tablet Portrait mode.
 * Allowed: Laptop / PC or Tablet in Landscape mode.
 */
(function (global) {
  'use strict';

  function detectDevice() {
    const ua = navigator.userAgent || navigator.vendor || global.opera || '';
    const width = global.innerWidth || document.documentElement.clientWidth || screen.width;
    const height = global.innerHeight || document.documentElement.clientHeight || screen.height;
    const minDim = Math.min(width, height);
    const maxDim = Math.max(width, height);
    const isPortrait = height > width;
    const hasTouch = ('ontouchstart' in global) || (navigator.maxTouchPoints > 0);

    // Mobile Phone UA Check (iPhone, iPod, Android Mobile, IEMobile, Windows Phone, etc.)
    const isMobileUA = /Android.*Mobile|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
    
    // Smartphone physical / viewport characteristics:
    // Smartphone landscape height is rarely above 500px, min dimension rarely above 550px.
    const isMobilePhone = isMobileUA || (hasTouch && minDim < 600) || (height < 520 && width < 960);

    if (isMobilePhone) {
      return {
        allowed: false,
        reason: 'phone',
        title: 'Smartphone Tidak Didukung',
        message: 'Placement Test Kalananti didesain untuk tampilan layar lebar.<br><br>Penggunaan <strong>HP / Smartphone</strong> (baik posisi tegak maupun mendatar) <strong>tidak dapat digunakan</strong>.<br><br>Mohon buka tautan ini melalui <strong>Laptop</strong>, <strong>Komputer</strong>, atau <strong>Tablet Landscape</strong>.',
        icon: 'phone'
      };
    }

    if (isPortrait) {
      return {
        allowed: false,
        reason: 'portrait',
        title: 'Putar Perangkat Anda',
        message: 'Placement Test tidak dapat diakses dalam mode Portrait.<br><br>Jika Anda menggunakan <strong>Tablet</strong>, mohon putar perangkat ke posisi <strong>Landscape (Mendatar)</strong> untuk melanjutkan.',
        icon: 'rotate'
      };
    }

    if (width < 960 || height < 540) {
      return {
        allowed: false,
        reason: 'small_window',
        title: 'Ukuran Layar Terlalu Kecil',
        message: 'Ukuran jendela browser Anda terlalu kecil untuk menampilkan materi tes secara optimal.<br><br>Mohon <strong>perbesar (maximize)</strong> jendela browser Anda atau gunakan layar yang lebih besar (minimal width 960px).',
        icon: 'expand'
      };
    }

    return { allowed: true };
  }

  function getSVGIcon(type) {
    if (type === 'phone') {
      return `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="7" y="2" width="10" height="20" rx="2" ry="2"></rect>
        <line x1="11" y1="18" x2="13" y2="18"></line>
        <line x1="3" y1="3" x2="21" y2="21" stroke="#f87171" stroke-width="2.5"></line>
      </svg>`;
    }
    if (type === 'rotate') {
      return `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#f9c013" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="6" width="18" height="12" rx="2" ry="2"></rect>
        <path d="M12 2v4m0 0L10 4m2 0l2 2"></path>
        <path d="M20 10a8 8 0 0 1-8 8"></path>
      </svg>`;
    }
    return `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"></path>
    </svg>`;
  }

  function injectGuardOverlay() {
    if (document.getElementById('kalanantiDeviceGuard')) return;

    const overlay = document.createElement('div');
    overlay.id = 'kalanantiDeviceGuard';
    overlay.setAttribute('aria-hidden', 'true');

    overlay.innerHTML = `
      <style>
        #kalanantiDeviceGuard {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          z-index: 9999999;
          background: linear-gradient(135deg, #0a192f 0%, #112240 60%, #020c1b 100%);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          display: none;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px 16px;
          color: #ffffff;
          font-family: 'Space Grotesk', 'Inter', system-ui, -apple-system, sans-serif;
          text-align: center;
          box-sizing: border-box;
          overflow-y: auto;
        }
        #kalanantiDeviceGuard.kg-active {
          display: flex !important;
        }
        .kg-card {
          max-width: 520px;
          width: 92%;
          background: rgba(255, 255, 255, 0.08);
          border: 1.5px solid rgba(255, 255, 255, 0.18);
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6), inset 0 0 0 1px rgba(255, 255, 255, 0.1);
          border-radius: 28px;
          padding: 36px 28px;
          display: flex;
          flex-direction: column;
          align-items: center;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          animation: kgPop 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes kgPop {
          from { opacity: 0; transform: scale(0.92) translateY(12px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .kg-logo {
          height: 40px;
          width: auto;
          margin-bottom: 22px;
          filter: drop-shadow(0 4px 12px rgba(255, 255, 255, 0.15));
        }
        .kg-icon-box {
          width: 88px;
          height: 88px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.06);
          border: 2px solid rgba(255, 255, 255, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.3);
        }
        .kg-title {
          font-family: 'Orbitron', 'Space Grotesk', sans-serif;
          font-size: 1.3rem;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: 0.04em;
          margin-bottom: 14px;
          text-transform: uppercase;
          line-height: 1.3;
        }
        .kg-message {
          font-size: 0.95rem;
          line-height: 1.6;
          color: #cbd5e1;
          margin-bottom: 26px;
        }
        .kg-message strong {
          color: #f9c013;
        }
        .kg-guide-box {
          display: flex;
          align-items: center;
          justify-content: space-around;
          gap: 12px;
          background: rgba(0, 0, 0, 0.25);
          padding: 14px 18px;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          width: 100%;
          box-sizing: border-box;
        }
        .kg-guide-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          font-size: 0.76rem;
          font-weight: 700;
          color: #94a3b8;
        }
        .kg-guide-item.kg-invalid {
          color: #f87171;
        }
        .kg-guide-item.kg-invalid span {
          text-decoration: line-through;
          opacity: 0.8;
        }
        .kg-guide-item.kg-valid {
          color: #4ade80;
        }
        .kg-guide-icon {
          font-size: 1.4rem;
        }
      </style>
      <div class="kg-card">
        <img src="https://cdn-web-2.ruangguru.com/landing-pages/assets/545c0426-169c-406f-8775-93afcacef50a.png" alt="Kalananti" class="kg-logo">
        <div class="kg-icon-box" id="kgIconBox"></div>
        <h2 class="kg-title" id="kgTitle">Akses Dibatasi</h2>
        <p class="kg-message" id="kgMessage"></p>
        <div class="kg-guide-box">
          <div class="kg-guide-item kg-invalid">
            <div class="kg-guide-icon">📱❌</div>
            <span>HP / Smartphone</span>
          </div>
          <div class="kg-guide-item kg-valid">
            <div class="kg-guide-icon">📲↪️</div>
            <span>Tablet Landscape</span>
          </div>
          <div class="kg-guide-item kg-valid">
            <div class="kg-guide-icon">💻✅</div>
            <span>Laptop / PC</span>
          </div>
        </div>
      </div>
    `;

    if (document.body) {
      document.body.appendChild(overlay);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        document.body.appendChild(overlay);
      });
    }
  }

  function updateGuard() {
    const res = detectDevice();
    const overlay = document.getElementById('kalanantiDeviceGuard');

    if (!res.allowed) {
      if (!overlay) injectGuardOverlay();
      const el = document.getElementById('kalanantiDeviceGuard');
      if (el) {
        document.getElementById('kgTitle').textContent = res.title;
        document.getElementById('kgMessage').innerHTML = res.message;
        document.getElementById('kgIconBox').innerHTML = getSVGIcon(res.icon);
        el.classList.add('kg-active');
        el.setAttribute('aria-hidden', 'false');
        if (document.body) document.body.style.overflow = 'hidden';
      }
    } else {
      if (overlay) {
        overlay.classList.remove('kg-active');
        overlay.setAttribute('aria-hidden', 'true');
        if (document.body) document.body.style.overflow = '';
      }
    }
  }

  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        injectGuardOverlay();
        updateGuard();
      });
    } else {
      injectGuardOverlay();
      updateGuard();
    }

    global.addEventListener('resize', updateGuard);
    global.addEventListener('orientationchange', () => {
      setTimeout(updateGuard, 200);
    });
  }

  init();
  global.KalanantiDeviceGuard = { detectDevice, updateGuard };
})(typeof window !== 'undefined' ? window : this);
