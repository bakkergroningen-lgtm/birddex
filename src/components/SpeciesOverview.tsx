import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { evaluateAndAwardBadges } from '../lib/badgeLogic';

interface Species {
  id: string;
  naam: string;
  familie: string | null;
  zeldzaamheid: string | null;
}

const RARITY_ORDER: Record<string, number> = {
  zeldzaam: 0,
  'vrij schaars': 1,
  algemeen: 2,
};
const RARITY_PILL_CLASS: Record<string, string> = {
  zeldzaam: 'pill pill-zeldzaam',
  'vrij schaars': 'pill pill-schaars',
  algemeen: 'pill pill-algemeen',
};
const OVERIG = 'Overig';

export default function SpeciesOverview() {
  const [species, setSpecies] = useState<Species[]>([]);
  const [seenSpeciesIds, setSeenSpeciesIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set([OVERIG]));
  const [newBadges, setNewBadges] = useState<string[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      const [{ data: speciesData }, { data: { user } }] = await Promise.all([
        supabase.from('species').select('id, naam, familie, zeldzaamheid'),
        supabase.auth.getUser(),
      ]);

      if (speciesData) setSpecies(speciesData as Species[]);

      let seen = new Set<string>();
      if (user) {
        const { data: logged } = await supabase
          .from('user_sightings')
          .select('species_id')
          .eq('user_id', user.id);
        if (logged) seen = new Set(logged.map((l) => l.species_id));
        setSeenSpeciesIds(seen);
      }

      setLoading(false);

      const before = await supabase.from('user_badges').select('badge_id');
      const beforeIds = new Set((before.data ?? []).map((b) => b.badge_id));
      const allEarned = await evaluateAndAwardBadges();
      const fresh = [...allEarned].filter((id) => !beforeIds.has(id));
      if (fresh.length > 0) setNewBadges(fresh);
    }
    load();
  }, []);

  const grouped = useMemo(() => {
    const byFamily: Record<string, Species[]> = {};
    for (const s of species) {
      const familie = s.familie ?? OVERIG;
      if (!byFamily[familie]) byFamily[familie] = [];
      byFamily[familie].push(s);
    }
    for (const familie in byFamily) {
      byFamily[familie].sort((a, b) => {
        const rarityDiff = (RARITY_ORDER[a.zeldzaamheid ?? ''] ?? 3) - (RARITY_ORDER[b.zeldzaamheid ?? ''] ?? 3);
        if (rarityDiff !== 0) return rarityDiff;
        return a.naam.localeCompare(b.naam);
      });
    }
    return byFamily;
  }, [species]);

  const sortedFamilies = useMemo(() => {
    const families = Object.keys(grouped).filter((f) => f !== OVERIG).sort();
    if (grouped[OVERIG]) families.push(OVERIG);
    return families;
  }, [grouped]);

  const categorizedSpecies = useMemo(() => species.filter((s) => s.familie), [species]);
  const categorizedSeenCount = useMemo(
    () => categorizedSpecies.filter((s) => seenSpeciesIds.has(s.id)).length,
    [categorizedSpecies, seenSpeciesIds],
  );

  function toggleCollapsed(familie: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(familie)) next.delete(familie);
      else next.add(familie);
      return next;
    });
  }

  function familieProgress(familie: string): { seen: number; total: number; pct: number } {
    const list = grouped[familie];
    const seen = list.filter((s) => seenSpeciesIds.has(s.id)).length;
    const total = list.length;
    return { seen, total, pct: total > 0 ? Math.round((seen / total) * 100) : 0 };
  }

  if (loading) return <p style={{ padding: 20 }}>Laden...</p>;

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: 20 }}>
      <h2 style={{ color: 'var(--color-dark)' }}>📱 BirdDex</h2>
      <p style={{ color: '#6b7a75', marginTop: -8 }}>
        {categorizedSeenCount} van de {categorizedSpecies.length} soorten gespot ✓
      </p>

      {newBadges.length > 0 && (
        <div
          className="card"
          style={{ background: 'var(--color-accent)', border: 'none', marginBottom: 20, textAlign: 'center' }}
        >
          🎉 <strong>Nieuwe badge{newBadges.length > 1 ? 's' : ''} behaald!</strong> Bekijk ze op het Badges-tabblad.
        </div>
      )}

      {sortedFamilies.map((familie) => {
        const isOverig = familie === OVERIG;
        const isCollapsed = collapsed.has(familie);
        const progress = !isOverig ? familieProgress(familie) : null;
        const isComplete = progress !== null && progress.pct === 100;

        return (
          <div key={familie} style={{ marginBottom: 24 }}>
            <button
              onClick={() => toggleCollapsed(familie)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                width: '100%',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: '#9aa5a2', transform: isCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.15s' }}>
                  ▾
                </span>
                <h3 style={{ color: isOverig ? '#9aa5a2' : 'var(--color-secondary)', fontSize: 16, margin: 0 }}>
                  {isOverig ? '📦 Overig (nog niet gecategoriseerd)' : familie}
                  {isComplete && ' 🏆'}
                </h3>
              </div>
              {progress && (
                <span style={{ fontSize: 12, fontWeight: 700, color: isComplete ? 'var(--color-primary)' : '#9aa5a2' }}>
                  {progress.seen}/{progress.total} · {progress.pct}%
                </span>
              )}
            </button>

            {progress && (
              <div style={{ height: 6, background: '#eef2f1', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${progress.pct}%`,
                    background: isComplete ? 'var(--color-accent-dark)' : 'var(--color-primary)',
                    transition: 'width 0.3s',
                  }}
                />
              </div>
            )}

            {!isCollapsed && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                {grouped[familie].map((s) => {
                  const seen = seenSpeciesIds.has(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => navigate(`/soorten/${s.id}`)}
                      className="card"
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: 14,
                        textAlign: 'left',
                        cursor: 'pointer',
                        border: seen ? '2px solid var(--color-primary)' : '2px solid #eef2f1',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {seen && <span style={{ color: 'var(--color-primary)', fontSize: 18 }}>✓</span>}
                        <span style={{ fontWeight: 700 }}>{s.naam}</span>
                      </div>
                      <span className={RARITY_PILL_CLASS[s.zeldzaamheid ?? ''] ?? 'pill'}>
                        {s.zeldzaamheid ?? 'onbekend'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
