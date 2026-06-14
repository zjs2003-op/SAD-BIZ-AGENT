export interface CsvNote {
  title: string;
  content: string;
  tags: string[];
}

export function rowToNote(
  row: Record<string, string>,
  fields: string[]
): CsvNote | null {
  if (fields.length === 0) return null;

  const [firstField, ...restFields] = fields;
  const title = (row[firstField] ?? "").trim();

  if (!title) return null;

  const content = restFields
    .map((field) => `${field}: ${(row[field] ?? "").trim()}`)
    .join("\n");

  return {
    title,
    content: content || "(no additional fields)",
    tags: ["csv-import"],
  };
}

export function rowsToNotes(
  rows: Record<string, string>[],
  fields: string[]
): CsvNote[] {
  return rows
    .map((row) => rowToNote(row, fields))
    .filter((note): note is CsvNote => note !== null);
}
