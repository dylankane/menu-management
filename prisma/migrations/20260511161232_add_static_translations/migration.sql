-- CreateTable
CREATE TABLE "static_translations" (
    "key" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "value" TEXT NOT NULL DEFAULT '',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "static_translations_pkey" PRIMARY KEY ("key","lang")
);
