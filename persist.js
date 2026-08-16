const BEST_URL = "/api/kv/pilgrim:best";
const ROUTES_URL = "/api/kv/pilgrim:routes";

export async function loadBest(fetcher = fetch) {
  try {
    const response = await fetcher(BEST_URL);
    if (!response.ok) return 0;
    const score = Number(await response.text());
    return Number.isFinite(score) && score >= 0 ? score : 0;
  } catch {
    return 0;
  }
}

export async function saveBest(score, currentBest = 0, fetcher = fetch) {
  const nextBest = Math.max(Number(score) || 0, Number(currentBest) || 0);
  if (nextBest <= currentBest) return currentBest;
  try {
    await fetcher(BEST_URL, { method: "PUT", body: String(nextBest) });
  } catch {
    // Static previews do not provide the Playgrounds KV API.
  }
  return nextBest;
}

export async function loadRoutes(fetcher = fetch) {
  try {
    const response = await fetcher(ROUTES_URL);
    if (!response.ok) return [];
    const routes = JSON.parse(await response.text());
    return Array.isArray(routes) ? routes.slice(0, 5) : [];
  } catch {
    return [];
  }
}

export async function saveRoute(route, currentRoutes = [], fetcher = fetch) {
  const routes = [route, ...currentRoutes].slice(0, 5);
  try {
    await fetcher(ROUTES_URL, {
      method: "PUT",
      body: JSON.stringify(routes),
    });
  } catch {
    // Keep the local result visible even when KV is unavailable.
  }
  return routes;
}
