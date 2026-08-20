import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../lib/supabaseClient';

type Zeldzaamheid = 'algemeen' | 'vrij schaars' | 'zeldzaam';

const RARITY_COLORS: Record<string, string> = {
  algemeen: '#2d6a4f',
  'vrij schaars': '#e67e22',
  zeldzaam: '#c0392b',
};
const DEFAULT_COLOR = '#7f8c8d';

const iconCache = new Map<string, L.DivIcon>();
function getIconForRarity(rarity: string | null): L.DivIcon {
  const color = (rarity && RARITY_COLORS[rarity]) || DEFAULT_COLOR;
  if (iconCache.has(color)) return iconCache.get(color)!;

  const icon = L.divIcon({
    html: `
      <div style="
        background:${color};
        width:32px; height:32px;
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        display:flex; align-items:center; justify-content:center;
        box-shadow:0 2px 4px rgba(0,0,0,0.35);
        border:2px solid white;
      ">
        <span style="transform:rotate(45deg); font-size:16px; line-height:1;">🐦</span>
      </div>
    `,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
  iconCache.set(color, icon);
  return icon;
}

interface Sighting {
  id: string;
  lat: number;
  lng: number;
  obs_date: string;
  species_id: string;
  species: { naam: string; wetenschappelijke_naam: string; zeldzaamheid: string | null } | null;
}

const ALL_RARITIES: Zeldzaamheid[] = ['algemeen', 'vrij schaars', 'zeldzaam'];

// Haalt "YYYY-MM-DD" uit een obs_date die soms ook een tijd bevat (bijv. "2026-08-18 07:30")
function dayOf(obsDate: string): string {
  return obsDate.slice(0, 10);
}

export default function SightingsMap() {
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRarities, setActiveRarities] = useState<Set<string>>(new Set(ALL_RARITIES));
  const [selectedDay, setSelectedDay] = useState<string>('alle');
  const [searchParams, setSearchParams] = useSearchParams();

  const speciesFilter = searchParams.get('species');

  useEffect(() => {
    async function fetchSightings() {
      const { data, error } = await supabase
        .from('sightings')
        .select('id, lat, lng, obs_date, species_id, species(naam, wetenschappelijke_naam, zeldzaamheid)')
        .order('obs_date', { ascending: false })
        .limit(1000);

      if (error) {
        console.error('Fout bij ophalen sightings:', error.message);
      } else {
        setSightings(data as unknown as Sighting[]);
      }
      setLoading(false);
    }

    fetchSightings();
  }, []);

  function toggleRarity(rarity: string) {
    setActiveRarities((prev) => {
      const next = new Set(prev);
      if (next.has(rarity)) next.delete(rarity);
      else next.add(rarity);
      return next;
    });
  }

  function clearSpeciesFilter() {
    searchParams.delete('species');
    setSearchParams(searchParams);
  }

  // Unieke dagen uit de opgehaalde sightings, meest recent eerst
  const availableDays = useMemo(() => {
    const days = new Set(sightings.map((s) => dayOf(s.obs_date)));
    return Array.from(days).sort((a, b) => b.localeCompare(a));
  }, [sightings]);

  const filteredSightings = useMemo(() => {
    return sightings.filter((s) => {
      if (!activeRarities.has(s.species?.zeldzaamheid ?? '')) return false;
      if (speciesFilter && s.species_id !== speciesFilter) return false;
      if (selectedDay !== 'alle' && dayOf(s.obs_date) !== selectedDay) return false;
      return true;
    });
  }, [sightings, activeRarities, speciesFilter, selectedDay]);

  const filteredSpeciesName = speciesFilter
    ? sightings.find((s) => s.species_id === speciesFilter)?.species?.naam
    : null;

  function formatDay(day: string): string {
    return new Date(day).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  if (loading) return <p style={{ padding: 20 }}>Kaart wordt geladen...</p>;

  return (
    <div style={{ position: 'relative' }}>
      {speciesFilter && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            background: 'var(--color-secondary)',
            color: 'white',
            padding: '8px 16px',
            borderRadius: 999,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontFamily: 'var(--font-heading)',
            fontWeight: 700,
            fontSize: 13,
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
        >
          🔍 {filteredSpeciesName ?? 'Gefilterd op soort'}
          <button
            onClick={clearSpeciesFilter}
            style={{
              background: 'rgba(255,255,255,0.25)',
              border: 'none',
              borderRadius: '50%',
              width: 20,
              height: 20,
              color: 'white',
              cursor: 'pointer',
              fontSize: 12,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Filters rechtsboven */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 1000,
          background: 'white',
          padding: '12px 14px',
          borderRadius: 12,
          boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          maxWidth: 190,
          maxHeight: 'calc(100vh - 140px)',
          overflowY: 'auto',
        }}
      >
        <div>
          <strong style={{ fontSize: 13, fontFamily: 'var(--font-heading)' }}>Zeldzaamheid</strong>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
            {ALL_RARITIES.map((rarity) => (
              <label key={rarity} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <input type="checkbox" checked={activeRarities.has(rarity)} onChange={() => toggleRarity(rarity)} />
                <span
                  style={{
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: RARITY_COLORS[rarity],
                  }}
                />
                {rarity}
              </label>
            ))}
          </div>
        </div>

        <div>
          <strong style={{ fontSize: 13, fontFamily: 'var(--font-heading)' }}>Dag</strong>
          <select
            className="input"
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
            style={{ marginTop: 6, fontSize: 13, padding: '6px 8px' }}
          >
            <option value="alle">Alle dagen</option>
            {availableDays.map((day) => (
              <option key={day} value={day}>{formatDay(day)}</option>
            ))}
          </select>
        </div>

        <div style={{ fontSize: 11, color: '#9aa5a2' }}>
          {filteredSightings.length} van {sightings.length} waarnemingen
        </div>
      </div>

      <MapContainer center={[52.1, 5.3]} zoom={8} style={{ height: 'calc(100vh - 60px)', width: '100%' }}>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-bijdragers &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        {filteredSightings.map((s) => (
          <Marker key={s.id} position={[s.lat, s.lng]} icon={getIconForRarity(s.species?.zeldzaamheid ?? null)}>
            <Popup>
              <strong>{s.species?.naam ?? 'Onbekende soort'}</strong>
              <br />
              <em>{s.species?.wetenschappelijke_naam}</em>
              <br />
              {s.species?.zeldzaamheid ?? 'zeldzaamheid onbekend'}
              <br />
              {s.obs_date}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
