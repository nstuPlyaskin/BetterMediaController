import type { ExtensionSettings } from './types';

export const DEFAULT_SETTINGS: ExtensionSettings = {
  seekStepSeconds: 5,
  volumeStep: 0.05,
  requireModifier: 'none',
  disabledHosts: [],
};

const STORAGE_KEY = 'arrowsSettings';

export async function getSettings(): Promise<ExtensionSettings> {
  const data = await chrome.storage.sync.get(STORAGE_KEY);
  const raw = data[STORAGE_KEY] as Partial<ExtensionSettings> | undefined;
  return { ...DEFAULT_SETTINGS, ...raw, disabledHosts: raw?.disabledHosts ?? [] };
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  await chrome.storage.sync.set({ [STORAGE_KEY]: settings });
}

export function subscribeSettings(
  callback: (settings: ExtensionSettings) => void,
): () => void {
  const listener: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
    changes,
    area,
  ) => {
    if (area !== 'sync' || !changes[STORAGE_KEY]) return;
    void getSettings().then(callback);
  };
  chrome.storage.onChanged.addListener(listener);
  void getSettings().then(callback);
  return () => chrome.storage.onChanged.removeListener(listener);
}
