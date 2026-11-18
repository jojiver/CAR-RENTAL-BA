import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { CATEGORIES, vehicles, type Category } from '../db/schema';
import { todayISO } from '../lib/dates';
import { listVehicles } from '../services/store';

export const vehiclesRouter = Router();

vehiclesRouter.get('/', (_req, res) => {
  res.json({ vehicles: listVehicles() });
});

vehiclesRouter.post('/', (req, res) => {
  const body = req.body ?? {};
  const name = String(body.name ?? '').trim();
  const brand = String(body.brand ?? '').trim();
  const model = String(body.model ?? '').trim();
  const year = Number(body.year);
  const category = String(body.category ?? '') as Category;
  const plate = String(body.plate ?? '').trim().toUpperCase();
  const dailyRate = Number(body.dailyRate);
  const mileage = Number(body.mileage ?? 0);

  if (!name || !brand || !model) {
    return res.status(400).json({ error: 'Name, brand and model are required.' });
  }
  if (!CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `Category must be one of: ${CATEGORIES.join(', ')}.` });
  }
  if (!Number.isFinite(year) || year < 1990 || year > 2030) {
    return res.status(400).json({ error: 'Year must be between 1990 and 2030.' });
  }
  if (!plate) {
    return res.status(400).json({ error: 'Plate number is required.' });
  }
  if (!Number.isFinite(dailyRate) || dailyRate <= 0) {
    return res.status(400).json({ error: 'Daily rate must be greater than zero.' });
  }
  if (!Number.isFinite(mileage) || mileage < 0) {
    return res.status(400).json({ error: 'Mileage must be zero or greater.' });
  }

  const existing = db.select().from(vehicles).where(eq(vehicles.plate, plate)).all();
  if (existing.length > 0) {
    return res.status(409).json({ error: 'A vehicle with that plate already exists.' });
  }

  const today = todayISO();
  const [created] = db
    .insert(vehicles)
    .values({
      name,
      brand,
      model,
      year,
      category,
      plate,
      dailyRate,
      mileage,
      lastServiceMileage: mileage,
      status: 'available',
      acquiredAt: today,
      createdAt: today,
    })
    .returning()
    .all();

  return res.status(201).json({ vehicle: created });
});

vehiclesRouter.patch('/:id/status', (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body?.status ?? '');
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'Invalid vehicle id.' });
  }
  if (status !== 'available' && status !== 'maintenance') {
    return res.status(400).json({ error: 'Status must be "available" or "maintenance".' });
  }
  const [vehicle] = db.select().from(vehicles).where(eq(vehicles.id, id)).all();
  if (!vehicle) {
    return res.status(404).json({ error: 'Vehicle not found.' });
  }
  db.update(vehicles).set({ status }).where(eq(vehicles.id, id)).run();
  const updated = listVehicles().find((row) => row.id === id);
  return res.json({ ok: true, vehicle: updated });
});
