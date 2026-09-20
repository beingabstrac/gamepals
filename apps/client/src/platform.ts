import { Capacitor } from '@capacitor/core';

/**
 * Native app services (docs/04 §1, docs/13). Plugins load only inside the iOS and Android apps;
 * the web build keeps using browser APIs.
 */
export const NATIVE = Capacitor.isNativePlatform();

/**
 * A build for a game portal (`VITE_PORTAL=1`), for CrazyGames, Poki, GameDistribution and itch.io
 * (docs/08 M12d). The page runs inside somebody else's iframe, so it registers no service worker:
 * a portal serves the game from its own origin and a worker of ours has no business there, and
 * some portals reject a build that installs one. The portal's own SDK replaces AdMob when there is
 * an account to test one against; until then this flag is what everything else hangs off.
 */
export const PORTAL = import.meta.env.VITE_PORTAL === '1';

// ---------- Storage: native Preferences in the apps (iOS may wipe WebView storage), localStorage on the web.

const cache = new Map<string, string>();

export const storage = {
  /** Loads saved values into memory before the first screen renders, so reads stay synchronous. */
  async init(): Promise<void> {
    if (!NATIVE) return;
    const { Preferences } = await import('@capacitor/preferences');
    const { keys } = await Preferences.keys();
    await Promise.all(
      keys.map(async (key) => {
        const { value } = await Preferences.get({ key });
        if (value !== null) cache.set(key, value);
      }),
    );
  },
  get(key: string): string | null {
    if (NATIVE) return cache.get(key) ?? null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    if (NATIVE) {
      cache.set(key, value);
      void import('@capacitor/preferences').then(({ Preferences }) => Preferences.set({ key, value }));
      return;
    }
    try {
      localStorage.setItem(key, value);
    } catch {
      // Private mode or storage blocked: the value lasts for this session only.
    }
  },
};

// ---------- Haptics: real device haptics in the apps (navigator.vibrate does nothing on iPhone).

export type HapticKind = 'light' | 'medium' | 'heavy' | 'success' | 'warning';

export function nativeHaptic(kind: HapticKind): void {
  void import('@capacitor/haptics').then(({ Haptics, ImpactStyle, NotificationType }) => {
    if (kind === 'success') return Haptics.notification({ type: NotificationType.Success });
    if (kind === 'warning') return Haptics.notification({ type: NotificationType.Warning });
    const style = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy }[kind];
    return Haptics.impact({ style });
  });
}

// ---------- Android Back button: step back a screen; at the top, send the app to the background.

/** `handler` returns true when it went back a screen, false when there is nowhere left to go. */
export function onBackButton(handler: () => boolean): () => void {
  if (!NATIVE) return () => undefined;
  let cancelled = false;
  let remove: (() => void) | undefined;
  void import('@capacitor/app').then(async ({ App }) => {
    const listener = await App.addListener('backButton', () => {
      if (!handler()) void App.minimizeApp();
    });
    if (cancelled) void listener.remove();
    else remove = () => void listener.remove();
  });
  return () => {
    cancelled = true;
    remove?.();
  };
}
