-- AlterTable
ALTER TABLE "menu_item_translations" ADD COLUMN     "price_note" TEXT;

-- AlterTable
ALTER TABLE "menu_items" ALTER COLUMN "price" DROP NOT NULL;

-- AlterTable
ALTER TABLE "set_menu_translations" ADD COLUMN     "price_note" TEXT;

-- AlterTable
ALTER TABLE "set_menus" ALTER COLUMN "price" DROP NOT NULL;
