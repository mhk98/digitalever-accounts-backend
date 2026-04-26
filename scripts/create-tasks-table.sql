CREATE TABLE IF NOT EXISTS `Tasks` (
  `Id` INT(10) NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(180) NOT NULL,
  `description` TEXT NULL,
  `assignedToUserId` INT(10) NOT NULL,
  `assignedByUserId` INT(10) NOT NULL,
  `priority` VARCHAR(32) NOT NULL DEFAULT 'Normal',
  `status` VARCHAR(32) NOT NULL DEFAULT 'Pending',
  `dueDate` DATE NULL,
  `createdAt` DATETIME NOT NULL,
  `updatedAt` DATETIME NOT NULL,
  `deletedAt` DATETIME NULL,
  PRIMARY KEY (`Id`),
  INDEX `idx_tasks_assigned_to_status` (`assignedToUserId`, `status`),
  INDEX `idx_tasks_assigned_by` (`assignedByUserId`),
  INDEX `idx_tasks_deleted_at` (`deletedAt`)
);
