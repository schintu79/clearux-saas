type Props = {
  number: string
  label: string
  centered?: boolean
  dark?: boolean
}

export function SectionMarker({ number, label, centered = false, dark = false }: Props) {
  return (
    <div
      className={`flex items-center gap-3.5 font-mono text-[11px] uppercase tracking-[0.12em] mb-7
        ${dark ? 'text-paper/55' : 'text-m-muted'}
        ${centered ? 'justify-center' : ''}
      `}
    >
      {!centered && (
        <span className={`inline-block w-8 h-px ${dark ? 'bg-paper' : 'bg-ink'}`} />
      )}
      <span className="text-signal font-medium">{number}</span>
      <span>{label}</span>
    </div>
  )
}
