export function PageLoading() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-8 sm:px-6" aria-busy="true">
      <p role="status" className="text-sm text-muted-foreground">
        Loading
      </p>
      <div className="h-8 w-48 rounded-md bg-muted" />
      <div className="h-24 rounded-md border border-border bg-card" />
      <div className="h-24 rounded-md border border-border bg-card" />
    </main>
  );
}