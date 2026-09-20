import { useEffect, useState } from 'preact/hooks';
import { OFFERS, PRO_GIVES, pro, type Plan, type ProState } from '../pro';

/** Live Pro state, for anything that needs to know whether to hide ads or open a level. */
export function usePro(): ProState {
  const [state, setState] = useState(pro.get());
  useEffect(() => pro.subscribe(setState), []);
  return state;
}

/**
 * The shop (docs/08 M11). Three ways to buy and the one-off is the one we lead with, because
 * that is what this audience actually buys: the category leader sells Remove Ads outright and
 * so does Ponder Club. The subscriptions stand beside it to make it look like the sensible one.
 */
export function ProSheet({ onClose }: { onClose(): void }) {
  const state = usePro();
  const [busy, setBusy] = useState<Plan | null>(null);

  const buy = async (plan: Plan) => {
    setBusy(plan);
    await pro.buy(plan);
    setBusy(null);
  };

  return (
    <div class="picker-backdrop" onClick={onClose}>
      <div class="picker pro-sheet" role="dialog" aria-label="Game Pals Pro" onClick={(event) => event.stopPropagation()}>
        {state.pro ? (
          <>
            <p class="picker-title">You have Pro 🎉</p>
            <ul class="pro-gives">
              {PRO_GIVES.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p class="pro-plan">
              {state.plan === 'lifetime' ? 'One payment, yours for good.' : `On the ${state.plan} plan.`}
            </p>
            <button class="btn secondary" onClick={onClose}>
              Back to the games
            </button>
          </>
        ) : (
          <>
            <p class="picker-title">Go Pro</p>
            <ul class="pro-gives">
              {PRO_GIVES.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <div class="pro-offers">
              {OFFERS.map((offer) => (
                <button
                  key={offer.plan}
                  class={offer.hero ? 'pro-offer hero' : 'pro-offer'}
                  disabled={busy !== null}
                  onClick={() => void buy(offer.plan)}
                >
                  {offer.hero && <span class="pro-flag">Best value</span>}
                  <span class="pro-title">{offer.title}</span>
                  <span class="pro-price">{busy === offer.plan ? 'One moment…' : offer.price}</span>
                  <span class="pro-note">{offer.note}</span>
                </button>
              ))}
            </div>
            <button class="pro-restore" onClick={() => void pro.restore()}>
              Restore a purchase
            </button>
          </>
        )}
      </div>
    </div>
  );
}
