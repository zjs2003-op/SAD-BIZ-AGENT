import { createServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import type { BusinessMemory } from "@/types/business-memory";

async function getStats() {
  const supabase = createServerClient();

  const { data: notes, error } = await supabase
    .from("business_memory")
    .select("id, title, created_at, tags")
    .order("created_at", { ascending: false });

  if (error) {
    return { notes: [] as BusinessMemory[], error: error.message };
  }

  return { notes: notes ?? [], error: null };
}

export default async function DashboardPage() {
  const { notes, error } = await getStats();

  const totalNotes = notes.length;
  const allTags = notes.flatMap((n) => n.tags ?? []);
  const uniqueTags = new Set(allTags).size;
  const recentNotes = notes.slice(0, 5);

  return (
    <div className="p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-1 text-muted">
          Overview of your business knowledge base
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not load data from Supabase: {error}. Make sure your environment
          variables are set and the{" "}
          <code className="rounded bg-red-100 px-1">business_memory</code> table
          exists.
        </div>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Notes" value={totalNotes} />
        <StatCard label="Unique Tags" value={uniqueTags} />
        <StatCard
          label="Latest Note"
          value={
            recentNotes[0]
              ? formatDate(recentNotes[0].created_at)
              : "—"
          }
          small
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Notes</h2>
          <Link
            href="/memory"
            className="text-sm font-medium text-primary hover:text-primary-hover"
          >
            View all →
          </Link>
        </div>

        {recentNotes.length === 0 ? (
          <div className="py-8 text-center text-muted">
            <p>No notes yet.</p>
            <Link
              href="/memory"
              className="mt-2 inline-block text-sm font-medium text-primary hover:text-primary-hover"
            >
              Add your first note
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {recentNotes.map((note) => (
              <li key={note.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-foreground">{note.title}</p>
                  <p className="text-sm text-muted">
                    {formatDate(note.created_at)}
                    {note.tags?.length > 0 && (
                      <span className="ml-2">
                        · {note.tags.join(", ")}
                      </span>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <QuickAction
          title="Add a Note"
          description="Capture meetings, decisions, and ideas"
          href="/memory"
        />
        <QuickAction
          title="Ask Questions"
          description="Query your notes with AI"
          href="/memory#ask"
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  small = false,
}: {
  label: string;
  value: string | number;
  small?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <p className="text-sm text-muted">{label}</p>
      <p
        className={`mt-1 font-bold text-foreground ${
          small ? "text-lg" : "text-3xl"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function QuickAction({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <h3 className="font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted">{description}</p>
    </Link>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
