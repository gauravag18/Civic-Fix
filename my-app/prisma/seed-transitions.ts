import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { TRANSITION_SEEDS } from "../src/lib/issues/transition-seeds";

// Upserts the reviewed status transitions. Does not create users, departments, or issues.
// Run from my-app only after reviewing src/lib/issues/transition-seeds.ts:
//   npm run db:seed-transitions

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
