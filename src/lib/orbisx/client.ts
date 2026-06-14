import type { OrbisXEvent } from "@/types/orbisx";

const DEFAULT_BASE = "https://orbisx.ca";

export function getOrbisXConfig() {
  const apiKey = process.env.ORBISX_API_KEY;
  const baseUrl = (process.env.ORBISX_API_BASE || DEFAULT_BASE).replace(/\/$/, "");
  const eventsPath = process.env.ORBISX_EVENTS_PATH || "/api/v1/events";
  const authStyle = process.env.ORBISX_AUTH_STYLE || "bearer";

  return { apiKey, baseUrl, eventsPath, authStyle };
}

function authHeaders(apiKey: string, authStyle: string): HeadersInit {
  if (authStyle === "api-key") {
    return { "Api-Key": apiKey, Accept: "application/json" };
  }
  if (authStyle === "x-api-key") {
    return { "X-API-KEY": apiKey, Accept: "application/json" };
  }
  return {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
  };
}

export async function fetchOrbisXEvents(
  startDate?: string,
  endDate?: string
): Promise<OrbisXEvent[]> {
  const { apiKey, baseUrl, eventsPath, authStyle } = getOrbisXConfig();

  if (!apiKey) {
    throw new Error("ORBISX_API_KEY is not configured");
  }

  const url = new URL(`${baseUrl}${eventsPath}`);
  if (startDate) url.searchParams.set("start_date", startDate);
  if (endDate) url.searchParams.set("end_date", endDate);

  const response = await fetch(url.toString(), {
    headers: authHeaders(apiKey, authStyle),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OrbisX API ${response.status}: ${body.slice(0, 300)}`);
  }

  const data = await response.json();
  return normalizeEventsPayload(data);
}

export function normalizeEventsPayload(data: unknown): OrbisXEvent[] {
  if (Array.isArray(data)) {
    return data.map(normalizeEvent).filter(Boolean) as OrbisXEvent[];
  }

  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    for (const key of ["events", "data", "results", "items"]) {
      if (Array.isArray(record[key])) {
        return (record[key] as unknown[])
          .map(normalizeEvent)
          .filter(Boolean) as OrbisXEvent[];
      }
    }
  }

  return [];
}

export function normalizeEvent(raw: unknown): OrbisXEvent | null {
  if (!raw || typeof raw !== "object") return null;

  const event = raw as Record<string, unknown>;
  const id = String(
    event.id ?? event.event_id ?? event.eventId ?? event.ID ?? ""
  ).trim();

  if (!id) return null;

  const title = String(
    event.title ??
      event.name ??
      event.service_name ??
      event.serviceName ??
      "OrbisX appointment"
  ).trim();

  const client = String(
    event.client_name ??
      event.clientName ??
      event.customer_name ??
      event.contact ??
      event.full_name ??
      ""
  ).trim();

  const date = String(
    event.event_date ?? event.date ?? event.start_date ?? event.start ?? ""
  ).trim();

  const time = String(
    event.event_time ?? event.time ?? event.start_time ?? ""
  ).trim();

  const details = String(event.details ?? event.description ?? event.notes ?? "").trim();
  const phone = String(event.phone ?? event.client_phone ?? "").trim();
  const email = String(event.email ?? event.client_email ?? "").trim();
  const address = String(event.event_address ?? event.address ?? "").trim();
  const service = String(event.service_name ?? event.serviceName ?? "").trim();
  const status = String(event.status ?? "").trim();

  return {
    id,
    title,
    client,
    date,
    time,
    details,
    phone,
    email,
    address,
    service,
    status,
    raw: event,
  };
}

export function eventToNote(event: OrbisXEvent) {
  const title = event.client
    ? `OrbisX: ${event.client} - ${event.title}`
    : `OrbisX: ${event.title}`;

  const content = [
    `event_id: ${event.id}`,
    event.client && `client: ${event.client}`,
    event.date && `date: ${event.date}`,
    event.time && `time: ${event.time}`,
    event.service && `service: ${event.service}`,
    event.phone && `phone: ${event.phone}`,
    event.email && `email: ${event.email}`,
    event.address && `address: ${event.address}`,
    event.status && `status: ${event.status}`,
    event.details && `details: ${event.details}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    title: title.slice(0, 200),
    content: content || `event_id: ${event.id}`,
    tags: ["orbisx", "calendar"],
  };
}
