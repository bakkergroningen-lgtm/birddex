import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { evaluateAndAwardBadges, type Badge } from '../lib/badgeLogic';

interface UserBadge {
  badge_id: string;
  behaald_op: string;
}

export default function BadgesPage() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [earnedMap, setEarnedMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: allBadges, error: badgesErr } = await supabase.from('badges').select('*');
      if (badgesErr) console.error('Fout bij ophalen badges:', badgesErr.message);
      if (allBadges) setBadges(allBadges as Badge[]);

      await evaluateAndAwardBadges();

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userBadges } = await supabase
          .from('user_badges')
          .select('badge_id, behaald_op')
          .eq('user_id', user.id);
        if (userBadges) {
          setEarnedMap(new Map((userBadges as UserBadge[]).map((b) => [b.badge_id, b.behaald_op])));
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <p style={{ padding: 20 }}>Laden...</p>;

  const earned = badges.filter((b) => earnedMap.has(b.id));
  const locked = badges.filter((b) => !earnedMap.has(b.id));

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: 20 }}>
      <h2 style={{ color: 'var(--color-dark)' }}>🏅 Badges</h2>
      <p style={{ color: '#6b7a75', marginTop: -8 }}>
        {earned.length} van de {badges.length} badges behaald
      </p>

      {earned.length > 0 && (
        <>
          <h3 style={{ color: 'var(--color-primary)', fontSize: 15 }}>Behaald</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 24 }}>
            {earned.map((b) => (
              <div key={b.id} className="card" style={{ textAlign: 'center', border: '2px solid var(--color-primary)' }}>
                <div style={{ fontSize: 36 }}>{b.emoji}</div>
                <div style={{ fontWeight: 700, fontSize: 13, marginTop: 4 }}>{b.naam}</div>
                <div style={{ fontSize: 11, color: '#9aa5a2', marginTop: 4 }}>
                  {new Date(earnedMap.get(b.id)!).toLocaleDateString('nl-NL')}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <h3 style={{ color: '#9aa5a2', fontSize: 15 }}>Nog te behalen</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
        {locked.map((b) => (
          <div key={b.id} className="card" style={{ textAlign: 'center', opacity: 0.55, border: '2px solid #eef2f1' }}>
            <div style={{ fontSize: 36, filter: 'grayscale(1)' }}>{b.emoji}</div>
            <div style={{ fontWeight: 700, fontSize: 13, marginTop: 4 }}>{b.naam}</div>
            <div style={{ fontSize: 11, color: '#9aa5a2', marginTop: 4 }}>{b.beschrijving}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
