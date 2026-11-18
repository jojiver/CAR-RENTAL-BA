CREATE TABLE `customers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`full_name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`license` text NOT NULL,
	`joined_at` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customers_email_unique` ON `customers` (`email`);--> statement-breakpoint
CREATE INDEX `customers_joined_idx` ON `customers` (`joined_at`);--> statement-breakpoint
CREATE TABLE `rentals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`vehicle_id` integer NOT NULL,
	`customer_id` integer NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`days` integer NOT NULL,
	`daily_rate` real NOT NULL,
	`total_amount` real NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`returned_at` text,
	`pickup_location` text NOT NULL,
	`dropoff_location` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `rentals_vehicle_idx` ON `rentals` (`vehicle_id`);--> statement-breakpoint
CREATE INDEX `rentals_customer_idx` ON `rentals` (`customer_id`);--> statement-breakpoint
CREATE INDEX `rentals_start_idx` ON `rentals` (`start_date`);--> statement-breakpoint
CREATE INDEX `rentals_status_idx` ON `rentals` (`status`);--> statement-breakpoint
CREATE TABLE `vehicles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`brand` text NOT NULL,
	`model` text NOT NULL,
	`year` integer NOT NULL,
	`category` text NOT NULL,
	`plate` text NOT NULL,
	`daily_rate` real NOT NULL,
	`mileage` integer DEFAULT 0 NOT NULL,
	`last_service_mileage` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'available' NOT NULL,
	`acquired_at` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vehicles_plate_unique` ON `vehicles` (`plate`);--> statement-breakpoint
CREATE INDEX `vehicles_category_idx` ON `vehicles` (`category`);--> statement-breakpoint
CREATE INDEX `vehicles_status_idx` ON `vehicles` (`status`);