-- AlterTable
ALTER TABLE "client_account" ADD COLUMN     "has_gourmet_club" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "has_restaurant_hub" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "max_languages" INTEGER NOT NULL DEFAULT 3;
