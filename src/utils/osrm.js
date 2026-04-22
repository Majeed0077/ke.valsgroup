const OSRM_BASE_URL = "https://router.project-osrm.org/route/v1/driving";
const RATE_LIMIT_COOLDOWN_MS = 30000;

let rateLimitCooldownUntil = 0;
const inflightRequests = new Map();

const buildCoordsString = (coordinates) => coordinates.map((point) => `${point[1]},${point[0]}`).join(";");

const createError = (message, code) => {
  const error = new Error(message);
  error.code = code;
  return error;
};

async function requestRoute(coordsString) {
  const now = Date.now();
  if (rateLimitCooldownUntil > now) {
    throw createError("Routing service is cooling down after rate limiting.", "OSRM_COOLDOWN");
  }

  const url = `${OSRM_BASE_URL}/${coordsString}?overview=full&geometries=geojson`;
  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 429) {
      rateLimitCooldownUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
      throw createError("Too many requests to the routing service.", "OSRM_RATE_LIMIT");
    }

    throw createError(`Routing service failed with status ${response.status}.`, "OSRM_HTTP_ERROR");
  }

  const data = await response.json();
  if (data.code !== "Ok" || !Array.isArray(data.routes) || data.routes.length === 0) {
    throw createError("No route found between the provided points.", "OSRM_NO_ROUTE");
  }

  return data.routes[0].geometry.coordinates.map((coord) => [coord[1], coord[0]]);
}

/**
 * Fetches a route from the public OSRM server.
 * @param {Array<[number, number]>} coordinates
 * @returns {Promise<Array<[number, number]>>}
 */
export async function fetchSnapppedRoute(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    throw createError("At least two coordinates are required to fetch a route.", "OSRM_INPUT_ERROR");
  }

  const coordsString = buildCoordsString(coordinates);
  const existingRequest = inflightRequests.get(coordsString);
  if (existingRequest) return existingRequest;

  const requestPromise = requestRoute(coordsString).finally(() => {
    inflightRequests.delete(coordsString);
  });

  inflightRequests.set(coordsString, requestPromise);
  return requestPromise;
}
