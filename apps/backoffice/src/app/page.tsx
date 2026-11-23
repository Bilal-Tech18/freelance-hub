import { redirect } from "next/navigation";
import { requireUser } from "@/lib/authz";

export default async function Home() {
  const user = await requireUser();
  redirect(
    user.role === "ADMIN"
      ? "/admin"
      : user.role === "MAINTAINER"
        ? "/maintenance"
        : "/projects"
  );
}
