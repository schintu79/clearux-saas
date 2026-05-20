# ClearUX Dashboard — Internal UI Spec

> Single source of truth for dashboard visual consistency.
> Every dashboard page must follow these rules. No one-off styles.

---

## Color Tokens

All dashboard pages render inside `.dashboard-clean`, which sets:

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--ink` | #18181B | #FAFAFA | Primary text, headings |
| `--ink-2` | #3F3F46 | #D4D4D8 | Secondary text |
| `--m-muted` | #71717A | #71717A | Helper text, labels, icons |
| `--m-muted-2` | #A1A1AA | #52525B | Tertiary / disabled |
| `--paper` | #FAFAFA | #09090B | Page background |
| `--paper-2` | #F4F4F5 | #18181B | Tinted zones, skeleton |
| `--card` | #FFFFFF | #18181B | Card background (opaque) |
| `--card-hover` | #FAFAFA | #27272A | Card hover state |
| `--rule` | #E4E4E7 | #27272A | Borders, dividers |
| `--signal` | #5E6B2F | #A4B26A | Brand accent |
| `--ok` | (green) | | Positive scores, success |
| `--warn` | (amber) | | Medium scores, caution |
| `--severe` | (red) | | Low scores, errors |

**Rules:**
- Never use hardcoded `#ffffff` or `#000000` — use `var(--card)` or `var(--ink)`.
- Never use `bg-card` Tailwind utility — use `style={{ background: 'var(--card)' }}`.
- Card borders: `1px solid var(--rule)` always via inline style.
- Tinted background zones: `color-mix(in srgb, var(--rule) 18%, transparent)`.
- Subtle icon/label backgrounds: `color-mix(in srgb, var(--ink) 6%, transparent)`.

---

## Typography Scale

All text uses `font-sans` (DM Sans). No `font-mono` in the dashboard.

| Role | Size | Weight | Tracking | Component |
|------|------|--------|----------|-----------|
| **Page title** | `text-[22px]` | `font-semibold` (600) | `tracking-[-0.01em]` | `PageHeader` |
| **Page subtitle** | `text-[13px]` | normal (400) | — | `PageHeader` |
| **Section title** | `text-[14px]` | `font-semibold` (600) | — | `SectionHeader` |
| **Card title** | `text-[13px]` | `font-semibold` (600) | — | inline |
| **Body text** | `text-[13px]` | normal (400) | — | inline |
| **Label** | `text-[11px]` | `font-medium` (500) | `tracking-wide` `uppercase` | `StatCard` label |
| **Hero KPI** | `text-[28px]` | `font-semibold` (600) | — `tabular-nums` | `StatCard` value |
| **Inline KPI** | `text-[14px]` | `font-semibold` (600) | — `tabular-nums` | row scores |
| **Small meta** | `text-[11px]` | normal (400) | — | timestamps, hints |

**Rules:**
- Page title is always `text-[22px] font-semibold` via `PageHeader`. Never `text-2xl font-medium`.
- Section titles are `text-[14px] font-semibold` with `var(--ink)` color.
- KPI values always use `tabular-nums` for alignment.
- Muted text always uses `var(--m-muted)` color.

---

## Spacing

| Token | Value | Usage |
|-------|-------|-------|
| Page top margin | `mb-6` on PageHeader | Below page header |
| Section gap | `mb-6` | Between major sections |
| Section title gap | `mb-2` | Between section title and content |
| Card grid gap | `gap-3` | Between cards in a grid |
| Card padding | `p-4` | Inside stat/overview cards |
| Card padding (large) | `p-5` | Inside detail/content cards |
| Inner element gap | `gap-1.5` | Between icon + label in cards |
| Max content width | `max-w-5xl` | All dashboard pages |

---

## Components

### PageHeader

Already exists at `v2/PageHeader.tsx`. All pages must use it.

```tsx
<PageHeader
  icon={<Activity size={18} />}
  title="Track"
  subtitle="Score trend and progress over time"
>
  {/* optional right-side actions */}
</PageHeader>
```

### SectionHeader — `v2/SectionHeader.tsx`

Section divider with title and optional right-side link.

```tsx
<SectionHeader title="Your brands & sites">
  <Link href="/dashboard/audits">My Audits <ChevronRight /></Link>
</SectionHeader>
```

Renders: `text-[14px] font-semibold` title, `flex justify-between`, `mb-2`.

### DashCard — `v2/DashCard.tsx`

Unified card shell. Replaces all `bg-card border border-border`, all `style={{ background: 'var(--card)' }}`, all `#ffffff`.

```tsx
<DashCard>content</DashCard>
<DashCard padding="lg">more room</DashCard>
<DashCard hover onClick={fn}>clickable</DashCard>
<DashCard dashed>empty state</DashCard>
```

- Background: `var(--card)`, border: `1px solid var(--rule)`, radius: `rounded-xl`.
- Padding: `sm` = `p-3`, `md` (default) = `p-4`, `lg` = `p-5`, `none` = no padding.
- Hover: optional lift + `var(--card-hover)` bg.
- Dashed: dashed border for empty states.

### StatCard — `v2/StatCard.tsx`

KPI card with icon, label, hero number, optional hint.

```tsx
<StatCard icon={Layers} label="Brands" value="12" tone="ink" hint="across 3 domains" />
```

- Label: `text-[11px] uppercase tracking-wide font-medium`, `var(--m-muted)`.
- Value: `text-[28px] font-semibold tabular-nums leading-none`.
- Tone colors: `ink` → `var(--ink)`, `ok` → `var(--ok)`, `warn` → `var(--warn)`, `severe` → `var(--severe)`, `muted` → `var(--m-muted)`.
- Hint: `text-[11px]`, `var(--m-muted)`.
- Wraps `DashCard` internally.

### ActionLink — `v2/ActionLink.tsx`

Flat pill button/link used for inline dashboard actions. Replaces all one-off inline-styled Links and color-mix buttons.

```tsx
<ActionLink href="/dashboard/new-audit" icon={PlusCircle}>New audit</ActionLink>
<ActionLink onClick={fn} icon={RefreshCw} variant="muted">Re-scan</ActionLink>
```

Two variants:
- **`primary`** (default): `var(--ink)` bg, `var(--paper)` text.
- **`muted`**: `color-mix(in srgb, var(--ink) 6%, transparent)` bg, `var(--ink)` text.

Shared: `text-[12px] font-semibold px-3 py-1.5 rounded-md inline-flex items-center gap-1.5`.

---

## Button Variants (when to use what)

| Context | Component |
|---------|-----------|
| Primary CTA (header actions) | `ActionLink variant="primary"` |
| Secondary/subtle inline action | `ActionLink variant="muted"` |
| Form submit buttons | `Button` (from `ui/Button.tsx`) |
| Danger/destructive in dialogs | `Button variant="danger"` |

**Rules:**
- Dashboard pages should never build ad-hoc styled `<button>` or `<Link>` with inline colors.
- All dashboard CTAs go through `ActionLink` or `Button`.

---

## Card Patterns

| Pattern | Implementation |
|---------|---------------|
| KPI overview grid | `StatCard` in a `grid grid-cols-2 md:grid-cols-4 gap-3` |
| List card (brand rows, audit rows) | `DashCard padding="none"` with `divide-y` children |
| Content/detail card | `DashCard padding="lg"` |
| Empty state | `DashCard dashed` with centered icon + text + CTA |
| Tinted diagnostic zone | Wrapper `div` with `color-mix(in srgb, var(--rule) 18%, transparent)` bg |

---

## Score Colors (reusable helper)

```ts
function scoreColor(s: number | null): string {
  if (s == null) return 'var(--m-muted)';
  if (s >= 70) return 'var(--ok)';
  if (s >= 40) return 'var(--warn)';
  return 'var(--severe)';
}
```

Every page that displays scores must use this exact function (or import from a shared util).

---

## Page Structure Template

Every dashboard page follows this skeleton:

```tsx
<div className="max-w-5xl mx-auto">
  <OverviewBreadcrumb />  {/* if brand-scoped */}
  <PageHeader icon={<Icon size={18} />} title="Page Name" subtitle="Description">
    <ActionLink href="..." icon={PlusCircle}>Primary CTA</ActionLink>
  </PageHeader>

  {/* KPI grid (if applicable) */}
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
    <StatCard ... />
  </div>

  {/* Section */}
  <SectionHeader title="Section name">
    <Link>View all</Link>
  </SectionHeader>
  <DashCard padding="none">
    {/* list content */}
  </DashCard>
</div>
```
