-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "auth_action" ADD VALUE 'resend_verify_email';
ALTER TYPE "auth_action" ADD VALUE 'password_reset';

-- AlterEnum
ALTER TYPE "auth_status" ADD VALUE 'invalid_reset_password_token';
