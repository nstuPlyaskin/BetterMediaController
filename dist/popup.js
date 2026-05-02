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

  const hostEl = document.getElementById('host');
  const toggleBtn = document.getElementById('toggle');
  const optionsBtn = document.getElementById('options');
  const shortcutsLink = document.getElementById('open-shortcuts');

  function normalizeHost(host) {
    return host.toLowerCase();
  }

  async function getActiveHostname() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tabs[0]?.url;
    if (!url) return null;
    try {
      return new URL(url).hostname;
    } catch {
      return null;
    }
  }

  async function refresh() {
    const host = await getActiveHostname();
    if (!host) {
      hostEl.textContent = 'Нет доступа к адресу вкладки (chrome://, store, …).';
      toggleBtn.disabled = true;
      toggleBtn.textContent = 'Недоступно';
      return;
    }
    toggleBtn.disabled = false;
    hostEl.textContent = host;
    const settings = await getSettings();
    const disabled = settings.disabledHosts.map(normalizeHost);
    const isOff = disabled.includes(normalizeHost(host));
    toggleBtn.textContent = isOff ? `Включить на ${host}` : `Отключить на ${host}`;
    toggleBtn.classList.toggle('primary', !isOff);
  }

  toggleBtn.addEventListener('click', async () => {
    const host = await getActiveHostname();
    if (!host) return;
    const settings = await getSettings();
    const h = normalizeHost(host);
    const set = new Set(settings.disabledHosts.map(normalizeHost));
    if (set.has(h)) {
      set.delete(h);
    } else {
      set.add(h);
    }
    await saveSettings({
      ...settings,
      disabledHosts: Array.from(set),
    });
    await refresh();
  });

  optionsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  shortcutsLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  });

  void refresh();
})();
