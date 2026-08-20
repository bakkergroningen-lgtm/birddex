import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../lib/supabaseClient';

const birdIcon = L.divIcon({
  html: `
    <div style="background:#6969B3; width:32px; height:32px; border-radius:50% 50% 50% 0; transform:rotate(-45deg); display:flex; align-items:center; justify-content:center; box-shadow:0 2px 4px rgba(0,0,0,0.35); border:2px solid white;">
      <span style="transform:rotate(45deg); font-size:16px; line-height:1;">🐦</span>
    </div>
  `,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

interface SightingDetail {
  id: string;
  spotted_at: string;
  notes: string | null;
  lat: number | null;
  lng: number | null;
  species: { naam: string; wetenschappelijke_naam: string; zeldzaamheid: string | null } | null;
}

const RARITY_PILL_CLASS: Record<string, string> = {
  zeldzaam: 'pill pill-zeldzaam',
  'vrij schaars': 'pill pill-schaars',
  algemeen: 'pill pill-algemeen',
};

export default function SightingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [sighting, setSighting] = useState<SightingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!id) return;
      const { data } = await supabase
        .from('user_sightings')
        .select('id, spotted_at, notes, lat, lng, species(naam, wetenschappelijke_naam, zeldzaamheid)')
        .eq('id', id)
        .single();
      setSighting(data as unknown as SightingDetail);
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleDelete() {
    if (!id) return;
    if (!confirm('Weet je zeker dat je deze waarneming wilt verwijderen? Dit kan niet ongedaan gemaakt worden.')) return;

    setDeleting(true);
    const { error } = await supabase.from('user_sightings').delete().eq('id', id);
    setDeleting(false);

    if (error) {
      alert(`Verwijderen mislukt: ${error.message}`);
    } else {
      navigate('/logboek');
    }
  }

  async function handleShare() {
    if (!sighting) return;
    const dateStr = new Date(sighting.spotted_at).toLocaleDateString('nl-NL', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
    const text = `🐦 Ik heb een ${sighting.species?.naam ?? 'vogel'} gespot op ${dateStr}!`;

    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        // gebruiker annuleerde het deelvenster, geen actie nodig
      }
    } else {
      await navigator.clipboard.writeText(text);
      setShareMessage('Gekopieerd naar klembord!');
      setTimeout(() => setShareMessage(null), 2500);
    }
  }

  if (loading) return <p style={{ padding: 20 }}>Laden...</p>;
  if (!sighting) return <p style={{ padding: 20 }}>Waarneming niet gevonden.</p>;

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: 20 }}>
      <button onClick={() => navigate('/logboek')} className="btn btn-outline btn-sm" style={{ marginBottom: 16 }}>
        ← Terug naar logboek
      </button>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ margin: 0 }}>{sighting.species?.naam ?? 'Onbekende soort'}</h2>
            <p style={{ fontStyle: 'italic', color: '#6b7a75', margin: '4px 0' }}>
              {sighting.species?.wetenschappelijke_naam}
            </p>
          </div>
          <span className={RARITY_PILL_CLASS[sighting.species?.zeldzaamheid ?? ''] ?? 'pill'}>
            {sighting.species?.zeldzaamheid ?? 'onbekend'}
          </span>
        </div>

        <p style={{ marginTop: 12 }}>
          📅{' '}
          {new Date(sighting.spotted_at).toLocaleDateString('nl-NL', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
          })}
        </p>

        {sighting.notes && <p style={{ color: '#6b7a75' }}>📝 {sighting.notes}</p>}
      </div>

      {sighting.lat != null && sighting.lng != null ? (
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
          <MapContainer
            center={[sighting.lat, sighting.lng]}
            zoom={12}
            style={{ height: 240, width: '100%' }}
            dragging={false}
            zoomControl={false}
            scrollWheelZoom={false}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; OpenStreetMap-bijdragers &copy; CARTO'
            />
            <Marker position={[sighting.lat, sighting.lng]} icon={birdIcon} />
          </MapContainer>
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', color: '#9aa5a2', marginBottom: 16 }}>
          📍 Geen locatie bekend voor deze waarneming
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleShare} className="btn btn-secondary" style={{ flex: 1 }}>
          📤 Delen
        </button>
        <button onClick={handleDelete} disabled={deleting} className="btn btn-danger" style={{ flex: 1 }}>
          {deleting ? 'Bezig...' : '🗑️ Verwijderen'}
        </button>
      </div>
      {shareMessage && <p style={{ textAlign: 'center', fontSize: 13, marginTop: 8 }}>{shareMessage}</p>}
    </div>
  );
}
