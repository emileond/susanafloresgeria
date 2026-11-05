CREATE TABLE `assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`note_id` text,
	`scale_key` text NOT NULL,
	`scale_version` integer NOT NULL,
	`answers` text NOT NULL,
	`score` integer NOT NULL,
	`max_score` integer NOT NULL,
	`interpretation` text NOT NULL,
	`severity` text NOT NULL,
	`details` text,
	`respondent` text,
	`comment` text,
	`performed_at` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`created_by` text,
	`updated_by` text,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `assessments_patient_idx` ON `assessments` (`patient_id`,`scale_key`,`performed_at`);