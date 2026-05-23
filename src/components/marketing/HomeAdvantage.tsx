import { SectionMarker } from './SectionMarker'

const ADVANTAGES = [
  {
    title: 'Fix from the dashboard, not a spreadsheet',
    desc: 'Every finding includes a concrete fix. For code issues, preview the diff, edit it, and deploy directly via FTP or SFTP. For content issues, export a clear recommendation to share with your team.',
  },
  {
    title: 'See how AI reads your site',
    desc: 'Fixpath probes multiple LLMs about your business and compares answers to ground truth. It validates structured data, checks AI discovery files, and monitors citation accuracy across models.',
  },
  {
    title: 'Share with your whole team',
    desc: 'Export findings as a PDF or Word report. Share a live link with stakeholders. Push fixes directly to your site. The WordPress plugin surfaces recommendations inside your CMS admin.',
  },
  {
    title: 'Track improvement over time',
    desc: 'Re-audit after making changes to confirm fixes landed. Compare scores side by side, see which fixes had the biggest impact, and prove progress to your team with one clear metric.',
  },
]

export function HomeAdvantage() {
  return (
    <section className="py-[100px] border-b border-rule max-sm:py-16">
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
        <SectionMarker number="03" label="Why Fixpath" />
        <h2
          className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-14"
          style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}
        >
          Audit tools find problems.{' '}
          <em className="italic text-signal">Fixpath fixes them.</em>
        </h2>

        <div className="grid sm:grid-cols-2 gap-x-12 gap-y-14">
          {ADVANTAGES.map((adv) => (
            <div key={adv.title}>
              <h3 className="font-sans text-[16px] font-semibold text-ink mb-3">{adv.title}</h3>
              <p className="font-sans text-[15px] text-ink-2 leading-[1.65]">{adv.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
