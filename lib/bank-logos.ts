export const BANK_LOGOS = {
  nubank: { name: 'Nubank', file: 'nubank.svg' },
  inter: { name: 'Inter', file: 'inter.svg' },
  c6: { name: 'C6 Bank', file: 'c6.svg' },
  neon: { name: 'Neon', file: 'neon.svg' },
  picpay: { name: 'PicPay', file: 'picpay.svg' },
  'banco-do-brasil': { name: 'Banco do Brasil', file: 'banco-do-brasil.svg' },
  bradesco: { name: 'Bradesco', file: 'bradesco.svg' },
  santander: { name: 'Santander', file: 'santander.svg' },
  caixa: { name: 'Caixa Econômica Federal', file: 'caixa.svg' },
  'mercado-pago': { name: 'Mercado Pago', file: 'mercado-pago.svg' },
  pagseguro: { name: 'PagSeguro', file: 'pagseguro.svg' },
  stone: { name: 'Stone', file: 'stone.svg' },
  xp: { name: 'XP Investimentos', file: 'xp.svg' },
  btg: { name: 'BTG Pactual', file: 'btg.svg' },
} as const;

export type BankLogoKey = keyof typeof BANK_LOGOS;

export function isValidBankLogo(key: string): key is BankLogoKey {
  return key in BANK_LOGOS;
}

export function getBankLogoPath(key: string | null): string | null {
  if (!key || !isValidBankLogo(key)) return null;
  return `/banks/${BANK_LOGOS[key].file}`;
}
