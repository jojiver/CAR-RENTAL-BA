import { addDaysISO, todayISO } from '../lib/dates';
import { periodDelta, round, sum } from '../lib/stats';
import { categoryStats, dailyRevenueSeries, rentalsStartingIn } from './derive';
import {
  effectiveVehicleStatus,
  isActiveToday,
  loadDataset,
  utilizationRate,
} from './store';

export function getOverview() {
  const dataset = loadDataset();
  const today = todayISO();
  const from30 = addDaysISO(today, -29);
  const prevFrom = addDaysISO(today, -59);
  const prevTo = addDaysISO(today, -30);

  const last30 = rentalsStartingIn(dataset, from30, today);
  const prev30 = rentalsStartingIn(dataset, prevFrom, prevTo);

  const revenue30 = sum(last30.map((rental) => rental.totalAmount));
  const revenuePrev = sum(prev30.map((rental) => rental.totalAmount));
  const avgRental = last30.length === 0 ? 0 : revenue30 / last30.length;
  const avgRentalPrev = prev30.length === 0 ? 0 : revenuePrev / prev30.length;

  const statuses = dataset.vehicles.map((vehicle) =>
    effectiveVehicleStatus(vehicle, dataset.rentals, today),
  );
  const activeRentals = dataset.rentals.filter((rental) => isActiveToday(rental, today)).length;

  return {
    today,
    kpis: {
      revenue30: {
        value: Math.round(revenue30),
        previous: Math.round(revenuePrev),
        delta: periodDelta(revenue30, revenuePrev),
      },
      activeRentals,
      utilization30: round(
        utilizationRate(dataset.rentals, from30, today, dataset.vehicles.length),
        4,
      ),
      avgRental: {
        value: Math.round(avgRental),
        previous: Math.round(avgRentalPrev),
        delta: periodDelta(avgRental, avgRentalPrev),
      },
      fleetSize: dataset.vehicles.length,
      available: statuses.filter((status) => status === 'available').length,
      rented: statuses.filter((status) => status === 'rented').length,
      maintenance: statuses.filter((status) => status === 'maintenance').length,
      customers: dataset.customers.length,
    },
    revenueTrend: dailyRevenueSeries(
      dataset.rentals,
      addDaysISO(today, -59),
      today,
    ).map((point) => ({
      date: point.date,
      revenue: point.revenue,
      rentals: point.rentals,
    })),
    categoryMix: categoryStats(dataset, from30, today).map((row) => ({
      category: row.category,
      vehicles: row.vehicles,
      utilization30: row.utilization,
      revenue30: row.revenue,
    })),
    recentRentals: dataset.rentals
      .slice()
      .sort((a, b) =>
        a.startDate === b.startDate ? b.id - a.id : b.startDate.localeCompare(a.startDate),
      )
      .slice(0, 8)
      .map((rental) => ({
        id: rental.id,
        customerName: dataset.customerById.get(rental.customerId)?.fullName ?? 'Unknown customer',
        vehicleName: dataset.vehicleById.get(rental.vehicleId)?.name ?? 'Unknown vehicle',
        category: dataset.vehicleById.get(rental.vehicleId)?.category ?? 'Economy',
        startDate: rental.startDate,
        endDate: rental.endDate,
        status: rental.status,
        totalAmount: rental.totalAmount,
      })),
  };
}
