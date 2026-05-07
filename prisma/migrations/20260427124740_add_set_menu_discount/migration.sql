-- AlterTable
ALTER TABLE "set_menus" ADD COLUMN     "discount_type" TEXT,
ADD COLUMN     "discount_value" DECIMAL(10,2),
ADD COLUMN     "has_discount" BOOLEAN NOT NULL DEFAULT false;
