import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { enablePushNotifications } from '../lib/pushNotifications';

interface Species {
  id: string;
  naam: string;
}

interface AlertRow {
  id: string;
  species_id: string | null;
  zeldzaamheid: string | null;
  alleen_ongelogd: boolean;
  lat: number;
  lng: number;
  radius_km: number;
  active: boolean;
}

const RARITY_OPTIONS = ['algemeen', 'vrij schaars', 'zeldzaam'];

export default function AlertSettings() {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [speciesList, setSpeciesList] = useState<Species[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushMessage, setPushMessage] = useState<string | null>(null);

  const [filterType, setFilterType] = useState<'species' | 'rarity' | 'ongelogd'>('ongelogd');
  const [selectedSpecies, setSelectedSpecies] = useState('');
  const [selectedRarity, setSelectedRarity] = useState('zeldzaam');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [radiusKm, setRadiusKm] = useState(25);
  const [saving, setSaving] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);

  useEffect(() => {
    loadAlerts();
    loadSpecies();
  }, []);

  async function loadAlerts() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('user_alerts_with_coords')
      .select('id, species_id, zeldzaamheid, alleen_ongelogd, lat, lng, radius_km, active')
      .eq('user_id', user.id)
      .order('id', { ascending: true });

    if (!error && data) setAlerts(data as AlertRow[]);
    setLoading(false);
  }

  async function loadSpecies() {
    const { data } = await supabase.from('species').select('id, naam').order('naam');
    if (data) setSpeciesList(data as Species[]);
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setFormMessage('Locatiebepaling wordt niet ondersteund door je browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setFormMessage(null);
      },
      () => setFormMessage("Kon je locatie niet ophalen. Vul 'm eventueel handmatig in."),
    );
  }

  async function handleAddAlert(e: React.FormEvent) {
    e.preventDefault();
    setFormMessage(null);

    if (lat === null || lng === null) {
      setFormMessage('Stel eerst een locatie in.');
      return;
    }
    if (filterType === 'species' && !selectedSpecies) {
      setFormMessage('Kies een soort.');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setSaving(true);

    const { error } = await supabase.from('user_alerts').insert({
      user_id: user.id,
      species_id: filterType === 'species' ? selectedSpecies : null,
      zeldzaamheid: filterType === 'rarity' ? selectedRarity : null,
      alleen_ongelogd: filterType === 'ongelogd',
      location: `POINT(${lng} ${lat})`,
      radius_km: radiusKm,
      active: true,
    });

    setSaving(false);
    if (error) {
      setFormMessage(`Fout: ${error.message}`);
    } else {
      setFormMessage('Alert toegevoegd! 🎉');
      loadAlerts();
    }
  }

  async function toggleActive(alert: AlertRow) {
    await supabase.from('user_alerts').update({ active: !alert.active }).eq('id', alert.id);
    loadAlerts();
  }

  async function deleteAlert(id: string) {
    await supabase.from('user_alerts').delete().eq('id', id);
    loadAlerts();
  }

  async function handleEnablePush() {
    setPushMessage('Bezig...');
    const result = await enablePushNotifications();
    setPushMessage(result.message);
  }

  function describeAlert(a: AlertRow): string {
    if (a.alleen_ongelogd) return '🆕 Nog niet gelogde soorten';
    if (a.species_id) {
      const sp = speciesList.find((s) => s.id === a.species_id);
      return `Soort: ${sp?.naam ?? a.species_id}`;
    }
    if (a.zeldzaamheid) return `Zeldzaamheid: ${a.zeldzaamheid}`;
    return 'Alle soorten';
  }

  if (loading) return <p style={{ padding: 20 }}>Laden...</p>;

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 20 }}>
      <h2 style={{ color: 'var(--color-dark)' }}>🔔 Pushmeldingen</h2>
      <button onClick={handleEnablePush} className="btn btn-secondary" style={{ width: '100%', marginBottom: 8 }}>
        Pushmeldingen activeren op dit apparaat
      </button>
      {pushMessage && <p style={{ fontSize: 14 }}>{pushMessage}</p>}

      <h2 style={{ color: 'var(--color-dark)', marginTop: 32 }}>Mijn alerts</h2>
      {alerts.length === 0 && <p style={{ color: '#6b7a75' }}>Nog geen alerts ingesteld.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        {alerts.map((a) => (
          <div
            key={a.id}
            className="card"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 14,
              opacity: a.active ? 1 : 0.5,
            }}
          >
            <div>
              <strong>{describeAlert(a)}</strong>
              <div style={{ fontSize: 13, color: '#6b7a75' }}>Straal: {a.radius_km} km</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => toggleActive(a)} className="btn btn-outline btn-sm">
                {a.active ? 'Pauzeren' : 'Activeren'}
              </button>
              <button onClick={() => deleteAlert(a.id)} className="btn btn-danger btn-sm">
                Verwijderen
              </button>
            </div>
          </div>
        ))}
      </div>

      <h2 style={{ color: 'var(--color-dark)' }}>Nieuwe alert toevoegen</h2>
      <form onSubmit={handleAddAlert} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="radio" checked={filterType === 'ongelogd'} onChange={() => setFilterType('ongelogd')} />
            🆕 Nog niet gelogde soorten
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="radio" checked={filterType === 'rarity'} onChange={() => setFilterType('rarity')} />
            Op zeldzaamheid
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="radio" checked={filterType === 'species'} onChange={() => setFilterType('species')} />
            Op specifieke soort
          </label>
        </div>

        {filterType === 'rarity' && (
          <select className="input" value={selectedRarity} onChange={(e) => setSelectedRarity(e.target.value)}>
            {RARITY_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        )}
        {filterType === 'species' && (
          <select className="input" value={selectedSpecies} onChange={(e) => setSelectedSpecies(e.target.value)}>
            <option value="">Kies een soort...</option>
            {speciesList.map((s) => <option key={s.id} value={s.id}>{s.naam}</option>)}
          </select>
        )}

        <div>
          <button type="button" onClick={useMyLocation} className="btn btn-accent btn-sm" style={{ marginBottom: 8 }}>
            📍 Gebruik mijn huidige locatie
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" type="number" step="0.0001" placeholder="Breedtegraad" value={lat ?? ''} onChange={(e) => setLat(parseFloat(e.target.value))} />
            <input className="input" type="number" step="0.0001" placeholder="Lengtegraad" value={lng ?? ''} onChange={(e) => setLng(parseFloat(e.target.value))} />
          </div>
        </div>

        <div>
          <label style={{ fontWeight: 700 }}>Straal: {radiusKm} km</label>
          <input type="range" min={1} max={200} value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))} style={{ width: '100%' }} />
        </div>

        {formMessage && <p style={{ margin: 0 }}>{formMessage}</p>}

        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? 'Bezig...' : 'Alert toevoegen'}
        </button>
      </form>
    </div>
  );
}
