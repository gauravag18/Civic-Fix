"use client";

import { Button } from "@/components/ui/button";

export default function AdminAnalyticsError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-8 sm:px-6">
      <h1 className="text-subsection font-semibold">Analytics</h1>
      <p role="alert">Analytics could not be loaded. Try again in a moment.</p>
      <Button type="button" onClick={() => reset()}>
        Try again
      </Button>
    </main>
  );
}
