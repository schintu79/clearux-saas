# ClearUX Project Rules

## Design Rules
- **No emojis** — Never use emojis anywhere in the UI. Use Lucide React icons instead.
- Use the app's CSS variables for theming: `var(--gradient-brand)`, `var(--gradient-brand-text)`, `text-text`, `text-muted`, `bg-card`, `bg-off`, `border-border`, etc.
- Font classes: `font-heading` (CCSGlyke) for headings, `font-body` (DM Sans) for body text.
- Follow the Vercel-style design language used throughout the app.

## Tech Stack
- Next.js App Router with React Server Components
- Supabase (auth, DB, storage with RLS)
- Tailwind CSS with custom CSS variables
- Lucide React for all icons
- Inngest for background job processing
- Stripe for payments
- PDFKit for PDF generation, docx-js for DOCX

## Admin
- Admin role system: user / admin / super_admin
- Super admin email: s.schintu@gmail.com
