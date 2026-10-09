import Link from "next/link";
import { AppPage } from "@/components/app-page";

export default function DepartmentIssueNotFound() {
  return (
    <AppPage
      title="Report not available"
      lede="This report is not available to your department."
    >
      <p className="text-small">
        <Link href="/department">Department queue</Link>
      </p>
    </AppPage>
  );
}
