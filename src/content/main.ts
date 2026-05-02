import { pickTargetMedia } from './mediaProbe';
import type { CommandAction } from '../shared/types';
import { getSettings, subscribeSettings, type ExtensionSettings } from '../shared/defaults';

let cachedSettings: ExtensionSettings | null = null;
let lastInteracted: HTMLMediaElement | null = null;

function normalizeHost(host: string): string {
  return host.toLowerCase();
}

function isHostDisabled(host: string, disabled: string[]): boolean {
  const h = normalizeHost(host);
  return disabled.some((d) => normalizeHost(d) === h);
}

function isTypingContext(el: Element | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag !== 'INPUT') {
    const role = el.getAttribute('role');
    if (role === 'textbox' || role === 'searchbox') return true;
    return false;
  }
  const input = el as HTMLInputElement;
  const type = (input.type || 'text').toLowerCase();
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

function modifierOk(e: KeyboardEvent, mode: ExtensionSettings['requireModifier']): boolean {
  if (mode === 'none') return !(e.altKey || e.ctrlKey || e.metaKey);
  if (mode === 'alt') return e.altKey && !e.ctrlKey && !e.metaKey;
  return false;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

async function applyMediaAction(
  media: HTMLMediaElement,
  action: CommandAction,
  settings: ExtensionSettings,
): Promise<boolean> {
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

function keyToAction(e: KeyboardEvent): CommandAction | null {
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

async function handleKeydown(e: KeyboardEvent): Promise<void> {
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

function trackUserMediaTarget(e: Event): void {
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

function initTracking(): void {
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

function bindRuntimeCommands(): void {
  chrome.runtime.onMessage.addListener((msg: unknown) => {
    if (!msg || typeof msg !== 'object') return;
    const m = msg as { type?: string; command?: CommandAction };
    if (m.type !== 'arrows-command' || !m.command) return;
    if (!document.hasFocus()) return;
    void (async () => {
      const settings = cachedSettings ?? (await getSettings());
      if (isHostDisabled(location.hostname, settings.disabledHosts)) return;
      const media = pickTargetMedia({ doc: document, lastInteracted });
      if (!media) return;
      await applyMediaAction(media, m.command, settings);
    })();
  });
}

function main(): void {
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
