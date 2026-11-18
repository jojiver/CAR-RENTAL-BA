import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { getDescriptive } from '../services/descriptive';
import { getOverview } from '../services/overview';
import { getPredictive } from '../services/predictive';
import { getPrescriptive } from '../services/prescriptive';

export const analyticsRouter = Router();

analyticsRouter.get(
  '/overview',
  asyncHandler(async (_req, res) => {
    res.json(await getOverview());
  }),
);

analyticsRouter.get(
  '/analytics/descriptive',
  asyncHandler(async (req, res) => {
    const days = Number(req.query.days ?? 365);
    const safeDays = Number.isFinite(days) ? Math.min(730, Math.max(30, Math.round(days))) : 365;
    res.json(await getDescriptive(safeDays));
  }),
);

analyticsRouter.get(
  '/analytics/predictive',
  asyncHandler(async (req, res) => {
    const horizon = Number(req.query.horizon ?? 14);
    res.json(await getPredictive(horizon));
  }),
);

analyticsRouter.get(
  '/analytics/prescriptive',
  asyncHandler(async (_req, res) => {
    res.json(await getPrescriptive());
  }),
);
