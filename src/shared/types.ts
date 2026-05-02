export type ModifierMode = 'none' | 'alt';

export interface ExtensionSettings {
  seekStepSeconds: number;
  volumeStep: number;
  requireModifier: ModifierMode;
  disabledHosts: string[];
}

export type CommandAction =
  | 'seek-back'
  | 'seek-forward'
  | 'volume-up'
  | 'volume-down'
  | 'toggle-pause';
