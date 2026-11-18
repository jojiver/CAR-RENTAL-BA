import { dowISO } from './dates';

export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return sum(values) / values.length;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, digits = 0): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function safeDiv(a: number, b: number): number {
  return b === 0 ? 0 : a / b;
}

export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = mean(values.map((value) => (value - avg) ** 2));
  return Math.sqrt(variance);
}

export function linearRegression(
  xs: number[],
  ys: number[],
): { slope: number; intercept: number; r2: number } {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) {
    return { slope: 0, intercept: ys[0] ?? 0, r2: 0 };
  }
  const mx = mean(xs.slice(0, n));
  const my = mean(ys.slice(0, n));
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i] - mx;
    numerator += dx * (ys[i] - my);
    denominator += dx * dx;
  }
  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = my - slope * mx;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i += 1) {
    const predicted = intercept + slope * xs[i];
    ssRes += (ys[i] - predicted) ** 2;
    ssTot += (ys[i] - my) ** 2;
  }
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
  return { slope, intercept, r2 };
}

export function mape(actual: number[], predicted: number[]): number {
  const pairs = actual
    .map((value, index) => ({ actual: value, predicted: predicted[index] }))
    .filter((pair) => pair.actual > 0 && Number.isFinite(pair.predicted));
  if (pairs.length === 0) return 0;
  const error =
    sum(pairs.map((pair) => Math.abs(pair.actual - pair.predicted) / pair.actual)) /
    pairs.length;
  return round(error * 100, 1);
}

export function periodDelta(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 1 : null;
  return (current - previous) / previous;
}

export function weekdayFactors(series: { date: string; value: number }[]): number[] {
  const buckets: number[][] = Array.from({ length: 7 }, () => []);
  for (const point of series) {
    buckets[dowISO(point.date)].push(point.value);
  }
  const overall = mean(series.map((point) => point.value)) || 1;
  const factors = buckets.map((bucket) => (bucket.length ? mean(bucket) / overall : 1));
  const normalized = factors.map((factor) => clamp(factor, 0.55, 1.6));
  const weightedMean =
    sum(normalized.map((factor, index) => factor * Math.max(1, buckets[index].length))) /
    sum(buckets.map((bucket) => Math.max(1, bucket.length)));
  return normalized.map((factor) => factor / (weightedMean || 1));
}
