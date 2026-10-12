-- Auth.js uses a JWT cookie, so the Session table is never written.
-- Issue votes have no application path. Both tables are empty.
DROP TABLE "Session";
DROP TABLE "IssueVote";
