import { getSettings, saveSettings } from '../shared/defaults';
import type { ModifierMode } from '../shared/types';

const seekEl = document.getElementById('seek') as HTMLInputElement;
const volEl = document.getElementById('vol') as HTMLInputElement;
const modEl = document.getElementById('mod') as HTMLSelectElement;
const hostsEl = document.getElementById('hosts') as HTMLTextAreaElement;
const saveBtn = document.getElementById('save') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLDivElement;

function volumeToPercent(step: number): number {
  return Math.round(step * 100);
}

function percentToVolume(p: number): number {
  return Math.min(1, Math.max(0.01, p / 100));
}

function parseHosts(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

async function load(): Promise<void> {
  const s = await getSettings();
  seekEl.value = String(s.seekStepSeconds);
  volEl.value = String(volumeToPercent(s.volumeStep));
  modEl.value = s.requireModifier;
  hostsEl.value = s.disabledHosts.join('\n');
}

saveBtn.addEventListener('click', async () => {
  statusEl.textContent = '';
  const seek = Number(seekEl.value);
  const volPct = Number(volEl.value);
  const mod = modEl.value as ModifierMode;
  if (!Number.isFinite(seek) || seek < 0.5) {
    statusEl.textContent = 'Некорректный шаг перемотки.';
    statusEl.style.color = '#f28b82';
    return;
  }
  if (!Number.isFinite(volPct) || volPct < 1 || volPct > 50) {
    statusEl.textContent = 'Шаг громкости: от 1 до 50%.';
    statusEl.style.color = '#f28b82';
    return;
  }
  if (mod !== 'none' && mod !== 'alt') {
    statusEl.textContent = 'Некорректный модификатор.';
    statusEl.style.color = '#f28b82';
    return;
  }
  await saveSettings({
    seekStepSeconds: seek,
    volumeStep: percentToVolume(volPct),
    requireModifier: mod,
    disabledHosts: parseHosts(hostsEl.value),
  });
  statusEl.style.color = '#81c995';
  statusEl.textContent = 'Сохранено.';
});

void load();
