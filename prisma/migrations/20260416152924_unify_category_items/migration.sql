/*
  Warnings:

  - You are about to drop the `menu_item_categories` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `set_menu_categories` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "menu_item_categories" DROP CONSTRAINT "menu_item_categories_category_id_fkey";

-- DropForeignKey
ALTER TABLE "menu_item_categories" DROP CONSTRAINT "menu_item_categories_menu_item_id_fkey";

-- DropForeignKey
ALTER TABLE "set_menu_categories" DROP CONSTRAINT "set_menu_categories_category_id_fkey";

-- DropForeignKey
ALTER TABLE "set_menu_categories" DROP CONSTRAINT "set_menu_categories_set_menu_id_fkey";

-- DropTable
DROP TABLE "menu_item_categories";

-- DropTable
DROP TABLE "set_menu_categories";

-- CreateTable
CREATE TABLE "category_items" (
    "id" SERIAL NOT NULL,
    "category_id" INTEGER NOT NULL,
    "menu_item_id" INTEGER,
    "set_menu_id" INTEGER,
    "display_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "category_items_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "category_items" ADD CONSTRAINT "category_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_items" ADD CONSTRAINT "category_items_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_items" ADD CONSTRAINT "category_items_set_menu_id_fkey" FOREIGN KEY ("set_menu_id") REFERENCES "set_menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
