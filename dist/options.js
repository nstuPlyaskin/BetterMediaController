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

  async function saveSettings(settings) {
    await chrome.storage.sync.set({ [STORAGE_KEY]: settings });
  }

  const seekEl = document.getElementById('seek');
  const volEl = document.getElementById('vol');
  const modEl = document.getElementById('mod');
  const hostsEl = document.getElementById('hosts');
  const saveBtn = document.getElementById('save');
  const statusEl = document.getElementById('status');

  function volumeToPercent(step) {
    return Math.round(step * 100);
  }

  function percentToVolume(p) {
    return Math.min(1, Math.max(0.01, p / 100));
  }

  function parseHosts(text) {
    return text
      .split(/\r?\n/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }

  async function load() {
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
    const mod = modEl.value;
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
})();
