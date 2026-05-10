/*
  Warnings:

  - Added the required column `updated_at` to the `opening_hours` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "opening_hours" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "opening_hours" ALTER COLUMN "updated_at" DROP DEFAULT;
