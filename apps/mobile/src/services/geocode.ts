export interface GeocodeResult {
  id: number;
  name: string;
  country: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  timezone: string;
  population?: number;
}

interface OpenMeteoResponse {
  results?: Array<{
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    country?: string;
    admin1?: string;
    timezone?: string;
    population?: number;
  }>;
}

const ENDPOINT = "https://geocoding-api.open-meteo.com/v1/search";

export async function searchCities(query: string, limit = 6): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const url = `${ENDPOINT}?name=${encodeURIComponent(trimmed)}&count=${limit}&language=en&format=json`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as OpenMeteoResponse;
    if (!data.results) return [];
    return data.results
      .filter((r) => r.country && r.timezone)
      .map((r) => ({
        id: r.id,
        name: r.name,
        country: r.country!,
        admin1: r.admin1,
        latitude: r.latitude,
        longitude: r.longitude,
        timezone: r.timezone!,
        population: r.population,
      }));
  } catch {
    return [];
  }
}

export function formatLocation(g: GeocodeResult): string {
  if (g.admin1 && g.admin1 !== g.name) return `${g.name}, ${g.admin1}, ${g.country}`;
  return `${g.name}, ${g.country}`;
}
