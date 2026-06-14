import { createServerClient } from "@/lib/supabase/server";
import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured" },
      { status: 500 }
    );
  }

  const { question } = await request.json();

  if (!question?.trim()) {
    return NextResponse.json(
      { error: "Question is required" },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  const { data: notes, error } = await supabase
    .from("business_memory")
    .select("id, title, content, tags, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!notes || notes.length === 0) {
    return NextResponse.json({
      answer:
        "You don't have any notes yet. Add some business notes first, then I can help answer questions about them.",
      sources: [],
    });
  }

  const context = (notes as any[])
  .map(
    (note, i) =>
      `[Note ${i + 1}] ID: ${note.id}\nTitle: ${note.title}\nTags: ${(note.tags ?? []).join(", ")}`
  )
  .join("\n\n---\n\n");

  const openai = new OpenAI({ apiKey });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a helpful business assistant. Answer questions based ONLY on the provided business notes. If the answer isn't in the notes, say so clearly. Be concise and cite which note titles you used. Here are the notes:

${context}`,
      },
      {
        role: "user",
        content: question.trim(),
      },
    ],
    temperature: 0.3,
  });

  const answer =
    completion.choices[0]?.message?.content ??
    "Sorry, I couldn't generate an answer.";

    const citedSources = (notes as any[])
    .filter((note) =>
      answer.toLowerCase().includes(note.title.toLowerCase())
    )
    .map((note) => ({ id: note.id, title: note.title }));

  const sources =
    citedSources.length > 0
      ? citedSources
      : (notes as any[]).slice(0, 3).map((n) => ({ id: n.id, title: n.title }));

  return NextResponse.json({ answer, sources });
}
