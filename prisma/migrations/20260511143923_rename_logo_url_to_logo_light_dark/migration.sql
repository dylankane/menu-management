/*
  Warnings:

  - You are about to drop the column `logo_url` on the `restaurant_settings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "restaurant_settings" DROP COLUMN "logo_url",
ADD COLUMN     "logo_dark_url" TEXT,
ADD COLUMN     "logo_light_url" TEXT;
