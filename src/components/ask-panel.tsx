"use client";

import { useState } from "react";
import type { AskQuestionResponse } from "@/types/business-memory";

export function AskPanel() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AskQuestionResponse | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to get answer");
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div id="ask">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="question" className="mb-1 block text-sm font-medium">
            Your question
          </label>
          <textarea
            id="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="What were the key decisions from our last strategy meeting?"
            required
            rows={3}
            className="w-full resize-y rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          {loading ? "Thinking..." : "Ask AI"}
        </button>
      </form>

      {result && (
        <div className="mt-6 rounded-lg border border-border bg-slate-50 p-4">
          <h3 className="mb-2 text-sm font-semibold text-foreground">Answer</h3>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {result.answer}
          </p>
          {result.sources.length > 0 && (
            <div className="mt-4 border-t border-border pt-3">
              <p className="text-xs font-medium text-muted">Referenced notes</p>
              <ul className="mt-1 space-y-1">
                {result.sources.map((source) => (
                  <li key={source.id} className="text-xs text-primary">
                    {source.title}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
