import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const CATEGORIES = ['Economy', 'Compact', 'SUV', 'Luxury', 'Van'] as const;
export type Category = (typeof CATEGORIES)[number];

export const VEHICLE_STATUSES = ['available', 'rented', 'maintenance'] as const;
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

export const RENTAL_STATUSES = ['active', 'completed', 'cancelled'] as const;
export type RentalStatus = (typeof RENTAL_STATUSES)[number];

export const vehicles = sqliteTable(
  'vehicles',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    brand: text('brand').notNull(),
    model: text('model').notNull(),
    year: integer('year').notNull(),
    category: text('category').$type<Category>().notNull(),
    plate: text('plate').notNull().unique(),
    dailyRate: real('daily_rate').notNull(),
    mileage: integer('mileage').notNull().default(0),
    lastServiceMileage: integer('last_service_mileage').notNull().default(0),
    status: text('status').$type<VehicleStatus>().notNull().default('available'),
    acquiredAt: text('acquired_at').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('vehicles_category_idx').on(table.category),
    index('vehicles_status_idx').on(table.status),
  ],
);

export const customers = sqliteTable(
  'customers',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    fullName: text('full_name').notNull(),
    email: text('email').notNull().unique(),
    phone: text('phone').notNull(),
    license: text('license').notNull(),
    joinedAt: text('joined_at').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('customers_joined_idx').on(table.joinedAt)],
);

export const rentals = sqliteTable(
  'rentals',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    vehicleId: integer('vehicle_id')
      .notNull()
      .references(() => vehicles.id),
    customerId: integer('customer_id')
      .notNull()
      .references(() => customers.id),
    startDate: text('start_date').notNull(),
    endDate: text('end_date').notNull(),
    days: integer('days').notNull(),
    dailyRate: real('daily_rate').notNull(),
    totalAmount: real('total_amount').notNull(),
    status: text('status').$type<RentalStatus>().notNull().default('active'),
    returnedAt: text('returned_at'),
    pickupLocation: text('pickup_location').notNull(),
    dropoffLocation: text('dropoff_location').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('rentals_vehicle_idx').on(table.vehicleId),
    index('rentals_customer_idx').on(table.customerId),
    index('rentals_start_idx').on(table.startDate),
    index('rentals_status_idx').on(table.status),
  ],
);

export type Vehicle = typeof vehicles.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Rental = typeof rentals.$inferSelect;
