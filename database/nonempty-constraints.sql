-- Migration for an existing schema that lacks these constraints.
-- Fresh schema.sql already includes them after export.
ALTER TABLE `users` ADD CONSTRAINT `chk_user_name_nonempty` CHECK (CHAR_LENGTH(TRIM(`user_name`)) > 0);

ALTER TABLE `laboratories` ADD CONSTRAINT `chk_lab_name_nonempty` CHECK (CHAR_LENGTH(TRIM(`lab_name`)) > 0);

ALTER TABLE `laboratories` ADD CONSTRAINT `chk_lab_location_nonempty` CHECK (CHAR_LENGTH(TRIM(`location`)) > 0);

ALTER TABLE `equipment` ADD CONSTRAINT `chk_equipment_name_nonempty` CHECK (CHAR_LENGTH(TRIM(`equipment_name`)) > 0);

ALTER TABLE `fault_reports` ADD CONSTRAINT `chk_fault_description_nonempty` CHECK (CHAR_LENGTH(TRIM(`fault_description`)) > 0);
