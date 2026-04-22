import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { buildCookieNames, decodeSessionCookie } from "@/lib/authCore";
import { resolveAccessForIdentity } from "@/lib/rbac";

const COOKIE_NAMES = buildCookieNames("customer");

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const cookieStore = await cookies();
    const session = decodeSessionCookie(
      cookieStore.get(COOKIE_NAMES.session)?.value,
      cookieStore.get(COOKIE_NAMES.token)?.value
    );
    const identity = {
      externalUserId: searchParams.get("externalUserId") || session?.externalUserId || session?.userId || "",
      username: searchParams.get("username") || session?.username || "",
      email: searchParams.get("email") || session?.email || "",
    };

    const resolved = await resolveAccessForIdentity(identity);
    return NextResponse.json(resolved, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Unable to resolve RBAC debug access." },
      { status: 500 }
    );
  }
}
