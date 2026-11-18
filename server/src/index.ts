import fs from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { db, runMigrations } from './db/client';
import { ensureSeeded } from './db/seed';
import { analyticsRouter } from './routes/analytics';
import { customersRouter } from './routes/customers';
import { rentalsRouter } from './routes/rentals';
import { vehiclesRouter } from './routes/vehicles';

const app = express();
const port = Number(process.env.PORT ?? 4000);
const clientDist = path.resolve(__dirname, '../../client/dist');

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'rove-api', time: new Date().toISOString() });
});

app.use('/api', analyticsRouter);
app.use('/api/vehicles', vehiclesRouter);
app.use('/api/customers', customersRouter);
app.use('/api/rentals', rentalsRouter);

if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    return res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
});

runMigrations();
ensureSeeded(db);

app.listen(port, () => {
  console.log(`[api] Rove API listening on http://localhost:${port}`);
  console.log('[api] GET /api/overview · /api/analytics/descriptive · /api/analytics/predictive · /api/analytics/prescriptive');
});
