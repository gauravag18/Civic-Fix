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

Staff provisioning does not confirm the email address and does not set `emailVerifiedAt`. The audit action `staff.provision` records `activation: admin-activated` and `emailVerified: false`. That audit is the only reason the account can sign in before email confirmation. Public registration still requires the email verification flow. The account receives `DEPARTMENT_STAFF` only. There is no database field for a mandatory password change, so the initial password is detected by `passwordChangedAt` still matching credential creation time. The staff member must replace it at `/account/password` before `/department` opens. The administrator has to deliver the initial password through a separate secure channel. The password is not stored in the page, the URL, or the logs.

## Administration

`/admin` is available only to an account whose server session has both administrator capabilities. The pages read live database counts and records. There is no public administrator registration.

The first administrator is created only by an explicit local command. It does not run during build, startup, deployment, or seeding, and it is not an HTTP route.

Preconditions:

- `DATABASE_URL` is set.
- The `ADMINISTRATOR` role already exists (`npm run db:seed-roles`).
- The user table is empty. Any existing user, including a non-administrator, makes the command refuse.
- No active administrator exists.
- You set `BOOTSTRAP_ADMIN_CONFIRM=yes`, plus an email, name, and password, in the process environment. Do not put the password in `.env`.

The password is hashed with the application Argon2id settings. The command sets `emailVerifiedAt` to the account creation time so this one account can sign in when mail is not configured. Normal registration still requires email verification. The account receives `ADMINISTRATOR` and, when that role is already seeded, `CITIZEN`. A second run refuses without creating another account.

From `my-app` in PowerShell:

```powershell
$env:BOOTSTRAP_ADMIN_CONFIRM = "yes"
$env:BOOTSTRAP_ADMIN_EMAIL = "you@example.com"
$env:BOOTSTRAP_ADMIN_NAME = "Your Name"
$env:BOOTSTRAP_ADMIN_PASSWORD = "<password of 12 to 128 characters>"
npm run admin:bootstrap
Remove-Item Env:BOOTSTRAP_ADMIN_PASSWORD
```

## Project structure

- `src/app/` — App Router routes, layouts, and global styles
