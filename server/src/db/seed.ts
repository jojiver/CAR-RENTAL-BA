import { eq, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { customers, rentals, vehicles, type Category } from './schema';
import { addDaysISO, todayISO } from '../lib/dates';
import { db, runMigrations } from './client';

type DB = BetterSQLite3Database<typeof schema>;

const DAYS_OF_HISTORY = 540;
const CUSTOMER_COUNT = 200;
const SERVICE_INTERVAL = 12_000;

const MONTH_FACTORS = [0.85, 0.86, 0.92, 0.96, 1.05, 1.2, 1.34, 1.28, 1.06, 0.97, 0.9, 1.12];
const WEEKDAY_FACTORS = [0.82, 0.88, 0.94, 1.0, 1.12, 1.34, 1.28];

const CATALOG: { brand: string; model: string; category: Category; base: number }[] = [
  { brand: 'Toyota', model: 'Corolla', category: 'Economy', base: 42 },
  { brand: 'Toyota', model: 'Yaris', category: 'Economy', base: 36 },
  { brand: 'Honda', model: 'Civic', category: 'Economy', base: 44 },
  { brand: 'Hyundai', model: 'Elantra', category: 'Economy', base: 40 },
  { brand: 'Kia', model: 'Rio', category: 'Economy', base: 34 },
  { brand: 'Volkswagen', model: 'Jetta', category: 'Economy', base: 43 },
  { brand: 'Nissan', model: 'Versa', category: 'Economy', base: 33 },
  { brand: 'Mazda', model: '3', category: 'Economy', base: 41 },
  { brand: 'Honda', model: 'Fit', category: 'Compact', base: 46 },
  { brand: 'Volkswagen', model: 'Golf', category: 'Compact', base: 52 },
  { brand: 'Toyota', model: 'Prius', category: 'Compact', base: 58 },
  { brand: 'Hyundai', model: 'Ioniq', category: 'Compact', base: 56 },
  { brand: 'Kia', model: 'Soul', category: 'Compact', base: 49 },
  { brand: 'Mini', model: 'Cooper', category: 'Compact', base: 62 },
  { brand: 'Mazda', model: 'CX-30', category: 'Compact', base: 57 },
  { brand: 'Toyota', model: 'RAV4', category: 'SUV', base: 82 },
  { brand: 'Honda', model: 'CR-V', category: 'SUV', base: 84 },
  { brand: 'Jeep', model: 'Wrangler', category: 'SUV', base: 92 },
  { brand: 'Ford', model: 'Explorer', category: 'SUV', base: 88 },
  { brand: 'Chevrolet', model: 'Tahoe', category: 'SUV', base: 96 },
  { brand: 'Subaru', model: 'Outback', category: 'SUV', base: 78 },
  { brand: 'Hyundai', model: 'Tucson', category: 'SUV', base: 76 },
  { brand: 'BMW', model: '5 Series', category: 'Luxury', base: 168 },
  { brand: 'Mercedes-Benz', model: 'E-Class', category: 'Luxury', base: 178 },
  { brand: 'Audi', model: 'A6', category: 'Luxury', base: 162 },
  { brand: 'Tesla', model: 'Model S', category: 'Luxury', base: 188 },
  { brand: 'Cadillac', model: 'CT5', category: 'Luxury', base: 150 },
  { brand: 'Chrysler', model: 'Pacifica', category: 'Van', base: 94 },
  { brand: 'Honda', model: 'Odyssey', category: 'Van', base: 98 },
  { brand: 'Toyota', model: 'Sienna', category: 'Van', base: 102 },
  { brand: 'Ford', model: 'Transit', category: 'Van', base: 90 },
  { brand: 'Kia', model: 'Carnival', category: 'Van', base: 96 },
];

const FIRST_NAMES = [
  'Ava', 'Liam', 'Noah', 'Mia', 'Ethan', 'Sofia', 'Lucas', 'Isabella', 'Mason',
  'Amelia', 'Logan', 'Harper', 'Elijah', 'Evelyn', 'James', 'Abigail', 'Benjamin',
  'Emily', 'Henry', 'Ella', 'Daniel', 'Scarlett', 'Michael', 'Grace', 'Alex',
  'Chloe', 'Samuel', 'Zoe', 'Owen', 'Lily',
];

const LAST_NAMES = [
  'Carter', 'Bennett', 'Hayes', 'Brooks', 'Reed', 'Foster', 'Morgan', 'Bailey',
  'Rivera', 'Chen', 'Patel', 'Nguyen', 'Kim', 'Garcia', 'Lopez', 'Wilson',
  'Turner', 'Collins', 'Stewart', 'Flores', 'Murphy', 'Cooper', 'Ward', 'Bell',
  'Cox', 'Diaz', 'Price', 'Wood', 'Barnes', 'Ross',
];

const LOCATIONS = ['Downtown Hub', 'Airport Terminal', 'Northside Depot', 'Harbor Point'];

const CATEGORY_DEMAND: Record<Category, number> = {
  Economy: 1.55,
  Compact: 1.2,
  SUV: 1.4,
  Luxury: 0.28,
  Van: 0.32,
};

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const rand = mulberry32(20_260_118);

function rnd(min: number, max: number): number {
  return min + rand() * (max - min);
}

function randInt(min: number, max: number): number {
  return Math.floor(rnd(min, max + 1));
}

function pick<T>(items: T[]): T {
  return items[Math.floor(rand() * items.length)];
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickWeighted<T>(items: T[], weightOf: (item: T) => number): T {
  const total = items.reduce((acc, item) => acc + weightOf(item), 0);
  let roll = rand() * total;
  for (const item of items) {
    roll -= weightOf(item);
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

function poisson(lambda: number): number {
  const limit = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= rand();
  } while (p > limit);
  return k - 1;
}

function pickDuration(): number {
  const roll = rand();
  if (roll < 0.45) return randInt(1, 3);
  if (roll < 0.8) return randInt(4, 7);
  if (roll < 0.95) return randInt(8, 14);
  return randInt(15, 21);
}

function overlaps(
  existing: { start: string; end: string }[],
  start: string,
  end: string,
): boolean {
  return existing.some((slot) => slot.start < end && start < slot.end);
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export function seedDatabase(database: DB): { vehicles: number; customers: number; rentals: number } {
  const today = todayISO();

  database.delete(rentals).run();
  database.delete(vehicles).run();
  database.delete(customers).run();
  database.run(sql`DELETE FROM sqlite_sequence WHERE name IN ('rentals', 'vehicles', 'customers')`);

  const vehicleRows = CATALOG.map((entry, index) => {
    const jittered = entry.base * rnd(0.92, 1.12);
    const rate = entry.base >= 100 ? Math.round(jittered / 5) * 5 : Math.round(jittered);
    const acquiredDaysAgo = randInt(120, 1_300);
    const mileage = randInt(9_500, 96_000);
    return {
      name: `${entry.brand} ${entry.model}`,
      brand: entry.brand,
      model: entry.model,
      year: randInt(2021, 2026),
      category: entry.category,
      plate: `RV-${1000 + index}`,
      dailyRate: rate,
      mileage,
      lastServiceMileage: Math.max(0, mileage - randInt(600, 14_500)),
      status: 'available' as const,
      acquiredAt: addDaysISO(today, -acquiredDaysAgo),
      createdAt: addDaysISO(today, -acquiredDaysAgo),
    };
  });

  database.insert(vehicles).values(vehicleRows).run();
  const vehicleList = database.select().from(vehicles).all();

  const customerRows = Array.from({ length: CUSTOMER_COUNT }, (_, index) => {
    const first = FIRST_NAMES[index % FIRST_NAMES.length];
    const last =
      LAST_NAMES[(index * 7 + Math.floor(index / FIRST_NAMES.length)) % LAST_NAMES.length];
    const joinedDaysAgo =
      index < 40 ? randInt(340, 720) : index < 120 ? randInt(120, 520) : randInt(15, 420);
    return {
      fullName: `${first} ${last}`,
      email: `${first}.${last}${index + 1}@rove-mail.com`.toLowerCase(),
      phone: `+1 (${randInt(200, 799)}) ${randInt(200, 999)}-${randInt(1000, 9999)}`,
      license: `DL-${randInt(100000, 999999)}`,
      joinedAt: addDaysISO(today, -joinedDaysAgo),
      createdAt: addDaysISO(today, -joinedDaysAgo),
    };
  });

  database.insert(customers).values(customerRows).run();
  const customerList = database.select().from(customers).all();
  const loyaltyPool = customerList.slice(0, 30);

  const bookings = new Map<number, { start: string; end: string }[]>();
  for (const vehicle of vehicleList) bookings.set(vehicle.id, []);

  const activeVehicleIds = new Set<number>();
  const rentalRows: (typeof rentals.$inferInsert)[] = [];

  for (let dayIndex = 0; dayIndex <= DAYS_OF_HISTORY; dayIndex += 1) {
    const date = addDaysISO(today, -DAYS_OF_HISTORY + dayIndex);
    const dow = new Date(`${date}T00:00:00.000Z`).getUTCDay();
    const month = Number(date.slice(5, 7));
    const growth = 0.72 + 0.42 * (dayIndex / DAYS_OF_HISTORY);
    const lambda =
      4.4 * WEEKDAY_FACTORS[dow] * MONTH_FACTORS[month - 1] * growth;
    const bookingsToday = poisson(lambda);

    for (let n = 0; n < bookingsToday; n += 1) {
      const duration = pickDuration();
      const start = date;
      const end = addDaysISO(start, duration);

      const candidates = shuffle(vehicleList).filter((vehicle) => {
        if (vehicle.acquiredAt > start) return false;
        return !overlaps(bookings.get(vehicle.id) ?? [], start, end);
      });
      if (candidates.length === 0) continue;
      const vehicle = pickWeighted(candidates, (candidate) => CATEGORY_DEMAND[candidate.category]);

      const eligibleCustomers = customerList.filter((customer) => customer.joinedAt <= start);
      if (eligibleCustomers.length === 0) continue;
      const preferred = loyaltyPool.filter((customer) => customer.joinedAt <= start);
      const customer =
        preferred.length > 0 && rand() < 0.35 ? pick(preferred) : pick(eligibleCustomers);

      const discount = duration >= 14 ? 0.15 : duration >= 7 ? 0.1 : 0;
      const totalAmount = Math.round(duration * vehicle.dailyRate * (1 - discount));
      const cancelled = rand() < 0.035;
      const completed = end <= today;
      const lateRoll = rand();
      const lateDays = lateRoll < 0.09 ? randInt(1, 3) : 0;

      let status: 'active' | 'completed' | 'cancelled' = completed ? 'completed' : 'active';
      if (cancelled) status = 'cancelled';

      let returnedAt: string | null = null;
      if (status === 'completed') {
        const projected = addDaysISO(end, lateDays);
        returnedAt = projected > today ? today : projected;
      }

      const pickupLocation = pick(LOCATIONS);
      const dropoffLocation = rand() < 0.9 ? pickupLocation : pick(LOCATIONS);

      rentalRows.push({
        vehicleId: vehicle.id,
        customerId: customer.id,
        startDate: start,
        endDate: end,
        days: duration,
        dailyRate: vehicle.dailyRate,
        totalAmount,
        status,
        returnedAt,
        pickupLocation,
        dropoffLocation,
        createdAt: start,
      });

      if (status !== 'cancelled') {
        bookings.get(vehicle.id)?.push({ start, end });
        if (status === 'active' && start <= today && end > today) {
          activeVehicleIds.add(vehicle.id);
        }
      }
    }
  }

  for (const part of chunk(rentalRows, 400)) {
    database.insert(rentals).values(part).run();
  }

  const maintenanceCandidates = shuffle(
    vehicleList.filter((vehicle) => !activeVehicleIds.has(vehicle.id)),
  )
    .sort((a, b) => b.mileage - a.mileage)
    .slice(0, 2)
    .map((vehicle) => vehicle.id);

  for (const vehicle of vehicleList) {
    const status = maintenanceCandidates.includes(vehicle.id)
      ? 'maintenance'
      : activeVehicleIds.has(vehicle.id)
        ? 'rented'
        : 'available';
    database.update(vehicles).set({ status }).where(eq(vehicles.id, vehicle.id)).run();
  }

  return {
    vehicles: vehicleList.length,
    customers: customerList.length,
    rentals: rentalRows.length,
  };
}

export function ensureSeeded(database: DB): boolean {
  const [row] = database.select({ count: sql<number>`count(*)` }).from(vehicles).all();
  if ((row?.count ?? 0) > 0) return false;
  const result = seedDatabase(database);
  console.log(
    `[seed] Seeded ${result.vehicles} vehicles, ${result.customers} customers, ${result.rentals} rentals.`,
  );
  return true;
}

if (require.main === module) {
  runMigrations();
  const result = seedDatabase(db);
  console.log(
    `[seed] Done: ${result.vehicles} vehicles, ${result.customers} customers, ${result.rentals} rentals (${SERVICE_INTERVAL.toLocaleString()} mi service interval).`,
  );
}

