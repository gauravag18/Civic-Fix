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

## Project structure

- `src/app/` — App Router routes, layouts, and global styles
