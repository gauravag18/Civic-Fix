import Link from "next/link";

export default function PublicIssueNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Report not available</h1>
      <p>This report is not on Explore.</p>
      <p className="text-small">
        <Link href="/explore">Explore issues</Link>
      </p>
    </main>
  );
}
