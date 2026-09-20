import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/700.css';
import { render } from 'preact';
import { App } from './App';
import { SELFTEST } from './autoplay';
import { NATIVE, storage } from './platform';
import { cue } from './feedback';
import './styles.css';

// Every button answers a tap; the first tap also unlocks Web Audio on iOS.
document.addEventListener('pointerdown', (event) => {
  const target = event.target as Element | null;
  if (target?.closest?.('button:not([disabled])')) cue('tap');
});

// Saved settings load first (native Preferences in the apps), then the first screen renders.
void storage.init().finally(() => {
  render(<App />, document.getElementById('app')!);
  // Native test builds only: the app plays every game by itself and logs the result for CI.
  if (SELFTEST) void import('./selftest').then((test) => test.runSelfTest());
});

// Web only: an installable app that opens with no connection. The native apps already carry every file.
if (!NATIVE && !SELFTEST && 'serviceWorker' in navigator) {
  void import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }));
  // A new build used to wait for a second visit, so a deploy could sit behind yesterday's cache
  // for a day. When the new worker takes over, reload once, but never in the middle of a game.
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || document.querySelector('.board canvas')) return;
    reloading = true;
    location.reload();
  });
}
