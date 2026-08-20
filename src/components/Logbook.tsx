import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import ImportEbirdCsv from './ImportEbirdCsv';

interface Species {
  naam: string;
  zeldzaamheid: string | null;
}

interface LogEntry {
  id: string;
  species_id: string;
  spotted_at: string;
  species: Species | null;
}

const RARITY_PILL_CLASS: Record<string, string> = {
  zeldzaam: 'pill pill-zeldzaam',
  'vrij schaars': 'pill pill-schaars',
  algemeen: 'pill pill-algemeen',
};

export default function Logbook() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [speciesList, setSpeciesList] = useState<{ id: string; naam: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const [selectedSpecies, setSelectedSpecies] = useState('');
  const [spottedAt, setSpottedAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [notes, setNotes] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
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
      .select('id, species_id, spotted_at, species(naam, zeldzaamheid)')
      .eq('user_id', user.id)
      .order('spotted_at', { ascending: false });

    if (!error && data) setEntries(data as unknown as LogEntry[]);
    setLoading(false);
  }

  async function loadSpecies() {
    const { data } = await supabase.from('species').select('id, naam').order('naam');
    if (data) setSpeciesList(data);
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setMessage('Locatiebepaling wordt niet ondersteund door deze browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setMessage('Locatie ingesteld ✓');
      },
      (err) => {
        setMessage(`Locatie ophalen mislukt: ${err.message}`);
      },
    );
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
      lat,
      lng,
    });
    setSaving(false);

    if (error) {
      setMessage(`Fout: ${error.message}`);
    } else {
      setMessage('Toegevoegd! 🎉');
      setSelectedSpecies('');
      setNotes('');
      setLat(null);
      setLng(null);
      loadEntries();
    }
  }

  const filteredEntries = useMemo(() => {
    if (!search.trim()) return entries;
    const q = search.toLowerCase();
    return entries.filter((e) => e.species?.naam.toLowerCase().includes(q));
  }, [entries, search]);

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('nl-NL', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  if (loading) return <p style={{ padding: 20 }}>Laden...</p>;

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: 20 }}>
      <h2 style={{ color: 'var(--color-dark)' }}>📖 Mijn logboek</h2>
      <p style={{ color: '#6b7a75', marginTop: -8 }}>{entries.length} waarnemingen</p>

      <ImportEbirdCsv onImported={loadEntries} />

      <input
        className="input"
        type="text"
        placeholder="🔍 Zoek een waarneming op soortnaam..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 16 }}
      />

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
            {speciesList.map((s) => <option key={s.id} value={s.id}>{s.naam}</option>)}
          </select>
          <input className="input" type="datetime-local" value={spottedAt} onChange={(e) => setSpottedAt(e.target.value)} />
          <input className="input" type="text" placeholder="Notitie (optioneel)" value={notes} onChange={(e) => setNotes(e.target.value)} />

          <div>
            <button type="button" onClick={useMyLocation} className="btn btn-accent btn-sm">
              📍 {lat ? 'Locatie ingesteld ✓' : 'Gebruik mijn locatie (optioneel)'}
            </button>
          </div>

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

      {filteredEntries.length === 0 && (
        <p style={{ color: '#6b7a75', textAlign: 'center' }}>
          {search ? 'Geen waarnemingen gevonden voor deze zoekopdracht.' : 'Nog niks gelogd — voeg je eerste waarneming toe!'}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filteredEntries.map((entry) => (
          <button
            key={entry.id}
            onClick={() => navigate(`/logboek/${entry.id}`)}
            className="card"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 14, textAlign: 'left', cursor: 'pointer' }}
          >
            <div>
              <div style={{ fontWeight: 700 }}>{entry.species?.naam ?? 'Onbekende soort'}</div>
              <div style={{ fontSize: 13, color: '#6b7a75' }}>{formatDate(entry.spotted_at)}</div>
            </div>
            <span className={RARITY_PILL_CLASS[entry.species?.zeldzaamheid ?? ''] ?? 'pill'}>
              {entry.species?.zeldzaamheid ?? 'onbekend'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}