// "Add to home screen" banner for phones. Shared by every page, so the
// markup and styles live here instead of in each HTML file.
//
// - Shows only on phone-size screens, a few seconds after the page loads.
// - Close (X): shows again in 15 days.
// - Share / menu: the browser never tells the page these were opened, so
//   while the banner shows the by-hand steps, the page losing focus (a browser
//   menu or share sheet opened over it) or going to the background (iOS jumps
//   to the home screen after "Add to Home Screen") counts as "probably adding
//   it": shows again in 30 days.
// - Installed: never shows again. That is known when the site opens as the
//   saved app, or when Chrome on Android says it is installed. An iPhone keeps
//   saved-app storage separate from Safari, so Safari can't learn it there.
// - Android Chrome: the button opens Chrome's own install prompt when the
//   browser offers one (needs manifest.webmanifest). Otherwise, and on
//   iPhone, the banner shows the steps to add the site by hand.
(function () {
  const INSTALLED_KEY = 'cce-install-installed';
  const HIDE_UNTIL_KEY = 'cce-install-hide-until';
  // Before 15/30-day snoozes, closing set this "never again" key. Treat it as
  // a close on that date so those phones follow the 15-day rule.
  const OLD_CLOSED_KEY = 'cce-install-dismissed';
  const CLOSE_DAYS = 15;
  const ADDING_DAYS = 30;
  const SHOW_DELAY_MS = 4000;
  const DAY_MS = 864e5;

  // Storage can be blocked (private mode, settings). Then the banner just
  // shows again next visit, which is fine.
  function hiddenNow() {
    try {
      if (localStorage.getItem(INSTALLED_KEY)) return true;
      const closedAt = Number(localStorage.getItem(OLD_CLOSED_KEY));
      const until = Math.max(Number(localStorage.getItem(HIDE_UNTIL_KEY)) || 0,
                             closedAt > 0 ? closedAt + CLOSE_DAYS * DAY_MS : 0);
      return Date.now() < until;
    } catch (e) { return false; }
  }
  function markInstalled() {
    try { localStorage.setItem(INSTALLED_KEY, String(Date.now())); } catch (e) { /* ignore */ }
  }
  // Never shortens a longer hide that is already set.
  function hideFor(days) {
    try {
      const until = Date.now() + days * DAY_MS;
      const current = Number(localStorage.getItem(HIDE_UNTIL_KEY)) || 0;
      if (until > current) localStorage.setItem(HIDE_UNTIL_KEY, String(until));
    } catch (e) { /* ignore */ }
  }

  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (standalone) { markInstalled(); return; }
  const phone = window.matchMedia('(max-width: 720px)').matches;
  if (!phone || hiddenNow()) return;

  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let installEvent = null;
  let banner = null;

  const css = `
    .install-banner {
      position: fixed; left: 12px; right: 12px; z-index: 60;
      bottom: calc(12px + env(safe-area-inset-bottom, 0px));
      background: var(--cce-white, #fdfcfa); color: var(--cce-dark-blue, #051f47);
      border: 1px solid var(--cce-border, #e7e3da); border-radius: 16px;
      box-shadow: 0 12px 32px -8px rgba(3, 22, 49, 0.30);
      padding: 16px; display: grid; grid-template-columns: auto 1fr auto; gap: 4px 14px;
      align-items: start; font-family: inherit;
      transform: translateY(calc(100% + 24px)); opacity: 0;
      transition: transform 0.3s ease, opacity 0.3s ease;
    }
    .install-banner.is-shown { transform: none; opacity: 1; }
    .install-banner-icon {
      width: 48px; height: 48px; border-radius: 12px; overflow: hidden; grid-row: span 2;
      border: 1px solid var(--cce-border, #e7e3da); background: #fdfcfa;
    }
    .install-banner-icon img { width: 100%; height: 100%; display: block; }
    .install-banner-title { margin: 2px 0 0; font-size: 16px; font-weight: 700; line-height: 1.3; }
    .install-banner-text { margin: 0; font-size: 14px; line-height: 1.45; color: var(--cce-med-gray, #4a5568); grid-column: 2; }
    .install-banner-text strong { color: var(--cce-dark-blue, #051f47); font-weight: 600; }
    .install-banner-text .ph { font-size: 17px; vertical-align: -3px; color: var(--cce-dark-blue, #051f47); }
    .install-banner-close {
      grid-column: 3; grid-row: 1; width: 36px; height: 36px; margin: -6px -6px 0 0;
      border: 0; border-radius: 50%; background: transparent; color: inherit;
      display: inline-flex; align-items: center; justify-content: center; font-size: 20px; cursor: pointer;
    }
    .install-banner-btn {
      grid-column: 1 / -1; margin-top: 12px; padding: 13px 16px;
      border: 0; border-radius: 10px; background: var(--cce-dark-blue, #051f47); color: var(--cce-white, #fdfcfa);
      font: inherit; font-size: 15px; font-weight: 600; cursor: pointer;
    }
    @media (prefers-reduced-motion: reduce) { .install-banner { transition: none; } }
  `;

  function build() {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    banner = document.createElement('div');
    banner.className = 'install-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Add CCE PTO to your home screen');

    let text;
    if (installEvent) text = 'Quick access like an app &mdash; no download needed.';
    else if (ios) text = 'Tap the <i class="ph ph-export" aria-label="Share"></i> share button, then <strong>&ldquo;Add to Home Screen.&rdquo;</strong>';
    else text = 'Tap the <i class="ph ph-dots-three-vertical" aria-label="Menu"></i> menu, then <strong>&ldquo;Add to Home screen.&rdquo;</strong>';

    banner.innerHTML =
      '<div class="install-banner-icon"><img src="/apple-touch-icon.png" alt=""></div>' +
      '<p class="install-banner-title">Add CCE PTO to your home screen</p>' +
      '<button type="button" class="install-banner-close" aria-label="Close"><i class="ph ph-x" aria-hidden="true"></i></button>' +
      '<p class="install-banner-text">' + text + '</p>' +
      (installEvent ? '<button type="button" class="install-banner-btn">Add to Home Screen</button>' : '');

    banner.querySelector('.install-banner-close').addEventListener('click', () => { hideFor(CLOSE_DAYS); hide(); });
    const btn = banner.querySelector('.install-banner-btn');
    if (btn) {
      btn.addEventListener('click', async () => {
        const event = installEvent;
        installEvent = null;
        hide();
        if (!event) return;
        event.prompt();
        try {
          const choice = await event.userChoice;
          if (choice && choice.outcome === 'dismissed') hideFor(CLOSE_DAYS);
        } catch (e) { /* ignore */ }
      });
    }
    document.body.appendChild(banner);
    if (!installEvent) watchForAdding();
    requestAnimationFrame(() => requestAnimationFrame(() => banner.classList.add('is-shown')));
  }

  // By-hand steps showing: a browser menu or share sheet opening over the page
  // takes its focus, and adding the site sends the browser to the background.
  // Either one means "probably adding it". Focus moving into an embedded
  // frame (like the newsletter form) is not a browser menu, so skip that.
  let watching = false;
  function watchForAdding() {
    if (watching) return;
    watching = true;
    const adding = () => {
      if (banner && !banner.querySelector('.install-banner-btn')) hideFor(ADDING_DAYS);
    };
    window.addEventListener('blur', () => {
      setTimeout(() => {
        const el = document.activeElement;
        if (!document.hasFocus() && !(el && el.tagName === 'IFRAME')) adding();
      }, 0);
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) adding(); });
  }

  function hide() {
    if (!banner) return;
    const el = banner;
    banner = null;
    el.classList.remove('is-shown');
    setTimeout(() => el.remove(), 350);
  }

  // Chrome fires this when the site can be installed; keep it for the button.
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installEvent = event;
    // Already showing the by-hand steps? Swap to the one-tap button.
    if (banner && !banner.querySelector('.install-banner-btn')) {
      banner.remove();
      banner = null;
      build();
    }
  });
  window.addEventListener('appinstalled', () => { markInstalled(); hide(); });

  // Chrome on Android can say whether this site is already installed (see
  // related_applications in manifest.webmanifest). Other browsers lack it.
  async function installed() {
    if (!navigator.getInstalledRelatedApps) return false;
    try { return (await navigator.getInstalledRelatedApps()).length > 0; } catch (e) { return false; }
  }

  window.addEventListener('load', () => setTimeout(async () => {
    if (hiddenNow()) return;
    if (await installed()) { markInstalled(); return; }
    build();
  }, SHOW_DELAY_MS));
})();
