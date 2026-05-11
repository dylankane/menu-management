-- AlterTable: GourmetClubMember
-- Drop denormalised visit fields (replaced by MemberVisit relation)
-- Add source field to track sign-up channel
ALTER TABLE "gourmet_club_members" DROP COLUMN IF EXISTS "visit_count";
ALTER TABLE "gourmet_club_members" DROP COLUMN IF EXISTS "last_visit";
ALTER TABLE "gourmet_club_members" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'admin';

-- CreateTable: member_visits
CREATE TABLE "member_visits" (
    "id"         SERIAL       NOT NULL,
    "member_id"  INTEGER      NOT NULL,
    "date"       DATE         NOT NULL,
    "notes"      TEXT,
    "source"     TEXT         NOT NULL DEFAULT 'manual',
    "added_by"   INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable: raffles
CREATE TABLE "raffles" (
    "id"          SERIAL       NOT NULL,
    "title"       TEXT         NOT NULL,
    "prize"       TEXT         NOT NULL,
    "period_type" TEXT         NOT NULL,
    "eligibility" TEXT         NOT NULL DEFAULT 'all',
    "start_date"  DATE         NOT NULL,
    "end_date"    DATE         NOT NULL,
    "draw_date"   DATE,
    "status"      TEXT         NOT NULL DEFAULT 'active',
    "winner_id"   INTEGER,
    "drawn_at"    TIMESTAMP(3),
    "notes"       TEXT,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raffles_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey: member_visits → gourmet_club_members
ALTER TABLE "member_visits"
    ADD CONSTRAINT "member_visits_member_id_fkey"
    FOREIGN KEY ("member_id")
    REFERENCES "gourmet_club_members"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: member_visits → users
ALTER TABLE "member_visits"
    ADD CONSTRAINT "member_visits_added_by_fkey"
    FOREIGN KEY ("added_by")
    REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: raffles → gourmet_club_members (winner)
ALTER TABLE "raffles"
    ADD CONSTRAINT "raffles_winner_id_fkey"
    FOREIGN KEY ("winner_id")
    REFERENCES "gourmet_club_members"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
