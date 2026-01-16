import { nubankParser } from './nubank';
import { nubankOfxParser } from './nubank-ofx';
import { nubankExtratoParser } from './nubank-extrato';
import { nubankExtratoOfxParser } from './nubank-extrato-ofx';

export const parsers = {
  nubank: nubankParser,
  'nubank-ofx': nubankOfxParser,
  'nubank-extrato': nubankExtratoParser,
  'nubank-extrato-ofx': nubankExtratoOfxParser,
  // Future: itau, bradesco, inter, etc.
} as const;

export type ParserKey = keyof typeof parsers;
export const parserList = Object.values(parsers);
