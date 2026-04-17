import Image from 'next/image';

interface LogoProps {
  className?: string;
  height?: number;
  variant?: 'dark' | 'light' | 'lime' | 'lime-cta';
}

/**
 * ClearUX SVG logo. Uses CSS filter to switch between dark/light/lime variants.
 * - dark: black logo (default, for light backgrounds)
 * - light: white logo (for dark backgrounds like footer, hero)
 * - lime: lime/green logo (for dark backgrounds like footer)
 * - lime-cta: dark logo (for lime backgrounds like final CTA)
 */
const Logo: React.FC<LogoProps> = ({ className = '', height = 22, variant = 'dark' }) => {
  const filterStyle =
    variant === 'light'
      ? { filter: 'brightness(0) invert(1)' }
      : variant === 'lime'
        ? { filter: 'brightness(0) invert(1) sepia(1) saturate(50) hue-rotate(30deg) brightness(1.5)' }
        : variant === 'lime-cta'
          ? { filter: 'brightness(0)' }
          : {};

  return (
    <Image
      src="/logo.svg"
      alt="ClearUX"
      width={Math.round(height * (792 / 210))}
      height={height}
      className={className}
      style={filterStyle}
      priority
    />
  );
};

export default Logo;
