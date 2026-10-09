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

## Issue categories

Citizen reporting needs active `IssueCategory` rows. The application does not insert them automatically and does not create users or sample issues.

Review `src/lib/issues/category-seeds.ts`, then from `my-app` run:

```bash
npm run db:seed-categories
```

The script upserts those categories by code. Run it only when you intend to add them. Existing categories with the same code keep their active or inactive state.

## Department workflow

Department staff can open `/department` only when the signed-in account has the department staff role and an active department membership. The application does not create staff users, departments, or sample issues.

Status changes are allowed only when the matching pair exists in `StatusTransition`. Review `src/lib/issues/transition-seeds.ts`, then from `my-app` run:

```bash
npm run db:seed-transitions
```

Before a staff account can use the queue, an administrator still has to create a department, grant the `DEPARTMENT_STAFF` role, and add an active membership for a verified user. Registration cannot do that while email delivery is unconfigured.

## Project structure

- `src/app/` — App Router routes, layouts, and global styles
