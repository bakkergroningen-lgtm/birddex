import { supabase } from './supabaseClient';

export interface Badge {
  id: string;
  naam: string;
  beschrijving: string;
  emoji: string;
  criteria_type: 'aantal_soorten' | 'zeldzaamheid_aantal' | 'familie_compleet' | 'tijdstip' | 'compleet';
  criteria_waarde: Record<string, unknown>;
}

interface LoggedSighting {
  species_id: string;
  spotted_at: string;
}

interface SpeciesInfo {
  id: string;
  familie: string | null;
  zeldzaamheid: string | null;
}

/**
 * Bepaalt voor de ingelogde gebruiker welke badges behaald zijn, en werkt
 * de user_badges-tabel bij met nieuw behaalde badges (met de datum van nu).
 * Retourneert de volledige set behaalde badge-ID's (oud + nieuw).
 */
export async function evaluateAndAwardBadges(): Promise<Set<string>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Set();

  const [
    { data: badges, error: badgesErr },
    { data: loggedRaw, error: loggedErr },
    { data: speciesRaw, error: speciesErr },
    { data: alreadyAwarded, error: awardedErr },
  ] = await Promise.all([
    supabase.from('badges').select('*'),
    supabase.from('user_sightings').select('species_id, spotted_at').eq('user_id', user.id),
    supabase.from('species').select('id, familie, zeldzaamheid'),
    supabase.from('user_badges').select('badge_id').eq('user_id', user.id),
  ]);

  if (badgesErr) console.error('evaluateAndAwardBadges: fout bij ophalen badges:', badgesErr.message);
  if (loggedErr) console.error('evaluateAndAwardBadges: fout bij ophalen user_sightings:', loggedErr.message);
  if (speciesErr) console.error('evaluateAndAwardBadges: fout bij ophalen species:', speciesErr.message);
  if (awardedErr) console.error('evaluateAndAwardBadges: fout bij ophalen user_badges:', awardedErr.message);

  const allBadges = (badges ?? []) as Badge[];
  const logged = (loggedRaw ?? []) as LoggedSighting[];
  const allSpecies = (speciesRaw ?? []) as SpeciesInfo[];
  const alreadyAwardedIds = new Set((alreadyAwarded ?? []).map((b) => b.badge_id));

  const speciesById = new Map(allSpecies.map((s) => [s.id, s]));
  const seenSpeciesIds = new Set(logged.map((l) => l.species_id));
  const categorizedSpecies = allSpecies.filter((s) => s.familie);

  const earned = new Set<string>();

  for (const badge of allBadges) {
    let isEarned = false;

    switch (badge.criteria_type) {
      case 'aantal_soorten': {
        const target = badge.criteria_waarde.count as number;
        const categorizedSeen = [...seenSpeciesIds].filter((id) => speciesById.get(id)?.familie);
        isEarned = categorizedSeen.length >= target;
        break;
      }
      case 'zeldzaamheid_aantal': {
        const target = badge.criteria_waarde.count as number;
        const rarity = badge.criteria_waarde.zeldzaamheid as string;
        const matching = [...seenSpeciesIds].filter((id) => speciesById.get(id)?.zeldzaamheid === rarity);
        isEarned = matching.length >= target;
        break;
      }
      case 'familie_compleet': {
        const familie = badge.criteria_waarde.familie as string;
        const speciesInFamilie = categorizedSpecies.filter((s) => s.familie === familie);
        isEarned = speciesInFamilie.length > 0 && speciesInFamilie.every((s) => seenSpeciesIds.has(s.id));
        break;
      }
      case 'tijdstip': {
        const before = badge.criteria_waarde.before as string | undefined;
        const after = badge.criteria_waarde.after as string | undefined;
        isEarned = logged.some((l) => {
          const time = new Date(l.spotted_at).toTimeString().slice(0, 5);
          if (before) return time < before;
          if (after) return time > after;
          return false;
        });
        break;
      }
      case 'compleet': {
        isEarned = categorizedSpecies.length > 0 && categorizedSpecies.every((s) => seenSpeciesIds.has(s.id));
        break;
      }
    }

    if (isEarned) earned.add(badge.id);
  }

  // Nieuw behaalde badges opslaan (badges die al eerder behaald waren, blijven met hun oorspronkelijke datum)
  const newlyEarned = [...earned].filter((id) => !alreadyAwardedIds.has(id));
  if (newlyEarned.length > 0) {
    const { error: insertErr } = await supabase.from('user_badges').insert(
      newlyEarned.map((badge_id) => ({ user_id: user.id, badge_id })),
    );
    if (insertErr) {
      console.error('Fout bij opslaan nieuwe badges:', insertErr.message);
    }
  }

  return new Set([...earned, ...alreadyAwardedIds]);
}