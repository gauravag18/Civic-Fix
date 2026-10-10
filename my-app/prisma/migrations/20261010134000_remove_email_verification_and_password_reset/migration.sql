-- Pending review. Do not apply until approved.
-- Removes email verification and email-based password reset.
-- Signed-in password changes remain on "UserCredential".
-- Sessions, credentials, roles, and issue records stay.

ALTER TABLE "User" DROP CONSTRAINT "user_email_verified_after_created";

DROP TABLE "EmailVerificationToken";

DROP TABLE "PasswordResetToken";

ALTER TABLE "User" DROP COLUMN "emailVerifiedAt";
