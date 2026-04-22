import { NextResponse } from "next/server";

const BASE_URL = process.env.EXTERNAL_AUTH_API_URL || process.env.EXTERNAL_MAPVIEW_API_URL || "";

export async function POST(request) {
  if (!BASE_URL) {
    return NextResponse.json(
      { error: "Missing EXTERNAL_AUTH_API_URL environment variable." },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const response = await fetch(`${BASE_URL.replace(/\/$/, "")}/react/forgotpassword`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = text ? { detail: text } : {};
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Unable to process forgot-password request." },
      { status: 500 }
    );
  }
}
