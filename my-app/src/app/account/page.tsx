import { redirect } from "next/navigation";
import { getAuthorization } from "@/lib/auth/authorization";
import { homePath } from "@/lib/auth/home-path";

export default async function AccountPage() {
  redirect(homePath(await getAuthorization()));
}
