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

## Issue categories

Citizen reporting needs active `IssueCategory` rows. The application does not insert them automatically and does not create users or sample issues.

Review `src/lib/issues/category-seeds.ts`, then from `my-app` run:

```bash
npm run db:seed-categories
```

The script upserts those categories by code. Run it only when you intend to add them. Existing categories with the same code keep their active or inactive state.

## Project structure

- `src/app/` — App Router routes, layouts, and global styles
