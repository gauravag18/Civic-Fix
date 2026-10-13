import { cn } from "cn";

function Bone({ className }: { className: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

export function PageLoading({ variant = "list" }: { variant?: "list" | "detail" | "form" }) {
  return (
    <div className="flex min-h-full w-full flex-1 flex-col" aria-busy="true">
      <p className="sr-only" role="status">
        Loading
      </p>
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Bone className="h-5 w-24" />
          <div className="flex items-center gap-2">
            <Bone className="h-8 w-20" />
            <Bone className="hidden h-8 w-28 sm:block" />
            <Bone className="size-10 rounded-full" />
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-3">
          <Bone className="h-9 w-56 max-w-full" />
          <Bone className="h-4 w-full max-w-lg" />
        </div>
        {variant === "detail" ? <DetailBody /> : variant === "form" ? <FormBody /> : <ListBody />}
      </main>
    </div>
  );
}

function ListBody() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <Bone className="h-40 w-full" />
      <Bone className="h-40 w-full" />
      <Bone className="h-40 w-full" />
    </div>
  );
}

function FormBody() {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="flex flex-col gap-3">
        <Bone className="h-4 w-full" />
        <Bone className="h-4 w-5/6" />
        <Bone className="h-4 w-2/3" />
      </div>
      <div className="flex flex-col gap-3">
        <Bone className="h-10 w-full" />
        <Bone className="h-10 w-full" />
        <Bone className="h-10 w-36" />
      </div>
    </div>
  );
}

function DetailBody() {
  return (
    <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
      <div className="flex flex-col gap-4">
        <Bone className="h-6 w-40" />
        <Bone className="h-4 w-full" />
        <Bone className="h-4 w-full" />
        <Bone className="h-4 w-4/5" />
        <Bone className="mt-4 h-32 w-full" />
      </div>
      <Bone className="aspect-[4/3] w-full lg:aspect-[3/4]" />
    </div>
  );
}
