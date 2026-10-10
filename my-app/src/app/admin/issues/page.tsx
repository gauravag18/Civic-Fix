import { redirect } from "next/navigation";
import { AdminDenied, AdminPage } from "@/components/admin-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loadAdminIssueGate } from "@/lib/issues/delete-queries";
import { isUuid } from "@/lib/issues/validate";

export const dynamic = "force-dynamic";

export default async function AdminIssuesPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const id = ((await searchParams).id ?? "").trim();
  const gate = await loadAdminIssueGate();
  if (gate.ok && isUuid(id)) redirect(`/admin/issues/${id}`);

  return (
    <AdminPage
      title="Delete a report"
      lede="Find one report by its identifier. Deletion is confirmed on the next page and is not available to citizens or departments."
    >
      {!gate.ok ? <AdminDenied reason={gate.reason} /> : null}
      {gate.ok ? (
        <form action="/admin/issues" method="get" className="flex flex-col gap-3">
          {id && !isUuid(id) ? (
            <p role="alert" className="text-destructive">
              Enter the report identifier from its address.
            </p>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="id">Report identifier</Label>
            <Input id="id" name="id" defaultValue={id} required autoComplete="off" />
          </div>
          <Button type="submit" className="w-full sm:w-auto">
            Find report
          </Button>
        </form>
      ) : null}
    </AdminPage>
  );
}
