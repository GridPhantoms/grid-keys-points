export type KeySeason = 'Genesis' | 'Exodus';

export type TraitPointGroup = {
  season: KeySeason;
  category: string;
  traits: ReadonlyArray<readonly [name: string, points: number]>;
};

export const TRAIT_POINT_GROUPS: readonly TraitPointGroup[] = [
  { season: 'Genesis', category: 'Grid Dominion', traits: [['Whispering Strike', 200], ['Steady Barrage', 400], ['Ambush Onslaught', 600], ['Intense Blitz', 800], ['Phantom Conquest', 1000]] },
  { season: 'Genesis', category: 'Cloaking Power', traits: [['Quiet Shadow', 200], ['Fading Mist', 400], ['Stealth Barrier', 600], ['Deep Camouflage', 800], ['Phantom Invisibility', 1000]] },
  { season: 'Genesis', category: 'Code Stratagem', traits: [['Emerging Tactic', 200], ['Partial Scheme', 400], ['Intact Blueprint', 600], ['Masterful Hack', 800], ['Phantom Stratagem', 1000]] },
  { season: 'Genesis', category: 'Veil Assault', traits: [['Subtle Slash', 200], ['Surgical Strike', 400], ['Fierce Breach', 600], ['Radiant Charge', 800], ['Phantom Overthrow', 1000]] },
  { season: 'Genesis', category: 'Pulse Fortitude', traits: [['Silent Endurance', 200], ['Iron Constitution', 400], ['Resonant Stamina', 600], ['Radiant Tenacity', 800], ['Phantom Command', 1000]] },
  { season: 'Genesis', category: 'Reward Modulation', traits: [['Genesis', 1000]] },
  { season: 'Exodus', category: 'Aerial Domain', traits: [['Silent Drift', 100], ['Shadow Split', 200], ['Fading Horizon', 300], ['Veil Shatter', 400], ['Exodus Flight', 500]] },
  { season: 'Exodus', category: 'Grid Speed', traits: [['Chrome Blitz', 100], ['Holo Sprint', 200], ['Flux Burst', 300], ['Ghost Overdrive', 400], ['Exodus Warp', 500]] },
  { season: 'Exodus', category: 'Exodus Sovereignty', traits: [['Silent Ascendancy', 100], ['Umbral Rule', 200], ['Spectral Decree', 300], ['Shadow Insurrection', 400], ['Exodus Dominion', 500]] },
  { season: 'Exodus', category: 'Veiled Power', traits: [['Veil Rend', 100], ['Oblivion Strike', 200], ['Grid Surge', 300], ['Eternal Edict', 400], ['Exodus Sprawl', 500]] },
  { season: 'Exodus', category: 'Phantom Weapon', traits: [['Echo Dagger', 100], ['Ghostwire Rifle', 200], ['Reaper Katanas', 300], ['Nebula Cannon', 400], ['Quantum Raygun', 500]] },
  { season: 'Exodus', category: 'Reward Modulation', traits: [['Exodus', 500]] },
] as const;

export const KEY_TRAIT_POINTS: Readonly<Record<string, number>> = Object.fromEntries(
  TRAIT_POINT_GROUPS.flatMap((group) =>
    group.traits.map(([trait, points]) => [`${group.category} - ${trait}`, points]),
  ),
);
