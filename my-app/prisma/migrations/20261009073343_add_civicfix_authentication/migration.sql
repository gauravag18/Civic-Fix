-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerifiedAt" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "UserCredential" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "passwordChangedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "tokenHash" BYTEA NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "tokenHash" BYTEA NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" TIMESTAMPTZ(3),

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "tokenHash" BYTEA NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" TIMESTAMPTZ(3),

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserCredential_userId_key" ON "UserCredential"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "session_user_revoked_at" ON "Session"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "session_expires_at" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "password_reset_expires_at" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_one_active" ON "PasswordResetToken"("userId") WHERE ("consumedAt" IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "email_verification_expires_at" ON "EmailVerificationToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_one_active" ON "EmailVerificationToken"("userId") WHERE ("consumedAt" IS NULL);

-- AddForeignKey
ALTER TABLE "UserCredential" ADD CONSTRAINT "UserCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Approved authentication checks. Same-row comparisons only.
ALTER TABLE "User"
  ADD CONSTRAINT "user_email_verified_after_created"
  CHECK ("emailVerifiedAt" IS NULL OR "emailVerifiedAt" >= "createdAt");

ALTER TABLE "UserCredential"
  ADD CONSTRAINT "user_credential_password_hash_argon2id"
  CHECK (starts_with("passwordHash", '$argon2id$'));

ALTER TABLE "UserCredential"
  ADD CONSTRAINT "user_credential_password_changed_after_created"
  CHECK ("passwordChangedAt" >= "createdAt");

ALTER TABLE "Session"
  ADD CONSTRAINT "session_token_hash_length"
  CHECK (octet_length("tokenHash") = 32);

ALTER TABLE "Session"
  ADD CONSTRAINT "session_expires_after_created"
  CHECK ("expiresAt" > "createdAt");

ALTER TABLE "Session"
  ADD CONSTRAINT "session_revoked_after_created"
  CHECK ("revokedAt" IS NULL OR "revokedAt" >= "createdAt");

ALTER TABLE "PasswordResetToken"
  ADD CONSTRAINT "password_reset_token_hash_length"
  CHECK (octet_length("tokenHash") = 32);

ALTER TABLE "PasswordResetToken"
  ADD CONSTRAINT "password_reset_expires_after_created"
  CHECK ("expiresAt" > "createdAt");

ALTER TABLE "PasswordResetToken"
  ADD CONSTRAINT "password_reset_consumed_after_created"
  CHECK ("consumedAt" IS NULL OR "consumedAt" >= "createdAt");

ALTER TABLE "EmailVerificationToken"
  ADD CONSTRAINT "email_verification_token_hash_length"
  CHECK (octet_length("tokenHash") = 32);

ALTER TABLE "EmailVerificationToken"
  ADD CONSTRAINT "email_verification_expires_after_created"
  CHECK ("expiresAt" > "createdAt");

ALTER TABLE "EmailVerificationToken"
  ADD CONSTRAINT "email_verification_consumed_after_created"
  CHECK ("consumedAt" IS NULL OR "consumedAt" >= "createdAt");
