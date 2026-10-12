# CivicFix

Community-powered civic issue reporting and resolution platform.

## Stack

Next.js (App Router), React, TypeScript, Tailwind CSS.

## Local development

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

Copy `.env.example` to `.env.local` and fill in values locally. Never commit `.env` files or credentials. All current variables are server-only.

## Scripts

- `npm run dev` — start the development server
- `npm run lint` — run ESLint
- `npm run build` — create a production build
- `npm run start` — serve the production build
- `npm run db:seed-roles` — upsert the four application roles
- `npm run db:seed-categories` — upsert the reviewed starter issue categories
- `npm run db:seed-transitions` — upsert the reviewed department status transitions
- `npm run admin:bootstrap` — create the first administrator when the user table is empty

## Issue categories

Citizen reporting needs active `IssueCategory` rows. The application does not insert them automatically and does not create users or sample issues.

Review `src/lib/issues/category-seeds.ts`, then from `my-app` run:

```bash
npm run db:seed-categories
```

The script upserts those eight categories by code. A later run refreshes `name` and `sortOrder` for those codes and leaves `isActive` unchanged. It does not delete or edit any other category, and it does not create users, departments, or issues.

## Department workflow

Department staff can open `/department` only when the signed-in account has the department staff role and an active department membership. The application does not create staff users, departments, or sample issues.

Status changes are allowed only when the matching pair exists in `StatusTransition`. Review `src/lib/issues/transition-seeds.ts`, then from `my-app` run:

```bash
npm run db:seed-transitions
```

That script upserts eight status pairs. A later run does not change an existing pair and does not delete any other pair. `REJECTED` and `REOPENED` are not included.

Before a staff account can use the queue, an administrator creates a department at `/admin/departments/new`, then provisions staff at `/admin/users/new` or adds an existing eligible staff member from the department page. The application does not create departments, staff, or memberships during build, startup, or seeding.

Staff provisioning creates a `DEPARTMENT_STAFF` account and can add one active department membership in the same step. The account receives `DEPARTMENT_STAFF` only. The department queue opens for an active member without requiring a password change. The administrator has to deliver the initial password through a separate secure channel. The password is not stored in the page, the URL, or the logs. A signed-in staff member can change it at `/account/password`.

There is no email delivery and no self-service password reset. A signed-in user changes a password at `/account/password`. A forgotten citizen password cannot be recovered in the application. An administrator can provision a new staff account with an initial password.

## Administration

`/admin` is available only to an account whose server session has both administrator capabilities. The pages read live database counts and records. There is no public administrator registration.

The first administrator is created only by an explicit local command. It does not run during build, startup, deployment, or seeding, and it is not an HTTP route.

Preconditions:

- `DATABASE_URL` is set.
- The `ADMINISTRATOR` role already exists (`npm run db:seed-roles`).
- The user table is empty. Any existing user, including a non-administrator, makes the command refuse.
- No active administrator exists.
- You set `BOOTSTRAP_ADMIN_CONFIRM=yes`, plus an email, name, and password, in the process environment. Do not put the password in `.env`.

The password is hashed with the application Argon2id settings. The account can sign in immediately. The account receives `ADMINISTRATOR` and, when that role is already seeded, `CITIZEN`. A second run refuses without creating another account.

From `my-app` in PowerShell:

```powershell
$env:BOOTSTRAP_ADMIN_CONFIRM = "yes"
$env:BOOTSTRAP_ADMIN_EMAIL = "you@example.com"
$env:BOOTSTRAP_ADMIN_NAME = "Your Name"
$env:BOOTSTRAP_ADMIN_PASSWORD = "<password of 12 to 128 characters>"
npm run admin:bootstrap
Remove-Item Env:BOOTSTRAP_ADMIN_PASSWORD
```

## Photographs and notifications

Citizens can attach up to 4 JPEG, PNG, or WebP photographs, 5 MB each, when submitting a report. The server checks the file bytes, stores them in the private Supabase bucket named by `SUPABASE_STORAGE_BUCKET` under generated object names, and records only that key on the issue. The bucket is not public, and the application does not store a permanent image URL. A signed-in user can load a photograph only when they reported the issue or can already open it in their department queue. A missing file is shown as unavailable. Photographs are not written to `data/issue-images`.

That directory lasts across restarts on a normal disk. It is not durable on a host that replaces the filesystem at deploy time. No external storage account is required.

In-app notifications are created in the same database transaction as the department action. A citizen is notified when their report status changes or when staff add a comment. The assigned staff member is notified when a report is assigned to them. Open `/notifications` to read them, mark one as read, or mark all as read. There is no email or live push channel.

## Project structure

- `src/app/` — App Router routes, layouts, and global styles
