-- AlterTable
ALTER TABLE "raffles" ADD COLUMN     "description" TEXT,
ADD COLUMN     "prize_description" TEXT,
ALTER COLUMN "updated_at" DROP DEFAULT;
