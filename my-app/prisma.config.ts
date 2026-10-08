import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // CLI migrations use the direct Neon connection. The app runtime still
    // reads DATABASE_URL in src/lib/prisma.ts.
    url: env("DIRECT_URL"),
  },
});
