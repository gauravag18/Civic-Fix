export function AnalyticsDefinitions({
  notes,
}: {
  notes: readonly { term: string; text: string }[];
}) {
  return (
    <details className="rounded-md border border-border bg-card px-4 py-3">
      <summary className="cursor-pointer font-semibold">How these figures are counted</summary>
      <dl className="mt-3 flex flex-col gap-3">
        {notes.map((note) => (
          <div key={note.term}>
            <dt className="font-semibold">{note.term}</dt>
            <dd className="text-small text-muted-foreground">{note.text}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
