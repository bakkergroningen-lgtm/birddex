import { useState } from 'react';
import Papa from 'papaparse';
import { supabase } from '../lib/supabaseClient';

interface ImportResult {
  success: boolean;
  rows_received?: number;
  new_species_created?: number;
  rows_imported?: number;
  error?: string;
}

export default function ImportEbirdCsv({ onImported }: { onImported?: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setResult(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (parsed) => {
        const rows = (parsed.data as Record<string, string>[]).map((r) => ({
          submissionId: r['Submission ID'] ?? '',
          scientificName: r['Scientific Name'] ?? '',
          commonName: r['Common Name'] ?? '',
          date: r['Date'] ?? '',
          time: r['Time'] ?? '',
          count: r['Count'] ?? '',
          lat: r['Latitude'] ?? '',
          lng: r['Longitude'] ?? '',
        })).filter((r) => r.scientificName && r.date);

        if (rows.length === 0) {
          setResult({ success: false, error: 'Geen bruikbare rijen gevonden in dit bestand.' });
          setBusy(false);
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setResult({ success: false, error: 'Niet ingelogd.' });
          setBusy(false);
          return;
        }

        try {
          const res = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-ebird-csv`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ rows }),
            },
          );
          const json = await res.json();
          setResult(json);
          if (json.success && onImported) onImported();
        } catch (err) {
          setResult({ success: false, error: err instanceof Error ? err.message : String(err) });
        }
        setBusy(false);
      },
      error: (err) => {
        setResult({ success: false, error: err.message });
        setBusy(false);
      },
    });
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="btn btn-secondary btn-sm"
        style={{ width: '100%' }}
      >
        📥 Importeer vanuit eBird
      </button>

      {open && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <ol style={{ fontSize: 13, color: '#6b7a75', paddingLeft: 18, margin: 0 }}>
            <li>Ga naar <a href="https://ebird.org/downloadMyData" target="_blank" rel="noreferrer">ebird.org/downloadMyData</a> en log in met je eBird-account</li>
            <li>Klik op "Download My Data" — je krijgt een e-mail met een downloadlink</li>
            <li>Download het .csv-bestand en upload het hieronder</li>
          </ol>

          <input type="file" accept=".csv" onChange={handleFile} disabled={busy} />

          {busy && <p style={{ fontSize: 14 }}>Bezig met importeren, even geduld...</p>}

          {result && (
            <p style={{ fontSize: 14, color: result.success ? 'var(--color-primary-dark)' : 'var(--color-danger)' }}>
              {result.success
                ? `✅ ${result.rows_imported} waarnemingen geïmporteerd (${result.new_species_created} nieuwe soorten aangemaakt).`
                : `❌ ${result.error}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
