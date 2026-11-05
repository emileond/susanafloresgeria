CREATE TABLE `prescriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`note_id` text,
	`folio` integer,
	`date` text NOT NULL,
	`items` text NOT NULL,
	`diagnosis` text,
	`general_instructions` text,
	`weight_kg` real,
	`status` text DEFAULT 'draft' NOT NULL,
	`snapshot` text,
	`issued_at` integer,
	`issued_by` text,
	`cancelled_at` integer,
	`cancelled_by` text,
	`cancel_reason` text,
	`source_id` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`created_by` text,
	`updated_by` text,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`issued_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cancelled_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `prescriptions_patient_idx` ON `prescriptions` (`patient_id`,`date`);--> statement-breakpoint
CREATE UNIQUE INDEX `prescriptions_folio_unique` ON `prescriptions` (`folio`);