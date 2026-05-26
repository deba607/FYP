function baseValue(value: string) {
  const trimmed = String(value || '').trim();
  return trimmed.length ? trimmed : 'default';
}

// Firebase Realtime Database keys/path segments cannot contain: . # $ [ ] /
export function encodeRtdbKey(value: string) {
  return baseValue(value).replace(/[.#$\[\]\/]/g, '_');
}
