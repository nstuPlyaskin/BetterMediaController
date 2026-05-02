import esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');

const watch = process.argv.includes('--watch');

if (!fs.existsSync(dist)) {
  fs.mkdirSync(dist, { recursive: true });
}

const manifest = {
  manifest_version: 3,
  name: 'Управление медиа плеером по ГОСТу',
  version: '1.0.0',
  description:
    'Стрелки и пробел по единому стандарту: перемотка, громкость, пауза для HTML5 video/audio.',
  icons: {
    16: 'icon.png',
    32: 'icon.png',
    48: 'icon.png',
    128: 'icon.png',
  },
  permissions: ['storage', 'activeTab'],
  host_permissions: ['<all_urls>'],
  background: {
    service_worker: 'background.js',
  },
  action: {
    default_popup: 'popup.html',
    default_title: 'Медиа по ГОСТу',
    default_icon: {
      16: 'icon.png',
      32: 'icon.png',
      48: 'icon.png',
    },
  },
  options_ui: {
    page: 'options.html',
    open_in_tab: true,
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['content.js'],
      run_at: 'document_start',
      all_frames: true,
    },
  ],
  commands: {
    'seek-back': {
      suggested_key: { default: 'Alt+Shift+Left' },
      description: 'Перемотка назад (дубль стрелки влево)',
    },
    'seek-forward': {
      suggested_key: { default: 'Alt+Shift+Right' },
      description: 'Перемотка вперёд (дубль стрелки вправо)',
    },
    'volume-up': {
      suggested_key: { default: 'Alt+Shift+Up' },
      description: 'Громкость + (дубль стрелки вверх)',
    },
    'volume-down': {
      suggested_key: { default: 'Alt+Shift+Down' },
      description: 'Громкость − (дубль стрелки вниз)',
    },
    'toggle-pause': {
      description:
        'Пауза / воспроизведение. Назначьте ярлык в chrome://extensions/shortcuts (лимит: 4 suggested_key).',
    },
  },
};

fs.writeFileSync(path.join(dist, 'manifest.json'), JSON.stringify(manifest, null, 2));

const iconSrc = path.join(root, 'icon.png');
if (fs.existsSync(iconSrc)) {
  fs.copyFileSync(iconSrc, path.join(dist, 'icon.png'));
} else {
  console.warn('icon.png not found at repo root; toolbar/store icon skipped until you add it.');
}

fs.copyFileSync(
  path.join(root, 'src', 'options', 'options.html'),
  path.join(dist, 'options.html'),
);
fs.copyFileSync(
  path.join(root, 'src', 'popup', 'popup.html'),
  path.join(dist, 'popup.html'),
);

const common = {
  bundle: true,
  platform: 'browser' as const,
  target: 'chrome114' as const,
  logLevel: 'warning' as const,
  sourcemap: false,
};

async function buildAll(): Promise<void> {
  await esbuild.build({
    ...common,
    entryPoints: [path.join(root, 'src', 'content', 'main.ts')],
    outfile: path.join(dist, 'content.js'),
    format: 'iife',
  });
  await esbuild.build({
    ...common,
    entryPoints: [path.join(root, 'src', 'background', 'serviceWorker.ts')],
    outfile: path.join(dist, 'background.js'),
    format: 'iife',
  });
  await esbuild.build({
    ...common,
    entryPoints: [path.join(root, 'src', 'options', 'options.ts')],
    outfile: path.join(dist, 'options.js'),
    format: 'iife',
  });
  await esbuild.build({
    ...common,
    entryPoints: [path.join(root, 'src', 'popup', 'popup.ts')],
    outfile: path.join(dist, 'popup.js'),
    format: 'iife',
  });
}

if (watch) {
  const ctxContent = await esbuild.context({
    ...common,
    entryPoints: [path.join(root, 'src', 'content', 'main.ts')],
    outfile: path.join(dist, 'content.js'),
    format: 'iife',
  });
  const ctxBg = await esbuild.context({
    ...common,
    entryPoints: [path.join(root, 'src', 'background', 'serviceWorker.ts')],
    outfile: path.join(dist, 'background.js'),
    format: 'iife',
  });
  const ctxOpt = await esbuild.context({
    ...common,
    entryPoints: [path.join(root, 'src', 'options', 'options.ts')],
    outfile: path.join(dist, 'options.js'),
    format: 'iife',
  });
  const ctxPopup = await esbuild.context({
    ...common,
    entryPoints: [path.join(root, 'src', 'popup', 'popup.ts')],
    outfile: path.join(dist, 'popup.js'),
    format: 'iife',
  });
  await Promise.all([
    ctxContent.watch(),
    ctxBg.watch(),
    ctxOpt.watch(),
    ctxPopup.watch(),
  ]);
  console.log('watching…');
} else {
  await buildAll();
  console.log('built → dist/');
}
