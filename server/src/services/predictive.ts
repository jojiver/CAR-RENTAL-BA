import { addDaysISO, dowISO, todayISO } from '../lib/dates';
import {
  clamp,
  linearRegression,
  mean,
  round,
  stdDev,
  sum,
  weekdayFactors,
} from '../lib/stats';
import { categoryStats, dailyRevenueSeries } from './derive';
import { loadDataset } from './store';

const HISTORY_DAYS = 180;

interface SeriesPoint {
  date: string;
  value: number;
}

function forecastSeries(series: SeriesPoint[], horizon: number) {
  const n = series.length;
  const values = series.map((point) => point.value);
  const trainWindow = Math.min(120, n);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = n - trainWindow; i < n; i += 1) {
    xs.push(i);
    ys.push(values[i]);
  }

  const regression = linearRegression(xs, ys);
  const avg = mean(ys) || 1;
  const slope = clamp(regression.slope * 0.5, -avg * 0.015, avg * 0.015);
  const factors = weekdayFactors(series.slice(Math.max(0, n - 56)));
  const recent = series.slice(Math.max(0, n - 14));
  const level = mean(recent.map((point) => point.value / (factors[dowISO(point.date)] || 1)));
  const residuals = recent.map(
    (point) => point.value - level * (factors[dowISO(point.date)] || 1),
  );
  const sd = stdDev(residuals);
  const lastDate = series[n - 1].date;

  const points = Array.from({ length: horizon }, (_, index) => {
    const k = index + 1;
    const date = addDaysISO(lastDate, k);
    const base = Math.max(0, level + slope * k);
    const predicted = Math.max(0, base * (factors[dowISO(date)] || 1));
    return {
      date,
      predicted: Math.round(predicted),
      lower: Math.max(0, Math.round(predicted - 1.28 * sd)),
      upper: Math.round(predicted + 1.28 * sd),
    };
  });

  return { points, slope, level, sd, r2: round(regression.r2, 3) };
}

function backtestSeries(series: SeriesPoint[], horizonDays = 28) {
  if (series.length < horizonDays + 28) {
    return { wape: 0, accuracy: 0, weeks: 0 };
  }
  const train = series.slice(0, series.length - horizonDays);
  const actualDaily = series.slice(series.length - horizonDays).map((point) => point.value);
  const { points } = forecastSeries(train, horizonDays);
  const predictedDaily = points.map((point) => point.predicted);
  const weeks = Math.floor(horizonDays / 7);
  const actualWeeks: number[] = [];
  const predictedWeeks: number[] = [];
  for (let week = 0; week < weeks; week += 1) {
    actualWeeks.push(sum(actualDaily.slice(week * 7, week * 7 + 7)));
    predictedWeeks.push(sum(predictedDaily.slice(week * 7, week * 7 + 7)));
  }
  const totalActual = sum(actualWeeks);
  const totalError = sum(actualWeeks.map((value, index) => Math.abs(value - predictedWeeks[index])));
  const wape = totalActual > 0 ? (totalError / totalActual) * 100 : 0;
  return {
    wape: round(wape, 1),
    accuracy: round(clamp(100 - wape, 0, 100), 1),
    weeks,
  };
}

const MODEL_NAME = 'Linear trend + weekday seasonality';
const MODEL_DESCRIPTION =
  'A damped least-squares trend over the last 120 days is combined with day-of-week factors from the last 8 weeks and a 14-day level, so the forecast tracks recent demand. The band is a roughly 80% interval from in-sample residuals (±1.28σ). Accuracy is measured as 100 − WAPE on the last 4 weeks of weekly totals.';

export function getPredictive(horizon = 14) {
  const h = clamp(Math.round(horizon) || 14, 7, 60);
  const dataset = loadDataset();
  const today = todayISO();
  const from = addDaysISO(today, -(HISTORY_DAYS - 1));

  const revenueDaily: SeriesPoint[] = dailyRevenueSeries(dataset.rentals, from, today).map(
    (point) => ({ date: point.date, value: point.revenue }),
  );
  const demandDaily: SeriesPoint[] = dailyRevenueSeries(dataset.rentals, from, today).map(
    (point) => ({ date: point.date, value: point.rentals }),
  );

  const revenueFull = forecastSeries(revenueDaily, 30);
  const demandFull = forecastSeries(demandDaily, 30);

  const from30 = addDaysISO(today, -29);
  const from90 = addDaysISO(today, -89);
  const from84 = addDaysISO(today, -83);
  const cat30 = categoryStats(dataset, from30, today);

  const categories = cat30.map((row) => {
    const ids = new Set(
      dataset.vehicles
        .filter((vehicle) => vehicle.category === row.category)
        .map((vehicle) => vehicle.id),
    );
    const own = dataset.rentals.filter(
      (rental) =>
        rental.status !== 'cancelled' &&
        ids.has(rental.vehicleId) &&
        rental.startDate >= from90 &&
        rental.startDate <= today,
    );
    const daily = dailyRevenueSeries(own, from84, today).map((point) => point.rentals);
    const weekly: number[] = [];
    for (let week = 0; week < 12; week += 1) {
      weekly.push(sum(daily.slice(week * 7, week * 7 + 7)));
    }
    const regression = linearRegression(
      weekly.map((_, index) => index),
      weekly,
    );
    const slope = regression.slope * 0.6;
    const levelRecent = mean(weekly.slice(-4));
    const projectedWeekly = Math.max(0, levelRecent + slope * 2);
    const next30Rentals = Math.round((projectedWeekly / 7) * 30);
    const avgValue = row.rentals > 0 ? row.revenue / row.rentals : row.avgRate;
    const trendPct = levelRecent > 0 ? Math.round(((slope * 4) / levelRecent) * 100) : 0;
    const confidence: 'high' | 'medium' | 'low' =
      row.rentals >= 60 ? 'high' : row.rentals >= 20 ? 'medium' : 'low';
    return {
      category: row.category,
      current30Rentals: row.rentals,
      next30Rentals,
      next30Revenue: Math.round(next30Rentals * avgValue),
      trendPct,
      utilization30: row.utilization,
      avgValue: Math.round(avgValue),
      confidence,
    };
  });

  const projectedRentals = sum(categories.map((row) => row.next30Rentals));
  const recentWindow = dataset.rentals.filter(
    (rental) =>
      rental.status !== 'cancelled' && rental.startDate >= from90 && rental.startDate <= today,
  );
  const avgDuration = mean(recentWindow.map((rental) => rental.days)) || 3;
  const projectedUtilization = clamp(
    (projectedRentals * avgDuration) / (dataset.vehicles.length * 30),
    0,
    1,
  );

  const completed180 = dataset.rentals.filter(
    (rental) =>
      rental.status === 'completed' && rental.returnedAt !== null && rental.endDate >= from,
  );
  const lateReturns = completed180.filter(
    (rental) => rental.returnedAt !== null && rental.returnedAt > rental.endDate,
  );
  const lateRate = completed180.length === 0 ? 0 : lateReturns.length / completed180.length;

  const revenueAccuracy = backtestSeries(revenueDaily);
  const demandAccuracy = backtestSeries(demandDaily);

  return {
    generatedAt: new Date().toISOString(),
    horizon: h,
    revenue: {
      history: revenueDaily.slice(-90).map((point) => ({
        date: point.date,
        actual: Math.round(point.value),
      })),
      forecast: revenueFull.points.slice(0, h),
      next30: Math.round(sum(revenueFull.points.map((point) => point.predicted))),
      model: {
        name: MODEL_NAME,
        description: MODEL_DESCRIPTION,
        backtestWeeks: revenueAccuracy.weeks,
        wape: revenueAccuracy.wape,
        accuracy: revenueAccuracy.accuracy,
        r2: revenueFull.r2,
      },
    },
    demand: {
      history: demandDaily.slice(-90).map((point) => ({
        date: point.date,
        actual: point.value,
      })),
      forecast: demandFull.points.slice(0, h),
      next30: Math.round(sum(demandFull.points.map((point) => point.predicted))),
      model: {
        name: MODEL_NAME,
        description: MODEL_DESCRIPTION,
        backtestWeeks: demandAccuracy.weeks,
        wape: demandAccuracy.wape,
        accuracy: demandAccuracy.accuracy,
        r2: demandFull.r2,
      },
    },
    categories,
    utilization: {
      current30: round(
        projectedRentals === 0
          ? 0
          : cat30.reduce((acc, row) => acc + row.utilization * row.vehicles, 0) /
              Math.max(1, dataset.vehicles.length),
        4,
      ),
      projectedNext30: round(projectedUtilization, 4),
      fleetSize: dataset.vehicles.length,
      avgDuration: round(avgDuration, 1),
    },
    risk: {
      lateReturnRate: round(lateRate, 4),
      expectedLateNext30: Math.round(projectedRentals * lateRate),
      completed180: completed180.length,
    },
  };
}
