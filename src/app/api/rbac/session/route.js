import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildCookieNames, decodeSessionCookie } from "@/lib/authCore";
import { resolveAccessForIdentity } from "@/lib/rbac";

const COOKIE_NAMES = buildCookieNames("customer");

export async function GET() {
  try {
    const cookieStore = await cookies();
    const session = decodeSessionCookie(
      cookieStore.get(COOKIE_NAMES.session)?.value,
      cookieStore.get(COOKIE_NAMES.token)?.value
    );

    if (!session) {
      return NextResponse.json({ isLoggedIn: false, assignedRoleKeys: [], assignedRoles: [], menuAccess: [] }, { status: 401 });
    }

    const resolved = await resolveAccessForIdentity({
      externalUserId: session.externalUserId || session.userId || "",
      username: session.username || "",
      email: session.email || "",
    });

    return NextResponse.json(
      {
        isLoggedIn: true,
        externalUserId: resolved.identity.externalUserId,
        assignedRoleKeys: resolved.assignedRoleKeys,
        assignedRoles: resolved.assignedRoles,
        rightsCatalog: resolved.rightsCatalog,
        menuAccess: resolved.menuAccess,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        isLoggedIn: true,
        assignedRoleKeys: [],
        assignedRoles: [],
        rightsCatalog: [],
        menuAccess: [],
        rbacError: error?.message || "Unable to resolve RBAC access.",
      },
      { status: 200 }
    );
  }
}
