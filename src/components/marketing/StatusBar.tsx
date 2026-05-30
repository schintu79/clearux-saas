export function StatusBar() {
  return (
    <div className="border-b border-rule sticky top-0 z-50 backdrop-blur-md" style={{ background: 'color-mix(in srgb, var(--paper) 92%, transparent)' }}>
      <div className="flex items-center justify-between px-8 py-3.5 font-mono text-[11px] tracking-[0.08em] uppercase text-m-muted max-w-mkt mx-auto">
        <div className="flex gap-7 items-center">
          <span className="flex items-center">
            <span className="inline-block w-[7px] h-[7px] rounded-full bg-ok mr-2" style={{ animation: 'm-pulse 2.4s infinite' }} />
            Audit engine · Nominal
          </span>
          <span>Edition 04 · Vol. 01</span>
        </div>
        <div>112 / 7 / 99</div>
      </div>
    </div>
  )
}
