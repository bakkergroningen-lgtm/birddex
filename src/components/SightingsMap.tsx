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

const RECENT_COLOR = { r: 105, g: 105, b: 179 };
const OLD_COLOR = { r: 154, g: 165, b: 162 };
function recencyColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const r = Math.round(OLD_COLOR.r + (RECENT_COLOR.r - OLD_COLOR.r) * clamped);
  const g = Math.round(OLD_COLOR.g + (RECENT_COLOR.g - OLD_COLOR.g) * clamped);
  const b = Math.round(OLD_COLOR.b + (RECENT_COLOR.b - OLD_COLOR.b) * clamped);
  return `rgb(${r},${g},${b})`;
}

const iconCache = new Map<string, L.DivIcon>();
function getIconForColor(color: string): L.DivIcon {
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

type Periode = '2dagen' | '1week' | '1maand' | '3maanden' | '1jaar' | 'alles';
const PERIODE_LABELS: Record<Periode, string> = {
  '2dagen': 'Laatste 2 dagen',
  '1week': 'Laatste week',
  '1maand': 'Laatste maand',
  '3maanden': 'Laatste 3 maanden',
  '1jaar': 'Laatste jaar',
  alles: 'Alles',
};

function periodeToStartDate(periode: Periode): string | null {
  const now = new Date();
  switch (periode) {
    case '2dagen': now.setDate(now.getDate() - 2); break;
    case '1week': now.setDate(now.getDate() - 7); break;
    case '1maand': now.setMonth(now.getMonth() - 1); break;
    case '3maanden': now.setMonth(now.getMonth() - 3); break;
    case '1jaar': now.setFullYear(now.getFullYear() - 1); break;
    case 'alles': return null;
  }
  return now.toISOString().slice(0, 10);
}

function dayOf(obsDate: string): string {
  return obsDate.slice(0, 10);
}

export default function SightingsMap() {
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRarities, setActiveRarities] = useState<Set<string>>(new Set(ALL_RARITIES));
  const [periode, setPeriode] = useState<Periode>('2dagen');
  const [searchParams, setSearchParams] = useSearchParams();

  const speciesFilter = searchParams.get('species');
  const isSpeciesMode = !!speciesFilter;

  useEffect(() => {
    async function fetchSightings() {
      setLoading(true);

      let query = supabase
        .from('sightings')
        .select('id, lat, lng, obs_date, species_id, species(naam, wetenschappelijke_naam, zeldzaamheid)')
        .order('obs_date', { ascending: false })
        .limit(5000);

      if (isSpeciesMode) {
        query = query.eq('species_id', speciesFilter);
      } else {
        const startDate = periodeToStartDate(periode);
        if (startDate) query = query.gte('obs_date', startDate);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Fout bij ophalen sightings:', error.message);
      } else {
        setSightings(data as unknown as Sighting[]);
      }
      setLoading(false);
    }

    fetchSightings();
  }, [periode, speciesFilter, isSpeciesMode]);

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

  const filteredSightings = useMemo(() => {
    if (isSpeciesMode) return sightings;
    return sightings.filter((s) => activeRarities.has(s.species?.zeldzaamheid ?? ''));
  }, [sightings, activeRarities, isSpeciesMode]);

  const dateRangeMs = useMemo(() => {
    if (!isSpeciesMode || filteredSightings.length === 0) return null;
    const times = filteredSightings.map((s) => new Date(dayOf(s.obs_date)).getTime());
    return { min: Math.min(...times), max: Math.max(...times) };
  }, [filteredSightings, isSpeciesMode]);

  function iconFor(s: Sighting): L.DivIcon {
    if (isSpeciesMode && dateRangeMs) {
      const t = new Date(dayOf(s.obs_date)).getTime();
      const span = dateRangeMs.max - dateRangeMs.min;
      const factor = span > 0 ? (t - dateRangeMs.min) / span : 1;
      return getIconForColor(recencyColor(factor));
    }
    const color = (s.species?.zeldzaamheid && RARITY_COLORS[s.species.zeldzaamheid]) || DEFAULT_COLOR;
    return getIconForColor(color);
  }

  const filteredSpeciesName = speciesFilter
    ? sightings.find((s) => s.species_id === speciesFilter)?.species?.naam
    : null;

  if (loading) return <p style={{ padding: 20 }}>Kaart wordt geladen...</p>;

  return (
    <div style={{ position: 'relative' }}>
      {isSpeciesMode && (
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
          🔍 {filteredSpeciesName ?? 'Gefilterd op soort'} — volledige geschiedenis
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
        {!isSpeciesMode && (
          <>
            <div>
              <strong style={{ fontSize: 13, fontFamily: 'var(--font-heading)' }}>Periode</strong>
              <select
                className="input"
                value={periode}
                onChange={(e) => setPeriode(e.target.value as Periode)}
                style={{ marginTop: 6, fontSize: 13, padding: '6px 8px' }}
              >
                {(Object.keys(PERIODE_LABELS) as Periode[]).map((p) => (
                  <option key={p} value={p}>{PERIODE_LABELS[p]}</option>
                ))}
              </select>
            </div>

            <div>
              <strong style={{ fontSize: 13, fontFamily: 'var(--font-heading)' }}>Zeldzaamheid</strong>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                {ALL_RARITIES.map((rarity) => (
                  <label key={rarity} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                    <input type="checkbox" checked={activeRarities.has(rarity)} onChange={() => toggleRarity(rarity)} />
                    <span
                      style={{
                        display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
                        background: RARITY_COLORS[rarity],
                      }}
                    />
                    {rarity}
                  </label>
                ))}
              </div>
            </div>
          </>
        )}

        {isSpeciesMode && (
          <div>
            <strong style={{ fontSize: 13, fontFamily: 'var(--font-heading)' }}>Recentheid</strong>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <div style={{ width: 80, height: 10, borderRadius: 5, background: `linear-gradient(90deg, ${recencyColor(0)}, ${recencyColor(1)})` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9aa5a2', marginTop: 2 }}>
              <span>oud</span>
              <span>nieuw</span>
            </div>
          </div>
        )}

        <div style={{ fontSize: 11, color: '#9aa5a2' }}>
          {filteredSightings.length} waarneming{filteredSightings.length !== 1 ? 'en' : ''}
        </div>
      </div>

      <MapContainer center={[52.1, 5.3]} zoom={8} style={{ height: 'calc(100vh - 60px)', width: '100%' }}>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-bijdragers &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        {filteredSightings.map((s) => (
          <Marker key={s.id} position={[s.lat, s.lng]} icon={iconFor(s)}>
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