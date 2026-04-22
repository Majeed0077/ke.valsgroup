import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { UILayout } from "@/lib/models/UILayout";

const DEFAULT_KEY = "default";

export async function GET() {
  try {
    await dbConnect();
    const doc = await UILayout.findOne({ key: DEFAULT_KEY }).lean();
    return NextResponse.json({ positions: doc?.positions || {} });
  } catch (err) {
    return NextResponse.json({ positions: {}, error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const layoutKey = String(body?.layoutKey || "");
    const position = body?.position;

    if (!layoutKey || !position || typeof position.x !== "number" || typeof position.y !== "number") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    await dbConnect();
    await UILayout.updateOne(
      { key: DEFAULT_KEY },
      { $set: { [`positions.${layoutKey}`]: position } },
      { upsert: true }
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
