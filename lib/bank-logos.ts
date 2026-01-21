export const BANK_LOGOS = {
  // Top traditional banks
  itau: { name: 'Itaú Unibanco', file: 'itau.svg' },
  'banco-do-brasil': { name: 'Banco do Brasil', file: 'banco-do-brasil.svg' },
  bradesco: { name: 'Bradesco', file: 'bradesco.svg' },
  caixa: { name: 'Caixa Econômica Federal', file: 'caixa.svg' },
  santander: { name: 'Santander', file: 'santander.svg' },
  btg: { name: 'BTG Pactual', file: 'btg.svg' },
  safra: { name: 'Safra', file: 'safra.svg' },

  // Digital/Fintech banks
  nubank: { name: 'Nubank', file: 'nubank.svg' },
  inter: { name: 'Inter', file: 'inter.svg' },
  c6: { name: 'C6 Bank', file: 'c6.svg' },
  original: { name: 'Banco Original', file: 'original.svg' },
  neon: { name: 'Neon', file: 'neon.svg' },

  // Payment institutions
  'mercado-pago': { name: 'Mercado Pago', file: 'mercado-pago.svg' },
  pagseguro: { name: 'PagSeguro', file: 'pagseguro.svg' },
  stone: { name: 'Stone', file: 'stone.svg' },
  picpay: { name: 'PicPay', file: 'picpay.svg' },

  // Investment banks
  xp: { name: 'XP Investimentos', file: 'xp.svg' },

  // Regional banks
  votorantim: { name: 'Banco Votorantim', file: 'votorantim.svg' },
  banrisul: { name: 'Banrisul', file: 'banrisul.svg' },
  brb: { name: 'BRB', file: 'brb.svg' },
  daycoval: { name: 'Banco Daycoval', file: 'daycoval.svg' },
  pine: { name: 'Banco Pine', file: 'pine.svg' },
  bmg: { name: 'Banco BMG', file: 'bmg.svg' },
  mercantil: { name: 'Banco Mercantil', file: 'mercantil.svg' },
  paulista: { name: 'Banco Paulista', file: 'paulista.svg' },
  sofisa: { name: 'Banco Sofisa', file: 'sofisa.svg' },
  'abc-brasil': { name: 'ABC Brasil', file: 'abc-brasil.svg' },

  // Cooperative banks
  sicoob: { name: 'Sicoob', file: 'sicoob.svg' },
  sicredi: { name: 'Sicredi', file: 'sicredi.svg' },
  unicred: { name: 'Unicred', file: 'unicred.svg' },
} as const;

export type BankLogoKey = keyof typeof BANK_LOGOS;

export function isValidBankLogo(key: string): key is BankLogoKey {
  return key in BANK_LOGOS;
}

export function getBankLogoPath(key: string | null): string | null {
  if (!key || !isValidBankLogo(key)) return null;
  return `/banks/${BANK_LOGOS[key].file}`;
}
