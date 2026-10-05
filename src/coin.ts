import { randomInt } from 'node:crypto';

export type CoinSide = 'heads' | 'tails';

export function flip(): CoinSide {
  return randomInt(0, 2) === 0 ? 'heads' : 'tails';
}
