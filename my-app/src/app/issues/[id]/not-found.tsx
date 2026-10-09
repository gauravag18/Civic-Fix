import Link from "next/link";
import { AppPage } from "@/components/app-page";

export default function IssueNotFound() {
  return (
    <AppPage title="Report not available" lede="This report is not available.">
      <p className="text-small">
        <Link href="/my-issues">My reports</Link>
        {" · "}
        <Link href="/report">Report an issue</Link>
      </p>
    </AppPage>
  );
}
