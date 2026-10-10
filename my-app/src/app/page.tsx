import Link from "next/link";
import { PublicFrame } from "@/components/shell/public-frame";
import { Button } from "@/components/ui/button";

const steps = [
  {
    title: "Describe what you saw",
    body: "Sign in, name the problem, and give a place someone can find. You can attach JPEG, PNG, or WebP photographs.",
  },
  {
    title: "The report is saved as Reported",
    body: "It stays on your account. You can later publish the title, category, general place, status, and date. A matching report from you in the last two minutes is treated as the same report.",
  },
  {
    title: "A department takes the work",
    body: "Staff in the assigned department can claim the report, name a person, add a comment, and move it through the allowed statuses.",
  },
  {
    title: "You can follow it here",
    body: "Status changes and new comments appear on the report and in your notifications. There is no email channel.",
  },
];

const capabilities = [
  ["Reporting", "Citizens file a report with a category, severity, location, and optional photographs."],
  ["Department queue", "Staff see their department’s reports and unassigned reports they are allowed to take."],
  ["Administration", "Administrators manage departments, categories, and staff accounts."],
  ["Notifications", "Assignment, status, and comment events stay inside CivicFix for the person they concern."],
  ["Explore", "A reporter can publish a report’s title, category, locality, city, status, and date. The description, street address, and photographs stay on the private report."],
];

const statuses = ["Reported", "Under review", "Assigned", "In progress", "Resolved"];

export default function Home() {
  return (
    <PublicFrame>
      <main>
        <section className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold tracking-wide text-link">Civic reporting</p>
            <h1 className="mt-3 max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">
              A better neighborhood starts with being heard.
            </h1>
            <p className="mt-4 max-w-xl text-lg text-muted-foreground">
              Tell CivicFix about a street, light, drain, or sanitation problem. The department that takes it can update the status, and you can read that record here.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button asChild>
                <Link href="/report" className="no-underline">
                  Report an issue
                </Link>
              </Button>
              <Button variant="secondary" asChild>
                <Link href="#how-it-works" className="no-underline">
                  How it works
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/explore" className="no-underline">
                  Explore issues
                </Link>
              </Button>
            </div>
          </div>
          <StreetSketch />
        </section>

        <section id="how-it-works" className="border-y border-border bg-card">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight">How it works</h2>
              <p className="mt-2 text-muted-foreground">
                The path below is the one CivicFix actually stores. A report starts as Reported and changes only when a permitted status transition exists.
              </p>
            </div>
            <ol className="flex flex-col">
              {steps.map((step, index) => (
                <li key={step.title} className="grid gap-3 border-t border-border py-6 md:grid-cols-[8rem_1fr] md:gap-8">
                  <p className="text-sm font-semibold text-accent">0{index + 1}</p>
                  <div>
                    <h3 className="text-xl font-semibold">{step.title}</h3>
                    <p className="mt-2 max-w-2xl text-muted-foreground">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">What you can do</h2>
            <p className="mt-2 text-muted-foreground">
              Each area is available only to the account that is allowed to use it.
            </p>
          </div>
          <dl className="flex flex-col">
            {capabilities.map(([title, body]) => (
              <div key={title} className="border-t border-border py-4">
                <dt className="font-semibold">{title}</dt>
                <dd className="mt-1 text-muted-foreground">{body}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="bg-primary text-primary-foreground">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-12 sm:px-6">
            <h2 className="text-3xl font-semibold tracking-tight">A report keeps its history</h2>
            <p className="max-w-2xl text-primary-foreground/80">
              Photographs stay with the report. Comments and status changes are recorded. A reporter can publish the title, category, general place, status, and date. The rest of the report stays private.
            </p>
            <ol className="flex flex-col gap-3 sm:flex-row sm:flex-wrap" aria-label="Example status sequence">
              {statuses.map((status, index) => (
                <li key={status} className="flex items-center gap-3 text-sm font-semibold">
                  <span className="border border-primary-foreground/30 px-3 py-2">{status}</span>
                  {index < statuses.length - 1 ? <span aria-hidden="true">→</span> : null}
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.2fr_0.8fr] md:items-end">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">The record is the accountability</h2>
            <p className="mt-3 max-w-xl text-muted-foreground">
              You can see who changed a status only as “you” or “CivicFix staff,” along with the time and any required reason. Staff comments that are meant for you show on your report.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            CivicFix does not publish a live map or a count of citywide issues. Published reports are listed on Explore.
          </p>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-12 sm:px-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">Ready to file a report?</h2>
              <p className="mt-2 text-muted-foreground">Use the account you already have, or create a citizen account.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild>
                <Link href="/report" className="no-underline">
                  Report an issue
                </Link>
              </Button>
              <Button variant="secondary" asChild>
                <Link href="/register" className="no-underline">
                  Create an account
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </PublicFrame>
  );
}

function StreetSketch() {
  return (
    <figure className="overflow-hidden rounded-md border border-border bg-card p-6">
      <svg viewBox="0 0 420 320" className="h-auto w-full" aria-hidden="true">
        <rect width="420" height="320" fill="#FFFCF6" />
        <rect x="0" y="230" width="420" height="90" fill="#EFE6D8" />
        <rect x="36" y="86" width="78" height="144" fill="#34251D" />
        <rect x="126" y="54" width="96" height="176" fill="#654737" />
        <rect x="236" y="108" width="70" height="122" fill="#A65F43" />
        <rect x="48" y="108" width="18" height="22" fill="#F7F3EB" />
        <rect x="78" y="108" width="18" height="22" fill="#F7F3EB" />
        <rect x="48" y="146" width="18" height="22" fill="#F7F3EB" />
        <rect x="78" y="146" width="18" height="22" fill="#F7F3EB" />
        <rect x="146" y="78" width="20" height="24" fill="#FFFCF6" />
        <rect x="178" y="78" width="20" height="24" fill="#FFFCF6" />
        <rect x="146" y="116" width="20" height="24" fill="#FFFCF6" />
        <rect x="178" y="116" width="20" height="24" fill="#FFFCF6" />
        <rect x="252" y="128" width="18" height="20" fill="#FFFCF6" />
        <rect x="278" y="128" width="18" height="20" fill="#FFFCF6" />
        <rect x="330" y="150" width="8" height="80" fill="#654737" />
        <circle cx="334" cy="142" r="22" fill="#A65F43" />
        <path d="M40 250h340" stroke="#34251D" strokeWidth="4" />
        <path d="M70 268h80M190 268h70M300 268h50" stroke="#C4B29E" strokeWidth="4" />
      </svg>
      <figcaption className="mt-3 text-sm text-muted-foreground">
        A street, its buildings, and the everyday work of keeping them in order.
      </figcaption>
    </figure>
  );
}
