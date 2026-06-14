import { createServerClient } from "@/lib/supabase/server";
import {
  eventToNote,
  fetchOrbisXEvents,
  getOrbisXConfig,
  normalizeEvent,
  normalizeEventsPayload,
} from "@/lib/orbisx/client";
import { NextRequest, NextResponse } from "next/server";

const HARD_MAX_IMPORTS = 5;
const LOOKBACK_DAYS = 14;

function lookbackDates() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - LOOKBACK_DAYS);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

async function getImportedEventIds(supabase: ReturnType<typeof createServerClient>) {
  const { data, error } = await supabase
    .from("business_memory")
    .select("content")
    .contains("tags", ["orbisx"])
    .limit(2000);

  if (error) throw new Error(error.message);

  const ids = new Set<string>();
  for (const note of (data ?? []) as { content: string }[]) {
    const match = String(note.content).match(/^event_id:\s*(.+)$/m);
    if (match) ids.add(match[1].trim());
  }
  return ids;
}

export async function GET() {
  const config = getOrbisXConfig();
  return NextResponse.json({
    configured: Boolean(config.apiKey),
    baseUrl: config.baseUrl,
    eventsPath: config.eventsPath,
    authStyle: config.authStyle,
    lookbackDays: LOOKBACK_DAYS,
    maxImportsPerRun: HARD_MAX_IMPORTS,
  });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const importedIds = await getImportedEventIds(supabase);
    const { startDate, endDate } = lookbackDates();

    let events = await fetchOrbisXEvents(startDate, endDate);
    let imported = 0;
    const errors: string[] = [];

    for (const event of events) {
      if (imported >= HARD_MAX_IMPORTS) break;
      if (importedIds.has(event.id)) continue;

      const note = eventToNote(event);
      const { error } = await supabase.from("business_memory").insert({
        title: note.title,
        content: note.content,
        tags: note.tags,
      } as never);

      if (error) {
        errors.push(`${event.id}: ${error.message}`);
        continue;
      }

      importedIds.add(event.id);
      imported += 1;
    }

    return NextResponse.json({
      scanned: events.length,
      imported,
      startDate,
      endDate,
      errors,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "OrbisX sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const events = normalizeEventsPayload(body);

    if (events.length === 0 && body?.id) {
      const single = normalizeEvent(body);
      if (single) events.push(single);
    }

    if (events.length === 0) {
      return NextResponse.json(
        { error: "No OrbisX events found in payload" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const importedIds = await getImportedEventIds(supabase);
    let imported = 0;

    for (const event of events.slice(0, HARD_MAX_IMPORTS)) {
      if (importedIds.has(event.id)) continue;

      const note = eventToNote(event);
      const { error } = await supabase.from("business_memory").insert({
        title: note.title,
        content: note.content,
        tags: note.tags,
      } as never);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      imported += 1;
    }

    return NextResponse.json({ imported });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "OrbisX webhook failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
