import { readFile } from "fs/promises";
import path from "path";
import { getSessionUser } from "@/lib/authz";

export const runtime = "nodejs";

/** Doc API pour agent IA, téléchargeable depuis /admin/settings/api-keys. */
export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    return new Response("Unauthorized", { status: 401 });
  }

  const content = await readFile(
    path.join(process.cwd(), "docs", "agent-api.md"),
    "utf-8"
  );

  return new Response(content, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": 'attachment; filename="backoffice-agent-api.md"',
    },
  });
}
