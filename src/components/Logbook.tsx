import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import ImportEbirdCsv from './ImportEbirdCsv';

interface Species {
  id: string;
  naam: string;
  zeldzaamheid: string | null;
  familie: string | null;
}

interface LogEntry {
  id: string;
  species_id: string;
  spotted_at: string;
  notes: string | null;
  species: Species | null;
}

const RARITY_ORDER = ['zeldzaam', 'vrij schaars', 'algemeen'];
const RARITY_LABELS: Record<string, string> = {
  zeldzaam: '🔴 Zeldzaam',
  'vrij schaars': '🟠 Vrij schaars',
  algemeen: '🟢 Algemeen',
};
const RARITY_PILL_CLASS: Record<string, string> = {
  zeldzaam: 'pill pill-zeldzaam',
  'vrij schaars': 'pill pill-schaars',
  algemeen: 'pill pill-algemeen',
};

export default function Logbook() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [speciesList, setSpeciesList] = useState<Species[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedSpecies, setSelectedSpecies] = useState('');
  const [spottedAt, setSpottedAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadEntries();
    loadSpecies();
  }, []);

  async function loadEntries() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('user_sightings')
      .select('id, species_id, spotted_at, notes, species(id, naam, zeldzaamheid, familie)')
      .eq('user_id', user.id)
      .order('spotted_at', { ascending: false });

    if (!error && data) setEntries(data as unknown as LogEntry[]);
    setLoading(false);
  }

  async function loadSpecies() {
    const { data } = await supabase.from('species').select('id, naam, zeldzaamheid, familie').order('naam');
    if (data) setSpeciesList(data as Species[]);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (!selectedSpecies) {
      setMessage('Kies een soort.');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setSaving(true);
    const { error } = await supabase.from('user_sightings').insert({
      user_id: user.id,
      species_id: selectedSpecies,
      spotted_at: new Date(spottedAt).toISOString(),
      notes: notes || null,
    });
    setSaving(false);

    if (error) {
      setMessage(`Fout: ${error.message}`);
    } else {
      setMessage('Toegevoegd aan je logboek! 🎉');
      setSelectedSpecies('');
      setNotes('');
      loadEntries();
    }
  }

  const grouped = useMemo(() => {
    const byRarity: Record<string, Record<string, { species: Species; count: number; lastSeen: string }>> = {};
    for (const entry of entries) {
      if (!entry.species) continue;
      const rarity = entry.species.zeldzaamheid ?? 'onbekend';
      const speciesId = entry.species.id;
      if (!byRarity[rarity]) byRarity[rarity] = {};
      if (!byRarity[rarity][speciesId]) {
        byRarity[rarity][speciesId] = { species: entry.species, count: 0, lastSeen: entry.spotted_at };
      }
      byRarity[rarity][speciesId].count += 1;
      if (entry.spotted_at > byRarity[rarity][speciesId].lastSeen) {
        byRarity[rarity][speciesId].lastSeen = entry.spotted_at;
      }
    }
    return byRarity;
  }, [entries]);

  const totalSpecies = new Set(entries.map((e) => e.species_id)).size;

  if (loading) return <p style={{ padding: 20 }}>Laden...</p>;

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: 20 }}>
      <h2 style={{ color: 'var(--color-dark)' }}>📖 Mijn logboek</h2>

      <ImportEbirdCsv onImported={loadEntries} />

      <div
        className="card"
        style={{
          display: 'flex',
          justifyContent: 'space-around',
          textAlign: 'center',
          marginBottom: 20,
          background: 'var(--color-primary)',
          color: 'white',
          border: 'none',
        }}
      >
        <div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 28, fontWeight: 800 }}>{totalSpecies}</div>
          <div style={{ fontSize: 13 }}>soorten</div>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 28, fontWeight: 800 }}>{entries.length}</div>
          <div style={{ fontSize: 13 }}>waarnemingen</div>
        </div>
      </div>

      {!showForm && (
        <button className="btn btn-primary" style={{ width: '100%', marginBottom: 20 }} onClick={() => setShowForm(true)}>
          + Nieuwe waarneming
        </button>
      )}

      {showForm && (
        <form onSubmit={handleAdd} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          <strong style={{ fontFamily: 'var(--font-heading)' }}>Nieuwe waarneming toevoegen</strong>
          <select className="input" value={selectedSpecies} onChange={(e) => setSelectedSpecies(e.target.value)}>
            <option value="">Kies een soort...</option>
            {speciesList.map((s) => (
              <option key={s.id} value={s.id}>{s.naam}</option>
            ))}
          </select>
          <input
            className="input"
            type="datetime-local"
            value={spottedAt}
            onChange={(e) => setSpottedAt(e.target.value)}
          />
          <input
            className="input"
            type="text"
            placeholder="Notitie (optioneel)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          {message && <p style={{ fontSize: 14, margin: 0 }}>{message}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>
              {saving ? 'Bezig...' : 'Toevoegen'}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>
              Annuleren
            </button>
          </div>
        </form>
      )}

      {entries.length === 0 && (
        <p style={{ color: '#6b7a75', textAlign: 'center' }}>Nog niks gelogd — voeg je eerste waarneming toe!</p>
      )}

      {RARITY_ORDER.filter((r) => grouped[r]).map((rarity) => (
        <div key={rarity} style={{ marginBottom: 24 }}>
          <h3 style={{ color: 'var(--color-dark)' }}>
            {RARITY_LABELS[rarity]} <span style={{ color: '#9aa5a2', fontWeight: 600 }}>({Object.keys(grouped[rarity]).length})</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.values(grouped[rarity])
              .sort((a, b) => a.species.naam.localeCompare(b.species.naam))
              .map(({ species, count, lastSeen }) => (
                <div
                  key={species.id}
                  className="card"
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 14 }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>{species.naam}</div>
                    {species.familie && <div style={{ color: '#9aa5a2', fontSize: 13 }}>{species.familie}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className={RARITY_PILL_CLASS[rarity] ?? 'pill'}>{count}×</span>
                    <div style={{ fontSize: 12, color: '#9aa5a2', marginTop: 4 }}>
                      {new Date(lastSeen).toLocaleDateString('nl-NL')}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
