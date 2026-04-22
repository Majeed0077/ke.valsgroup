// src/app/api/sync-external-data/route.js
import { cookies } from "next/headers";
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Vehicle, VehiclePathPoint } from '@/lib/models/VehicleData'; // Adjust path if necessary
import { buildCookieNames } from "@/lib/authCore";

// Environment variables should be defined in .env.local
const EXTERNAL_API_URL = process.env.EXTERNAL_MAPVIEW_API_URL;
const EXTERNAL_API_TOKEN = process.env.EXTERNAL_MAPVIEW_API_TOKEN;
const EXTERNAL_API_USERID = process.env.EXTERNAL_MAPVIEW_API_USERID;
const COOKIE_NAMES = buildCookieNames("customer");

/**
 * API Route: Fetches vehicle data from an external source and syncs it to MongoDB.
 * Intended to be run periodically by a cron job or scheduler.
 */
export async function GET(request) {
  // --- 1. Configuration Check ---
  if (!EXTERNAL_API_URL || !EXTERNAL_API_TOKEN || !EXTERNAL_API_USERID) {
    const errorMessage = "[API Sync] Missing environment variables. Ensure EXTERNAL_MAPVIEW_API_URL, EXTERNAL_MAPVIEW_API_TOKEN, and EXTERNAL_MAPVIEW_API_USERID are set.";
    console.error(errorMessage);
    return NextResponse.json({ error: 'Sync server is not configured correctly.' }, { status: 500 });
  }

  try {
    // --- 2. Connect to Database ---
    await dbConnect();

    // --- 3. Fetch Data from External Source ---
    console.log('[API Sync] Fetching data from external source...');
    
    const url = new URL(`${EXTERNAL_API_URL}/vtp/mapview`);
    url.searchParams.append("userid", EXTERNAL_API_USERID);
    const cookieStore = await cookies();
    const loginFor = cookieStore.get(COOKIE_NAMES.loginFor)?.value || "";
    const loginKey = cookieStore.get(COOKIE_NAMES.loginKey)?.value || "";

    const fetchOptions = {
        method: 'GET',
        cache: 'no-store',
        headers: {
            // Correct format for Bearer token
            'Authorization': `Bearer ${EXTERNAL_API_TOKEN}`,
            ...(loginFor ? { login_for: loginFor } : {}),
            ...(loginKey ? { login_key: loginKey } : {}),
        }
    };

    const externalResponse = await fetch(url.toString(), fetchOptions);

    if (!externalResponse.ok) {
      const errorText = await externalResponse.text();
      console.error(`[API Sync] Error fetching from external source: ${externalResponse.status}`, errorText);
      return NextResponse.json({ error: `External API fetch failed`, details: errorText }, { status: 502 });
    }

    const data = await externalResponse.json();
    const vehiclesToSync = Array.isArray(data) ? data : (data?.vehicles || data?.data || []);

    if (!Array.isArray(vehiclesToSync) || vehiclesToSync.length === 0) {
      console.log('[API Sync] No vehicles found in the external source response.');
      return NextResponse.json({ message: 'No new vehicle data found to sync.' }, { status: 200 });
    }

    // --- 4. Process Each Vehicle ---
    let successCount = 0;
    let errorCount = 0;

    for (const vehicleData of vehiclesToSync) {
      try {
        // Validation: Ensure the primary key and location data exist before processing
        if (!vehicleData.imei_id || vehicleData.latitude == null || vehicleData.longitude == null) {
          console.warn('[API Sync] Skipping vehicle due to missing essential data (imei_id, lat, or lng). Received:', JSON.stringify(vehicleData));
          errorCount++;
          continue; // Skip this vehicle and move to the next one
        }

        const recordTimestamp = new Date(vehicleData.device_date || vehicleData.server_date || Date.now());

        // Create a clean payload object to ensure data types and fields match your schema
        // This prevents CastErrors and saving unwanted data.
        const updatePayload = {
            imei_id: vehicleData.imei_id,
            user_id: vehicleData.user_id,
            vehicle_no: vehicleData.vehicle_no,
            vehicle_type: vehicleData.vehicle_type,
            company: vehicleData.company,
            server_date: vehicleData.server_date ? new Date(vehicleData.server_date) : null,
            device_date: vehicleData.device_date ? new Date(vehicleData.device_date) : null,
            latitude: parseFloat(vehicleData.latitude),
            longitude: parseFloat(vehicleData.longitude),
            altitude: vehicleData.altitude != null ? Number(vehicleData.altitude) : null,
            speed: vehicleData.speed != null ? Number(vehicleData.speed) : 0,
            odometer: vehicleData.odo_meter != null ? Number(vehicleData.odo_meter) : 0,
            angle_name: vehicleData.angle_name,
            location_name: vehicleData.location_name,
            road: vehicleData.road,
            district_name: vehicleData.district_name,
            city_name: vehicleData.city_name,
            state_name: vehicleData.state_name,
            country_name: vehicleData.country_name,
            poi: vehicleData.poi,
            
            // --- FIX FOR CastError: Convert "Y"/"N" to Boolean ---
            ignition_state: vehicleData.ignition_state === 'Y',
            battery_power: vehicleData.battery_power === 'Y',
            
            user_status: vehicleData.user_status,
            movement_status: vehicleData.movement_status,
            sleep_mode: vehicleData.sleep_mode,
            sleep_mode_desc: vehicleData.sleep_mode_desc,
            valid: vehicleData.valid,
            battery_level: vehicleData.battery_level != null ? Number(vehicleData.battery_level) : null,
            battery_voltage: vehicleData.battery_voltage != null ? Number(vehicleData.battery_voltage) : null,
            external_voltage: vehicleData.external_voltage != null ? Number(vehicleData.external_voltage) : null,
            satellites: vehicleData.satellites != null ? Number(vehicleData.satellites) : null,
            gnss_state: vehicleData.gnss_state,
            gnss_status: vehicleData.gnss_status,
            gsm_signal_level: vehicleData.gsm_signal_level != null ? Number(vehicleData.gsm_signal_level) : null,
            // You can add more conversions for other fields if needed
        };

        // OPERATION 1: Update the main vehicle document with the latest state
        await Vehicle.findOneAndUpdate(
          { imei_id: vehicleData.imei_id },
          { $set: updatePayload },
          { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        // OPERATION 2: Create a new historical path point
        await VehiclePathPoint.create({
          imei_id: vehicleData.imei_id,
          latitude: parseFloat(vehicleData.latitude),
          longitude: parseFloat(vehicleData.longitude),
          speed: vehicleData.speed != null ? parseFloat(vehicleData.speed) : 0,
          timestamp: recordTimestamp,
        });

        successCount++;
      } catch (dbError) {
        errorCount++;
        console.error(`[API Sync] DB error processing IMEI_ID ${vehicleData.imei_id}:`, dbError.message);
      }
    }

    // --- 5. Return Final Response ---
    const summaryMessage = `Sync complete. Total from source: ${vehiclesToSync.length}, Successfully processed: ${successCount}, Skipped/Errors: ${errorCount}`;
    console.log(`[API Sync] ${summaryMessage}`);
    return NextResponse.json({ message: summaryMessage, success: successCount, errors: errorCount });

  } catch (error) {
    console.error('[API Sync] Critical error in sync process:', error);
    return NextResponse.json({ error: 'Sync process failed.', details: error.message }, { status: 500 });
  }
}
