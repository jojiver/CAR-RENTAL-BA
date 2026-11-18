import { addDaysISO, eachMonth, formatMonthLabel, formatShortDate, monthKeyISO, startOfWeekISO, todayISO } from '../lib/dates';
import { mean, round, sum } from '../lib/stats';
import { categoryStats, rentalsStartingIn } from './derive';
import { daysInWindow, loadDataset, rentedDaysWithin, utilizationRate } from './store';

export function getDescriptive(days = 365) {
  const dataset = loadDataset();
  const today = todayISO();
  const from = addDaysISO(today, -(days - 1));
  const windowRentals = rentalsStartingIn(dataset, from, today);

  const revenue = sum(windowRentals.map((rental) => rental.totalAmount));
  const uniqueCustomers = new Set(windowRentals.map((rental) => rental.customerId));
  const countsPerCustomer = new Map<number, number>();
  for (const rental of windowRentals) {
    countsPerCustomer.set(rental.customerId, (countsPerCustomer.get(rental.customerId) ?? 0) + 1);
  }
  const repeatCustomers = [...countsPerCustomer.values()].filter((count) => count >= 2).length;

  const monthly = eachMonth(from, today).map((month) => {
    const own = windowRentals.filter((rental) => monthKeyISO(rental.startDate) === month);
    return {
      month,
      label: formatMonthLabel(month),
      revenue: Math.round(sum(own.map((rental) => rental.totalAmount))),
      rentals: own.length,
    };
  });

  const weekly: {
    week: string;
    label: string;
    revenue: number;
    rentals: number;
    utilization: number;
  }[] = [];
  let cursor = startOfWeekISO(addDaysISO(today, -15 * 7));
  const firstWeek = startOfWeekISO(from);
  if (cursor < firstWeek) cursor = firstWeek;
  while (cursor <= today) {
    const weekEnd = addDaysISO(cursor, 6);
    const cappedEnd = weekEnd > today ? today : weekEnd;
    const own = windowRentals.filter(
      (rental) => rental.startDate >= cursor && rental.startDate <= weekEnd,
    );
    weekly.push({
      week: cursor,
      label: formatShortDate(cursor),
      revenue: Math.round(sum(own.map((rental) => rental.totalAmount))),
      rentals: own.length,
      utilization: round(
        utilizationRate(dataset.rentals, cursor, cappedEnd, dataset.vehicles.length),
        4,
      ),
    });
    cursor = addDaysISO(cursor, 7);
  }

  const vehicleAgg = new Map<number, { revenue: number; rentals: number }>();
  for (const rental of windowRentals) {
    const entry = vehicleAgg.get(rental.vehicleId) ?? { revenue: 0, rentals: 0 };
    entry.revenue += rental.totalAmount;
    entry.rentals += 1;
    vehicleAgg.set(rental.vehicleId, entry);
  }
  const windowDays = daysInWindow(from, today);
  const topVehicles = [...vehicleAgg.entries()]
    .map(([vehicleId, agg]) => {
      const vehicle = dataset.vehicleById.get(vehicleId);
      const booked = sum(
        dataset.rentals
          .filter((rental) => rental.vehicleId === vehicleId)
          .map((rental) => rentedDaysWithin(rental, from, today)),
      );
      return {
        id: vehicleId,
        name: vehicle?.name ?? 'Unknown vehicle',
        category: vehicle?.category ?? 'Economy',
        rentals: agg.rentals,
        revenue: Math.round(agg.revenue),
        utilization: round(Math.min(1, booked / windowDays), 4),
        dailyRate: vehicle?.dailyRate ?? 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  const durationBuckets = [
    { bucket: '1–2 days', count: 0 },
    { bucket: '3–5 days', count: 0 },
    { bucket: '6–10 days', count: 0 },
    { bucket: '11+ days', count: 0 },
  ];
  for (const rental of windowRentals) {
    if (rental.days <= 2) durationBuckets[0].count += 1;
    else if (rental.days <= 5) durationBuckets[1].count += 1;
    else if (rental.days <= 10) durationBuckets[2].count += 1;
    else durationBuckets[3].count += 1;
  }

  const segments = [
    { segment: 'Loyal', customers: 0, revenue: 0, rentals: 0 },
    { segment: 'Returning', customers: 0, revenue: 0, rentals: 0 },
    { segment: 'One-time', customers: 0, revenue: 0, rentals: 0 },
  ];
  for (const [customerId, count] of countsPerCustomer) {
    const own = windowRentals.filter((rental) => rental.customerId === customerId);
    const spend = sum(own.map((rental) => rental.totalAmount));
    const bucket = count >= 5 ? segments[0] : count >= 2 ? segments[1] : segments[2];
    bucket.customers += 1;
    bucket.revenue += spend;
    bucket.rentals += count;
  }

  return {
    window: { from, to: today, days },
    kpis: {
      revenue: Math.round(revenue),
      rentals: windowRentals.length,
      avgDuration: round(mean(windowRentals.map((rental) => rental.days)), 1),
      avgValue: windowRentals.length === 0 ? 0 : Math.round(revenue / windowRentals.length),
      uniqueCustomers: uniqueCustomers.size,
      utilization: round(
        utilizationRate(dataset.rentals, from, today, dataset.vehicles.length),
        4,
      ),
      revenuePerVehicle:
        dataset.vehicles.length === 0 ? 0 : Math.round(revenue / dataset.vehicles.length),
      repeatRate:
        uniqueCustomers.size === 0 ? 0 : round(repeatCustomers / uniqueCustomers.size, 4),
      fleetSize: dataset.vehicles.length,
    },
    monthly,
    weekly,
    categories: categoryStats(dataset, from, today),
    topVehicles,
    durationBuckets,
    segments: segments.map((row) => ({
      ...row,
      revenue: Math.round(row.revenue),
      avgSpend: row.customers === 0 ? 0 : Math.round(row.revenue / row.customers),
    })),
  };
}
