CREATE TABLE `assemblies` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`title` text,
	`notes` text,
	`created_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `attendance_records` (
	`id` text PRIMARY KEY NOT NULL,
	`assembly_id` text NOT NULL,
	`member_id` text NOT NULL,
	`present` integer DEFAULT false NOT NULL,
	`marked_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`assembly_id`) REFERENCES `assemblies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_attendance_assembly_member` ON `attendance_records` (`assembly_id`,`member_id`);--> statement-breakpoint
CREATE INDEX `idx_attendance_assembly` ON `attendance_records` (`assembly_id`);