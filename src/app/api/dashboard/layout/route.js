import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { UILayout } from "@/lib/models/UILayout";
import { buildCookieNames, decodeSessionCookie } from "@/lib/authCore";

const COOKIE_NAMES = buildCookieNames("customer");
const DASHBOARD_LAYOUT_SCOPE = "dashboard-grid";

function getDashboardLayoutKey(session) {
  const identity =
    String(session?.externalUserId || session?.username || session?.email || session?.userId || "").trim();
  if (!identity) return "";
  return `${DASHBOARD_LAYOUT_SCOPE}:${identity.toLowerCase()}`;
}

async function getDashboardLayoutDoc() {
  const cookieStore = await cookies();
  const session = decodeSessionCookie(
    cookieStore.get(COOKIE_NAMES.session)?.value,
    cookieStore.get(COOKIE_NAMES.token)?.value
  );

  if (!session) {
    return { key: "", session: null, doc: null };
  }

  const key = getDashboardLayoutKey(session);
  if (!key) {
    return { key: "", session, doc: null };
  }

  await dbConnect();
  const doc = await UILayout.findOne({ key }).lean();
  return { key, session, doc };
}

export async function GET() {
  try {
    const { key, session, doc } = await getDashboardLayoutDoc();

    if (!session || !key) {
      return NextResponse.json({ layouts: null }, { status: 401 });
    }

    return NextResponse.json({
      layouts: doc?.positions?.layouts || null,
      updatedAt: doc?.updatedAt || null,
    });
  } catch (error) {
    return NextResponse.json(
      { layouts: null, error: error?.message || "Unable to load dashboard layout." },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const { key, session } = await getDashboardLayoutDoc();
    if (!session || !key) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const body = await request.json();
    const layouts = body?.layouts;

    if (!layouts || typeof layouts !== "object" || Array.isArray(layouts)) {
      return NextResponse.json({ error: "Invalid layouts payload." }, { status: 400 });
    }

    await UILayout.updateOne(
      { key },
      {
        $set: {
          positions: {
            layouts,
          },
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Unable to save dashboard layout." },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const { key, session } = await getDashboardLayoutDoc();
    if (!session || !key) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    await UILayout.deleteOne({ key });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Unable to reset dashboard layout." },
      { status: 500 }
    );
  }
}
