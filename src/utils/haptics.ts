import * as Haptics from 'expo-haptics';

// Fire-and-forget: haptics are a nicety and must never block or throw into the UI.

/** A task got finished — the "stamp" moment. */
export const hapticSuccess = () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

/** A small state change, e.g. ticking a checklist item. */
export const hapticTick = () => void Haptics.selectionAsync().catch(() => {});

/** Something still needs doing (e.g. Save pressed without an amount) — a nudge, not an error. */
export const hapticNudge = () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
