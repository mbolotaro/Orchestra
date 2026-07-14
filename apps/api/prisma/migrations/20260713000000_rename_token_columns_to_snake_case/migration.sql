-- refresh_tokens: rename camelCase columns to snake_case
ALTER TABLE "refresh_tokens" RENAME COLUMN "userId" TO "user_id";
ALTER TABLE "refresh_tokens" RENAME COLUMN "tokenHash" TO "token_hash";
ALTER TABLE "refresh_tokens" RENAME COLUMN "expiresAt" TO "expires_at";
ALTER TABLE "refresh_tokens" RENAME COLUMN "revokedAt" TO "revoked_at";
ALTER TABLE "refresh_tokens" RENAME COLUMN "replacedBy" TO "replaced_by";
ALTER TABLE "refresh_tokens" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "refresh_tokens" RENAME COLUMN "userAgent" TO "user_agent";
ALTER TABLE "refresh_tokens" RENAME COLUMN "ipAddress" TO "ip_address";

-- refresh_tokens: rename dependent index and FK
ALTER INDEX "refresh_tokens_userId_revokedAt_idx" RENAME TO "refresh_tokens_user_id_revoked_at_idx";
ALTER TABLE "refresh_tokens" RENAME CONSTRAINT "refresh_tokens_userId_fkey" TO "refresh_tokens_user_id_fkey";

-- password_reset_tokens: rename remaining camelCase columns
ALTER TABLE "password_reset_tokens" RENAME COLUMN "usedAt" TO "used_at";
ALTER TABLE "password_reset_tokens" RENAME COLUMN "expiresAt" TO "expires_at";
ALTER TABLE "password_reset_tokens" RENAME COLUMN "createdAt" TO "created_at";
