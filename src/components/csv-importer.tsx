"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";
import { rowsToNotes, type CsvNote } from "@/lib/csv-to-notes";

type ParsedRow = Record<string, string>;

export function CsvImporter() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fields, setFields] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [notes, setNotes] = useState<CsvNote[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParseError(null);
    setImportResult(null);
    setImportError(null);

    Papa.parse<ParsedRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        if (results.errors.length > 0) {
          setParseError(results.errors[0].message);
          setRows([]);
          setFields([]);
          setNotes([]);
          return;
        }

        const parsedFields = results.meta.fields ?? [];
        const parsedRows = results.data;

        if (parsedFields.length === 0 || parsedRows.length === 0) {
          setParseError("CSV is empty or has no columns.");
          setRows([]);
          setFields([]);
          setNotes([]);
          return;
        }

        setFields(parsedFields);
        setRows(parsedRows);
        setNotes(rowsToNotes(parsedRows, parsedFields));
      },
      error(err) {
        setParseError(err.message);
        setRows([]);
        setFields([]);
        setNotes([]);
      },
    });
  }

  async function handleImport() {
    if (notes.length === 0) return;

    setImporting(true);
    setImportError(null);
    setImportResult(null);

    try {
      const res = await fetch("/api/memory/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Import failed");
      }

      setImportResult(`Successfully imported ${data.imported} note(s).`);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  function handleReset() {
    setFileName(null);
    setFields([]);
    setRows([]);
    setNotes([]);
    setParseError(null);
    setImportResult(null);
    setImportError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  const previewRows = rows.slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Upload CSV</h2>
        <p className="mb-4 text-sm text-muted">
          The first column becomes the note title. Remaining columns become
          key:value pairs in the note content. All imported notes are tagged{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
            csv-import
          </code>
          .
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          className="block w-full text-sm text-muted file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-primary-hover"
        />

        {fileName && (
          <p className="mt-3 text-sm text-muted">
            Selected: <span className="font-medium text-foreground">{fileName}</span>
            {rows.length > 0 && (
              <span> · {rows.length} row(s) · {notes.length} note(s) ready</span>
            )}
          </p>
        )}

        {parseError && (
          <p className="mt-3 text-sm text-red-600">{parseError}</p>
        )}
      </div>

      {previewRows.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">
            Preview (first {previewRows.length} row
            {previewRows.length !== 1 ? "s" : ""})
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  {fields.map((field) => (
                    <th
                      key={field}
                      className="px-3 py-2 font-medium text-foreground"
                    >
                      {field}
                      {field === fields[0] && (
                        <span className="ml-1 text-xs font-normal text-primary">
                          (title)
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    {fields.map((field) => (
                      <td key={field} className="px-3 py-2 text-muted">
                        {row[field] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {rows.length > 10 && (
            <p className="mt-3 text-xs text-muted">
              + {rows.length - 10} more row(s) will be imported
            </p>
          )}
        </div>
      )}

      {notes.length > 0 && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleImport}
            disabled={importing}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {importing ? "Importing..." : `Import ${notes.length} Note(s)`}
          </button>

          <button
            onClick={handleReset}
            disabled={importing}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            Reset
          </button>
        </div>
      )}

      {importResult && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {importResult}
        </div>
      )}

      {importError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {importError}
        </div>
      )}
    </div>
  );
}
