import { PIECE_IDS, PieceId } from "./pieces";

/** Simple seedable PRNG (mulberry32) so games can be reproduced from a seed,
 * mirroring the Python trainer's seeded random.Random. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class SevenBag {
  private rng: () => number;
  private bag: PieceId[] = [];

  constructor(rng?: () => number) {
    this.rng = rng ?? Math.random;
  }

  private refill() {
    const bag = [...PIECE_IDS];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    this.bag = bag;
  }

  next(): PieceId {
    if (this.bag.length === 0) this.refill();
    return this.bag.pop()!;
  }
}
