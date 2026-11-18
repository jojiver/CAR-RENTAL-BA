import { Router } from 'express';
import { listCustomers } from '../services/store';

export const customersRouter = Router();

customersRouter.get('/', (_req, res) => {
  res.json({ customers: listCustomers() });
});
