CREATE TYPE "UserRole" AS ENUM ('owner', 'member');

ALTER TABLE "User"
ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'owner';
