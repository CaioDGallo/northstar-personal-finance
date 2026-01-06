import { nubankParser } from './nubank';
import { nubankExtratoParser } from './nubank-extrato';

export const parsers = {
  nubank: nubankParser,
  'nubank-extrato': nubankExtratoParser,
  // Future: itau, bradesco, inter, etc.
} as const;

export type ParserKey = keyof typeof parsers;
export const parserList = Object.values(parsers);
