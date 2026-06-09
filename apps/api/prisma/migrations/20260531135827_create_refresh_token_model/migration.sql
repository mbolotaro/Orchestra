/*
  Warnings:

  - The values [login,logout] on the enum `auth_action` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "auth_action_new" AS ENUM ('sign_up', 'sign_in', 'sign_out');
ALTER TABLE "auth_logs" ALTER COLUMN "action" TYPE "auth_action_new" USING ("action"::text::"auth_action_new");
ALTER TYPE "auth_action" RENAME TO "auth_action_old";
ALTER TYPE "auth_action_new" RENAME TO "auth_action";
DROP TYPE "public"."auth_action_old";
COMMIT;

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "jti" VARCHAR(36) NOT NULL,
    "tokenHash" VARCHAR(255) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedBy" VARCHAR(36),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" VARCHAR(512),
    "ipAddress" VARCHAR(45),

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_jti_key" ON "refresh_tokens"("jti");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_revokedAt_idx" ON "refresh_tokens"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "refresh_tokens_jti_idx" ON "refresh_tokens"("jti");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
