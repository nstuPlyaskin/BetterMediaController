function isElementVisible(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 && rect.height <= 0) return false;
  const style = window.getComputedStyle(el);
  if (style.visibility === 'hidden' || style.display === 'none') return false;
  if (Number(style.opacity) === 0) return false;
  return true;
}

function visibleVideoArea(el: HTMLVideoElement): number {
  if (!isElementVisible(el)) return 0;
  const r = el.getBoundingClientRect();
  const w = Math.max(0, Math.min(r.right, window.innerWidth) - Math.max(r.left, 0));
  const h = Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0));
  return w * h;
}

function traverseShadow(
  root: Document | ShadowRoot,
  out: HTMLMediaElement[],
): void {
  const elements = root.querySelectorAll('audio, video');
  for (const el of elements) {
    out.push(el as HTMLMediaElement);
  }
  root.querySelectorAll('*').forEach((node) => {
    if (node.shadowRoot) {
      traverseShadow(node.shadowRoot, out);
    }
  });
}

export function collectMediaInDocument(doc: Document): HTMLMediaElement[] {
  const out: HTMLMediaElement[] = [];
  traverseShadow(doc, out);
  return out.filter((m) => m.isConnected);
}

function isPiPActive(m: HTMLMediaElement): boolean {
  try {
    return document.pictureInPictureElement === m;
  } catch {
    return false;
  }
}

export function pickTargetMedia(args: {
  doc: Document;
  lastInteracted: HTMLMediaElement | null;
}): HTMLMediaElement | null {
  const { doc, lastInteracted } = args;
  const all = collectMediaInDocument(doc);
  if (all.length === 0) return null;

  const pip = all.find(isPiPActive);
  if (pip) return pip;

  if (
    lastInteracted &&
    lastInteracted.isConnected &&
    all.includes(lastInteracted)
  ) {
    return lastInteracted;
  }

  const playing = all.filter((m) => !m.paused && !m.ended);
  const pool = playing.length ? playing : all;

  let best: HTMLMediaElement | null = null;
  let bestScore = -Infinity;

  for (const m of pool) {
    let score = 0;
    if (!m.paused && !m.ended) score += 100;
    if (!m.paused) score += 10;
    if (m instanceof HTMLVideoElement) {
      score += visibleVideoArea(m) / 10_000;
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
