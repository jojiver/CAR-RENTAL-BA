# Rove — Car Rental Intelligence

A full-stack car rental operations platform with a live dashboard and three layers of analytics: **descriptive** (what happened), **predictive** (what will happen) and **prescriptive** (what to do next).

React + Vite on the front end, Express on the back end, Drizzle ORM over PostgreSQL. The database runs on **[Neon](https://neon.tech)**, and the API + built UI deploy to **[Render](https://render.com)**.

---

## Features

- **Operations dashboard** — 30-day revenue with trend, active rentals, fleet utilization, average rental value, daily revenue chart, fleet status donut, category performance and recent bookings.
- **Fleet management** — 32 seeded vehicles across Economy, Compact, SUV, Luxury and Van; per-vehicle 30-day utilization, mileage/service state, maintenance toggle and add-vehicle form.
- **Rentals** — full rental ledger with status filters, search, live pricing estimate, overlap protection, return and cancel actions.
- **Customers** — spend, rental count, last rental and Loyal/Returning/One-time segmentation.
- **Analytics** — deep-dive tabs for the three analysis types, backed by purpose-built endpoints.
- **Seeded history** — 18 months (~2,225 rentals) with growth, summer/holiday seasonality, weekday patterns, long-rental discounts and late returns, so the analytics have something real to chew on.

---

## How the analytics work

### 1. Descriptive — what happened

Computed from the rental ledger for a selectable window (90 / 180 / 365 days):

- Revenue, bookings, unique customers, average duration and average rental value.
- **Utilization** = booked vehicle-days ÷ (fleet size × days in window). Cancelled rentals are excluded.
- Monthly revenue, weekly utilization, revenue and utilization by class, revenue share, top vehicles by revenue, duration mix and customer segments.
- Repeat rate = customers with 2+ rentals in the window ÷ unique customers.

### 2. Predictive — what will happen

A lightweight, explainable time-series model — no black box:

- Damped least-squares **trend** over the last 120 days.
- **Day-of-week seasonality** learned from the last 8 weeks.
- **14-day level** (recent demand) so the forecast tracks current conditions instead of lagging.
- **80% prediction interval** from in-sample residuals (±1.28σ).
- Backtested on the last **4 weeks of weekly totals**; accuracy is reported as `100 − WAPE` so one quiet week cannot dominate the score.
- Per-class 30-day demand and revenue forecasts from weekly class totals, with the trend damped by 40% to avoid over-reacting to noise.
- Operational risk: historical late-return rate applied to projected rentals.

### 3. Prescriptive — what to do next

Recommendations are generated from current utilization, forecasts and vehicle state, and ranked by estimated monthly impact:

- **Pricing** — utilization thresholds (≥85% → +10%, ≥70% → +5%, otherwise hold), adjusted for demand trend. Impact assumes short-run price elasticity of **−0.6**.
- **Promotions** — only for classes below 60% utilization. Discounts assume the deal-seeking segment is more elastic (**−1.6**), so volume can rise faster than price falls.
- **Fleet capacity** — add vehicles where utilization is ≥80% and revenue per unit is healthy; retire capacity only when utilization is **both** below 48% and revenue per unit is below the fleet average.
- **Maintenance** — every vehicle is tracked against a 12,000-mile service interval, with due-date estimates from its average daily mileage.
- The **priority action plan** merges these into a single ranked list; urgent maintenance is pulled forward because downtime risks future availability.
- All assumptions are shown in the UI and repeated in the API response, so the numbers stay auditable.

---

## Stack

| Layer | Technology |
| --- | --- |
| Front end | React 18, React Router, Vite, Recharts, hand-rolled CSS design system |
| Back end | Express 4, TypeScript (tsx for dev) |
| ORM / DB | Drizzle ORM + `pg` (PostgreSQL) |
| Hosted DB | Neon (Postgres) |
| API hosting | Render (Express, API only) |
| Frontend hosting | Vercel (Vite build of `client/`) |
| Tooling | npm workspaces, concurrently, drizzle-kit, TypeScript |

---

## Project structure

```
.
├── package.json              # workspace root + dev scripts
├── render.yaml               # Render Blueprint (API web service + env vars)
├── vercel.json               # Vercel build config + SPA rewrites
├── docker-compose.yml        # optional local PostgreSQL
├── client/
│   ├── .env.example          # VITE_API_URL template
│   ├── index.html
│   ├── vite.config.ts        # /api proxy to :4000 in dev
│   └── src/
│       ├── App.tsx           # routes
│       ├── api.ts            # typed fetch client (VITE_API_URL aware)
│       ├── types.ts          # API contracts
│       ├── styles.css        # design system
│       ├── components/       # layout, UI primitives, charts, icons
│       └── pages/            # Dashboard, Fleet, Rentals, Customers, Analytics
└── server/
    ├── .env.example          # DATABASE_URL + CORS template
    ├── drizzle.config.ts
    ├── drizzle/              # generated Postgres migrations
    └── src/
        ├── index.ts          # Express app, migrations + auto-seed
        ├── db/               # schema, client, deterministic seed
        ├── routes/           # vehicles, customers, rentals, analytics
        ├── services/         # overview + descriptive/predictive/prescriptive
        └── lib/              # date + statistics helpers
```

---

## Clone & reproduce all data

Requires **Node.js 20+** (tested on Node 24), npm, and a PostgreSQL connection string.

```bash
git clone <repository-url> rove-car-rental
cd rove-car-rental
npm install
cp server/.env.example server/.env
```

Edit `server/.env` and set `DATABASE_URL` to a **Neon** connection string (or any Postgres URL):

```env
DATABASE_URL=postgres://USER:PASSWORD@ep-xxxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
```

Then start the app:

```bash
npm run dev
```

- Web app: http://localhost:5173
- API: http://localhost:4000
- On first start the server applies the migrations in `server/drizzle/` and, if the fleet table is empty, seeds the database automatically.

### What gets loaded

- **32 vehicles** across Economy, Compact, SUV, Luxury and Van.
- **200 customers** with join dates spread across the last two years.
- **~2,225 rentals** over 18 months, including active, completed and cancelled bookings, plus realistic seasonality, weekday demand, long-rental discounts, loyalty patterns and late returns.
- The seed uses a fixed random seed, so **every clone gets the exact same data** and matching analytics.

### Rebuilding the data

| Goal | Command |
| --- | --- |
| Rebuild the dataset from scratch | `npm run db:seed` |
| Same thing, explicit reset | `npm run db:reset` |
| Sync schema directly without migration files (prototyping) | `npm run db:push` |
| Verify the seeded API | `curl http://localhost:4000/api/overview` |

### Optional: local PostgreSQL instead of Neon

```bash
docker compose up -d
```

Then use this in `server/.env`:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/rove
```

---

## Deploy: Neon (database) + Render (API) + Vercel (frontend)

### 1. Create the Neon database

1. Sign in at [neon.tech](https://neon.tech) and create a project. Pick a region close to your Render region.
2. Open **Connection details** and copy the **pooled** connection string. Keep `?sslmode=require` at the end.
3. Store it as `DATABASE_URL` in Render (next step). You do **not** need to run any SQL manually — the app migrates and seeds on first boot.

> If your pooled connection ever rejects migrations, use Neon's **direct** (non-pooler) string for the first deploy, then switch to pooled. Both work with the `pg` driver.

### 2. Deploy the backend on Render

1. Push this repository to GitHub/GitLab.
2. In Render, choose **New → Blueprint** and select the repo. `render.yaml` defines the API web service:
   - **Build:** `npm install --include=dev && npm run build -w server`
   - **Start:** `npm start`
   - **Health check:** `/api/health`
3. When Render prompts for environment variables, paste the Neon URL into `DATABASE_URL`.
4. Deploy. Render runs the API only (the UI is hosted on Vercel).

Manual alternative if you don't use the Blueprint:

| Setting | Value |
| --- | --- |
| Environment | Node |
| Build command | `npm install --include=dev && npm run build -w server` |
| Start command | `npm start` |
| Health check path | `/api/health` |
| `DATABASE_URL` | Neon connection string |
| `NODE_VERSION` | `22` |

### 3. Deploy the frontend on Vercel

1. In Vercel, choose **Add New → Project** and import the same repository.
2. Leave **Root Directory** at the repository root. The included `vercel.json`:
   - installs the workspace (`npm install --include=dev`)
   - builds only the client (`npm run build -w client`)
   - publishes `client/dist`
   - proxies `/api/*` to `https://car-rental-ba.onrender.com/api/*`
   - rewrites SPA routes to `index.html` so `/fleet`, `/analytics?tab=predictive`, etc. work on refresh.
3. Optionally, instead of the proxy, set an environment variable (Production and Preview):
   - `VITE_API_URL` = `https://<your-render-service>.onrender.com`
   - Use the **origin only** — no `/api`, no trailing slash. The client appends `/api`. If set, this takes priority over the proxy.
4. Deploy. Vite inlines `VITE_API_URL` at build time, so redeploy after changing it.
5. Open the Vercel URL; the dashboard should load data from Render. Check the browser console/network if the API is unreachable.

> If you prefer to set Vercel's **Root Directory** to `client`, use Framework Preset **Vite**, Build Command `npm run build`, Output Directory `dist`, and add an SPA rewrite to `index.html`. The root `vercel.json` setup above is the supported path.

### 4. Verify the deployment

```
https://<your-render-service>.onrender.com/api/health
https://<your-render-service>.onrender.com/api/overview
https://<your-vercel-app>.vercel.app/
```

The first API deploy runs migrations and seeds the dataset automatically. Subsequent deploys keep the existing data; use `npm run db:seed` locally against the same `DATABASE_URL` if you ever want to rebuild it.

### Environment variables

| Variable | Service | Required | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | Render (and local `server/.env`) | Yes | Neon/Postgres connection string, e.g. `...?sslmode=require` |
| `VITE_API_URL` | Vercel (and optional `client/.env.local`) | No | Render API origin; overrides the `/api` proxy in `vercel.json` |
| `CORS_ORIGIN` | Render | No | Comma-separated allowed origins; defaults to all |
| `PG_POOL_MAX` | Render | No | Connection pool size (default `5`) |
| `PORT` | Render | No | Injected by Render; the app falls back to `4000` |

### Deployment notes

- Render's free instances spin down after inactivity, and Neon's free tier may suspend idle databases — the first request afterwards can take a few seconds.
- The app opens a pool of at most `PG_POOL_MAX` connections (default 5), which fits Neon's free-tier limits.
- Keep `sslmode=require` in the Neon URL. If it is missing, the server enables SSL automatically for `*.neon.tech` hosts.
- The Vercel frontend calls the Render API cross-origin. CORS is open by default; set `CORS_ORIGIN=https://your-app.vercel.app` on Render to restrict it (comma-separate multiple origins).
- The local production flow (`npm run build && npm start`) still serves the built UI and API from one process if you ever want a single-service deployment.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | API + web app together |
| `npm run dev:server` / `npm run dev:client` | Run one side only |
| `npm run build` | Type-check and build server + client |
| `npm run start` | Serve the built API and web app on `PORT` (default 4000) |
| `npm run db:generate` | Regenerate Postgres migrations after schema edits |
| `npm run db:push` | Push the schema without generating migration files |
| `npm run db:seed` | Rebuild the dataset from scratch |
| `npm run db:reset` | Same as seed (explicit rebuild) |

---

## API

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/health` | Health probe (used by Render) |
| GET | `/api/overview` | Dashboard KPIs, 60-day revenue trend, fleet mix, recent bookings |
| GET | `/api/analytics/descriptive?days=365` | Descriptive statistics for the window |
| GET | `/api/analytics/predictive?horizon=14` | Revenue + demand forecasts, class forecasts, utilization projection, late-return risk |
| GET | `/api/analytics/prescriptive` | Pricing, promotions, fleet and maintenance recommendations + ranked actions + assumptions |
| GET | `/api/vehicles` | Fleet with per-vehicle utilization and effective status |
| POST | `/api/vehicles` | Add a vehicle |
| PATCH | `/api/vehicles/:id/status` | Set `available` or `maintenance` |
| GET | `/api/customers` | Customer book with spend and segment |
| GET | `/api/rentals?status=&q=&limit=` | Rental ledger + summary stats |
| POST | `/api/rentals` | Create a rental (validates dates, maintenance, overlap, computes discounts) |
| PATCH | `/api/rentals/:id` | `{ "action": "return" \| "cancel" }` |

---

## Data model

- **vehicles** — name, brand, model, year, class, plate, daily rate, mileage, last service mileage, status, acquired date.
- **customers** — name, email, phone, license, joined date.
- **rentals** — vehicle + customer FKs, start/end dates, days, rate, total, status (`active`/`completed`/`cancelled`), returned date, pickup/dropoff locations.

Dates are stored as PostgreSQL `date` columns and exposed as ISO `YYYY-MM-DD` strings. The return date is exclusive when counting billed days (`Nov 1 → Nov 3` = 2 days).

---

## Notes & limitations

- PostgreSQL is required; there is no SQLite fallback. Neon works out of the box, or use the provided Docker Compose file locally.
- Forecast impacts are directional monthly estimates under stated elasticities, not guarantees.
- Utilization includes vehicles in maintenance in the capacity denominator — call it out if your finance team prefers a stricter definition.
- Revenue is recognized on the rental start date; cancelled bookings are excluded from revenue, demand and utilization.
- The dataset is generated with a fixed seed, so numbers are reproducible across re-seeds.
- Secrets stay out of git: `server/.env` and `client/.env.local` are gitignored. Set `DATABASE_URL` on Render and `VITE_API_URL` on Vercel for production.
- When running the client alone against a remote API, set `VITE_API_URL` in `client/.env.local`; otherwise Vite's dev proxy targets `http://localhost:4000`.

---

## License

MIT — use it, fork it, take it for a test drive.
