import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { customers, rentals, vehicles } from '../db/schema';
import type { Category, Customer, Rental, RentalStatus, Vehicle, VehicleStatus } from '../db/schema';
import { addDaysISO, daysBetweenISO, todayISO } from '../lib/dates';
import { sum } from '../lib/stats';

export interface Dataset {
  vehicles: Vehicle[];
  customers: Customer[];
  rentals: Rental[];
  vehicleById: Map<number, Vehicle>;
  customerById: Map<number, Customer>;
}

export async function loadDataset(): Promise<Dataset> {
  const [vehicleRows, customerRows, rentalRows] = await Promise.all([
    db.select().from(vehicles),
    db.select().from(customers),
    db.select().from(rentals),
  ]);
  return {
    vehicles: vehicleRows,
    customers: customerRows,
    rentals: rentalRows,
    vehicleById: new Map(vehicleRows.map((vehicle) => [vehicle.id, vehicle])),
    customerById: new Map(customerRows.map((customer) => [customer.id, customer])),
  };
}

export function daysInWindow(from: string, to: string): number {
  return daysBetweenISO(from, to) + 1;
}

export function rentalDays(rental: Rental): number {
  return Math.max(1, rental.days || daysBetweenISO(rental.startDate, rental.endDate));
}

export function overlapsRange(rental: Rental, from: string, to: string): boolean {
  return rental.startDate <= to && rental.endDate >= from;
}

export function rentedDaysWithin(rental: Rental, from: string, to: string): number {
  if (rental.status === 'cancelled' || !overlapsRange(rental, from, to)) return 0;
  const endExclusive = addDaysISO(to, 1);
  const start = rental.startDate > from ? rental.startDate : from;
  const end = rental.endDate < endExclusive ? rental.endDate : endExclusive;
  return Math.max(0, daysBetweenISO(start, end));
}

export function bookedDays(rentalList: Rental[], from: string, to: string): number {
  return sum(rentalList.map((rental) => rentedDaysWithin(rental, from, to)));
}

export function utilizationRate(
  rentalList: Rental[],
  from: string,
  to: string,
  vehicleCount: number,
): number {
  const capacity = vehicleCount * daysInWindow(from, to);
  if (capacity === 0) return 0;
  return Math.min(1, bookedDays(rentalList, from, to) / capacity);
}

export function isActiveToday(rental: Rental, today: string): boolean {
  return rental.status === 'active' && rental.startDate <= today && rental.endDate > today;
}

export function effectiveVehicleStatus(
  vehicle: Vehicle,
  rentalList: Rental[],
  today: string,
): VehicleStatus {
  if (vehicle.status === 'maintenance') return 'maintenance';
  if (rentalList.some((rental) => rental.vehicleId === vehicle.id && isActiveToday(rental, today))) {
    return 'rented';
  }
  return 'available';
}

export function customerSegment(rentalCount: number): string {
  if (rentalCount >= 5) return 'Loyal';
  if (rentalCount >= 2) return 'Returning';
  return 'One-time';
}

export function categoryOf(vehicleId: number, dataset: Dataset): Category {
  return dataset.vehicleById.get(vehicleId)?.category ?? 'Economy';
}

export interface VehicleOverview extends Vehicle {
  utilization30: number;
  effectiveStatus: VehicleStatus;
  activeRental: { id: number; customerName: string; endDate: string } | null;
}

export async function listVehicles(): Promise<VehicleOverview[]> {
  const { vehicles: vehicleRows, rentals: rentalRows, customerById } = await loadDataset();
  const today = todayISO();
  const from = addDaysISO(today, -29);
  return vehicleRows
    .map((vehicle) => {
      const own = rentalRows.filter((rental) => rental.vehicleId === vehicle.id);
      const active = own.find((rental) => isActiveToday(rental, today)) ?? null;
      return {
        ...vehicle,
        utilization30: Math.min(
          1,
          bookedDays(own, from, today) / (30 * 1),
        ),
        effectiveStatus: effectiveVehicleStatus(vehicle, rentalRows, today),
        activeRental: active
          ? {
              id: active.id,
              customerName: customerById.get(active.customerId)?.fullName ?? 'Unknown',
              endDate: active.endDate,
            }
          : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface CustomerOverview extends Customer {
  rentalsCount: number;
  totalSpend: number;
  lastRental: string | null;
  segment: string;
}

export async function listCustomers(): Promise<CustomerOverview[]> {
  const { customers: customerRows, rentals: rentalRows } = await loadDataset();
  return customerRows
    .map((customer) => {
      const own = rentalRows.filter(
        (rental) => rental.customerId === customer.id && rental.status !== 'cancelled',
      );
      const rentalsCount = own.length;
      const lastRental = own.reduce<string | null>(
        (latest, rental) => (latest === null || rental.startDate > latest ? rental.startDate : latest),
        null,
      );
      return {
        ...customer,
        rentalsCount,
        totalSpend: Math.round(sum(own.map((rental) => rental.totalAmount))),
        lastRental,
        segment: customerSegment(rentalsCount),
      };
    })
    .sort((a, b) => b.totalSpend - a.totalSpend);
}

export interface RentalRow {
  id: number;
  vehicleId: number;
  customerId: number;
  vehicleName: string;
  vehicleCategory: Category;
  plate: string;
  customerName: string;
  startDate: string;
  endDate: string;
  days: number;
  dailyRate: number;
  totalAmount: number;
  status: RentalStatus;
  returnedAt: string | null;
  pickupLocation: string;
  dropoffLocation: string;
}

export interface RentalQuery {
  status?: RentalStatus | 'all';
  q?: string;
  limit?: number;
}

export async function listRentals(query: RentalQuery = {}): Promise<{
  rentals: RentalRow[];
  total: number;
  stats: { activeCount: number; completed30: number; revenue30: number; avgDuration30: number };
}> {
  const { rentals: rentalRows, vehicleById, customerById } = await loadDataset();
  const today = todayISO();
  const from30 = addDaysISO(today, -29);

  const rows: RentalRow[] = rentalRows.map((rental) => {
    const vehicle = vehicleById.get(rental.vehicleId);
    return {
      id: rental.id,
      vehicleId: rental.vehicleId,
      customerId: rental.customerId,
      vehicleName: vehicle?.name ?? 'Unknown vehicle',
      vehicleCategory: vehicle?.category ?? 'Economy',
      plate: vehicle?.plate ?? '—',
      customerName: customerById.get(rental.customerId)?.fullName ?? 'Unknown customer',
      startDate: rental.startDate,
      endDate: rental.endDate,
      days: rentalDays(rental),
      dailyRate: rental.dailyRate,
      totalAmount: rental.totalAmount,
      status: rental.status,
      returnedAt: rental.returnedAt,
      pickupLocation: rental.pickupLocation,
      dropoffLocation: rental.dropoffLocation,
    };
  });

  const needle = (query.q ?? '').trim().toLowerCase();
  const filtered = rows
    .filter((row) => {
      if (query.status && query.status !== 'all' && row.status !== query.status) return false;
      if (!needle) return true;
      return (
        row.customerName.toLowerCase().includes(needle) ||
        row.vehicleName.toLowerCase().includes(needle) ||
        row.plate.toLowerCase().includes(needle)
      );
    })
    .sort((a, b) => (a.startDate === b.startDate ? b.id - a.id : b.startDate.localeCompare(a.startDate)));

  const recentRevenue = rentalRows.filter(
    (rental) =>
      rental.status !== 'cancelled' && rental.startDate >= from30 && rental.startDate <= today,
  );
  const completed30 = recentRevenue.filter((rental) => rental.status === 'completed');

  return {
    rentals: filtered.slice(0, query.limit ?? 400),
    total: filtered.length,
    stats: {
      activeCount: rentalRows.filter((rental) => isActiveToday(rental, today)).length,
      completed30: completed30.length,
      revenue30: Math.round(sum(recentRevenue.map((rental) => rental.totalAmount))),
      avgDuration30:
        recentRevenue.length === 0
          ? 0
          : Math.round(
              (sum(recentRevenue.map((rental) => rentalDays(rental))) / recentRevenue.length) * 10,
            ) / 10,
    },
  };
}

export async function findActiveOverlap(
  vehicleId: number,
  startDate: string,
  endDate: string,
): Promise<Rental | undefined> {
  const rows = await db.select().from(rentals).where(eq(rentals.vehicleId, vehicleId));
  return rows
    .filter((rental) => rental.status !== 'cancelled')
    .find((rental) => rental.startDate < endDate && startDate < rental.endDate);
}
