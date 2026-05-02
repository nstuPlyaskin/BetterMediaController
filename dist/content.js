(() => {
  const STORAGE_KEY = 'arrowsSettings';
  const DEFAULT_SETTINGS = {
    seekStepSeconds: 5,
    volumeStep: 0.05,
    requireModifier: 'none',
    disabledHosts: [],
  };

  async function getSettings() {
    const data = await chrome.storage.sync.get(STORAGE_KEY);
    const raw = data[STORAGE_KEY];
    return {
      ...DEFAULT_SETTINGS,
      ...raw,
      disabledHosts: raw?.disabledHosts ?? [],
    };
  }

  function subscribeSettings(callback) {
    const listener = (changes, area) => {
      if (area !== 'sync' || !changes[STORAGE_KEY]) return;
      void getSettings().then(callback);
    };
    chrome.storage.onChanged.addListener(listener);
    void getSettings().then(callback);
    return () => chrome.storage.onChanged.removeListener(listener);
  }

  function isElementVisible(el) {
    if (!(el instanceof HTMLElement)) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 && rect.height <= 0) return false;
    const style = window.getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') return false;
    if (Number(style.opacity) === 0) return false;
    return true;
  }

  function visibleVideoArea(el) {
    if (!isElementVisible(el)) return 0;
    const r = el.getBoundingClientRect();
    const w = Math.max(0, Math.min(r.right, window.innerWidth) - Math.max(r.left, 0));
    const h = Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0));
    return w * h;
  }

  function traverseShadow(root, out) {
    root.querySelectorAll('audio, video').forEach((el) => {
      out.push(el);
    });
    root.querySelectorAll('*').forEach((node) => {
      if (node.shadowRoot) {
        traverseShadow(node.shadowRoot, out);
      }
    });
  }

  function collectMediaInDocument(doc) {
    const out = [];
    traverseShadow(doc, out);
    return out.filter((m) => m.isConnected);
  }

  function isPiPActive(m) {
    try {
      return document.pictureInPictureElement === m;
    } catch {
      return false;
    }
  }

  function pickTargetMedia(args) {
    const { doc, lastInteracted: last } = args;
    const all = collectMediaInDocument(doc);
    if (all.length === 0) return null;

    const pip = all.find(isPiPActive);
    if (pip) return pip;

    if (last && last.isConnected && all.includes(last)) {
      return last;
    }

    const playing = all.filter((m) => !m.paused && !m.ended);
    const pool = playing.length ? playing : all;

    let best = null;
    let bestScore = -Infinity;

    for (const m of pool) {
      let score = 0;
      if (!m.paused && !m.ended) score += 100;
      if (!m.paused) score += 10;
      if (m instanceof HTMLVideoElement) {
        score += visibleVideoArea(m) / 10000;
      } else {
        score += 1;
      }
      if (m.readyState >= 2) score += 5;
      if (score > bestScore) {
        bestScore = score;
        best = m;
      }
    }

    return best;
  }

  let cachedSettings = null;
  let lastInteracted = null;

  function normalizeHost(host) {
    return host.toLowerCase();
  }

  function isHostDisabled(host, disabled) {
    const h = normalizeHost(host);
    return disabled.some((d) => normalizeHost(d) === h);
  }

  function isTypingContext(el) {
    if (!el || !(el instanceof HTMLElement)) return false;
    if (el.isContentEditable) return true;
    const tag = el.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (tag !== 'INPUT') {
      const role = el.getAttribute('role');
      if (role === 'textbox' || role === 'searchbox') return true;
      return false;
    }
    const type = (el.type || 'text').toLowerCase();
    const nonText = new Set([
      'button',
      'checkbox',
      'color',
      'file',
      'hidden',
      'image',
      'radio',
      'range',
      'reset',
      'submit',
    ]);
    if (nonText.has(type)) return false;
    return true;
  }

  function modifierOk(e, mode) {
    if (mode === 'none') return !(e.altKey || e.ctrlKey || e.metaKey);
    if (mode === 'alt') return e.altKey && !e.ctrlKey && !e.metaKey;
    return false;
  }

  function clamp(n, lo, hi) {
    return Math.min(hi, Math.max(lo, n));
  }

  async function applyMediaAction(media, action, settings) {
    const seek = settings.seekStepSeconds;
    const volStep = settings.volumeStep;
    try {
      switch (action) {
        case 'seek-back': {
          const t = media.currentTime - seek;
          media.currentTime = clamp(t, 0, Number.isFinite(media.duration) ? media.duration : t);
          return true;
        }
        case 'seek-forward': {
          const maxT = Number.isFinite(media.duration) ? media.duration : media.currentTime + seek;
          const t = media.currentTime + seek;
          media.currentTime = clamp(t, 0, maxT);
          return true;
        }
        case 'volume-up': {
          if (media.muted && media.volume === 0) media.muted = false;
          media.volume = clamp(media.volume + volStep, 0, 1);
          if (media.volume > 0) media.muted = false;
          return true;
        }
        case 'volume-down': {
          media.volume = clamp(media.volume - volStep, 0, 1);
          return true;
        }
        case 'toggle-pause': {
          if (media.paused) {
            void media.play().catch(() => {});
          } else {
            media.pause();
          }
          return true;
        }
        default:
          return false;
      }
    } catch {
      return false;
    }
  }

  function keyToAction(e) {
    switch (e.code) {
      case 'ArrowLeft':
        return 'seek-back';
      case 'ArrowRight':
        return 'seek-forward';
      case 'ArrowUp':
        return 'volume-up';
      case 'ArrowDown':
        return 'volume-down';
      case 'Space':
        return 'toggle-pause';
      default:
        return null;
    }
  }

  async function handleKeydown(e) {
    const settings = cachedSettings ?? (await getSettings());
    if (isHostDisabled(location.hostname, settings.disabledHosts)) return;

    if (!modifierOk(e, settings.requireModifier)) return;

    const action = keyToAction(e);
    if (!action) return;

    if (e.repeat) {
      if (action !== 'volume-up' && action !== 'volume-down') return;
    }

    if (isTypingContext(document.activeElement)) return;

    const media = pickTargetMedia({ doc: document, lastInteracted });
    if (!media) return;

    const ok = await applyMediaAction(media, action, settings);
    if (!ok) return;

    e.preventDefault();
    e.stopImmediatePropagation();
  }

  function trackUserMediaTarget(e) {
    const t = e.target;
    if (!(t instanceof Node)) return;
    if (t instanceof HTMLMediaElement) {
      lastInteracted = t;
      return;
    }
    if (t instanceof Element) {
      const closest = t.closest('audio,video');
      if (closest instanceof HTMLMediaElement) {
        lastInteracted = closest;
      }
    }
  }

  function initTracking() {
    document.addEventListener('pointerdown', trackUserMediaTarget, true);
    document.addEventListener(
      'play',
      (e) => {
        if (e.target instanceof HTMLMediaElement) {
          lastInteracted = e.target;
        }
      },
      true,
    );
  }

  function bindRuntimeCommands() {
    chrome.runtime.onMessage.addListener((msg) => {
      if (!msg || typeof msg !== 'object') return;
      if (msg.type !== 'arrows-command' || !msg.command) return;
      if (!document.hasFocus()) return;
      void (async () => {
        const settings = cachedSettings ?? (await getSettings());
        if (isHostDisabled(location.hostname, settings.disabledHosts)) return;
        const media = pickTargetMedia({ doc: document, lastInteracted });
        if (!media) return;
        await applyMediaAction(media, msg.command, settings);
      })();
    });
  }

  function main() {
    subscribeSettings((s) => {
      cachedSettings = s;
    });
    initTracking();
    document.addEventListener(
      'keydown',
      (e) => {
        void handleKeydown(e);
      },
      true,
    );
    bindRuntimeCommands();
  }

  main();
})();
