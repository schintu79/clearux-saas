import { SectionMarker } from './SectionMarker'

const ADVANTAGES = [
  {
    title: 'Not just another audit checklist',
    desc: 'Most tools give you a list of problems and leave you to figure out what to do. Fixpath turns every finding into a clear action — fix it directly, send a recommendation to your team, or deploy a code change with one click.',
  },
  {
    title: 'AI visibility is not optional',
    desc: 'AI agents are already reading your site for their users. Fixpath is the only audit platform that checks how LLMs interpret your pages, tests structured data for AI consumption, and monitors citation accuracy across models.',
  },
  {
    title: 'Built for teams, not just auditors',
    desc: 'Export findings as PDF or Word reports. Share a live link with stakeholders. Push fixes to your site via FTP. The WordPress plugin brings recommendations directly into your CMS. Everyone stays in the loop.',
  },
  {
    title: 'Track improvement, not just problems',
    desc: 'Re-audit anytime and see what changed. Your Website Health Score gives your team a single metric to optimise around. Compare against competitors. See which fixes moved the score the most.',
  },
]

export function HomeAdvantage() {
  return (
    <section className="py-[100px] border-b border-rule max-sm:py-16">
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
        <SectionMarker number="03" label="Why Fixpath" />
        <h2
          className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-14"
          style={{ fontSize: 'clamp(40px, 5.5vw, 72px)' }}
        >
          Audit tools find problems.{' '}
          <em className="italic text-signal">Fixpath fixes them.</em>
        </h2>

        <div className="grid sm:grid-cols-2 gap-x-12 gap-y-14">
          {ADVANTAGES.map((adv) => (
            <div key={adv.title}>
              <h3 className="font-sans text-[17px] font-semibold text-ink mb-3">{adv.title}</h3>
              <p className="font-sans text-[15px] text-ink-2 leading-[1.65]">{adv.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
