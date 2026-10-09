import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { CATEGORY_SEEDS } from "../src/lib/issues/category-seeds";

// Upserts the reviewed starter categories by code.
// Does not create users, issues, departments, or assignments.
// Run from my-app only after reviewing src/lib/issues/category-seeds.ts:
//   npm run db:seed-categories

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    for (const category of CATEGORY_SEEDS) {
      await prisma.issueCategory.upsert({
        where: { code: category.code },
        update: { name: category.name, sortOrder: category.sortOrder },
        create: { ...category, isActive: true },
      });
      console.log(`Category ready: ${category.code}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(() => {
  console.error("Category seed failed.");
  process.exit(1);
});
