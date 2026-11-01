ALTER TABLE `trackers` ADD `position` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Existing trackers keep their creation order.
UPDATE `trackers` SET `position` = `id`;