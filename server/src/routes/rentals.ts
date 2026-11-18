import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { customers, rentals, vehicles } from '../db/schema';
import type { RentalStatus } from '../db/schema';
import { daysBetweenISO, todayISO } from '../lib/dates';
import { asyncHandler } from '../lib/asyncHandler';
import { findActiveOverlap, isActiveToday, listRentals } from '../services/store';

export const rentalsRouter = Router();

const STATUSES: RentalStatus[] = ['active', 'completed', 'cancelled'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

async function refreshVehicleStatus(vehicleId: number): Promise<void> {
  const today = todayISO();
  const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, vehicleId));
  if (!vehicle || vehicle.status === 'maintenance') return;
  const rows = await db.select().from(rentals).where(eq(rentals.vehicleId, vehicleId));
  const active = rows.some((rental) => isActiveToday(rental, today));
  await db
    .update(vehicles)
    .set({ status: active ? 'rented' : 'available' })
    .where(eq(vehicles.id, vehicleId));
}

async function rentalRow(id: number) {
  const [rental] = await db.select().from(rentals).where(eq(rentals.id, id));
  if (!rental) return undefined;
  const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, rental.vehicleId));
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, rental.customerId));
  return {
    id: rental.id,
    vehicleId: rental.vehicleId,
    customerId: rental.customerId,
    vehicleName: vehicle?.name ?? 'Unknown vehicle',
    vehicleCategory: vehicle?.category ?? 'Economy',
    plate: vehicle?.plate ?? '—',
    customerName: customer?.fullName ?? 'Unknown customer',
    startDate: rental.startDate,
    endDate: rental.endDate,
    days: rental.days,
    dailyRate: rental.dailyRate,
    totalAmount: rental.totalAmount,
    status: rental.status,
    returnedAt: rental.returnedAt,
    pickupLocation: rental.pickupLocation,
    dropoffLocation: rental.dropoffLocation,
  };
}

rentalsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const status = String(req.query.status ?? 'all') as RentalStatus | 'all';
    const q = String(req.query.q ?? '');
    const limit = Number(req.query.limit ?? 400);
    const result = await listRentals({
      status: STATUSES.includes(status as RentalStatus) || status === 'all' ? status : 'all',
      q,
      limit: Number.isFinite(limit) ? Math.min(5000, Math.max(1, Math.round(limit))) : 400,
    });
    res.json(result);
  }),
);

rentalsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const customerId = Number(body.customerId);
    const vehicleId = Number(body.vehicleId);
    const startDate = String(body.startDate ?? '');
    const endDate = String(body.endDate ?? '');

    if (!Number.isFinite(customerId) || !Number.isFinite(vehicleId)) {
      res.status(400).json({ error: 'A customer and a vehicle are required.' });
      return;
    }
    if (!ISO_DATE.test(startDate) || !ISO_DATE.test(endDate)) {
      res.status(400).json({ error: 'Dates must be in YYYY-MM-DD format.' });
      return;
    }
    const days = daysBetweenISO(startDate, endDate);
    if (days < 1) {
      res.status(400).json({ error: 'The return date must be after the pickup date.' });
      return;
    }

    const [customer] = await db.select().from(customers).where(eq(customers.id, customerId));
    if (!customer) {
      res.status(404).json({ error: 'Customer not found.' });
      return;
    }
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, vehicleId));
    if (!vehicle) {
      res.status(404).json({ error: 'Vehicle not found.' });
      return;
    }
    if (vehicle.status === 'maintenance') {
      res.status(409).json({ error: 'This vehicle is in maintenance and cannot be booked.' });
      return;
    }
    if (await findActiveOverlap(vehicleId, startDate, endDate)) {
      res.status(409).json({ error: 'That vehicle is already booked for part of this period.' });
      return;
    }

    const discount = days >= 14 ? 0.15 : days >= 7 ? 0.1 : 0;
    const totalAmount = Math.round(days * vehicle.dailyRate * (1 - discount));
    const today = todayISO();

    const [created] = await db
      .insert(rentals)
      .values({
        vehicleId,
        customerId,
        startDate,
        endDate,
        days,
        dailyRate: vehicle.dailyRate,
        totalAmount,
        status: 'active',
        returnedAt: null,
        pickupLocation: 'Downtown Hub',
        dropoffLocation: 'Downtown Hub',
        createdAt: today,
      })
      .returning();

    if (startDate <= today) {
      await db.update(vehicles).set({ status: 'rented' }).where(eq(vehicles.id, vehicleId));
    }

    res.status(201).json({ rental: (await rentalRow(created.id)) ?? created });
  }),
);

rentalsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const action = String(req.body?.action ?? '');
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: 'Invalid rental id.' });
      return;
    }
    if (action !== 'return' && action !== 'cancel') {
      res.status(400).json({ error: 'Action must be "return" or "cancel".' });
      return;
    }

    const [rental] = await db.select().from(rentals).where(eq(rentals.id, id));
    if (!rental) {
      res.status(404).json({ error: 'Rental not found.' });
      return;
    }
    if (action === 'return') {
      if (rental.status !== 'active') {
        res.status(400).json({ error: 'Only active rentals can be returned.' });
        return;
      }
      await db
        .update(rentals)
        .set({ status: 'completed', returnedAt: todayISO() })
        .where(eq(rentals.id, id));
    } else {
      if (rental.status === 'completed') {
        res.status(400).json({ error: 'Completed rentals cannot be cancelled.' });
        return;
      }
      await db.update(rentals).set({ status: 'cancelled' }).where(eq(rentals.id, id));
    }

    await refreshVehicleStatus(rental.vehicleId);
    res.json({ ok: true, rental: await rentalRow(id) });
  }),
);
