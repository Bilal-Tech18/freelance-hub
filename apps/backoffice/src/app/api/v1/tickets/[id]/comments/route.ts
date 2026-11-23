import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiKey } from "@/lib/api-key";
import { apiError, handleServiceError } from "@/lib/api-serializers";
import { addComment } from "@/lib/services/tickets";

const schema = z.object({ body: z.string().min(1).max(10000) });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiKey(request, ["comments:write"]);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return apiError(422, "VALIDATION", "Invalid JSON body.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return apiError(422, "VALIDATION", parsed.error.issues[0].message);
  }

  try {
    const comment = await addComment(auth.actor, id, { body: parsed.data.body });
    return NextResponse.json(
      {
        comment: {
          id: comment.id,
          body: comment.body,
          author: comment.author,
          createdAt: comment.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (e) {
    return handleServiceError(e);
  }
}
