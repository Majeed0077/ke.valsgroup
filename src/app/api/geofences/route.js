// src/app/api/geofences/route.js
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import dbConnect from '@/lib/mongodb';
import { Geofence } from '@/lib/models/Geofence';
import { buildCookieNames, decodeSessionCookie } from '@/lib/authCore';

const GEOFENCE_QUERY_TIMEOUT_MS = 2500;
const COOKIE_NAMES = buildCookieNames("customer");

const getMemoryGeofences = () => {
  if (!globalThis.__geofenceCache) {
    globalThis.__geofenceCache = [];
  }
  return globalThis.__geofenceCache;
};

async function resolveGeofenceScope() {
  const cookieStore = await cookies();
  const session = decodeSessionCookie(
    cookieStore.get(COOKIE_NAMES.session)?.value,
    cookieStore.get(COOKIE_NAMES.token)?.value
  );

  if (!session) return null;

  const ownerUserId = String(session.externalUserId || session.userId || "").trim();
  if (!ownerUserId) return null;

  const companyId = String(session.companyId || "").trim();
  const company = String(session.companyId || session.ownershipScopeId || session.loginKey || ownerUserId).trim();

  return {
    ownerUserId,
    companyId,
    company: company || ownerUserId,
  };
}

async function findGeofencesWithTimeout(ownerUserId) {
  return Promise.race([
    Geofence.find({ ownerUserId, isActive: true }).sort({ createdAt: -1 }).lean(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Geofence query timed out.")), GEOFENCE_QUERY_TIMEOUT_MS)
    ),
  ]);
}

// --- GET Request: Fetch active geofences for the authenticated user ---
export async function GET(request) {
  const scope = await resolveGeofenceScope();
  if (!scope) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const memoryGeofences = getMemoryGeofences();

  try {
    try {
      await dbConnect();
    } catch (dbError) {
      console.warn('[API /geofences GET] DB unavailable, using memory cache.', dbError?.message);
      const filtered = memoryGeofences.filter((g) => g.ownerUserId === scope.ownerUserId && g.isActive);
      return NextResponse.json(filtered);
    }
    const geofences = await findGeofencesWithTimeout(scope.ownerUserId);
    return NextResponse.json(geofences);

  } catch (error) {
    console.warn('[API /geofences GET] Using fallback geofences.', error?.message || error);
    const filtered = memoryGeofences.filter((g) => g.ownerUserId === scope.ownerUserId && g.isActive);
    return NextResponse.json(filtered, { status: 200 });
  }
}


// --- POST Request: Create a new geofence ---
export async function POST(request) {
    try {
        const scope = await resolveGeofenceScope();
        if (!scope) {
            return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
        }

        try {
            await dbConnect();
        } catch (dbError) {
            console.warn('[API /geofences POST] DB unavailable, using memory cache.', dbError?.message);
            const body = await request.json();

            if (!body.name || !body.type || !body.data) {
                return NextResponse.json({ error: 'Missing required fields: name, type, data' }, { status: 400 });
            }

            const memoryGeofences = getMemoryGeofences();
            const newGeofence = {
                _id: `mem-${Date.now()}`,
                name: body.name,
                type: body.type,
                company: scope.company,
                companyId: scope.companyId,
                ownerUserId: scope.ownerUserId,
                description: body.description || '',
                isActive: true,
                polygon: body.type === 'Polygon'
                  ? { type: 'Polygon', coordinates: body.data.coordinates }
                  : undefined,
                rectangle: body.type === 'Rectangle'
                  ? { bounds: body.data.bounds }
                  : undefined,
                circle: body.type === 'Circle'
                  ? { center: body.data.center, radius: body.data.radius }
                  : undefined,
                marker: body.type === 'Marker'
                  ? { point: body.data.point }
                  : undefined,
            };

            memoryGeofences.push(newGeofence);
            return NextResponse.json({ message: 'Geofence created (memory cache)', geofence: newGeofence }, { status: 201 });
        }
        const body = await request.json();

        // Basic validation
        if (!body.name || !body.type || !body.data) {
            return NextResponse.json({ error: 'Missing required fields: name, type, data' }, { status: 400 });
        }
        
        let newGeofenceData = {
            name: body.name,
            type: body.type,
            company: scope.company,
            companyId: scope.companyId,
            ownerUserId: scope.ownerUserId,
            description: body.description || '',
            isActive: true,
        };

        if (body.type === 'Polygon') {
            newGeofenceData.polygon = {
                type: 'Polygon',
                coordinates: body.data.coordinates, // Expecting GeoJSON format [lng, lat]
            };
        } else if (body.type === 'Rectangle') {
            newGeofenceData.rectangle = {
                bounds: body.data.bounds,
            };
        } else if (body.type === 'Circle') {
            newGeofenceData.circle = {
                center: body.data.center, // Expecting { lat, lng }
                radius: body.data.radius, // Expecting radius in meters
            };
        } else if (body.type === 'Marker') {
            newGeofenceData.marker = {
                point: body.data.point,
            };
        } else {
            return NextResponse.json({ error: 'Invalid geofence type' }, { status: 400 });
        }
        
        const geofence = await Geofence.create(newGeofenceData);

        return NextResponse.json({ message: 'Geofence created successfully', geofence }, { status: 201 });

    } catch (error) {
        console.error('[API /geofences POST] Error creating geofence:', error);
        return NextResponse.json({ error: 'Failed to create geofence', details: error.message }, { status: 500 });
    }
}
