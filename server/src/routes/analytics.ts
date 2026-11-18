import { Router } from 'express';
import { getDescriptive } from '../services/descriptive';
import { getOverview } from '../services/overview';
import { getPredictive } from '../services/predictive';
import { getPrescriptive } from '../services/prescriptive';

export const analyticsRouter = Router();

analyticsRouter.get('/overview', (_req, res) => {
  res.json(getOverview());
});

analyticsRouter.get('/analytics/descriptive', (req, res) => {
  const days = Number(req.query.days ?? 365);
  const safeDays = Number.isFinite(days) ? Math.min(730, Math.max(30, Math.round(days))) : 365;
  res.json(getDescriptive(safeDays));
});

analyticsRouter.get('/analytics/predictive', (req, res) => {
  const horizon = Number(req.query.horizon ?? 14);
  res.json(getPredictive(horizon));
});

analyticsRouter.get('/analytics/prescriptive', (_req, res) => {
  res.json(getPrescriptive());
});
