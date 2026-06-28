import * as Haptics from 'expo-haptics';

// A single, centralized wrapper over expo-haptics. Reserved for meaningful state
// changes — outcomes, discrete actions, picking/toggling — never pure navigation
// or scrolling. Every call degrades to a safe no-op when haptics are unavailable
// (no taptic engine, unsupported platform, or a rejected native promise), so
// callers never have to guard or await.

/** Outcome feedback: the result of an action the user just took. */
export type HapticNotification = 'success' | 'warning' | 'error';

/** Impact feedback weight for a discrete action; iOS defaults to a light tap. */
export type HapticImpact = 'light' | 'medium' | 'heavy';

function fireAndForget(fire: () => Promise<void>): void {
  try {
    // Native triggers are fire-and-forget; swallow rejections so an unavailable
    // engine can never surface as an unhandled promise or break the caller.
    fire().catch(() => {});
  } catch {
    // Synchronous throw (module unavailable on this platform) — no-op.
  }
}

function notificationType(outcome: HapticNotification): Haptics.NotificationFeedbackType {
  switch (outcome) {
    case 'success':
      return Haptics.NotificationFeedbackType.Success;
    case 'warning':
      return Haptics.NotificationFeedbackType.Warning;
    case 'error':
      return Haptics.NotificationFeedbackType.Error;
  }
}

function impactStyle(weight: HapticImpact): Haptics.ImpactFeedbackStyle {
  switch (weight) {
    case 'light':
      return Haptics.ImpactFeedbackStyle.Light;
    case 'medium':
      return Haptics.ImpactFeedbackStyle.Medium;
    case 'heavy':
      return Haptics.ImpactFeedbackStyle.Heavy;
  }
}

export const haptics = {
  /** Outcome of a task: success / warning / error notification. */
  notification(outcome: HapticNotification): void {
    fireAndForget(() => Haptics.notificationAsync(notificationType(outcome)));
  },

  /** A discrete action landed (add, drop, delete) — a single impact tap. */
  impact(weight: HapticImpact = 'light'): void {
    fireAndForget(() => Haptics.impactAsync(impactStyle(weight)));
  },

  /** Picking or toggling something — the lightest selection tick. */
  selection(): void {
    fireAndForget(() => Haptics.selectionAsync());
  },
};
