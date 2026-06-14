import type { createServerClient } from "@/lib/supabase/server";

type SupabaseClient = ReturnType<typeof createServerClient>;

export interface NoteForContext {
  id: string;
  title: string;
  content: string;
  tags: string[];
  created_at: string;
}

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "any",
  "are",
  "been",
  "but",
  "can",
  "could",
  "did",
  "do",
  "does",
  "for",
  "from",
  "had",
  "has",
  "have",
  "how",
  "into",
  "is",
  "its",
  "may",
  "might",
  "must",
  "not",
  "our",
  "should",
  "some",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "was",
  "were",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "will",
  "with",
  "would",
  "you",
  "your",
]);

export function extractSearchTerms(question: string): string[] {
  const terms = question
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));

  return [...new Set(terms)].slice(0, 12);
}

function escapeIlike(term: string): string {
  return term.replace(/[%_\\]/g, "\\$&");
}

async function fetchLatestNotes(
  supabase: SupabaseClient,
  limit: number
): Promise<NoteForContext[]> {
  const { data, error } = await supabase
    .from("business_memory")
    .select("id, title, content, tags, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as NoteForContext[];
}

async function searchNotesByTerms(
  supabase: SupabaseClient,
  terms: string[],
  limit: number
): Promise<NoteForContext[]> {
  const scored = new Map<string, { note: NoteForContext; score: number }>();

  for (const term of terms) {
    const pattern = `%${escapeIlike(term)}%`;

    const { data, error } = await supabase
      .from("business_memory")
      .select("id, title, content, tags, created_at")
      .or(`title.ilike.${pattern},content.ilike.${pattern}`);

    if (error) throw new Error(error.message);

    for (const note of (data ?? []) as NoteForContext[]) {
      const existing = scored.get(note.id);
      if (existing) {
        existing.score += 1;
      } else {
        scored.set(note.id, { note, score: 1 });
      }
    }
  }

  return [...scored.values()]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (
        new Date(b.note.created_at).getTime() -
        new Date(a.note.created_at).getTime()
      );
    })
    .slice(0, limit)
    .map((entry) => entry.note);
}

export async function selectNotesForQuestion(
  supabase: SupabaseClient,
  question: string
): Promise<NoteForContext[]> {
  const terms = extractSearchTerms(question);

  if (terms.length > 0) {
    const matches = await searchNotesByTerms(supabase, terms, 30);
    if (matches.length > 0) return matches;
  }

  return fetchLatestNotes(supabase, 20);
}

export function buildNotesContext(notes: NoteForContext[]): string {
  return notes
    .map(
      (note, i) =>
        `[Note ${i + 1}]
ID: ${note.id}
Title: ${note.title}
Tags: ${(note.tags ?? []).join(", ") || "none"}
Content:
${note.content}`
    )
    .join("\n\n---\n\n");
}

export function resolveSources(
  notes: NoteForContext[],
  answer: string
): { id: string; title: string }[] {
  const citedSources = notes
    .filter((note) =>
      answer.toLowerCase().includes(note.title.toLowerCase())
    )
    .map((note) => ({ id: note.id, title: note.title }));

  if (citedSources.length > 0) return citedSources;

  return notes.slice(0, 3).map((note) => ({ id: note.id, title: note.title }));
}
