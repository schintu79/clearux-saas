import Link from 'next/link'

type Props = {
  className?: string
  size?: number
}

export function Logo({ className = '', size = 30 }: Props) {
  return (
    <Link href="/" className={`flex items-center gap-2.5 no-underline ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-signal block shrink-0"
      >
        <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="2.5" fill="none" />
        <circle cx="16" cy="16" r="5.5" fill="currentColor" />
      </svg>
      <span className="font-sans font-bold text-[26px] leading-none tracking-[-0.025em] text-ink">
        ClearUX
      </span>
    </Link>
  )
}
