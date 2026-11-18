# Rove — Car Rental Intelligence

A full-stack car rental operations platform with a live dashboard and three layers of analytics: **descriptive** (what happened), **predictive** (what will happen) and **prescriptive** (what to do next).

Built with React + Vite on the front end, Express on the back end, and Drizzle ORM over SQLite.

---

## Features

- **Operations dashboard** — 30-day revenue with trend, active rentals, fleet utilization, average rental value, daily revenue chart, fleet status donut, category performance and recent bookings.
- **Fleet management** — 32 seeded vehicles across Economy, Compact, SUV, Luxury and Van; per-vehicle 30-day utilization, mileage/service state, maintenance toggle and add-vehicle form.
- **Rentals** — full rental ledger with status filters, search, live pricing estimate, overlap protection, return and cancel actions.
- **Customers** — spend, rental count, last rental and Loyal/Returning/One-time segmentation.
- **Analytics** — deep-dive tabs for the three analysis types, backed by purpose-built endpoints.
- **Seeded history** — 18 months (~2,200 rentals) with growth, summer/holiday seasonality, weekday patterns, long-rental discounts and late returns, so the analytics have something real to chew on.

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
| ORM / DB | Drizzle ORM + better-sqlite3 (SQLite file in `server/data/`) |
| Tooling | npm workspaces, concurrently, drizzle-kit, TypeScript |

---

## Project structure

```
.
├── package.json              # workspace root + dev scripts
├── client/
│   ├── index.html
│   ├── vite.config.ts        # /api proxy to :4000
│   └── src/
│       ├── App.tsx           # routes
│       ├── api.ts            # typed fetch client
│       ├── types.ts          # API contracts
│       ├── styles.css        # design system
│       ├── components/       # layout, UI primitives, charts, icons
│       └── pages/            # Dashboard, Fleet, Rentals, Customers, Analytics
└── server/
    ├── drizzle.config.ts
    ├── drizzle/              # generated SQL migrations
    └── src/
        ├── index.ts          # Express app, migrations + auto-seed
        ├── db/               # schema, client, deterministic seed
        ├── routes/           # vehicles, customers, rentals, analytics
        ├── services/         # overview + descriptive/predictive/prescriptive
        └── lib/              # date + statistics helpers
```

---

## Clone & reproduce all data

Requires **Node.js 20+** (tested on Node 24) and npm.

```bash
git clone <repository-url> rove-car-rental
cd rove-car-rental
npm install
npm run dev
```

That's the whole setup — no manual database import.

### How the full dataset appears after cloning

The SQLite database is **not committed** (`server/data/` is gitignored). Instead the data is
fully reproducible from the seed generator:

1. On the first API start, Drizzle migrations in `server/drizzle/` are applied.
2. If the `vehicles` table is empty, the deterministic seed runs automatically and inserts:
   - **32 vehicles** across Economy, Compact, SUV, Luxury and Van
   - **200 customers** with join dates spread over the last two years
   - **~2,225 rentals** covering 18 months, including active, completed and cancelled bookings
   - realistic seasonality, weekday demand, long-rental discounts, loyalty patterns and late returns
3. Because the generator uses a fixed seed, every clone gets the **same dataset**, so dashboard
   totals, forecasts and recommendations are reproducible.

You can verify it after start-up:

```bash
curl http://localhost:4000/api/overview
curl http://localhost:4000/api/analytics/descriptive
```

### Rebuilding or copying the data

| Goal | Command |
| --- | --- |
| Rebuild the dataset from scratch | `npm run db:seed` |
| Same thing, explicit reset | `npm run db:reset` |
| Keep a database between clones | copy `server/data/rove.db` into `server/data/` before starting; a non-empty database is never re-seeded |
| Commit/ship the generated database | remove `server/data/` from `.gitignore` before committing (not recommended for large projects) |

### Run modes

```bash
# development (API :4000 + Vite :5173)
npm run dev

# production-style: build the UI, then serve UI + API from one process on :4000
npm run build
npm start
```

- Web app (dev): http://localhost:5173
- API: http://localhost:4000
- Production app: http://localhost:4000

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | API + web app together |
| `npm run dev:server` / `npm run dev:client` | Run one side only |
| `npm run build` | Type-check and build server + client |
| `npm run start` | Serve the built API and web app on port 4000 |
| `npm run db:generate` | Regenerate Drizzle migrations after schema edits |
| `npm run db:seed` | Rebuild the dataset from scratch |
| `npm run db:reset` | Same as seed (explicit rebuild) |

To wipe and reseed at any time:

```bash
npm run db:seed
```

The SQLite file lives at `server/data/rove.db` (gitignored).

---

## API

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/health` | Health probe |
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

Rental dates are stored as ISO `YYYY-MM-DD` strings; the return date is exclusive when counting billed days (`Nov 1 → Nov 3` = 2 days).

---

## Notes & limitations

- SQLite keeps the demo zero-setup. Swap the Drizzle driver if you need Postgres/MySQL.
- Forecast impacts are directional monthly estimates under stated elasticities, not guarantees.
- Utilization includes vehicles in maintenance in the capacity denominator — call it out if your finance team prefers a stricter definition.
- Revenue is recognized on the rental start date; cancelled bookings are excluded from revenue, demand and utilization.
- The dataset is generated with a fixed seed, so numbers are reproducible across re-seeds.

---

## License

MIT — use it, fork it, take it for a test drive.
