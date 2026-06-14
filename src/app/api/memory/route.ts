import { createServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("business_memory")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const body = await request.json();

  const { title, content, tags } = body;

  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json(
      { error: "Title and content are required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
  .from("business_memory")
  .insert({
    title: title.trim(),
    content: content.trim(),
    tags: Array.isArray(tags) ? tags : [],
  } as any) 
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
