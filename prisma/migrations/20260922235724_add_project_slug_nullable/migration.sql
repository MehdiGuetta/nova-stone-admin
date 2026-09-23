-- AlterTable
ALTER TABLE `Project` ADD COLUMN `slug` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Project_slug_key` ON `Project`(`slug`);
