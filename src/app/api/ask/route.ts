import { createServerClient } from "@/lib/supabase/server";
import {
  buildNotesContext,
  resolveSources,
  selectNotesForQuestion,
} from "@/lib/ask-search";
import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const question = body?.question;

    if (!question?.trim()) {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const notes = await selectNotesForQuestion(supabase, question.trim());

    if (notes.length === 0) {
      return NextResponse.json({
        answer:
          "You don't have any notes yet. Add some business notes first, then I can help answer questions about them.",
        sources: [],
      });
    }

    const context = buildNotesContext(notes);
    let answer =
      "Sorry, I couldn't generate an answer. Please try again.";

    try {
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

      answer =
        completion.choices[0]?.message?.content?.trim() ??
        "Sorry, I couldn't generate an answer. Please try again.";
    } catch {
      answer =
        "Sorry, I couldn't reach OpenAI right now. Please try again in a moment.";
    }

    const sources = resolveSources(notes, answer);

    return NextResponse.json({ answer, sources });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
