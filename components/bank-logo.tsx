import Image from 'next/image';
import { getBankLogoPath } from '@/lib/bank-logos';
import { cn } from '@/lib/utils';

type BankLogoProps = {
  logo: string | null;
  size?: number;
  className?: string;
};

export function BankLogo({ logo, size = 24, className }: BankLogoProps) {
  const logoPath = getBankLogoPath(logo);

  if (!logoPath) return null;

  return (
    <Image
      src={logoPath}
      alt=""
      width={size}
      height={size}
      className={cn('object-contain', className)}
    />
  );
}
