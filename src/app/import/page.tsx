import { CsvImporter } from "@/components/csv-importer";

export default function ImportPage() {
  return (
    <div className="p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">CSV Import</h1>
        <p className="mt-1 text-muted">
          Upload a CSV file to bulk-create business memory notes
        </p>
      </header>

      <CsvImporter />
    </div>
  );
}
