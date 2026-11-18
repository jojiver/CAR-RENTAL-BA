import { CATEGORIES, type Category, type Rental } from '../db/schema';
import { eachDay } from '../lib/dates';
import { mean, round, sum } from '../lib/stats';
import { daysInWindow, utilizationRate, type Dataset } from './store';

export function nonCancelled(rentalList: Rental[]): Rental[] {
  return rentalList.filter((rental) => rental.status !== 'cancelled');
}

export function rentalsStartingIn(dataset: Dataset, from: string, to: string): Rental[] {
  return dataset.rentals.filter(
    (rental) =>
      rental.status !== 'cancelled' && rental.startDate >= from && rental.startDate <= to,
  );
}

export interface CategoryStats {
  category: Category;
  vehicles: number;
  rentals: number;
  revenue: number;
  avgRate: number;
  avgDuration: number;
  utilization: number;
  revenueShare: number;
}

export function categoryStats(dataset: Dataset, from: string, to: string): CategoryStats[] {
  const windowRentals = rentalsStartingIn(dataset, from, to);
  const totalRevenue = sum(windowRentals.map((rental) => rental.totalAmount)) || 1;

  return CATEGORIES.map((category) => {
    const categoryVehicles = dataset.vehicles.filter((vehicle) => vehicle.category === category);
    const ids = new Set(categoryVehicles.map((vehicle) => vehicle.id));
    const own = windowRentals.filter((rental) => ids.has(rental.vehicleId));
    const ownAll = dataset.rentals.filter((rental) => ids.has(rental.vehicleId));
    const revenue = sum(own.map((rental) => rental.totalAmount));
    const utilization =
      categoryVehicles.length === 0
        ? 0
        : utilizationRate(ownAll, from, to, categoryVehicles.length);

    return {
      category,
      vehicles: categoryVehicles.length,
      rentals: own.length,
      revenue: Math.round(revenue),
      avgRate: round(mean(own.map((rental) => rental.dailyRate)), 2),
      avgDuration: round(mean(own.map((rental) => rental.days)), 1),
      utilization: round(utilization, 4),
      revenueShare: round(revenue / totalRevenue, 4),
    };
  });
}

export interface DailyPoint {
  date: string;
  revenue: number;
  rentals: number;
}

export function dailyRevenueSeries(
  rentalList: Rental[],
  from: string,
  to: string,
): DailyPoint[] {
  const revenue = new Map<string, number>();
  const counts = new Map<string, number>();
  for (const rental of rentalList) {
    if (rental.status === 'cancelled') continue;
    if (rental.startDate < from || rental.startDate > to) continue;
    revenue.set(rental.startDate, (revenue.get(rental.startDate) ?? 0) + rental.totalAmount);
    counts.set(rental.startDate, (counts.get(rental.startDate) ?? 0) + 1);
  }
  return eachDay(from, to).map((date) => ({
    date,
    revenue: Math.round(revenue.get(date) ?? 0),
    rentals: counts.get(date) ?? 0,
  }));
}
