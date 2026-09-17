import type { ComponentChildren } from 'preact';

/**
 * What to do next, when there is no button to press. Buttons are for actions you can take;
 * telling someone to tap the board is not an action, so it never gets a dead button.
 */
export function TurnHint({ children }: { children: ComponentChildren }) {
  return <p class="hint-bubble turn-hint">{children}</p>;
}
