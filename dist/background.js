(() => {
  const COMMAND_MAP = {
    'seek-back': 'seek-back',
    'seek-forward': 'seek-forward',
    'volume-up': 'volume-up',
    'volume-down': 'volume-down',
    'toggle-pause': 'toggle-pause',
  };

  chrome.commands.onCommand.addListener((command) => {
    const action = COMMAND_MAP[command];
    if (!action) return;
    void chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      const id = tabs[0]?.id;
      if (id === undefined) return;
      chrome.tabs
        .sendMessage(id, { type: 'arrows-command', command: action })
        .catch(() => {});
    });
  });
})();
