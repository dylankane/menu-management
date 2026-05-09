-- CreateTable
CREATE TABLE "gourmet_club_members" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "birthday_month" INTEGER,
    "birthday_day" INTEGER,
    "visit_count" INTEGER NOT NULL DEFAULT 0,
    "last_visit" DATE,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "marketing_consent" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gourmet_club_members_pkey" PRIMARY KEY ("id")
);
