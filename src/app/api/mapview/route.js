import { cookies } from "next/headers";
import { NextResponse } from 'next/server';
import { buildCookieNames } from "@/lib/authCore";

// Retrieve sensitive configuration from server-side environment variables.
// This is a security best practice.
const MAPVIEW_EXTERNAL_API_URL = process.env.EXTERNAL_MAPVIEW_API_URL;
const MAPVIEW_API_AUTH_TOKEN = process.env.EXTERNAL_MAPVIEW_API_AUTH_TOKEN;
const COOKIE_NAMES = buildCookieNames("customer");

export async function GET(request) {
  // --- 1. Configuration Check ---
  // Ensure the server is properly configured before proceeding.
  if (!MAPVIEW_EXTERNAL_API_URL || !MAPVIEW_API_AUTH_TOKEN) {
    console.error("[API Route /api/mapview] Missing environment variables for mapview external API configuration.");
    return NextResponse.json({ error: 'Server configuration error. Unable to connect to the external mapview service.' }, { status: 500 });
  }

  // --- 2. Input Validation ---
  // Get the 'company' query parameter from the incoming request URL.
  const { searchParams } = new URL(request.url);
  const company = searchParams.get('company');

  if (!company) {
    return NextResponse.json({ error: 'Missing required query parameter: company' }, { status: 400 });
  }

  // --- 3. Prepare the External API Call ---
  // Construct the full URL to call the real, external API.
  const externalApiUrl = `${MAPVIEW_EXTERNAL_API_URL}?company=${encodeURIComponent(company)}`;
  const cookieStore = await cookies();
  const loginFor = cookieStore.get(COOKIE_NAMES.loginFor)?.value || "";
  const loginKey = cookieStore.get(COOKIE_NAMES.loginKey)?.value || "";

  console.log(`[API Route /api/mapview] Forwarding request to: ${externalApiUrl}`);

  try {
    // --- 4. Execute the External API Call ---
    const apiResponse = await fetch(externalApiUrl, {
      method: 'GET',
      headers: {
        // Add the secret authorization token. This is hidden from the client.
        'Authorization': MAPVIEW_API_AUTH_TOKEN,
        'Content-Type': 'application/json',
        ...(loginFor ? { login_for: loginFor } : {}),
        ...(loginKey ? { login_key: loginKey } : {}),
      },
      // 'no-store' is crucial to ensure you always get the latest live data.
      cache: 'no-store',
    });

    // We get the response as text first to handle both success and error bodies safely.
    const responseBodyText = await apiResponse.text();

    // --- 5. Handle External API Errors ---
    // Check if the external API responded with an error status (e.g., 401, 404, 500).
    if (!apiResponse.ok) {
      console.error(`[API Route /api/mapview] External API Error: ${apiResponse.status} ${apiResponse.statusText}`, "Response Body:", responseBodyText);
      // Attempt to parse the error response as JSON for a cleaner message, otherwise return the raw text.
      try {
        const errorJson = JSON.parse(responseBodyText);
        return NextResponse.json(errorJson, { status: apiResponse.status });
      } catch (e) {
        return NextResponse.json({ error: 'External API error', details: responseBodyText }, { status: apiResponse.status });
      }
    }

    // --- 6. Handle Successful Response ---
    // Try to parse the successful response text as JSON.
    try {
      const data = JSON.parse(responseBodyText);
      console.log("[API Route /api/mapview] Successfully fetched and parsed data from external API.");
      return NextResponse.json(data);
    } catch (e) {
      // This catches cases where the API returns status 200 but the body is not valid JSON.
      console.error("[API Route /api/mapview] Error parsing JSON response from external API:", e, "Response Text:", responseBodyText);
      return NextResponse.json({ error: 'Failed to parse JSON response from external API', details: responseBodyText }, { status: 502 }); // 502 Bad Gateway is appropriate here.
    }

  } catch (error) {
    // --- 7. Handle Network/Fetch Errors ---
    // This catches errors like network failures, DNS issues, etc.
    console.error('[API Route /api/mapview] Network or other error during fetch to external API:', error);
    return NextResponse.json({ error: 'Failed to connect to the external API or other internal error.', details: error.message }, { status: 503 }); // 503 Service Unavailable.
  }
}
