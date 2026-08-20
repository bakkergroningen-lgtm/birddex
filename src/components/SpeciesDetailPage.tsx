import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

interface SpeciesDetail {
  id: string;
  naam: string;
  wetenschappelijke_naam: string;
  familie: string | null;
  zeldzaamheid: string | null;
  foto_url: string | null;
  herkenning: string | null;
  leefgebied: string | null;
  voedsel: string | null;
  voortplanting: string | null;
}

const RARITY_PILL_CLASS: Record<string, string> = {
  zeldzaam: 'pill pill-zeldzaam',
  'vrij schaars': 'pill pill-schaars',
  algemeen: 'pill pill-algemeen',
};

function InfoSection({ title, text }: { title: string; text: string | null }) {
  if (!text) return null;
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <h3 style={{ fontSize: 15, color: 'var(--color-secondary)', marginBottom: 6 }}>{title}</h3>
      <p style={{ margin: 0, lineHeight: 1.5 }}>{text}</p>
    </div>
  );
}

export default function SpeciesDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [species, setSpecies] = useState<SpeciesDetail | null>(null);
  const [seen, setSeen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!id) return;
      const { data } = await supabase.from('species').select('*').eq('id', id).single();
      setSpecies(data as SpeciesDetail);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: logged } = await supabase
          .from('user_sightings')
          .select('id')
          .eq('user_id', user.id)
          .eq('species_id', id)
          .limit(1)
          .maybeSingle();
        setSeen(!!logged);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) return <p style={{ padding: 20 }}>Laden...</p>;
  if (!species) return <p style={{ padding: 20 }}>Soort niet gevonden.</p>;

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: 20 }}>
      <button onClick={() => navigate(-1)} className="btn btn-outline btn-sm" style={{ marginBottom: 16 }}>
        ← Terug
      </button>

      <div
        className="card"
        style={{
          textAlign: 'center',
          marginBottom: 20,
          background: seen ? 'var(--color-primary)' : 'var(--color-secondary)',
          color: 'white',
          border: 'none',
        }}
      >
        {seen && <div style={{ fontSize: 13, marginBottom: 4 }}>✓ Al gespot!</div>}
        <h2 style={{ color: 'white', fontSize: 26 }}>{species.naam}</h2>
        <p style={{ fontStyle: 'italic', margin: '4px 0 12px' }}>{species.wetenschappelijke_naam}</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          <span className={RARITY_PILL_CLASS[species.zeldzaamheid ?? ''] ?? 'pill'}>
            {species.zeldzaamheid ?? 'onbekend'}
          </span>
          {species.familie && (
            <span className="pill" style={{ background: 'rgba(255,255,255,0.25)', color: 'white' }}>
              {species.familie}
            </span>
          )}
        </div>
      </div>

      <InfoSection title="🔎 Herkenning" text={species.herkenning} />
      <InfoSection title="🌳 Leefgebied" text={species.leefgebied} />
      <InfoSection title="🍽️ Voedsel" text={species.voedsel} />
      <InfoSection title="🥚 Voortplanting" text={species.voortplanting} />

      {!species.herkenning && (
        <p style={{ color: '#9aa5a2', textAlign: 'center', fontStyle: 'italic' }}>
          Nog geen uitgebreide informatie beschikbaar voor deze soort.
        </p>
      )}

      <button
        onClick={() => navigate(`/?species=${species.id}`)}
        className="btn btn-primary"
        style={{ width: '100%', marginTop: 12 }}
      >
        🗺️ Bekijk waarnemingen op de kaart
      </button>
    </div>
  );
}
