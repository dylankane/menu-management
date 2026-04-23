/*
  Warnings:

  - You are about to drop the column `display_order` on the `menu_items` table. All the data in the column will be lost.
  - You are about to drop the column `is_set_menu` on the `menu_items` table. All the data in the column will be lost.
  - You are about to drop the column `course_id` on the `set_menu_dishes` table. All the data in the column will be lost.
  - You are about to drop the `set_menu_dish_notes` table. If the table is not empty, all the data it contains will be lost.

*/

-- DropForeignKey (defensive — may already be gone from partial first run)
ALTER TABLE "set_menu_dish_notes" DROP CONSTRAINT IF EXISTS "set_menu_dish_notes_set_menu_dish_id_fkey";
ALTER TABLE "set_menu_dishes"     DROP CONSTRAINT IF EXISTS "set_menu_dishes_course_id_fkey";
ALTER TABLE "set_menu_dishes"     DROP CONSTRAINT IF EXISTS "set_menu_dishes_dish_id_fkey";
ALTER TABLE "set_menu_dishes"     DROP CONSTRAINT IF EXISTS "set_menu_dishes_set_menu_id_fkey";

-- AlterTable menu_items
ALTER TABLE "menu_items" DROP COLUMN IF EXISTS "display_order",
                         DROP COLUMN IF EXISTS "is_set_menu";

-- AlterTable set_menu_dishes
ALTER TABLE "set_menu_dishes" DROP COLUMN IF EXISTS "course_id";
ALTER TABLE "set_menu_dishes" ADD COLUMN IF NOT EXISTS "set_menu_course_id" INTEGER;

-- DropTable (defensive)
DROP TABLE IF EXISTS "set_menu_dish_notes";

-- Clear stale set_menu_dishes rows (set_menu_id referenced old menu_items, not new set_menus)
TRUNCATE TABLE "set_menu_dishes";

-- CreateTable
CREATE TABLE IF NOT EXISTS "set_menus" (
    "id" SERIAL NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "image_url" TEXT,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "set_menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "set_menu_translations" (
    "set_menu_id" INTEGER NOT NULL,
    "lang" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,

    CONSTRAINT "set_menu_translations_pkey" PRIMARY KEY ("set_menu_id","lang")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "set_menu_categories" (
    "set_menu_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "set_menu_categories_pkey" PRIMARY KEY ("set_menu_id","category_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "set_menu_courses" (
    "id" SERIAL NOT NULL,
    "set_menu_id" INTEGER NOT NULL,
    "course_id" INTEGER NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "set_menu_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "set_menu_course_translations" (
    "set_menu_course_id" INTEGER NOT NULL,
    "lang" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "set_menu_course_translations_pkey" PRIMARY KEY ("set_menu_course_id","lang")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "set_menu_dish_translations" (
    "set_menu_dish_id" INTEGER NOT NULL,
    "lang" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "set_menu_dish_translations_pkey" PRIMARY KEY ("set_menu_dish_id","lang")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "set_menu_courses_set_menu_id_course_id_key" ON "set_menu_courses"("set_menu_id", "course_id");

-- AddForeignKey (defensive — drop before re-adding in case partial run left them)
ALTER TABLE "set_menu_translations"      DROP CONSTRAINT IF EXISTS "set_menu_translations_set_menu_id_fkey";
ALTER TABLE "set_menu_categories"        DROP CONSTRAINT IF EXISTS "set_menu_categories_set_menu_id_fkey";
ALTER TABLE "set_menu_categories"        DROP CONSTRAINT IF EXISTS "set_menu_categories_category_id_fkey";
ALTER TABLE "set_menu_courses"           DROP CONSTRAINT IF EXISTS "set_menu_courses_set_menu_id_fkey";
ALTER TABLE "set_menu_courses"           DROP CONSTRAINT IF EXISTS "set_menu_courses_course_id_fkey";
ALTER TABLE "set_menu_course_translations" DROP CONSTRAINT IF EXISTS "set_menu_course_translations_set_menu_course_id_fkey";
ALTER TABLE "set_menu_dishes"            DROP CONSTRAINT IF EXISTS "set_menu_dishes_set_menu_id_fkey";
ALTER TABLE "set_menu_dishes"            DROP CONSTRAINT IF EXISTS "set_menu_dishes_dish_id_fkey";
ALTER TABLE "set_menu_dishes"            DROP CONSTRAINT IF EXISTS "set_menu_dishes_set_menu_course_id_fkey";
ALTER TABLE "set_menu_dish_translations" DROP CONSTRAINT IF EXISTS "set_menu_dish_translations_set_menu_dish_id_fkey";

ALTER TABLE "set_menu_translations"      ADD CONSTRAINT "set_menu_translations_set_menu_id_fkey"                   FOREIGN KEY ("set_menu_id")        REFERENCES "set_menus"("id")        ON DELETE CASCADE  ON UPDATE CASCADE;
ALTER TABLE "set_menu_categories"        ADD CONSTRAINT "set_menu_categories_set_menu_id_fkey"                     FOREIGN KEY ("set_menu_id")        REFERENCES "set_menus"("id")        ON DELETE CASCADE  ON UPDATE CASCADE;
ALTER TABLE "set_menu_categories"        ADD CONSTRAINT "set_menu_categories_category_id_fkey"                     FOREIGN KEY ("category_id")        REFERENCES "categories"("id")       ON DELETE CASCADE  ON UPDATE CASCADE;
ALTER TABLE "set_menu_courses"           ADD CONSTRAINT "set_menu_courses_set_menu_id_fkey"                        FOREIGN KEY ("set_menu_id")        REFERENCES "set_menus"("id")        ON DELETE CASCADE  ON UPDATE CASCADE;
ALTER TABLE "set_menu_courses"           ADD CONSTRAINT "set_menu_courses_course_id_fkey"                          FOREIGN KEY ("course_id")          REFERENCES "courses"("id")          ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "set_menu_course_translations" ADD CONSTRAINT "set_menu_course_translations_set_menu_course_id_fkey"   FOREIGN KEY ("set_menu_course_id") REFERENCES "set_menu_courses"("id") ON DELETE CASCADE  ON UPDATE CASCADE;
ALTER TABLE "set_menu_dishes"            ADD CONSTRAINT "set_menu_dishes_set_menu_id_fkey"                         FOREIGN KEY ("set_menu_id")        REFERENCES "set_menus"("id")        ON DELETE CASCADE  ON UPDATE CASCADE;
ALTER TABLE "set_menu_dishes"            ADD CONSTRAINT "set_menu_dishes_dish_id_fkey"                             FOREIGN KEY ("dish_id")            REFERENCES "menu_items"("id")       ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "set_menu_dishes"            ADD CONSTRAINT "set_menu_dishes_set_menu_course_id_fkey"                  FOREIGN KEY ("set_menu_course_id") REFERENCES "set_menu_courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "set_menu_dish_translations" ADD CONSTRAINT "set_menu_dish_translations_set_menu_dish_id_fkey"         FOREIGN KEY ("set_menu_dish_id")   REFERENCES "set_menu_dishes"("id")  ON DELETE CASCADE  ON UPDATE CASCADE;
