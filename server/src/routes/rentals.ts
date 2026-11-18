import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { customers, rentals, vehicles } from '../db/schema';
import type { RentalStatus } from '../db/schema';
import { daysBetweenISO, todayISO } from '../lib/dates';
import { findActiveOverlap, isActiveToday, listRentals } from '../services/store';

export const rentalsRouter = Router();

const STATUSES: RentalStatus[] = ['active', 'completed', 'cancelled'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function refreshVehicleStatus(vehicleId: number): void {
  const today = todayISO();
  const [vehicle] = db.select().from(vehicles).where(eq(vehicles.id, vehicleId)).all();
  if (!vehicle || vehicle.status === 'maintenance') return;
  const active = db
    .select()
    .from(rentals)
    .where(eq(rentals.vehicleId, vehicleId))
    .all()
    .some((rental) => isActiveToday(rental, today));
  db.update(vehicles)
    .set({ status: active ? 'rented' : 'available' })
    .where(eq(vehicles.id, vehicleId))
    .run();
}

rentalsRouter.get('/', (req, res) => {
  const status = String(req.query.status ?? 'all') as RentalStatus | 'all';
  const q = String(req.query.q ?? '');
  const limit = Number(req.query.limit ?? 400);
  const result = listRentals({
    status: STATUSES.includes(status as RentalStatus) || status === 'all' ? status : 'all',
    q,
    limit: Number.isFinite(limit) ? Math.min(5000, Math.max(1, Math.round(limit))) : 400,
  });
  res.json(result);
});

rentalsRouter.post('/', (req, res) => {
  const body = req.body ?? {};
  const customerId = Number(body.customerId);
  const vehicleId = Number(body.vehicleId);
  const startDate = String(body.startDate ?? '');
  const endDate = String(body.endDate ?? '');

  if (!Number.isFinite(customerId) || !Number.isFinite(vehicleId)) {
    return res.status(400).json({ error: 'A customer and a vehicle are required.' });
  }
  if (!ISO_DATE.test(startDate) || !ISO_DATE.test(endDate)) {
    return res.status(400).json({ error: 'Dates must be in YYYY-MM-DD format.' });
  }
  const days = daysBetweenISO(startDate, endDate);
  if (days < 1) {
    return res.status(400).json({ error: 'The return date must be after the pickup date.' });
  }

  const [customer] = db.select().from(customers).where(eq(customers.id, customerId)).all();
  if (!customer) {
    return res.status(404).json({ error: 'Customer not found.' });
  }
  const [vehicle] = db.select().from(vehicles).where(eq(vehicles.id, vehicleId)).all();
  if (!vehicle) {
    return res.status(404).json({ error: 'Vehicle not found.' });
  }
  if (vehicle.status === 'maintenance') {
    return res.status(409).json({ error: 'This vehicle is in maintenance and cannot be booked.' });
  }
  if (findActiveOverlap(vehicleId, startDate, endDate)) {
    return res.status(409).json({ error: 'That vehicle is already booked for part of this period.' });
  }

  const discount = days >= 14 ? 0.15 : days >= 7 ? 0.1 : 0;
  const totalAmount = Math.round(days * vehicle.dailyRate * (1 - discount));
  const today = todayISO();

  const [created] = db
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
    .returning()
    .all();

  if (startDate <= today) {
    db.update(vehicles).set({ status: 'rented' }).where(eq(vehicles.id, vehicleId)).run();
  }

  const row = listRentals({ limit: 1000 }).rentals.find((item) => item.id === created.id);
  return res.status(201).json({ rental: row ?? created });
});

rentalsRouter.patch('/:id', (req, res) => {
  const id = Number(req.params.id);
  const action = String(req.body?.action ?? '');
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'Invalid rental id.' });
  }
  if (action !== 'return' && action !== 'cancel') {
    return res.status(400).json({ error: 'Action must be "return" or "cancel".' });
  }

  const [rental] = db.select().from(rentals).where(eq(rentals.id, id)).all();
  if (!rental) {
    return res.status(404).json({ error: 'Rental not found.' });
  }
  if (action === 'return') {
    if (rental.status !== 'active') {
      return res.status(400).json({ error: 'Only active rentals can be returned.' });
    }
    db.update(rentals)
      .set({ status: 'completed', returnedAt: todayISO() })
      .where(eq(rentals.id, id))
      .run();
  } else {
    if (rental.status === 'completed') {
      return res.status(400).json({ error: 'Completed rentals cannot be cancelled.' });
    }
    db.update(rentals).set({ status: 'cancelled' }).where(eq(rentals.id, id)).run();
  }

  refreshVehicleStatus(rental.vehicleId);
  const row = listRentals({ limit: 1000 }).rentals.find((item) => item.id === id);
  return res.json({ ok: true, rental: row });
});
