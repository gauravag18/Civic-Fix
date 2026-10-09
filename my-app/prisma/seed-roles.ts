import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { ROLE_SEEDS } from "../src/lib/auth/roles";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    for (const role of ROLE_SEEDS) {
      await prisma.role.upsert({
        where: { code: role.code },
        update: { name: role.name, description: role.description },
        create: role,
      });
      console.log(`Role ready: ${role.code}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(() => {
  console.error("Role seed failed.");
  process.exit(1);
});
