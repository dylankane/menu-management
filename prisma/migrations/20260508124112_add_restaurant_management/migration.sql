/*
  Warnings:

  - You are about to drop the column `address` on the `restaurant_settings` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `restaurant_settings` table. All the data in the column will be lost.
  - You are about to drop the column `social_links` on the `restaurant_settings` table. All the data in the column will be lost.
  - You are about to drop the column `website` on the `restaurant_settings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "restaurant_settings" DROP COLUMN "address",
DROP COLUMN "phone",
DROP COLUMN "social_links",
DROP COLUMN "website";

-- CreateTable
CREATE TABLE "client_account" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "owner_name" TEXT,
    "owner_email" TEXT,
    "owner_phone" TEXT,
    "billing_address" TEXT,
    "tax_number" TEXT,
    "plan" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_contact" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "phone" TEXT,
    "whatsapp" TEXT,
    "email_general" TEXT,
    "email_reservations" TEXT,
    "address" TEXT,
    "map_url" TEXT,
    "instagram_url" TEXT,
    "facebook_url" TEXT,
    "tripadvisor_url" TEXT,
    "google_url" TEXT,
    "twitter_url" TEXT,
    "linkedin_url" TEXT,
    "youtube_url" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restaurant_contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opening_hours" (
    "id" SERIAL NOT NULL,
    "day" TEXT NOT NULL,
    "is_closed" BOOLEAN NOT NULL DEFAULT false,
    "slot_1_from" TEXT,
    "slot_1_to" TEXT,
    "slot_2_active" BOOLEAN NOT NULL DEFAULT false,
    "slot_2_from" TEXT,
    "slot_2_to" TEXT,
    "note" TEXT,

    CONSTRAINT "opening_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opening_hours_overrides" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "is_closed" BOOLEAN NOT NULL DEFAULT true,
    "slot_1_from" TEXT,
    "slot_1_to" TEXT,
    "slot_2_active" BOOLEAN NOT NULL DEFAULT false,
    "slot_2_from" TEXT,
    "slot_2_to" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opening_hours_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcement" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT,
    "body" TEXT,
    "image_url" TEXT,
    "cta_active" BOOLEAN NOT NULL DEFAULT false,
    "cta_label" TEXT,
    "cta_url" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "opening_hours_day_key" ON "opening_hours"("day");

-- CreateIndex
CREATE UNIQUE INDEX "opening_hours_overrides_date_key" ON "opening_hours_overrides"("date");
