import { createServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

interface ImportNote {
  title: string;
  content: string;
  tags?: string[];
}

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const body = await request.json();
  const notes: ImportNote[] = body.notes;

  if (!Array.isArray(notes) || notes.length === 0) {
    return NextResponse.json(
      { error: "At least one note is required" },
      { status: 400 }
    );
  }

  const validNotes = notes
    .filter((n) => n.title?.trim() && n.content?.trim())
    .map((n) => ({
      title: n.title.trim(),
      content: n.content.trim(),
      tags: Array.isArray(n.tags) ? n.tags : ["csv-import"],
    }));

  if (validNotes.length === 0) {
    return NextResponse.json(
      { error: "No valid notes to import" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("business_memory")
    .insert(validNotes as never[])
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { imported: data?.length ?? validNotes.length },
    { status: 201 }
  );
}
