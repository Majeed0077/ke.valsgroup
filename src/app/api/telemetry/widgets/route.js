import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { UILayout } from "@/lib/models/UILayout";
import { buildCookieNames, decodeSessionCookie } from "@/lib/authCore";

const COOKIE_NAMES = buildCookieNames("customer");
const TELEMETRY_WIDGET_SCOPE = "telemetry-widgets";

function getTelemetryWidgetKey(session) {
  const identity =
    String(session?.externalUserId || session?.username || session?.email || session?.userId || "").trim();
  if (!identity) return "";
  return `${TELEMETRY_WIDGET_SCOPE}:${identity.toLowerCase()}`;
}

function sanitizeVisibilityMap(source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  return Object.fromEntries(
    Object.entries(source)
      .filter(([key]) => String(key || "").trim() !== "")
      .map(([key, value]) => [String(key).trim(), value !== false])
  );
}

async function getTelemetryWidgetDoc() {
  const cookieStore = await cookies();
  const session = decodeSessionCookie(
    cookieStore.get(COOKIE_NAMES.session)?.value,
    cookieStore.get(COOKIE_NAMES.token)?.value
  );

  if (!session) {
    return { key: "", session: null, doc: null };
  }

  const key = getTelemetryWidgetKey(session);
  if (!key) {
    return { key: "", session, doc: null };
  }

  await dbConnect();
  const doc = await UILayout.findOne({ key }).lean();
  return { key, session, doc };
}

export async function GET() {
  try {
    const { key, session, doc } = await getTelemetryWidgetDoc();

    if (!session || !key) {
      return NextResponse.json({ visibility: null }, { status: 401 });
    }

    return NextResponse.json({
      visibility: doc?.positions?.visibility || null,
      updatedAt: doc?.updatedAt || null,
    });
  } catch (error) {
    return NextResponse.json(
      { visibility: null, error: error?.message || "Unable to load telemetry widget preferences." },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const { key, session } = await getTelemetryWidgetDoc();
    if (!session || !key) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const body = await request.json();
    const visibility = sanitizeVisibilityMap(body?.visibility);

    if (!visibility) {
      return NextResponse.json({ error: "Invalid visibility payload." }, { status: 400 });
    }

    await UILayout.updateOne(
      { key },
      {
        $set: {
          positions: {
            visibility,
          },
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Unable to save telemetry widget preferences." },
      { status: 500 }
    );
  }
}
