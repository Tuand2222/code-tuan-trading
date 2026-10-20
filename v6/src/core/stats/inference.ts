export function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function wilson(wins: number, n: number): [number, number] | null {
  if (!Number.isInteger(n) || !Number.isInteger(wins) || n <= 0 || wins < 0 || wins > n)
    return null;
  const z = 1.959963984540054,
    p = wins / n,
    d = 1 + (z * z) / n,
    c = (p + (z * z) / (2 * n)) / d,
    h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [wins === 0 ? 0 : Math.max(0, c - h), wins === n ? 1 : Math.min(1, c + h)];
}
export function bootstrap(
  values: number[],
  seed = 2103,
  iterations = 2000,
): [number, number] | null {
  if (!values.length) return null;
  if (values.some((v) => !Number.isFinite(v)) || !Number.isInteger(iterations) || iterations < 2)
    throw Error('INVALID_BOOTSTRAP');
  const random = mulberry32(seed),
    means: number[] = [];
  for (let i = 0; i < iterations; i++) {
    let s = 0;
    for (let j = 0; j < values.length; j++) s += values[Math.floor(random() * values.length)];
    means.push(s / values.length);
  }
  means.sort((a, b) => a - b);
  const q = (p: number) => {
    const x = (means.length - 1) * p,
      i = Math.floor(x);
    return means[i] + (means[Math.min(i + 1, means.length - 1)] - means[i]) * (x - i);
  };
  return [q(0.025), q(0.975)];
}
