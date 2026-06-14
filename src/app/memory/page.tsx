"use client";

import { useCallback, useEffect, useState } from "react";
import { AddNoteForm } from "@/components/add-note-form";
import { AskPanel } from "@/components/ask-panel";
import { NotesList } from "@/components/notes-list";
import type { BusinessMemory } from "@/types/business-memory";

export default function MemoryPage() {
  const [notes, setNotes] = useState<BusinessMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch("/api/memory");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to load notes");
      }
      const data = await res.json();
      setNotes(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  return (
    <div className="p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Business Memory</h1>
        <p className="mt-1 text-muted">
          Add notes and ask AI questions about your business knowledge
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Add Note</h2>
          <AddNoteForm onNoteAdded={fetchNotes} />
        </section>

        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Ask a Question</h2>
          <AskPanel />
        </section>
      </div>

      <section className="mt-8 rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">
          All Notes {notes.length > 0 && `(${notes.length})`}
        </h2>
        {loading ? (
          <p className="py-8 text-center text-sm text-muted">Loading notes...</p>
        ) : (
          <NotesList notes={notes} onNoteDeleted={fetchNotes} />
        )}
      </section>
    </div>
  );
}
