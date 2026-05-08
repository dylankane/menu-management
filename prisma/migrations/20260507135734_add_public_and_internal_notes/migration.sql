-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "category_translations" ADD COLUMN     "public_notes" TEXT;

-- AlterTable
ALTER TABLE "menu_item_translations" ADD COLUMN     "public_notes" TEXT;

-- AlterTable
ALTER TABLE "set_menu_courses" ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "set_menu_translations" ADD COLUMN     "public_notes" TEXT;
