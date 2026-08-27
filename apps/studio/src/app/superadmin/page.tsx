import { redirect } from "next/navigation";

/** /superadmin has nothing of its own to show yet — client orgs is the only section built so far. */
export default function SuperadminLandingPage() {
  redirect("/superadmin/clients");
}
