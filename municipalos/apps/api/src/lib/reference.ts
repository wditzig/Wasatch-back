import { randomInt } from "node:crypto";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** e.g. "CR-7K3M9Q2X": 40 bits of randomness, so references cannot be enumerated in sequence. */
export function generateReference(prefix: string): string {
  let out = "";
  for (let i = 0; i < 8; i++) out += CROCKFORD[randomInt(CROCKFORD.length)];
  return `${prefix}-${out}`;
}
