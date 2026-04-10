-- ============================================================
-- ClearUX SaaS — Checklist Categories & Items Seed
-- ============================================================

-- Category 1: First Impression
INSERT INTO checklist_categories (name, slug, description, sort_order)
VALUES (
  'First Impression',
  'first-impression',
  'Does the product make a strong first impression?',
  1
);

WITH cat_id AS (SELECT id FROM checklist_categories WHERE slug = 'first-impression' LIMIT 1)
INSERT INTO checklist_items (category_id, title, description, what_to_check, sort_order)
SELECT
  cat_id.id,
  *
FROM cat_id, (VALUES
  (
    'Visual Hierarchy',
    'The page layout uses clear visual hierarchy to guide attention to key elements',
    'Check if the most important elements (value prop, CTA) stand out visually. Are headings, colors, and spacing used effectively to create a clear information hierarchy?',
    1
  ),
  (
    'Loading & Performance',
    'The page loads quickly and doesn''t feel sluggish',
    'Measure initial load time. Does the hero section load in under 3 seconds? Are there any noticeable delays or janky animations that hurt perceived performance?',
    2
  ),
  (
    'Brand Clarity',
    'The brand identity is immediately recognizable',
    'Can you instantly identify the product/company name? Is the logo prominent? Is the brand voice consistent with the design style?',
    3
  ),
  (
    'Above the Fold Impact',
    'Critical content and CTAs appear without scrolling',
    'What''s visible in the first viewport? Is the value proposition clear before scrolling? Is there a strong CTA in the hero section?',
    4
  )
) AS items(title, description, what_to_check, sort_order);

-- Category 2: Value Proposition
INSERT INTO checklist_categories (name, slug, description, sort_order)
VALUES (
  'Value Proposition',
  'value-proposition',
  'Is the value proposition clear and compelling?',
  2
);

WITH cat_id AS (SELECT id FROM checklist_categories WHERE slug = 'value-proposition' LIMIT 1)
INSERT INTO checklist_items (category_id, title, description, what_to_check, sort_order)
SELECT
  cat_id.id,
  *
FROM cat_id, (VALUES
  (
    'Headline Clarity',
    'The headline clearly articulates what the product does',
    'Read the main headline in 5 seconds. Does it immediately tell you what problem is solved? Avoid jargon. Is it benefit-focused rather than feature-focused?',
    1
  ),
  (
    'Subheading Support',
    'Supporting text reinforces the value proposition',
    'Does the subheading or supporting text add clarity? Does it explain who it''s for or what problem it solves? Is it concise (1-2 lines)?',
    2
  ),
  (
    'Differentiation',
    'The product explains why it''s different or better',
    'Is there a comparison, unique selling point, or clear advantage stated? How does it differentiate from competitors (explicitly or implicitly)?',
    3
  ),
  (
    'Social Proof',
    'Trust signals or social proof reinforce the value',
    'Are there testimonials, logos of customers, ratings, or case studies? Do they appear early and reinforce the key claim?',
    4
  )
) AS items(title, description, what_to_check, sort_order);

-- Category 3: Navigation & IA
INSERT INTO checklist_categories (name, slug, description, sort_order)
VALUES (
  'Navigation & IA',
  'navigation-ia',
  'Is the information architecture intuitive?',
  3
);

WITH cat_id AS (SELECT id FROM checklist_categories WHERE slug = 'navigation-ia' LIMIT 1)
INSERT INTO checklist_items (category_id, title, description, what_to_check, sort_order)
SELECT
  cat_id.id,
  *
FROM cat_id, (VALUES
  (
    'Menu Findability',
    'Navigation menu is easy to find and use',
    'Is the main navigation visible on every page? Does it use standard patterns (top bar, hamburger menu)? Are menu items clearly labeled and organized logically?',
    1
  ),
  (
    'Breadcrumbs & Context',
    'Users always know where they are in the site',
    'Do key pages have breadcrumbs or location indicators? Can users easily navigate back to parent pages? Is the current page highlighted in navigation?',
    2
  ),
  (
    'Link Scanning',
    'Important links and CTAs are easy to spot',
    'Are links visually distinct (color, underline, hover state)? Do CTAs stand out from regular links? Can you quickly spot where to click to take an action?',
    3
  ),
  (
    'Logical Page Flow',
    'Page sections follow a logical, scannable structure',
    'Can you scan the page and understand the content flow? Are sections clearly separated? Does the layout encourage reading from top to bottom?',
    4
  )
) AS items(title, description, what_to_check, sort_order);

-- Category 4: Conversion & CTAs
INSERT INTO checklist_categories (name, slug, description, sort_order)
VALUES (
  'Conversion & CTAs',
  'conversion-ctas',
  'Are calls to action effective?',
  4
);

WITH cat_id AS (SELECT id FROM checklist_categories WHERE slug = 'conversion-ctas' LIMIT 1)
INSERT INTO checklist_items (category_id, title, description, what_to_check, sort_order)
SELECT
  cat_id.id,
  *
FROM cat_id, (VALUES
  (
    'Button Visibility',
    'Primary CTAs are prominent and easy to click',
    'Do buttons use contrasting colors? Are they large enough to tap on mobile? Is the primary button visually distinct from secondary options?',
    1
  ),
  (
    'Button Copy',
    'CTA text is action-oriented and clear',
    'Does the button text clearly state what happens next (e.g., "Start Free Trial" vs "Submit")? Is it benefit-focused? Avoid vague text like "Click Here".',
    2
  ),
  (
    'CTA Placement',
    'CTAs appear where users expect them',
    'Is there a CTA in the hero section? Are additional CTAs strategically placed throughout the page? Do repeated CTAs make sense contextually?',
    3
  ),
  (
    'Form Friction',
    'Form fields are minimal and easy to complete',
    'How many form fields are required? Are labels clear and inside or above inputs? Can users see what happens after submission?',
    4
  )
) AS items(title, description, what_to_check, sort_order);

-- Category 5: Onboarding
INSERT INTO checklist_categories (name, slug, description, sort_order)
VALUES (
  'Onboarding',
  'onboarding',
  'Is the onboarding experience smooth?',
  5
);

WITH cat_id AS (SELECT id FROM checklist_categories WHERE slug = 'onboarding' LIMIT 1)
INSERT INTO checklist_items (category_id, title, description, what_to_check, sort_order)
SELECT
  cat_id.id,
  *
FROM cat_id, (VALUES
  (
    'Registration Simplicity',
    'Sign-up process is quick and straightforward',
    'How many steps to create an account? Can users sign up with email/social login? Is there a clear indication of what happens next after sign-up?',
    1
  ),
  (
    'First-Time User Guidance',
    'New users are guided toward their first success',
    'Is there an onboarding tour, checklist, or prompt? Does it highlight key features? Can users skip it if they prefer?',
    2
  ),
  (
    'Contextual Help',
    'Help is available where users need it',
    'Are tooltips, explanations, or help icons provided? Does the interface teach users how to use features without overwhelming them?',
    3
  ),
  (
    'Aha Moment Timing',
    'Users experience the core value early in the flow',
    'Can a new user see the main benefit within 2-3 actions? Does the product demonstrate value before asking for money or commitment?',
    4
  )
) AS items(title, description, what_to_check, sort_order);

-- Category 6: Mobile Experience
INSERT INTO checklist_categories (name, slug, description, sort_order)
VALUES (
  'Mobile Experience',
  'mobile-experience',
  'Does it work well on mobile?',
  6
);

WITH cat_id AS (SELECT id FROM checklist_categories WHERE slug = 'mobile-experience' LIMIT 1)
INSERT INTO checklist_items (category_id, title, description, what_to_check, sort_order)
SELECT
  cat_id.id,
  *
FROM cat_id, (VALUES
  (
    'Responsive Design',
    'Layout adapts properly to mobile screen sizes',
    'View on a phone (375px width). Does content reflow without horizontal scrolling? Are text and images appropriately sized? Test both portrait and landscape.',
    1
  ),
  (
    'Touch Targets',
    'Buttons and links are large enough to tap',
    'Are interactive elements at least 44x44px? Is spacing between buttons sufficient? Can you easily tap buttons without hitting adjacent elements?',
    2
  ),
  (
    'Mobile Navigation',
    'Navigation works well on small screens',
    'Is there a mobile menu (hamburger or collapse)? Is the menu easy to open and close? Can users navigate without excess scrolling?',
    3
  ),
  (
    'Mobile Performance',
    'Page loads and performs well on slow networks',
    'Test on 4G or throttled connection. Does the page load in under 5 seconds? Are images optimized? Is there noticeable lag or janky scrolling?',
    4
  )
) AS items(title, description, what_to_check, sort_order);

-- Category 7: Trust & Credibility
INSERT INTO checklist_categories (name, slug, description, sort_order)
VALUES (
  'Trust & Credibility',
  'trust-credibility',
  'Does the product build trust?',
  7
);

WITH cat_id AS (SELECT id FROM checklist_categories WHERE slug = 'trust-credibility' LIMIT 1)
INSERT INTO checklist_items (category_id, title, description, what_to_check, sort_order)
SELECT
  cat_id.id,
  *
FROM cat_id, (VALUES
  (
    'Security Signals',
    'Privacy and security measures are clearly communicated',
    'Are SSL certificates indicated? Is there mention of data protection, GDPR, or security practices? Are privacy links easily accessible?',
    1
  ),
  (
    'Credibility Indicators',
    'Company background and expertise are evident',
    'Is there an About page or founder info? Are team members shown? Are credentials, years in business, or expertise highlighted?',
    2
  ),
  (
    'Customer Validation',
    'Customer testimonials and case studies are prominent',
    'Are real customer testimonials with photos/names included? Are case studies detailed with results? Do reviews feel authentic (not generic)?',
    3
  ),
  (
    'Contact & Support',
    'Users can easily contact support or find help',
    'Is there a visible contact method (email, chat, form)? Are support hours listed? Is there an FAQ or knowledge base?',
    4
  )
) AS items(title, description, what_to_check, sort_order);

-- Category 8: Content & Copy
INSERT INTO checklist_categories (name, slug, description, sort_order)
VALUES (
  'Content & Copy',
  'content-copy',
  'Is the content clear and effective?',
  8
);

WITH cat_id AS (SELECT id FROM checklist_categories WHERE slug = 'content-copy' LIMIT 1)
INSERT INTO checklist_items (category_id, title, description, what_to_check, sort_order)
SELECT
  cat_id.id,
  *
FROM cat_id, (VALUES
  (
    'Readability',
    'Text is easy to read with good contrast and spacing',
    'Is text color contrasting well with background? Is font size readable (16px+ body text)? Is line spacing adequate (1.5 or more)?',
    1
  ),
  (
    'Copywriting Quality',
    'Copy is concise, jargon-free, and benefit-focused',
    'Is the language simple and accessible? Are benefits explained clearly? Do sections avoid unnecessary words or corporate speak?',
    2
  ),
  (
    'Scanability',
    'Content is formatted for quick scanning',
    'Are headings used hierarchically? Are bullet points used for lists? Is there white space between sections? Can you quickly grasp the main points?',
    3
  ),
  (
    'Grammar & Errors',
    'Content is free of spelling, grammar, and typos',
    'Are there any obvious spelling mistakes or grammatical errors? Does the copy feel polished and professional? Check for consistent capitalization and punctuation.',
    4
  )
) AS items(title, description, what_to_check, sort_order);

-- Category 9: Performance & Tech
INSERT INTO checklist_categories (name, slug, description, sort_order)
VALUES (
  'Performance & Tech',
  'performance-tech',
  'Is the product fast and reliable?',
  9
);

WITH cat_id AS (SELECT id FROM checklist_categories WHERE slug = 'performance-tech' LIMIT 1)
INSERT INTO checklist_items (category_id, title, description, what_to_check, sort_order)
SELECT
  cat_id.id,
  *
FROM cat_id, (VALUES
  (
    'Page Load Speed',
    'Initial page load is fast (under 3 seconds)',
    'Check Core Web Vitals: LCP < 2.5s, FID < 100ms. Use Lighthouse or PageSpeed Insights. Does the hero appear within 2.5 seconds?',
    1
  ),
  (
    'Interactivity Responsiveness',
    'Clicks and interactions respond immediately',
    'Do buttons respond to clicks instantly? Is there lag when scrolling? Do form inputs respond immediately to typing?',
    2
  ),
  (
    'Video & Media Performance',
    'Videos load quickly and don''t block page rendering',
    'Do videos start playing smoothly? Does background video autoplay without blocking the page? Are images properly compressed?',
    3
  ),
  (
    'Broken Links & Errors',
    'All links work and there are no 404 or 500 errors',
    'Click through major links and CTAs. Check the console for JavaScript errors. Are there any dead links or non-functional features?',
    4
  )
) AS items(title, description, what_to_check, sort_order);

-- Category 10: AI Discoverability
INSERT INTO checklist_categories (name, slug, description, sort_order)
VALUES (
  'AI Discoverability',
  'ai-discoverability',
  'Is the product discoverable by AI systems?',
  10
);

WITH cat_id AS (SELECT id FROM checklist_categories WHERE slug = 'ai-discoverability' LIMIT 1)
INSERT INTO checklist_items (category_id, title, description, what_to_check, sort_order)
SELECT
  cat_id.id,
  *
FROM cat_id, (VALUES
  (
    'Semantic HTML Structure',
    'Content uses semantic HTML (h1-h6, article, section, nav)',
    'Inspect the HTML. Are headings properly hierarchical? Does the page use semantic tags or just divs? Is there one clear h1? Does structure make sense without CSS?',
    1
  ),
  (
    'Schema Markup',
    'Structured data (JSON-LD, microdata) helps AI understand content',
    'Check for schema.org markup (Organization, Product, Article, etc). Is there rich snippet data? Use Google''s Structured Data Testing Tool.',
    2
  ),
  (
    'Meta Tags & Open Graph',
    'Meta descriptions and Open Graph tags are informative',
    'Is there a descriptive meta description (120-160 chars)? Are OG tags present for social sharing? Is the title tag descriptive?',
    3
  ),
  (
    'Content Accessibility to Crawlers',
    'Text content is not hidden in images or JavaScript',
    'Is important content in text form (not images)? Are CTA text and value prop accessible to crawlers? View page source—can you see the key content?',
    4
  ),
  (
    'robots.txt & Sitemap',
    'robots.txt and XML sitemap guide search engines',
    'Check /robots.txt for crawl directives. Is there an XML sitemap? Are important pages indexable (not blocked by noindex)?',
    5
  ),
  (
    'Internal Linking Structure',
    'Related content is linked logically for AI navigation',
    'Are there contextual internal links? Do landing pages link to related resources? Is the link structure logical and consistent?',
    6
  )
) AS items(title, description, what_to_check, sort_order);
