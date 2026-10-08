-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DISABLED');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('REPORTED', 'UNDER_REVIEW', 'VERIFIED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REJECTED', 'REOPENED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ISSUE_VERIFIED', 'ISSUE_ASSIGNED', 'STATUS_CHANGED', 'COMMENT_ADDED', 'ISSUE_RESOLVED', 'ADMIN_NOTICE');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(320) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "disabledAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "assignedById" UUID,
    "assignedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ(3),

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentMembership" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "departmentId" UUID NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMPTZ(3),

    CONSTRAINT "DepartmentMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueCategory" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "IssueCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Issue" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT NOT NULL,
    "categoryId" UUID NOT NULL,
    "reporterId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "severity" "Severity" NOT NULL,
    "status" "IssueStatus" NOT NULL DEFAULT 'REPORTED',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "resolvedAt" TIMESTAMPTZ(3),
    "closedAt" TIMESTAMPTZ(3),
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "description" TEXT NOT NULL,
    "locality" VARCHAR(160),
    "city" VARCHAR(120) NOT NULL,
    "postalCode" VARCHAR(16),
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueImage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "issueId" UUID NOT NULL,
    "uploadedById" UUID NOT NULL,
    "storageKey" VARCHAR(512) NOT NULL,
    "originalFilename" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(127) NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "IssueImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueComment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "issueId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),
    "deletedById" UUID,

    CONSTRAINT "IssueComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueVote" (
    "issueId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueVote_pkey" PRIMARY KEY ("issueId","userId")
);

-- CreateTable
CREATE TABLE "IssueAssignment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "issueId" UUID NOT NULL,
    "departmentId" UUID NOT NULL,
    "assigneeId" UUID,
    "assignedById" UUID NOT NULL,
    "assignedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMPTZ(3),
    "note" TEXT,

    CONSTRAINT "IssueAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueStatusHistory" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "issueId" UUID NOT NULL,
    "fromStatus" "IssueStatus",
    "toStatus" "IssueStatus" NOT NULL,
    "changedById" UUID NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusTransition" (
    "fromStatus" "IssueStatus" NOT NULL,
    "toStatus" "IssueStatus" NOT NULL,

    CONSTRAINT "StatusTransition_pkey" PRIMARY KEY ("fromStatus","toStatus")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recipientId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "body" TEXT NOT NULL,
    "issueId" UUID,
    "commentId" UUID,
    "readAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actorId" UUID,
    "action" VARCHAR(80) NOT NULL,
    "entityType" VARCHAR(80) NOT NULL,
    "entityId" UUID NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ipAddress" INET,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "user_role_one_active_grant" ON "UserRole"("userId", "roleId") WHERE ("revokedAt" IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "membership_one_active" ON "DepartmentMembership"("userId") WHERE ("endedAt" IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "IssueCategory_code_key" ON "IssueCategory"("code");

-- CreateIndex
CREATE UNIQUE INDEX "IssueCategory_name_key" ON "IssueCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Issue_locationId_key" ON "Issue"("locationId");

-- CreateIndex
CREATE INDEX "issue_active_status_created_at" ON "Issue"("status", "createdAt" DESC) WHERE ("deletedAt" IS NULL);

-- CreateIndex
CREATE INDEX "issue_category_status" ON "Issue"("categoryId", "status");

-- CreateIndex
CREATE INDEX "issue_reporter_created_at" ON "Issue"("reporterId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "location_city_locality" ON "Location"("city", "locality");

-- CreateIndex
CREATE UNIQUE INDEX "IssueImage_storageKey_key" ON "IssueImage"("storageKey");

-- CreateIndex
CREATE INDEX "comment_issue_created_at" ON "IssueComment"("issueId", "createdAt");

-- CreateIndex
CREATE INDEX "assignment_department_ended_at" ON "IssueAssignment"("departmentId", "endedAt");

-- CreateIndex
CREATE INDEX "assignment_active_assignee" ON "IssueAssignment"("assigneeId") WHERE ("endedAt" IS NULL AND "assigneeId" IS NOT NULL);

-- CreateIndex
CREATE UNIQUE INDEX "assignment_one_active" ON "IssueAssignment"("issueId") WHERE ("endedAt" IS NULL);

-- CreateIndex
CREATE INDEX "status_history_issue_created_at" ON "IssueStatusHistory"("issueId", "createdAt");

-- CreateIndex
CREATE INDEX "notification_recipient_read_created" ON "Notification"("recipientId", "readAt", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_entity_created_at" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_actor_created_at" ON "AuditLog"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentMembership" ADD CONSTRAINT "DepartmentMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentMembership" ADD CONSTRAINT "DepartmentMembership_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "IssueCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueImage" ADD CONSTRAINT "IssueImage_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueImage" ADD CONSTRAINT "IssueImage_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueComment" ADD CONSTRAINT "IssueComment_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueComment" ADD CONSTRAINT "IssueComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueComment" ADD CONSTRAINT "IssueComment_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueVote" ADD CONSTRAINT "IssueVote_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueVote" ADD CONSTRAINT "IssueVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueAssignment" ADD CONSTRAINT "IssueAssignment_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueAssignment" ADD CONSTRAINT "IssueAssignment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueAssignment" ADD CONSTRAINT "IssueAssignment_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueAssignment" ADD CONSTRAINT "IssueAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueStatusHistory" ADD CONSTRAINT "IssueStatusHistory_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueStatusHistory" ADD CONSTRAINT "IssueStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "IssueComment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Approved CHECK constraints. Prisma 7.10.0 cannot represent these in schema.prisma.
ALTER TABLE "Issue"
  ADD CONSTRAINT "issue_title_length"
  CHECK (char_length("title") BETWEEN 8 AND 160);

ALTER TABLE "Issue"
  ADD CONSTRAINT "issue_description_length"
  CHECK (char_length("description") BETWEEN 20 AND 5000);

ALTER TABLE "Issue"
  ADD CONSTRAINT "issue_resolved_after_created"
  CHECK ("resolvedAt" IS NULL OR "resolvedAt" >= "createdAt");

ALTER TABLE "Issue"
  ADD CONSTRAINT "issue_closed_after_created"
  CHECK ("closedAt" IS NULL OR "closedAt" >= "createdAt");

ALTER TABLE "Location"
  ADD CONSTRAINT "location_coordinates_pair"
  CHECK (
    ("latitude" IS NULL AND "longitude" IS NULL)
    OR (
      "latitude" IS NOT NULL
      AND "longitude" IS NOT NULL
      AND "latitude" >= -90
      AND "latitude" <= 90
      AND "longitude" >= -180
      AND "longitude" <= 180
    )
  );

ALTER TABLE "IssueImage"
  ADD CONSTRAINT "issue_image_byte_size"
  CHECK ("byteSize" > 0 AND "byteSize" <= 10485760);

ALTER TABLE "IssueComment"
  ADD CONSTRAINT "issue_comment_body_length"
  CHECK (char_length("body") BETWEEN 1 AND 2000);

ALTER TABLE "IssueStatusHistory"
  ADD CONSTRAINT "status_history_reason_required"
  CHECK (
    ("toStatus"::text NOT IN ('REJECTED', 'REOPENED'))
    OR ("reason" IS NOT NULL AND char_length(btrim("reason")) > 0)
  );
