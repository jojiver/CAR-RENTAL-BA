import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { listCustomers } from '../services/store';

export const customersRouter = Router();

customersRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json({ customers: await listCustomers() });
  }),
);
