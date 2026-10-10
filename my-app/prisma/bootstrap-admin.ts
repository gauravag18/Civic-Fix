import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { decideBootstrap } from "../src/lib/admin/rules";
import { hashPassword, validatePassword } from "../src/lib/auth/password";
import { normalizeEmail, normalizeName } from "../src/lib/auth/service";

// Local operator command for the first administrator.
// It is not an HTTP route and is not called from build, startup, or seeding.
//
// Preconditions:
// - DATABASE_URL is set for this process.
// - The ADMINISTRATOR role already exists (npm run db:seed-roles).
// - The user table is empty. Any existing user refuses the command.
// - No active administrator exists.
// - BOOTSTRAP_ADMIN_CONFIRM=yes.
// - BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_NAME, and BOOTSTRAP_ADMIN_PASSWORD
//   are supplied in the environment for this invocation. Do not store the
//   password in .env.
//
// The account can sign in immediately. Registration does not require email
// verification. This command still grants ADMINISTRATOR only through this
// explicit local step.
//
// The account receives ADMINISTRATOR. When the CITIZEN role already exists,
// it also receives CITIZEN. It does not receive staff or moderator access.
//
// From my-app, in PowerShell, for one process only:
//   $env:BOOTSTRAP_ADMIN_CONFIRM = "yes"
//   $env:BOOTSTRAP_ADMIN_EMAIL = "you@example.com"
//   $env:BOOTSTRAP_ADMIN_NAME = "Your Name"
//   $env:BOOTSTRAP_ADMIN_PASSWORD = "<password of 12 to 128 characters>"
//   npm run admin:bootstrap
//   Remove-Item Env:BOOTSTRAP_ADMIN_PASSWORD

const MESSAGES = {
  confirm: "Set BOOTSTRAP_ADMIN_CONFIRM=yes to run this command.",
  identity: "BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_NAME are required.",
  password: "The password does not meet the account password rules.",
  role: "The ADMINISTRATOR role is missing. Seed roles before bootstrap.",
  admin_exists: "An administrator already exists. Bootstrap was refused.",
  users_exist: "Users already exist. Bootstrap was refused.",
} as const;

class BootstrapStop extends Error {
  constructor(readonly reason: keyof typeof MESSAGES) {
    super("bootstrap refused");
  }
}

function fail(reason: keyof typeof MESSAGES): never {
  console.error(MESSAGES[reason]);
  process.exit(1);
}

async function main() {
  const email = normalizeEmail(process.env.BOOTSTRAP_ADMIN_EMAIL ?? "");
  const name = normalizeName(process.env.BOOTSTRAP_ADMIN_NAME ?? "");
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "";
  const passwordError = email && name ? validatePassword(password, email, name) : null;
  const local = decideBootstrap({
    confirmed: process.env.BOOTSTRAP_ADMIN_CONFIRM === "yes",
    email,
    name,
    passwordError,
    hasAdminRole: true,
    activeAdminCount: 0,
    userCount: 0,
  });
  if (!local.ok) {
    if (local.reason === "password" && passwordError) {
      console.error(passwordError);
      process.exit(1);
    }
    fail(local.reason);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const role = await prisma.role.findUnique({
      where: { code: "ADMINISTRATOR" },
      select: { id: true },
    });
    const [userCount, activeAdminCount] = await Promise.all([
      prisma.user.count(),
      prisma.userRole.count({
        where: {
          revokedAt: null,
          role: { code: "ADMINISTRATOR" },
          user: { accountStatus: "ACTIVE", disabledAt: null },
        },
      }),
    ]);
    const ready = decideBootstrap({
      confirmed: true,
      email,
      name,
      passwordError: null,
      hasAdminRole: Boolean(role),
      activeAdminCount,
      userCount,
    });
    if (!ready.ok) fail(ready.reason);

    const passwordHash = await hashPassword(password);
    const now = new Date();
    await prisma.$transaction(
      async (tx) => {
        const adminRole = await tx.role.findUnique({
          where: { code: "ADMINISTRATOR" },
          select: { id: true },
        });
        const citizenRole = await tx.role.findUnique({
          where: { code: "CITIZEN" },
          select: { id: true },
        });
        const usersNow = await tx.user.count();
        const adminsNow = await tx.userRole.count({
          where: {
            revokedAt: null,
            role: { code: "ADMINISTRATOR" },
            user: { accountStatus: "ACTIVE", disabledAt: null },
          },
        });
        const again = decideBootstrap({
          confirmed: true,
          email,
          name,
          passwordError: null,
          hasAdminRole: Boolean(adminRole),
          activeAdminCount: adminsNow,
          userCount: usersNow,
        });
        if (!again.ok) throw new BootstrapStop(again.reason);
        if (!adminRole || !email || !name) throw new BootstrapStop("role");

        const user = await tx.user.create({
          data: {
            email,
            name,
            accountStatus: "ACTIVE",
            createdAt: now,
            credential: {
              create: { passwordHash, createdAt: now, passwordChangedAt: now },
            },
            rolesReceived: {
              create: [
                { roleId: adminRole.id, assignedAt: now },
                ...(citizenRole ? [{ roleId: citizenRole.id, assignedAt: now }] : []),
              ],
            },
          },
          select: { id: true },
        });
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: "admin.bootstrap",
            entityType: "User",
            entityId: user.id,
            metadata: {
              role: "ADMINISTRATOR",
              citizen: citizenRole ? "granted" : "absent",
            },
            createdAt: now,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
    console.log("Administrator ready.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  if (error instanceof BootstrapStop) {
    console.error(MESSAGES[error.reason]);
    process.exit(1);
  }
  console.error("Administrator bootstrap failed.");
  process.exit(1);
});
