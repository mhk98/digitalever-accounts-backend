CREATE TABLE IF NOT EXISTS `Notices` (
  `Id` INT(10) NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(160) NULL,
  `message` TEXT NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'Active',
  `createdByUserId` INT(10) NULL,
  `createdByRole` VARCHAR(32) NULL,
  `createdAt` DATETIME NOT NULL,
  `updatedAt` DATETIME NOT NULL,
  `deletedAt` DATETIME NULL,
  PRIMARY KEY (`Id`),
  INDEX `idx_notices_status_created_at` (`status`, `createdAt`),
  INDEX `idx_notices_deleted_at` (`deletedAt`)
);
