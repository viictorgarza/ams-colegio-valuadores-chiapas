CREATE TABLE `annual_fees` (
	`id` text PRIMARY KEY NOT NULL,
	`year` integer NOT NULL,
	`membership_type_id` text,
	`amount_cents` integer NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`membership_type_id`) REFERENCES `membership_types`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_fees_year` ON `annual_fees` (`year`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`before_json` text,
	`after_json` text,
	`device` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_created` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_entity` ON `audit_log` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `backup_log` (
	`id` text PRIMARY KEY NOT NULL,
	`destination` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`size_bytes` integer,
	`sha256` text,
	`status` text NOT NULL,
	`error` text
);
--> statement-breakpoint
CREATE TABLE `document_types` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`is_required` integer DEFAULT false NOT NULL,
	`has_expiry` integer DEFAULT false NOT NULL,
	`allows_multiple` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `document_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`member_document_id` text NOT NULL,
	`version_number` integer NOT NULL,
	`file_id` text NOT NULL,
	`uploaded_by` text,
	`uploaded_at` text NOT NULL,
	`observations` text,
	FOREIGN KEY (`member_document_id`) REFERENCES `member_documents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_dver_mdoc` ON `document_versions` (`member_document_id`);--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`sha256` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`mime_type` text NOT NULL,
	`original_name` text NOT NULL,
	`created_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `files_sha256_unique` ON `files` (`sha256`);--> statement-breakpoint
CREATE TABLE `import_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`source_name` text NOT NULL,
	`imported_at` text NOT NULL,
	`user_id` text,
	`stats_json` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `member_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`document_type_id` text NOT NULL,
	`status` text DEFAULT 'pendiente' NOT NULL,
	`expires_at` text,
	`has_physical` integer DEFAULT false NOT NULL,
	`physical_location` text,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`document_type_id`) REFERENCES `document_types`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_mdocs_member` ON `member_documents` (`member_id`);--> statement-breakpoint
CREATE TABLE `member_status_history` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`status_id` text NOT NULL,
	`changed_at` text NOT NULL,
	`reason` text,
	`changed_by` text,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`status_id`) REFERENCES `member_statuses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_msh_member` ON `member_status_history` (`member_id`);--> statement-breakpoint
CREATE TABLE `member_statuses` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_statuses_code_unique` ON `member_statuses` (`code`);--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`member_number` text NOT NULL,
	`title` text,
	`given_names` text NOT NULL,
	`paternal_surname` text,
	`maternal_surname` text,
	`full_name` text NOT NULL,
	`photo_file_id` text,
	`curp` text,
	`rfc` text,
	`email` text,
	`phone` text,
	`phone_home` text,
	`street` text,
	`city` text,
	`state` text,
	`zip` text,
	`university` text,
	`degree` text,
	`specialty` text,
	`masters` text,
	`doctorate` text,
	`company` text,
	`position` text,
	`is_perito` integer DEFAULT false NOT NULL,
	`perito_number` text,
	`membership_type_id` text NOT NULL,
	`status_id` text NOT NULL,
	`joined_at` text,
	`observations` text,
	`import_batch_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`photo_file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`membership_type_id`) REFERENCES `membership_types`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`status_id`) REFERENCES `member_statuses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`import_batch_id`) REFERENCES `import_batches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_members_member_number` ON `members` (`member_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_members_curp` ON `members` (`curp`);--> statement-breakpoint
CREATE INDEX `idx_members_full_name` ON `members` (`full_name`);--> statement-breakpoint
CREATE INDEX `idx_members_status` ON `members` (`status_id`);--> statement-breakpoint
CREATE TABLE `membership_types` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`is_fee_exempt` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `organization` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`short_name` text,
	`rfc` text,
	`street` text,
	`city` text,
	`state` text,
	`zip` text,
	`country` text,
	`phone` text,
	`email` text,
	`website` text,
	`fiscal_notes` text,
	`logo_file_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`logo_file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`year` integer NOT NULL,
	`kind` text DEFAULT 'pago' NOT NULL,
	`amount_cents` integer DEFAULT 0 NOT NULL,
	`paid_at` text NOT NULL,
	`method` text,
	`reference` text,
	`receipt_folio` text,
	`receipt_file_id` text,
	`observations` text,
	`created_by` text,
	`import_batch_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`receipt_file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`import_batch_id`) REFERENCES `import_batches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_payments_member_year` ON `payments` (`member_id`,`year`);--> statement-breakpoint
CREATE INDEX `idx_payments_year` ON `payments` (`year`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`full_name` text NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`must_change_password` integer DEFAULT false NOT NULL,
	`last_login_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);