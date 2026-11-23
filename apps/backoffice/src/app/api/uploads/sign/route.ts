import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/authz";
import { signUpload } from "@/lib/cloudinary";

export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Session requise." } },
      { status: 401 }
    );
  }
  return NextResponse.json(signUpload());
}
