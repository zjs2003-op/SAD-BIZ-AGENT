"use client";

import type { BusinessMemory } from "@/types/business-memory";

interface NotesListProps {
  notes: BusinessMemory[];
  onNoteDeleted: () => void;
}

export function NotesList({ notes, onNoteDeleted }: NotesListProps) {
  async function handleDelete(id: string) {
    if (!confirm("Delete this note?")) return;

    const res = await fetch(`/api/memory/${id}`, { method: "DELETE" });
    if (res.ok) {
      onNoteDeleted();
    }
  }

  if (notes.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted">
        No notes yet. Add one using the form.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {notes.map((note) => (
        <li key={note.id} className="py-4 first:pt-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-foreground">{note.title}</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted">
                {note.content}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted">
                  {formatDate(note.created_at)}
                </span>
                {note.tags?.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={() => handleDelete(note.id)}
              className="shrink-0 text-xs text-red-500 hover:text-red-700"
            >
              Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
