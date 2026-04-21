/*
  Warnings:

  - You are about to drop the column `notes` on the `menu_item_translations` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "menu_item_translations" DROP COLUMN "notes";

-- AlterTable
ALTER TABLE "menu_items" ADD COLUMN     "notes" TEXT;
