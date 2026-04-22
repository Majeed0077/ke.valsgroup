import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildCookieNames, decodeSessionCookie } from "@/lib/authCore";
import dbConnect from "@/lib/mongodb";
import { ProfileAvatar } from "@/lib/models/ProfileAvatar";

const COOKIE_NAMES = buildCookieNames("customer");
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function buildAvatarIdentity(session) {
  return String(
    session?.externalUserId || session?.userId || session?.username || session?.email || ""
  )
    .trim()
    .toLowerCase();
}

function buildAvatarKey(session) {
  const identity = buildAvatarIdentity(session);
  if (!identity) return "";
  return [
    String(session?.loginFor || "").trim().toUpperCase(),
    String(session?.loginKey || "").trim(),
    identity,
  ].join("|");
}

async function getAvatarContext() {
  const cookieStore = await cookies();
  const session = decodeSessionCookie(
    cookieStore.get(COOKIE_NAMES.session)?.value,
    cookieStore.get(COOKIE_NAMES.token)?.value
  );

  if (!session) {
    return { session: null, key: "", identity: "" };
  }

  const identity = buildAvatarIdentity(session);
  const key = buildAvatarKey(session);
  return { session, key, identity };
}

function buildMetaResponse(doc) {
  return {
    hasAvatar: Boolean(doc?.mimeType),
    avatarUpdatedAt: doc?.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
    mimeType: String(doc?.mimeType || ""),
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const wantsMeta = searchParams.get("meta") === "1";
    const { session, key } = await getAvatarContext();

    if (!session || !key) {
      if (wantsMeta) {
        return NextResponse.json({ hasAvatar: false, avatarUpdatedAt: null }, { status: 401 });
      }
      return new NextResponse("Authentication required.", { status: 401 });
    }

    await dbConnect();
    if (wantsMeta) {
      const doc = await ProfileAvatar.findOne({ key })
        .select("mimeType updatedAt")
        .lean()
        .exec();
      return NextResponse.json(buildMetaResponse(doc), {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const doc = await ProfileAvatar.findOne({ key })
      .select("mimeType size imageData updatedAt")
      .exec();

    if (!doc?.imageData || !doc?.mimeType) {
      return new NextResponse("Avatar not found.", { status: 404 });
    }

    const imageBuffer = Buffer.isBuffer(doc.imageData)
      ? doc.imageData
      : Buffer.from(doc.imageData?.buffer || doc.imageData || []);

    return new NextResponse(new Uint8Array(imageBuffer), {
      status: 200,
      headers: {
        "Content-Type": doc.mimeType,
        "Content-Length": String(Number(doc.size || imageBuffer.length || 0)),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Unable to load avatar." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const { session, key, identity } = await getAvatarContext();
    if (!session || !key) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const formData = await request.formData();
    const avatarFile = formData.get("avatar");
    if (!avatarFile || typeof avatarFile.arrayBuffer !== "function") {
      return NextResponse.json({ error: "Avatar file is required." }, { status: 400 });
    }

    const mimeType = String(avatarFile.type || "").trim().toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return NextResponse.json({ error: "Only JPG, PNG, WEBP, or GIF images are allowed." }, { status: 400 });
    }

    const size = Number(avatarFile.size || 0);
    if (!Number.isFinite(size) || size <= 0 || size > MAX_AVATAR_BYTES) {
      return NextResponse.json({ error: "Avatar size must be under 5MB." }, { status: 400 });
    }

    const buffer = Buffer.from(await avatarFile.arrayBuffer());
    await dbConnect();
    const avatarUpdatedAt = new Date().toISOString();
    await ProfileAvatar.updateOne(
      { key },
      {
        $set: {
          key,
          identity,
          loginFor: String(session.loginFor || "").trim().toUpperCase(),
          loginKey: String(session.loginKey || "").trim(),
          userId: String(session.userId || "").trim(),
          externalUserId: String(session.externalUserId || "").trim(),
          username: String(session.username || "").trim(),
          email: String(session.email || "").trim().toLowerCase(),
          mimeType,
          filename: String(avatarFile.name || "avatar").trim(),
          size: buffer.length,
          imageData: buffer,
          updatedAt: new Date(avatarUpdatedAt),
        },
      },
      {
        upsert: true,
      }
    ).exec();

    return NextResponse.json(
      {
        hasAvatar: true,
        avatarUpdatedAt,
        mimeType,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Unable to upload avatar." },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const { session, key } = await getAvatarContext();
    if (!session || !key) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    await dbConnect();
    await ProfileAvatar.deleteOne({ key });
    return NextResponse.json({ ok: true, hasAvatar: false, avatarUpdatedAt: null }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Unable to delete avatar." },
      { status: 500 }
    );
  }
}
