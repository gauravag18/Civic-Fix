import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { TRANSITION_SEEDS } from "../src/lib/issues/transition-seeds";

// Upserts allowed status pairs. Does not create users, departments, or issues.

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    for (const transition of TRANSITION_SEEDS) {
      await prisma.statusTransition.upsert({
        where: {
          fromStatus_toStatus: {
            fromStatus: transition.fromStatus,
            toStatus: transition.toStatus,
          },
        },
        update: {},
        create: transition,
      });
      console.log(`Transition ready: ${transition.fromStatus} -> ${transition.toStatus}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(() => {
  console.error("Transition seed failed.");
  process.exit(1);
});
