/*
  Warnings:

  - You are about to drop the column `icon` on the `allergen_tags` table. All the data in the column will be lost.
  - You are about to drop the column `is_default` on the `allergen_tags` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `allergen_tags` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `categories` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `categories` table. All the data in the column will be lost.
  - You are about to drop the column `icon` on the `dietary_tags` table. All the data in the column will be lost.
  - You are about to drop the column `is_default` on the `dietary_tags` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `dietary_tags` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `menu_items` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `menu_items` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `menu_items` table. All the data in the column will be lost.
  - You are about to drop the `category_items` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `set_menu_menu_items` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `set_menus` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[slug]` on the table `categories` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `slug` to the `categories` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "category_items" DROP CONSTRAINT "category_items_category_id_fkey";

-- DropForeignKey
ALTER TABLE "category_items" DROP CONSTRAINT "category_items_menu_item_id_fkey";

-- DropForeignKey
ALTER TABLE "category_items" DROP CONSTRAINT "category_items_set_menu_id_fkey";

-- DropForeignKey
ALTER TABLE "set_menu_menu_items" DROP CONSTRAINT "set_menu_menu_items_menu_item_id_fkey";

-- DropForeignKey
ALTER TABLE "set_menu_menu_items" DROP CONSTRAINT "set_menu_menu_items_set_menu_id_fkey";

-- DropIndex
DROP INDEX "allergen_tags_name_key";

-- DropIndex
DROP INDEX "dietary_tags_name_key";

-- AlterTable
ALTER TABLE "allergen_tags" DROP COLUMN "icon",
DROP COLUMN "is_default",
DROP COLUMN "name";

-- AlterTable
ALTER TABLE "categories" DROP COLUMN "description",
DROP COLUMN "name",
ADD COLUMN     "slug" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "dietary_tags" DROP COLUMN "icon",
DROP COLUMN "is_default",
DROP COLUMN "name";

-- AlterTable
ALTER TABLE "menu_items" DROP COLUMN "description",
DROP COLUMN "name",
DROP COLUMN "notes",
ADD COLUMN     "is_set_menu" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "category_items";

-- DropTable
DROP TABLE "set_menu_menu_items";

-- DropTable
DROP TABLE "set_menus";

-- CreateTable
CREATE TABLE "restaurant_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "restaurant_name" TEXT NOT NULL DEFAULT 'My Restaurant',
    "primary_language" TEXT NOT NULL DEFAULT 'en',
    "enabled_languages" JSONB NOT NULL DEFAULT '["en","es"]',
    "logo_url" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "social_links" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restaurant_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allergen_tag_translations" (
    "allergen_id" INTEGER NOT NULL,
    "lang" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "allergen_tag_translations_pkey" PRIMARY KEY ("allergen_id","lang")
);

-- CreateTable
CREATE TABLE "dietary_tag_translations" (
    "dietary_id" INTEGER NOT NULL,
    "lang" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "dietary_tag_translations_pkey" PRIMARY KEY ("dietary_id","lang")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" SERIAL NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_translations" (
    "course_id" INTEGER NOT NULL,
    "lang" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "course_translations_pkey" PRIMARY KEY ("course_id","lang")
);

-- CreateTable
CREATE TABLE "category_translations" (
    "category_id" INTEGER NOT NULL,
    "lang" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,

    CONSTRAINT "category_translations_pkey" PRIMARY KEY ("category_id","lang")
);

-- CreateTable
CREATE TABLE "menu_item_translations" (
    "menu_item_id" INTEGER NOT NULL,
    "lang" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "notes" TEXT,

    CONSTRAINT "menu_item_translations_pkey" PRIMARY KEY ("menu_item_id","lang")
);

-- CreateTable
CREATE TABLE "menu_item_categories" (
    "menu_item_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "menu_item_categories_pkey" PRIMARY KEY ("menu_item_id","category_id")
);

-- CreateTable
CREATE TABLE "set_menu_dishes" (
    "id" SERIAL NOT NULL,
    "set_menu_id" INTEGER NOT NULL,
    "dish_id" INTEGER NOT NULL,
    "course_id" INTEGER,
    "display_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "set_menu_dishes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "set_menu_dish_notes" (
    "set_menu_dish_id" INTEGER NOT NULL,
    "lang" TEXT NOT NULL,
    "notes" TEXT NOT NULL,

    CONSTRAINT "set_menu_dish_notes_pkey" PRIMARY KEY ("set_menu_dish_id","lang")
);

-- CreateIndex
CREATE UNIQUE INDEX "set_menu_dishes_set_menu_id_dish_id_key" ON "set_menu_dishes"("set_menu_id", "dish_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- AddForeignKey
ALTER TABLE "allergen_tag_translations" ADD CONSTRAINT "allergen_tag_translations_allergen_id_fkey" FOREIGN KEY ("allergen_id") REFERENCES "allergen_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dietary_tag_translations" ADD CONSTRAINT "dietary_tag_translations_dietary_id_fkey" FOREIGN KEY ("dietary_id") REFERENCES "dietary_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_translations" ADD CONSTRAINT "course_translations_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_translations" ADD CONSTRAINT "category_translations_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_translations" ADD CONSTRAINT "menu_item_translations_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_categories" ADD CONSTRAINT "menu_item_categories_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_categories" ADD CONSTRAINT "menu_item_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "set_menu_dishes" ADD CONSTRAINT "set_menu_dishes_set_menu_id_fkey" FOREIGN KEY ("set_menu_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "set_menu_dishes" ADD CONSTRAINT "set_menu_dishes_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "set_menu_dishes" ADD CONSTRAINT "set_menu_dishes_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "set_menu_dish_notes" ADD CONSTRAINT "set_menu_dish_notes_set_menu_dish_id_fkey" FOREIGN KEY ("set_menu_dish_id") REFERENCES "set_menu_dishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
