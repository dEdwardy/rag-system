ALTER TABLE "User"
ADD COLUMN "displayName" TEXT,
ADD COLUMN "passwordHash" TEXT;

CREATE TABLE "AuthIdentityLink" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "emailSnapshot" TEXT,
  "profileSnapshot" JSONB,
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AuthIdentityLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthIdentityLink_provider_subject_key" ON "AuthIdentityLink"("provider", "subject");

CREATE INDEX "AuthIdentityLink_userId_idx" ON "AuthIdentityLink"("userId");

ALTER TABLE "AuthIdentityLink"
ADD CONSTRAINT "AuthIdentityLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
