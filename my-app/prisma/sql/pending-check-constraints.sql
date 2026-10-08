-- Pending CHECK constraints for the approved CivicFix schema.
-- Prisma 7.10.0 cannot represent these in schema.prisma.
-- Do not apply this file until the reviewed migration is created.
-- Partial unique indexes are already declared in schema.prisma and are not repeated here.

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
