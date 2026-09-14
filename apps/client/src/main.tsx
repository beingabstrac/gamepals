import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/700.css';
import { render } from 'preact';
import { App } from './App';
import { SELFTEST } from './autoplay';
import { cue } from './feedback';
import './styles.css';

// Every button answers a tap; the first tap also unlocks Web Audio on iOS.
document.addEventListener('pointerdown', (event) => {
  const target = event.target as Element | null;
  if (target?.closest?.('button:not([disabled])')) cue('tap');
});

render(<App />, document.getElementById('app')!);

// Native test builds only: the app plays every game by itself and logs the result for CI.
if (SELFTEST) void import('./selftest').then((test) => test.runSelfTest());
