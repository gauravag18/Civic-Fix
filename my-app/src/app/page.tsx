import Link from "next/link";
import { connection } from "next/server";
import { getAuthorization } from "@/lib/auth/authorization";
import { workspaceOf, type Workspace } from "@/lib/auth/home-path";
import { StreetSketch } from "@/components/street-sketch";
import { PublicFrame } from "@/components/shell/public-frame";
import { Button } from "@/components/ui/button";

const steps = [
  {
    title: "Create a citizen account",
    body: "Registration is for citizens. Department staff and administrators sign in with the accounts they already have.",
  },
  {
    title: "File the report",
    body: "Name the problem, choose a category and severity, and give a place someone can find. Photographs are optional.",
  },
  {
    title: "Follow the record",
    body: "The report is saved as Reported. Open it from My issues to see status changes and comments.",
  },
];

const statuses = ["Reported", "Under review", "Assigned", "In progress", "Resolved"];

export const dynamic = "force-dynamic";

export default async function Home() {
  await connection();
  const workspace = workspaceOf(await getAuthorization());

  return (
    <PublicFrame>
      <main>
        <section className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              File a civic report and follow it to resolution.
            </h1>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
              A citizen account is how you report a street, lighting, drainage, or sanitation problem. The department that takes the work updates the status, and that record stays with your account.
            </p>
            <div className="mt-8">
              <AccountActions workspace={workspace} />
            </div>
          </div>
          <StreetSketch />
        </section>

        <section className="border-y border-border bg-card">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight">How a report moves</h2>
              <p className="mt-3 text-muted-foreground">
                Three steps, from a citizen account to a status you can read later.
              </p>
            </div>
            <ol className="mt-10 grid gap-4 md:grid-cols-3">
              {steps.map((step, index) => (
                <li key={step.title} className="flex flex-col rounded-md border border-border bg-background p-5">
                  <p className="text-sm font-semibold text-accent">0{index + 1}</p>
                  <h3 className="mt-3 text-xl font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="bg-primary text-primary-foreground">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-14 sm:px-6">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight">The status stays on the report</h2>
              <p className="mt-3 text-primary-foreground/80">
                A report starts as Reported. It changes only through an allowed step, and you can see the current status from My issues.
              </p>
            </div>
            <ol className="flex flex-col gap-3 sm:flex-row sm:flex-wrap" aria-label="Status sequence">
              {statuses.map((status, index) => (
                <li key={status} className="flex items-center gap-3 text-sm font-semibold">
                  <span className="border border-primary-foreground/30 bg-primary-foreground/5 px-3 py-2">{status}</span>
                  {index < statuses.length - 1 ? <span aria-hidden="true">→</span> : null}
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {workspace === "department"
                ? "Open your department"
                : workspace === "admin"
                  ? "Administration"
                  : "Start with a citizen account"}
            </h2>
            <p className="mt-3 max-w-xl text-muted-foreground">
              {workspace === "department"
                ? "The queue and reports waiting to be taken are in the bar above."
                : workspace === "admin"
                  ? "Overview, departments, categories, users, and reports are in the bar above."
                  : "Register if you are new. Sign in if you already have an account."}
            </p>
          </div>
        </section>
      </main>
    </PublicFrame>
  );
}

function AccountActions({ workspace }: { workspace: Workspace | null }) {
  if (workspace === "department") {
    return (
      <Button asChild className="w-full sm:w-auto">
        <Link href="/department" className="no-underline">
          Open the queue
        </Link>
      </Button>
    );
  }
  if (workspace === "admin") {
    return (
      <Button asChild className="w-full sm:w-auto">
        <Link href="/admin" className="no-underline">
          Open administration
        </Link>
      </Button>
    );
  }
  if (workspace === "citizen") {
    return (
      <Button asChild className="w-full sm:w-auto">
        <Link href="/report" className="no-underline">
          Report an issue
        </Link>
      </Button>
    );
  }
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Button asChild className="w-full sm:w-auto">
        <Link href="/register" className="no-underline">
          Create a citizen account
        </Link>
      </Button>
      <Button variant="outline" asChild className="w-full sm:w-auto">
        <Link href="/login" className="no-underline">
          Sign in
        </Link>
      </Button>
    </div>
  );
}

