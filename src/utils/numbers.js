export function ar(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return String(value ?? '');
  if (n === 10) return 'عشرة';
  return String(n);
}

export function ar1(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return String(value ?? '');
  if (n === 10) return 'عشرة';
  return n.toFixed(1);
}

export function arPercent(value) {
  return `${ar(value)}%`;
}
