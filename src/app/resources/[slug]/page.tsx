import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MarketingBody } from '@/components/marketing/MarketingBody'
import { Nav } from '@/components/marketing/Nav'
import { Footer } from '@/components/marketing/Footer'

/* ── Content block types ── */
type ContentBlock =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'callout'; text: string }

interface Article {
  title: string
  category: string
  readTime: string
  intro: string
  blocks: ContentBlock[]
}

/* ── Full guide content for each resource article ── */
const ARTICLES: Record<string, Article> = {
  'what-is-website-health-score': {
    title: 'What is a Website Health Score?',
    category: 'Getting started',
    readTime: '4 min',
    intro: 'Your Website Health Score is a composite metric that tells you how well your site performs across UX, accessibility, AI readiness, brand consistency, and SEO. It turns a complex, multi-dimensional audit into a single number you can track over time.',
    blocks: [
      { type: 'h2', text: 'How the score is calculated' },
      { type: 'p', text: 'Fixpath runs 96 checkpoints across six modules: Foundation, Human Experience, Inclusive Design, Future Readiness, Brand Consistency, and SEO Structure. Each module contains four categories, and each category contains four individual checkpoints.' },
      { type: 'p', text: 'Every finding is assigned a severity level — critical, major, moderate, or minor. Critical findings carry the most weight because they represent issues that directly harm user experience or prevent entire user groups from accessing your site. The score is weighted so that fixing a single critical issue moves the needle more than fixing several minor ones.' },
      { type: 'p', text: 'The final score is normalised to a 0 to 100 scale. It reflects not just the count of issues but their relative importance, giving you a realistic picture of site quality rather than an overwhelming list of everything that could theoretically be improved.' },

      { type: 'h2', text: 'What the score ranges mean' },
      { type: 'p', text: 'A score above 80 indicates a well-maintained site with no critical issues. There may still be moderate findings worth addressing, but the fundamentals are solid. Sites in this range typically have clear navigation, accessible forms, working structured data, and consistent branding.' },
      { type: 'p', text: 'Between 50 and 80, there are meaningful improvements to make. You likely have a mix of major and moderate issues — perhaps missing alt text on key images, broken heading hierarchy, or conversion paths that lack trust signals. This is the range where focused effort yields the biggest return.' },
      { type: 'p', text: 'Below 50, there are likely structural problems affecting user experience or discoverability. This might mean critical accessibility violations, no structured data for AI systems, deceptive design patterns, or performance issues that cause users to leave before the page loads. Start with the critical findings and work your way through the fix path.' },

      { type: 'h2', text: 'Why a single number matters' },
      { type: 'p', text: 'Single-dimension tools check one thing well — page speed, accessibility compliance, or SEO metadata. But websites are experienced as a whole. A fast site with deceptive sign-up flows still loses trust. An accessible site with no structured data is invisible to AI agents. The Website Health Score gives you a holistic view so you can prioritise across dimensions, not just within them.' },
      { type: 'p', text: 'The score also makes it easier to communicate progress to stakeholders. Instead of sharing a spreadsheet of individual findings, you can show a clear trend line: "We were at 52 in January and we are at 74 now." That kind of narrative is what gets continued investment in site quality.' },

      { type: 'h2', text: 'Tracking improvement over time' },
      { type: 'p', text: 'Every time you re-run an audit, Fixpath recalculates your score and shows the delta. The dashboard tracks your score history so you can see the impact of each round of fixes. If a score drops after a new deployment, you can compare audits side-by-side to see exactly which new findings appeared.' },
      { type: 'p', text: 'This feedback loop — audit, fix, re-audit — is the core of the Fixpath workflow. The score gives you the north star metric, and the fix paths give you the concrete steps to move it.' },
    ],
  },

  'fix-dark-patterns': {
    title: 'How to identify and fix dark patterns',
    category: 'UX',
    readTime: '6 min',
    intro: 'Dark patterns are deceptive design choices that trick users into actions they did not intend. They erode trust, increase churn, and increasingly violate consumer protection regulations in the EU, US, and UK. Here is how to find them on your site and what to do about them.',
    blocks: [
      { type: 'h2', text: 'What counts as a dark pattern' },
      { type: 'p', text: 'The term "dark pattern" was coined by UX researcher Harry Brignull to describe interface designs that manipulate users into making choices they would not otherwise make. The EU Digital Services Act, the FTC in the United States, and the UK Competition and Markets Authority all now reference dark patterns in their enforcement guidelines.' },
      { type: 'p', text: 'Common examples include forced continuity, where subscriptions are easy to start but require multiple steps or a phone call to cancel. Confirmshaming uses guilt-tripping language on opt-out buttons, like "No thanks, I don\'t want to save money." Hidden costs appear late in checkout after the user has already invested time. Misdirection draws visual attention away from choices the business does not want users to make.' },
      { type: 'p', text: 'Other patterns are subtler: pre-checked boxes that opt users into marketing emails, account deletion flows that require more steps than account creation, or cookie consent banners where "Accept all" is a prominent button while "Manage preferences" is grey text that is easy to miss.' },

      { type: 'h2', text: 'The business case against dark patterns' },
      { type: 'p', text: 'Dark patterns may produce short-term conversion gains, but the long-term costs are significant. Users who feel tricked leave negative reviews, file chargebacks, and do not return. Research from the Baymard Institute shows that 17 percent of users abandon checkout specifically because they did not trust the site with their payment information — and deceptive patterns are a primary driver of that mistrust.' },
      { type: 'p', text: 'Regulatory risk is increasing. The FTC has issued fines exceeding 200 million dollars for dark pattern violations. The EU Digital Services Act requires platforms to avoid deceptive interfaces or face penalties of up to 6 percent of global revenue. Even if your site is not large enough to attract regulatory attention today, building ethical patterns now avoids costly redesigns later.' },

      { type: 'h2', text: 'How Fixpath detects dark patterns' },
      { type: 'p', text: 'The Ethical Design category within the Human Experience module scans for known dark pattern indicators. It analyses button text for manipulative language, checks for asymmetric opt-in and opt-out flows, flags hidden costs that appear in later checkout steps, and evaluates cookie consent implementations against best practices.' },
      { type: 'p', text: 'Each flagged pattern includes the affected page URL, a severity rating, a description of why it is considered deceptive, and a concrete recommendation for how to redesign the interaction. Critical findings are patterns that are most likely to trigger regulatory enforcement or drive users away permanently.' },

      { type: 'h2', text: 'Fixing the most common patterns' },
      { type: 'h3', text: 'Confirmshaming' },
      { type: 'p', text: 'Replace guilt-tripping decline text with neutral alternatives. Instead of "No thanks, I hate saving money," use "No thanks" or "Maybe later." The opt-out should be as visually prominent as the opt-in — same font size, same weight, no reduced contrast.' },
      { type: 'h3', text: 'Forced continuity' },
      { type: 'p', text: 'Make cancellation as easy as sign-up. If users can subscribe in two clicks, they should be able to cancel in two clicks. Send a reminder email before a trial converts to paid. Show the renewal date clearly in account settings.' },
      { type: 'h3', text: 'Hidden costs' },
      { type: 'p', text: 'Show the full price, including taxes and fees, as early as possible in the purchase flow — ideally on the product page itself. If exact costs depend on location, show a range or a note that additional fees may apply before the user reaches checkout.' },
      { type: 'h3', text: 'Cookie consent' },
      { type: 'p', text: 'Give "Reject all" the same visual weight as "Accept all." Do not use colour or size differences to steer users toward accepting. Place manage-preferences options on the first layer of the banner, not behind an additional click.' },

      { type: 'h2', text: 'After the fix' },
      { type: 'p', text: 'Once you have addressed the flagged patterns, re-run the audit to verify the findings are resolved. Track your Ethical Design category score over time — it is one of the best indicators of long-term user trust and retention.' },
    ],
  },

  'ai-visibility-guide': {
    title: 'A practical guide to AI visibility',
    category: 'AI readiness',
    readTime: '8 min',
    intro: 'AI agents — from ChatGPT to Perplexity to Google AI Overviews — are reading your site on behalf of their users. When someone asks an AI about your industry, product category, or brand, the answer depends on what it can find and understand about your site. AI visibility is how you influence that answer.',
    blocks: [
      { type: 'h2', text: 'AI visibility is not SEO' },
      { type: 'p', text: 'Search engines index pages and rank them by relevance signals like backlinks, keyword density, and page authority. AI systems do something fundamentally different: they interpret meaning. An AI agent reading your site is trying to understand what your business does, what makes it different, who it serves, and whether the information is trustworthy.' },
      { type: 'p', text: 'This distinction matters because a site can rank well in search results while being poorly understood by AI. If your value proposition is buried in marketing language, if your product descriptions rely on imagery rather than text, or if your structured data is missing or inconsistent, AI agents will either misrepresent you or skip you entirely.' },

      { type: 'h2', text: 'The four dimensions of AI visibility' },
      { type: 'p', text: 'Fixpath evaluates AI visibility across four dimensions, each corresponding to a different aspect of how AI systems discover and interpret your site.' },

      { type: 'h3', text: '1. Structured data completeness' },
      { type: 'p', text: 'Structured data — typically JSON-LD markup — gives AI systems explicit, machine-readable information about your business. This includes your organization name, description, products, services, pricing, reviews, and FAQs. Without it, AI agents have to infer this information from unstructured page content, which leads to inaccuracies.' },
      { type: 'p', text: 'Fixpath checks for the presence and correctness of Organization, Product, Service, FAQ, Article, and BreadcrumbList schemas. It validates that required fields are populated and that the data matches what is visible on the page — a common source of errors when structured data is added once and never updated.' },

      { type: 'h3', text: '2. LLM probe accuracy' },
      { type: 'p', text: 'This dimension measures what AI models actually say about your business compared to reality. Fixpath sends probe queries to multiple AI systems and compares their responses against your site content. If an AI describes your product incorrectly, omits a key feature, or attributes capabilities you do not have, you will see the discrepancy in the audit.' },
      { type: 'p', text: 'Low probe accuracy usually means your site content is ambiguous, contradictory, or spread across too many pages without clear hierarchy. The fix is to consolidate key information on primary pages — your homepage, product page, and about page — using clear, direct language that leaves no room for misinterpretation.' },

      { type: 'h3', text: '3. AI discovery files' },
      { type: 'p', text: 'The llms.txt standard is an emerging convention that provides AI agents with a structured overview of your site, similar to how robots.txt guides search engine crawlers. An llms.txt file at your site root tells AI systems what your site is about, what pages are most important, and how to interpret your content hierarchy.' },
      { type: 'p', text: 'Fixpath checks for the presence of llms.txt, validates its format, and flags common issues like missing descriptions, broken internal links, or content that contradicts what is on the actual pages.' },

      { type: 'h3', text: '4. Citation quality' },
      { type: 'p', text: 'When AI agents cite your site in their responses, the quality of that citation depends on how well your content supports extraction. Pages with clear headings, concise paragraphs, and explicit conclusions are more likely to be cited accurately. Content that is vague, jargon-heavy, or structured as a sales pitch rather than information is less likely to be selected or will be paraphrased poorly.' },
      { type: 'p', text: 'Fixpath evaluates content citeability by analysing heading clarity, paragraph structure, information density, and the presence of extractable claims (statistics, specifications, direct answers to common questions).' },

      { type: 'h2', text: 'Quick wins for AI visibility' },
      { type: 'p', text: 'Start with structured data. Adding correct JSON-LD to your homepage, product pages, and FAQ page is the single highest-impact change for AI visibility. Use Google\'s Rich Results Test to validate your markup, then verify it appears correctly in the Fixpath audit.' },
      { type: 'p', text: 'Next, create an llms.txt file. Even a basic version that lists your primary pages with one-sentence descriptions will improve how AI agents navigate your site. The format is simple and well-documented.' },
      { type: 'p', text: 'Finally, review your key pages through the lens of a machine reader. Is your product description explicit enough that an AI could accurately summarise it in one sentence? Is your pricing clear? Are your differentiators stated as facts rather than implied through marketing language? The clearer your content, the more accurately AI systems will represent you.' },

      { type: 'h2', text: 'Monitoring AI visibility over time' },
      { type: 'p', text: 'AI visibility is not a one-time fix. AI models are retrained regularly, and their understanding of your site evolves. New competitors enter the space, and AI systems may update their answers accordingly. Run regular audits to catch regressions and track your AI readiness score as a leading indicator of how your business appears in AI-generated responses.' },
    ],
  },

  'wcag-accessibility-basics': {
    title: 'WCAG 2.1 AA: what you actually need to do',
    category: 'Accessibility',
    readTime: '7 min',
    intro: 'WCAG 2.1 AA is the most widely referenced accessibility standard and the benchmark for legal compliance in most jurisdictions. Meeting it means your site works for people using screen readers, keyboard navigation, and assistive technologies. This guide breaks down what matters most and where to start.',
    blocks: [
      { type: 'h2', text: 'The four principles' },
      { type: 'p', text: 'WCAG is organised around four principles: Perceivable, Operable, Understandable, and Robust. Perceivable means all content can be presented in ways users can sense — through sight, hearing, or touch. Operable means all functionality is available via keyboard and other input methods. Understandable means content and interface behaviour are predictable and legible. Robust means content works across current and future assistive technologies.' },
      { type: 'p', text: 'Each principle contains guidelines, and each guideline contains success criteria rated A, AA, or AAA. AA is the standard most organisations target because it represents a practical balance between accessibility and implementation effort.' },

      { type: 'h2', text: 'The highest-impact changes' },
      { type: 'p', text: 'Not all WCAG criteria carry equal weight in practice. Some affect large user groups or block access entirely, while others address edge cases. Here are the changes that make the biggest difference.' },

      { type: 'h3', text: 'Colour contrast' },
      { type: 'p', text: 'Body text needs a contrast ratio of at least 4.5:1 against its background. Large text (18px bold or 24px regular) needs 3:1. This is the single most common failure and the easiest to fix. Use a contrast checker to validate your colour combinations, paying special attention to text on images, gradients, or coloured backgrounds.' },

      { type: 'h3', text: 'Alt text for images' },
      { type: 'p', text: 'Every informational image needs a text alternative that conveys its purpose. Decorative images should have empty alt attributes (alt="") so screen readers skip them. The most common mistake is using file names as alt text or writing generic descriptions like "image" or "photo." Good alt text describes what the image communicates in context — "Revenue growth chart showing 40 percent increase in Q3" is useful; "chart.png" is not.' },

      { type: 'h3', text: 'Keyboard navigation' },
      { type: 'p', text: 'Every interactive element — links, buttons, form fields, menus, modals — must be reachable and operable using only a keyboard. This means logical tab order, visible focus indicators, and no keyboard traps where the user cannot tab away from an element. Test by unplugging your mouse and navigating your entire site with Tab, Shift+Tab, Enter, and Escape.' },

      { type: 'h3', text: 'Form labels and errors' },
      { type: 'p', text: 'Every form input needs a programmatically associated label — not just placeholder text, which disappears when the user starts typing. Error messages should identify which field has the problem and what the user needs to do to fix it. Avoid relying on colour alone to indicate errors; add text or an icon as well.' },

      { type: 'h3', text: 'Heading hierarchy' },
      { type: 'p', text: 'Headings should follow a logical order: one H1 per page, followed by H2s for major sections, H3s for subsections, and so on. Screen reader users navigate by heading level, so skipping from H1 to H4 or using headings purely for visual styling creates a confusing experience.' },

      { type: 'h2', text: 'Cognitive accessibility' },
      { type: 'p', text: 'WCAG 2.1 introduced several criteria focused on cognitive accessibility, recognising that accessibility is not only about sensory or motor impairments. These include providing purpose for each input field, ensuring content does not require complex gestures, and allowing users to undo or confirm important actions.' },
      { type: 'p', text: 'Beyond the formal criteria, cognitive accessibility means writing in plain language, keeping layouts predictable, avoiding auto-playing media, and giving users enough time to complete tasks. These improvements benefit everyone, not just users with cognitive differences.' },

      { type: 'h2', text: 'How Fixpath checks accessibility' },
      { type: 'p', text: 'The Inclusive Design module runs automated WCAG checks across your entire site. It flags violations by severity: critical issues like missing form labels or inaccessible navigation are prioritised over advisory items like suboptimal link text. Each finding links directly to the relevant WCAG success criterion so you can understand the requirement, read the official guidance, and verify your fix.' },
      { type: 'p', text: 'Automated tools catch roughly 30 to 50 percent of accessibility issues. The rest require manual testing — navigating with a keyboard, testing with a screen reader, and checking content comprehension. Fixpath identifies the automated findings; the manual checks are noted as recommendations where relevant.' },

      { type: 'h2', text: 'Building an accessibility practice' },
      { type: 'p', text: 'Accessibility is not a one-time project. Every new feature, page, or design change can introduce regressions. The most effective approach is to integrate accessibility into your existing workflow: include it in design reviews, add automated checks to your CI pipeline, and re-audit regularly with Fixpath to catch issues before they reach production.' },
    ],
  },

  'seo-structure-audit': {
    title: 'SEO structure: what your audit is really checking',
    category: 'SEO',
    readTime: '5 min',
    intro: 'SEO structure goes beyond keywords. It covers the technical foundation that search engines use to crawl, index, and rank your pages. A strong SEO structure means your content is discoverable, your pages are correctly indexed, and search engines understand the relationships between them.',
    blocks: [
      { type: 'h2', text: 'Heading hierarchy' },
      { type: 'p', text: 'Search engines use headings to understand page structure and topic hierarchy. Every page should have exactly one H1 that describes the page\'s primary topic. H2s break the content into major sections, and H3s provide further detail within those sections. Skipping heading levels or using headings for visual styling rather than content structure sends confusing signals to crawlers.' },
      { type: 'p', text: 'Fixpath checks that each page has a single H1, that heading levels are sequential, and that heading text is descriptive rather than generic. A heading like "Our approach" tells the crawler nothing; "How we reduce deployment time by 60 percent" tells it everything.' },

      { type: 'h2', text: 'Meta tags and descriptions' },
      { type: 'p', text: 'Every indexable page should have a unique title tag and meta description. The title tag appears in search results and browser tabs — keep it under 60 characters, front-load the most important words, and make it specific to the page content. The meta description appears below the title in search results and should be 150 to 160 characters that summarise the page and include a reason to click.' },
      { type: 'p', text: 'Fixpath flags missing, duplicate, or truncated title tags and meta descriptions. It also checks for keyword consistency — if your page content focuses on "API monitoring" but your title tag says "Dashboard overview," there is a mismatch that hurts relevance signals.' },

      { type: 'h2', text: 'Canonical URLs' },
      { type: 'p', text: 'Canonical tags tell search engines which version of a page is the primary one. Without them, duplicate content — from URL parameters, www vs non-www, or paginated pages — can split ranking authority across multiple URLs. Every page should have a self-referencing canonical tag pointing to its preferred URL.' },
      { type: 'p', text: 'Fixpath checks for missing canonicals, canonicals that point to non-existent pages, and inconsistencies between the canonical URL and the actual page URL. These issues are common on sites that have undergone URL structure changes or migrations.' },

      { type: 'h2', text: 'Internal linking' },
      { type: 'p', text: 'Internal links distribute page authority and help crawlers discover content. A page that is linked from your homepage and main navigation receives more crawl priority than one buried four clicks deep. Fixpath analyses your internal link structure to identify orphan pages (pages with no internal links pointing to them), excessive link depth, and missed opportunities to link contextually relevant content.' },
      { type: 'p', text: 'Good internal linking is not just about navigation menus. In-content links — where you naturally reference related pages within your body text — are strong relevance signals. If your pricing page mentions a feature, link to the feature page. If a blog post references a case study, link to it.' },

      { type: 'h2', text: 'Technical crawlability' },
      { type: 'p', text: 'Crawlability covers the technical factors that determine whether search engines can access and process your pages. This includes robots.txt configuration, XML sitemap presence and accuracy, redirect chains, broken links, and server response codes. A single misconfigured robots.txt rule can deindex your entire site; a redirect chain that loops can prevent pages from being crawled at all.' },
      { type: 'p', text: 'Fixpath runs 16 SEO checkpoints across these areas. Findings are ranked by impact — a broken canonical on your highest-traffic page matters more than a suboptimal meta description on a low-traffic archive page. Each finding includes the affected URL, what is wrong, why it matters, and how to fix it.' },

      { type: 'h2', text: 'Putting it together' },
      { type: 'p', text: 'SEO structure is the foundation that everything else builds on. Content strategy, link building, and keyword optimisation all perform better when the underlying structure is sound. Start with the critical findings from your Fixpath audit — fix broken canonicals, add missing meta tags, repair heading hierarchy — and re-audit to confirm the improvements.' },
    ],
  },

  'wordpress-audit-workflow': {
    title: 'The WordPress audit workflow',
    category: 'WordPress',
    readTime: '4 min',
    intro: 'The Fixpath WordPress plugin lets you audit, fix, and track improvements without leaving your admin panel. This guide walks through setup, running your first audit, and building a regular improvement workflow.',
    blocks: [
      { type: 'h2', text: 'Installation and setup' },
      { type: 'p', text: 'Install the Fixpath plugin from the WordPress plugin directory or upload it directly from your Fixpath dashboard. Once activated, go to Settings and enter your Fixpath API key, which you will find in your Fixpath account under Integrations. The plugin connects to your Fixpath account so audit results sync between WordPress and the web dashboard.' },
      { type: 'p', text: 'After connecting, the plugin adds a Fixpath menu item to your WordPress admin sidebar. From here you can trigger audits, view findings, and track your Website Health Score — all without switching to a separate tool.' },

      { type: 'h2', text: 'Running your first audit' },
      { type: 'p', text: 'Click "Run audit" from the Fixpath dashboard inside WordPress. The plugin sends your site URL to Fixpath, which runs all 96 checkpoints across the six modules. Depending on the size of your site, this typically takes two to five minutes. You will see a progress indicator while the audit runs, and a notification when it completes.' },
      { type: 'p', text: 'Once complete, findings appear in a list view grouped by module. Each finding shows the severity, the affected page or template, a description of the issue, and a recommended fix. You can filter by severity, module, or page to focus on what matters most.' },

      { type: 'h2', text: 'Fixing issues from WordPress' },
      { type: 'p', text: 'For many common issues, the plugin provides direct links to the affected page or template in the WordPress editor. Missing alt text on images, heading hierarchy problems, and meta description gaps can often be resolved by clicking through to the relevant content and making the change in place.' },
      { type: 'p', text: 'Some findings require theme or plugin changes — for example, colour contrast issues that come from your theme\'s CSS, or missing structured data that needs a schema plugin. In these cases, the fix path includes specific guidance on what to change and where, even if the fix is not a one-click operation.' },
      { type: 'p', text: 'For technical issues like missing canonical tags, redirect chains, or robots.txt configuration, the plugin provides the exact code or setting to change. If your hosting environment supports it, some of these can be applied directly through the plugin.' },

      { type: 'h2', text: 'Tracking improvement' },
      { type: 'p', text: 'After fixing issues, re-run the audit from the same WordPress dashboard. Fixpath recalculates your Website Health Score and shows you which findings were resolved and which are new. The score history graph shows your trend over time, so you can demonstrate progress to clients or stakeholders.' },
      { type: 'p', text: 'The plugin syncs with your Fixpath web dashboard, so team members who do not use WordPress can still see the latest audit results, score trends, and remaining findings. This is useful for agencies managing multiple client sites or teams where design, development, and content work happens in different tools.' },

      { type: 'h2', text: 'Building a regular workflow' },
      { type: 'p', text: 'The most effective approach is to run an audit after every significant content update or deployment. Fixpath can also be configured to run automatically on a schedule — weekly or monthly — so you catch regressions before they accumulate. Pair regular audits with a prioritisation habit: fix critical issues immediately, schedule major issues for your next sprint, and batch minor issues for periodic cleanup.' },
      { type: 'callout', text: 'Tip: The WordPress plugin works with multisite installations. You can audit and track each subsite independently from the network admin panel.' },
    ],
  },
}

/* ── Related articles helper ── */
const ALL_SLUGS = Object.keys(ARTICLES)
function getRelatedArticles(currentSlug: string) {
  return ALL_SLUGS.filter((s) => s !== currentSlug).slice(0, 3)
}

export function generateStaticParams() {
  return ALL_SLUGS.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = ARTICLES[slug]
  if (!article) return { title: 'Not found' }
  return {
    title: `${article.title} — Fixpath Resources`,
    description: article.intro.slice(0, 160),
  }
}

export default async function ResourceArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = ARTICLES[slug]
  if (!article) notFound()

  const related = getRelatedArticles(slug)

  return (
    <MarketingBody>
      <Nav />
      <main>
      {/* Hero */}
      <section className="py-20 sm:py-[100px] border-b border-rule">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <Link
            href="/resources"
            className="font-mono text-[11px] tracking-[0.12em] uppercase text-signal no-underline hover:underline mb-8 inline-block"
          >
            &larr; All resources
          </Link>
          <div className="flex items-center gap-3 mb-6">
            <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-signal">{article.category}</span>
            <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-m-muted">{article.readTime}</span>
          </div>
          <h1
            className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-8"
            style={{ fontSize: 'clamp(36px, 5vw, 56px)' }}
          >
            {article.title}
          </h1>
        </div>
      </section>

      {/* Article body */}
      <section className="py-[60px] max-sm:py-10">
        <div className="max-w-[680px] mx-auto px-8 max-sm:px-5">
          {/* Intro paragraph */}
          <p className="font-sans text-[18px] leading-[1.75] text-ink mb-8">
            {article.intro}
          </p>

          {/* Content blocks */}
          {article.blocks.map((block, i) => {
            switch (block.type) {
              case 'h2':
                return (
                  <h2
                    key={i}
                    className="font-sans text-[22px] font-semibold text-ink mt-12 mb-4 leading-snug"
                  >
                    {block.text}
                  </h2>
                )
              case 'h3':
                return (
                  <h3
                    key={i}
                    className="font-sans text-[17px] font-semibold text-ink mt-8 mb-3 leading-snug"
                  >
                    {block.text}
                  </h3>
                )
              case 'callout':
                return (
                  <div
                    key={i}
                    className="my-8 rounded-[4px] border border-rule p-5"
                    style={{ background: 'var(--paper-2)' }}
                  >
                    <p className="font-sans text-[15px] leading-[1.7] text-ink-2 m-0">
                      {block.text}
                    </p>
                  </div>
                )
              case 'p':
              default:
                return (
                  <p key={i} className="font-sans text-[17px] leading-[1.75] text-ink-2 mb-6">
                    {block.text}
                  </p>
                )
            }
          })}

          {/* CTA */}
          <div className="mt-16 pt-8 border-t border-rule">
            <p className="font-sans text-[15px] text-m-muted mb-4">
              Want to see these checks applied to your site?
            </p>
            <Link
              href="/register"
              className="font-sans text-[15px] font-semibold text-signal no-underline hover:underline"
            >
              Start your free audit &rarr;
            </Link>
          </div>

          {/* Related articles */}
          <div className="mt-16 pt-8 border-t border-rule">
            <p className="font-mono text-[11px] tracking-[0.08em] uppercase text-m-muted mb-6">
              Related guides
            </p>
            <div className="flex flex-col gap-4">
              {related.map((slug) => {
                const rel = ARTICLES[slug]
                return (
                  <Link
                    key={slug}
                    href={`/resources/${slug}`}
                    className="group flex items-center justify-between py-3 no-underline border-b border-rule last:border-0"
                  >
                    <span className="font-sans text-[15px] text-ink group-hover:text-signal transition-colors">
                      {rel.title}
                    </span>
                    <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-m-muted shrink-0 ml-4">
                      {rel.readTime}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </section>
    </main>
      <Footer />
    </MarketingBody>
  )
}
