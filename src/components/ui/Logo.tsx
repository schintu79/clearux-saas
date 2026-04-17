import Image from 'next/image';

interface LogoProps {
  className?: string;
  height?: number;
  variant?: 'dark' | 'light' | 'lime-cta';
}

/**
 * ClearUX SVG logo. Uses CSS filter to switch between dark/light/lime variants.
 * - dark: black logo (default, for light backgrounds)
 * - light: white logo (for dark backgrounds like footer, hero)
 * - lime-cta: dark logo (for lime backgrounds like final CTA)
 */
const Logo: React.FC<LogoProps> = ({ className = '', height = 22, variant = 'dark' }) => {
  const filterStyle =
    variant === 'light'
      ? { filter: 'brightness(0) invert(1)' }
      : variant === 'lime-cta'
        ? { filter: 'brightness(0)' }
        : {};

  return (
    <Image
      src="/logo.svg"
      alt="ClearUX"
      width={Math.round(height * (710 / 105))}
      height={height}
      className={className}
      style={filterStyle}
      priority
    />
  );
};

export default Logo;
