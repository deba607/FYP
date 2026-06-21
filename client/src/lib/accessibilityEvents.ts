export const OPEN_ACCESSIBILITY_SETTINGS_EVENT = 'bharat-museum:open-accessibility-settings';

export function openAccessibilitySettings() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(OPEN_ACCESSIBILITY_SETTINGS_EVENT));
  }
}
