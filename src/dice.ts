import { randomInt } from 'node:crypto';

export const MAX_SIDES = 10_000;

export type DiceErrorCode =
  | 'NOT_AN_INTEGER'
  | 'TOO_FEW_SIDES'
  | 'OUT_OF_RANGE'
  | 'INVALID_SIDES';

export class DiceError extends Error {
  readonly code: DiceErrorCode;
  readonly received: unknown;

  constructor(code: DiceErrorCode, received: unknown) {
    super(code);
    this.name = 'DiceError';
    this.code = code;
    this.received = received;
  }
}

export function validateSides(sides: unknown): number {
  if (typeof sides !== 'number' || !Number.isInteger(sides)) {
    throw new DiceError('NOT_AN_INTEGER', sides);
  }
  if (sides < 2) {
    throw new DiceError('TOO_FEW_SIDES', sides);
  }
  if (sides > MAX_SIDES) {
    throw new DiceError('OUT_OF_RANGE', sides);
  }
  return sides;
}

export function roll(sides: number): number {
  return randomInt(1, sides + 1);
}