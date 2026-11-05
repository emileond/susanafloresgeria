CREATE TABLE `appointments` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text,
	`source` text NOT NULL,
	`external_uid` text,
	`external_url` text,
	`title` text,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`modality` text DEFAULT 'consultorio' NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`created_by` text,
	`updated_by` text,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `appointments_starts_idx` ON `appointments` (`starts_at`);--> statement-breakpoint
CREATE INDEX `appointments_patient_idx` ON `appointments` (`patient_id`,`starts_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `appointments_external_unique` ON `appointments` (`source`,`external_uid`);--> statement-breakpoint
CREATE TABLE `sync_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`status` text NOT NULL,
	`added` integer DEFAULT 0 NOT NULL,
	`updated` integer DEFAULT 0 NOT NULL,
	`cancelled` integer DEFAULT 0 NOT NULL,
	`message` text
);
--> statement-breakpoint
CREATE INDEX `sync_runs_started_idx` ON `sync_runs` (`source`,`started_at`);