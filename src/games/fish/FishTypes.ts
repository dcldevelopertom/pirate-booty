export type FishRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legend'

export type FishKind = {
  id: string
  name: string
  image: string
  rarity: FishRarity
  coins: number
  speed: number
  scale: number
  depthMin: number
  depthMax: number
  weight: number
}

export const FISH_KINDS: FishKind[] = [
  { id: 'sardine', name: 'Sardine', image: 'images/fish/sardine.png', rarity: 'common', coins: 1, speed: 2.4, scale: 0.9, depthMin: 1.2, depthMax: 4, weight: 12 },
  { id: 'minnow', name: 'Minnow', image: 'images/fish/minnow.png', rarity: 'common', coins: 1, speed: 2.6, scale: 0.85, depthMin: 1.2, depthMax: 4.2, weight: 12 },
  { id: 'guppy', name: 'Guppy', image: 'images/fish/guppy.png', rarity: 'common', coins: 1, speed: 2.2, scale: 0.8, depthMin: 1.4, depthMax: 4.5, weight: 11 },
  { id: 'herring', name: 'Herring', image: 'images/fish/herring.png', rarity: 'common', coins: 1, speed: 2.5, scale: 1.0, depthMin: 1.6, depthMax: 5, weight: 11 },
  { id: 'perch', name: 'Perch', image: 'images/fish/perch.png', rarity: 'common', coins: 1, speed: 1.9, scale: 1.05, depthMin: 1.8, depthMax: 5.2, weight: 10 },
  { id: 'clown', name: 'Clownfish', image: 'images/fish/clown.png', rarity: 'common', coins: 1, speed: 2.1, scale: 0.95, depthMin: 1.5, depthMax: 4.8, weight: 10 },
  { id: 'tang', name: 'Yellow Tang', image: 'images/fish/tang.png', rarity: 'common', coins: 1, speed: 2.3, scale: 1.0, depthMin: 2, depthMax: 5.5, weight: 10 },
  { id: 'snapper', name: 'Snapper', image: 'images/fish/snapper.png', rarity: 'common', coins: 1, speed: 2.0, scale: 1.1, depthMin: 2.2, depthMax: 6, weight: 9 },
  { id: 'wrasse', name: 'Wrasse', image: 'images/fish/wrasse.png', rarity: 'common', coins: 1, speed: 2.2, scale: 1.0, depthMin: 2, depthMax: 5.8, weight: 9 },
  { id: 'catfish', name: 'Catfish', image: 'images/fish/catfish.png', rarity: 'common', coins: 1, speed: 1.5, scale: 1.15, depthMin: 3, depthMax: 7, weight: 8 },
  { id: 'bass', name: 'Bass', image: 'images/fish/bass.png', rarity: 'common', coins: 1, speed: 1.8, scale: 1.1, depthMin: 2.4, depthMax: 6.2, weight: 8 },
  { id: 'whitebait', name: 'Whitebait', image: 'images/fish/whitebait.png', rarity: 'common', coins: 1, speed: 2.8, scale: 0.75, depthMin: 1.2, depthMax: 3.8, weight: 12 },
  { id: 'parrot', name: 'Parrotfish', image: 'images/fish/parrot.png', rarity: 'uncommon', coins: 2, speed: 2.0, scale: 1.25, depthMin: 2.5, depthMax: 7, weight: 6 },
  { id: 'angel', name: 'Angelfish', image: 'images/fish/angel.png', rarity: 'uncommon', coins: 2, speed: 2.1, scale: 1.15, depthMin: 2.2, depthMax: 6.5, weight: 6 },
  { id: 'puffer', name: 'Puffer', image: 'images/fish/puffer.png', rarity: 'uncommon', coins: 2, speed: 1.4, scale: 1.2, depthMin: 2, depthMax: 6, weight: 5 },
  { id: 'lion', name: 'Lionfish', image: 'images/fish/lion.png', rarity: 'uncommon', coins: 2, speed: 1.6, scale: 1.3, depthMin: 3, depthMax: 7.5, weight: 5 },
  { id: 'seahorse', name: 'Seahorse', image: 'images/fish/seahorse.png', rarity: 'uncommon', coins: 2, speed: 1.1, scale: 0.95, depthMin: 1.8, depthMax: 5.5, weight: 5 },
  { id: 'flyer', name: 'Flying Fish', image: 'images/fish/flyer.png', rarity: 'uncommon', coins: 2, speed: 3.4, scale: 1.1, depthMin: 1.4, depthMax: 4.5, weight: 5 },
  { id: 'trigger', name: 'Triggerfish', image: 'images/fish/trigger.png', rarity: 'uncommon', coins: 2, speed: 1.9, scale: 1.2, depthMin: 2.6, depthMax: 6.8, weight: 5 },
  { id: 'grouper', name: 'Grouper', image: 'images/fish/grouper.png', rarity: 'uncommon', coins: 2, speed: 1.5, scale: 1.4, depthMin: 3.2, depthMax: 8, weight: 4 },
  { id: 'tuna', name: 'Tuna', image: 'images/fish/tuna.png', rarity: 'rare', coins: 3, speed: 3.6, scale: 1.5, depthMin: 3.5, depthMax: 8.5, weight: 3 },
  { id: 'koi', name: 'Koi', image: 'images/fish/koi.png', rarity: 'rare', coins: 3, speed: 1.8, scale: 1.25, depthMin: 2, depthMax: 6, weight: 3 },
  { id: 'lantern', name: 'Lanternfish', image: 'images/fish/lantern.png', rarity: 'rare', coins: 3, speed: 2.4, scale: 1.05, depthMin: 5, depthMax: 10, weight: 3 },
  { id: 'eel', name: 'Moray Eel', image: 'images/fish/eel.png', rarity: 'rare', coins: 3, speed: 2.0, scale: 1.6, depthMin: 4, depthMax: 9, weight: 3 },
  { id: 'swordfish', name: 'Swordfish', image: 'images/fish/swordfish.png', rarity: 'rare', coins: 3, speed: 3.8, scale: 1.7, depthMin: 3.8, depthMax: 9, weight: 2 },
  { id: 'marlin', name: 'Marlin', image: 'images/fish/marlin.png', rarity: 'rare', coins: 3, speed: 4.0, scale: 1.75, depthMin: 4, depthMax: 9.5, weight: 2 },
  { id: 'golden-koi', name: 'Golden Koi', image: 'images/fish/golden-koi.png', rarity: 'epic', coins: 5, speed: 2.2, scale: 1.45, depthMin: 2.5, depthMax: 7, weight: 1 },
  { id: 'angler', name: 'Angler', image: 'images/fish/angler.png', rarity: 'epic', coins: 5, speed: 1.7, scale: 1.5, depthMin: 6, depthMax: 10.5, weight: 1 },
  { id: 'jewel', name: 'Jewel Parrot', image: 'images/fish/jewel.png', rarity: 'epic', coins: 5, speed: 2.5, scale: 1.4, depthMin: 3, depthMax: 8, weight: 1 },
  { id: 'ghost', name: 'Ghost Fish', image: 'images/fish/ghost.png', rarity: 'legend', coins: 8, speed: 4.6, scale: 1.8, depthMin: 6.5, depthMax: 11, weight: 1 }
]

export function fishKindById(id: string): FishKind | undefined {
  return FISH_KINDS.find((k) => k.id === id)
}

export function pickFishKind(): FishKind {
  let total = 0
  for (const k of FISH_KINDS) total += k.weight
  let roll = Math.random() * total
  for (const k of FISH_KINDS) {
    roll -= k.weight
    if (roll <= 0) return k
  }
  return FISH_KINDS[0]
}
