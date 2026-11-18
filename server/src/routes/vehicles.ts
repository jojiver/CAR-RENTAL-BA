import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { CATEGORIES, vehicles, type Category } from '../db/schema';
import { todayISO } from '../lib/dates';
import { asyncHandler } from '../lib/asyncHandler';
import { listVehicles } from '../services/store';

export const vehiclesRouter = Router();

vehiclesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json({ vehicles: await listVehicles() });
  }),
);

vehiclesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
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
      res.status(400).json({ error: 'Name, brand and model are required.' });
      return;
    }
    if (!CATEGORIES.includes(category)) {
      res.status(400).json({ error: `Category must be one of: ${CATEGORIES.join(', ')}.` });
      return;
    }
    if (!Number.isFinite(year) || year < 1990 || year > 2030) {
      res.status(400).json({ error: 'Year must be between 1990 and 2030.' });
      return;
    }
    if (!plate) {
      res.status(400).json({ error: 'Plate number is required.' });
      return;
    }
    if (!Number.isFinite(dailyRate) || dailyRate <= 0) {
      res.status(400).json({ error: 'Daily rate must be greater than zero.' });
      return;
    }
    if (!Number.isFinite(mileage) || mileage < 0) {
      res.status(400).json({ error: 'Mileage must be zero or greater.' });
      return;
    }

    const existing = await db.select().from(vehicles).where(eq(vehicles.plate, plate));
    if (existing.length > 0) {
      res.status(409).json({ error: 'A vehicle with that plate already exists.' });
      return;
    }

    const today = todayISO();
    const [created] = await db
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
      .returning();

    res.status(201).json({ vehicle: created });
  }),
);

vehiclesRouter.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const status = String(req.body?.status ?? '');
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: 'Invalid vehicle id.' });
      return;
    }
    if (status !== 'available' && status !== 'maintenance') {
      res.status(400).json({ error: 'Status must be "available" or "maintenance".' });
      return;
    }
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, id));
    if (!vehicle) {
      res.status(404).json({ error: 'Vehicle not found.' });
      return;
    }
    await db.update(vehicles).set({ status }).where(eq(vehicles.id, id));
    const updated = (await listVehicles()).find((row) => row.id === id);
    res.json({ ok: true, vehicle: updated });
  }),
);
