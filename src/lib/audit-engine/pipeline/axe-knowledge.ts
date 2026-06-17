// ============================================================
// Accessibility knowledge layer — surgical, site-agnostic axe enrichment
// ============================================================
// axe-core only gives us a rule statement + a reference URL. To be SURGICAL we
// combine, per rule:
//   • expert guidance (what it means, why it matters for real users, how to fix)
//   • the ACTUAL failing element from the page (selector / count)
// to produce a specific, evidenced recommendation — for ANY site, not one brand.
//
// EXPANDABLE: this is a living knowledge base. To improve a finding, add or
// refine an entry in AXE_RULE_KNOWLEDGE keyed by the axe rule id. Anything not
// mapped falls back to principle-based guidance, so unmapped rules still produce
// a sensible, non-generic finding on every site.
//
// `{el}` in any string is replaced with the failing element's selector.
// Pure + unit-tested.
// ============================================================

export interface AxeRuleKnowledge {
  /** Plain statement of the defect (WHAT WE FOUND). May use {el}. */
  what: string
  /** Concrete user/business impact (WHY IT MATTERS). */
  why: string
  /** Detailed, actionable fix. May use {el}. */
  fix: string
}

// Keyed by axe-core rule id. Keep entries accurate and vendor-neutral.
export const AXE_RULE_KNOWLEDGE: Record<string, AxeRuleKnowledge> = {
  'button-name': {
    what: 'The button {el} has no accessible name — it contains no visible text and no aria-label/aria-labelledby, so assistive tech announces it only as “button”.',
    why: 'Screen-reader and voice-control users cannot tell what the button does, so they can’t use it — often blocking a core action (search, menu, submit).',
    fix: 'Give {el} an accessible name: put visible text inside the button, or add aria-label="…" (or aria-labelledby pointing at a visible label). For an icon-only button, aria-label is required, e.g. <button aria-label="Search">.',
  },
  'link-name': {
    what: 'The link {el} has no discernible text — it has no readable label, so assistive tech announces it as just “link”.',
    why: 'Screen-reader users navigating by links hear a list of unlabeled “link” entries and can’t tell where any of them go, so they can’t navigate the page.',
    fix: 'Give {el} text: add visible link text, or aria-label/aria-labelledby. For an icon or image link, add alt text on the image or aria-label on the link, e.g. <a href="/" aria-label="Home">.',
  },
  'color-contrast': {
    what: 'Text in {el} does not meet the WCAG AA contrast minimum (4.5:1 for normal text, 3:1 for large text) against its background.',
    why: 'Low-contrast text is hard or impossible to read for people with low vision, colour-blindness, or anyone on a bright screen — they may miss the content entirely.',
    fix: 'Increase the contrast of {el}: darken the text or lighten the background until the ratio is ≥ 4.5:1 (≥ 3:1 for text ≥ 18.66px bold or 24px). Check the exact pair with a contrast tool and adjust the colour token, not just this instance.',
  },
  'image-alt': {
    what: 'The image {el} has no alt attribute, so assistive tech has nothing to announce for it.',
    why: 'Screen-reader users get silence or a filename where the image should be — if the image carries meaning (a logo, a chart, a product photo) that information is lost.',
    fix: 'Add alt text to {el}: alt="short description of what it conveys" for meaningful images, or alt="" (empty) for purely decorative ones so they’re skipped. Describe the meaning, not “image of…”.',
  },
  'input-image-alt': {
    what: 'The image button {el} (<input type="image">) has no alt text.',
    why: 'Screen-reader users can’t tell what this image-button submits or does, so they can’t use the control.',
    fix: 'Add alt to {el} describing the action, e.g. <input type="image" alt="Search">.',
  },
  'label': {
    what: 'The form field {el} has no programmatic label — no <label for>, aria-label, or aria-labelledby — so assistive tech can’t announce what to enter.',
    why: 'Screen-reader users reach the field and hear only “edit text” with no idea what it’s for; voice-control users can’t target it by name. Placeholder text alone does not count and disappears on input.',
    fix: 'Associate a label with {el}: <label for="ID">…</label> matching the input’s id, or wrap the input in a <label>, or add aria-label. Keep a visible label — placeholders are not labels.',
  },
  'select-name': {
    what: 'The <select> {el} has no accessible name.',
    why: 'Screen-reader users can’t tell what the dropdown is for, so they may pick the wrong option or skip it.',
    fix: 'Label {el} with <label for>, aria-label, or aria-labelledby.',
  },
  'aria-required-children': {
    what: 'The element {el} has a role that requires specific child roles, but those children are missing (e.g. role="list" with no role="listitem", role="tablist" with no tabs).',
    why: 'Assistive tech announces the container as a list/menu/tablist but finds nothing inside it, so the structure is broken and confusing for screen-reader users.',
    fix: 'Either add the required child roles inside {el} (e.g. role="listitem" for each item under role="list"), or — better — use the native element (<ul><li>) and drop the ARIA roles entirely.',
  },
  'aria-required-parent': {
    what: 'The element {el} has a role that must be inside a specific parent role, but isn’t (e.g. role="listitem" not inside role="list").',
    why: 'Without the required parent, assistive tech can’t convey the relationship, so the item is announced out of context.',
    fix: 'Wrap {el} in the required parent role, or switch to native semantic elements that imply the relationship (<ul><li>).',
  },
  'aria-roles': {
    what: 'The element {el} uses an invalid or misspelled ARIA role.',
    why: 'An unrecognised role is ignored or mis-announced, so the element’s purpose isn’t conveyed to assistive tech.',
    fix: 'Correct the role on {el} to a valid ARIA role, or remove it and use the matching native element.',
  },
  'aria-allowed-attr': {
    what: 'The element {el} has an ARIA attribute that isn’t allowed for its role.',
    why: 'Disallowed ARIA attributes are ignored or cause assistive tech to misreport state, confusing users.',
    fix: 'Remove the disallowed aria-* attribute from {el}, or change the role so the attribute is valid for it.',
  },
  'aria-valid-attr-value': {
    what: 'An ARIA attribute on {el} has an invalid value (e.g. aria-labelledby pointing at an id that doesn’t exist).',
    why: 'Invalid ARIA values break the accessibility tree — names, states, or relationships are dropped for screen-reader users.',
    fix: 'Fix the attribute value on {el}: ensure referenced ids exist, and that values match the attribute’s allowed set.',
  },
  'aria-hidden-focus': {
    what: 'The element {el} is inside aria-hidden="true" but is still focusable.',
    why: 'Keyboard users can tab to a control that screen readers are told to ignore — they land on something with no announcement, a confusing dead end.',
    fix: 'Either remove aria-hidden from the ancestor of {el}, or make {el} non-focusable while hidden (e.g. tabindex="-1" and disable it).',
  },
  'nested-interactive': {
    what: 'The element {el} nests one interactive control inside another (e.g. a button inside a link).',
    why: 'Nested controls produce unpredictable keyboard and screen-reader behaviour — focus and activation become ambiguous.',
    fix: 'Restructure {el} so interactive controls are siblings, not nested. Use one control per action.',
  },
  'html-has-lang': {
    what: 'The <html> element is missing a lang attribute.',
    why: 'Without a page language, screen readers may use the wrong pronunciation rules, making content hard to understand; it also weakens translation and SEO signals.',
    fix: 'Add a lang attribute to <html>, e.g. <html lang="en"> (or the page’s actual language / locale).',
  },
  'html-lang-valid': {
    what: 'The <html> lang attribute has an invalid value.',
    why: 'An invalid language code is ignored, so screen readers fall back to the wrong pronunciation.',
    fix: 'Set <html lang> to a valid BCP-47 code, e.g. "en", "ar", "en-US".',
  },
  'valid-lang': {
    what: 'A lang attribute on {el} has an invalid value.',
    why: 'Screen readers can’t switch pronunciation for this passage, so mixed-language content is read incorrectly.',
    fix: 'Set the lang on {el} to a valid BCP-47 code for that content’s language.',
  },
  'document-title': {
    what: 'The page has no <title>, or it is empty.',
    why: 'The title is the first thing screen readers announce and what labels the browser tab and search results — without it users can’t tell which page they’re on.',
    fix: 'Add a descriptive, unique <title> in <head> for this page (not the same title as every other page).',
  },
  'heading-order': {
    what: 'Heading levels on the page skip (e.g. an <h1> followed directly by an <h3>) at {el}.',
    why: 'Screen-reader users navigate by heading level; skipped levels make the page’s structure unclear and can hide sections.',
    fix: 'Use heading levels in order around {el} — don’t jump levels for styling. Style with CSS, keep the semantic level sequential.',
  },
  'empty-heading': {
    what: 'The heading {el} has no text content.',
    why: 'An empty heading shows up in the screen-reader heading list as a blank entry, breaking navigation.',
    fix: 'Add text to {el}, or remove the heading element if it’s being used only for spacing.',
  },
  'list': {
    what: 'The list container {el} (<ul>/<ol>) contains items that are not <li> (or contains non-list content).',
    why: 'Broken list structure means screen readers don’t announce “list, N items”, so users lose the grouping and count.',
    fix: 'Ensure {el} contains only <li> children (move other content inside the <li> or out of the list).',
  },
  'listitem': {
    what: 'The list item {el} (<li>) is not contained in a <ul> or <ol>.',
    why: 'A stray <li> isn’t announced as part of a list, so its grouping is lost.',
    fix: 'Wrap {el} in a <ul> or <ol>, or change it to a non-list element if it isn’t really a list item.',
  },
  'region': {
    what: 'Content at {el} sits outside any landmark region (header/nav/main/footer/aside).',
    why: 'Screen-reader users navigate by landmarks; content outside them is hard to find and skip.',
    fix: 'Wrap page content in semantic landmarks: <main> for the primary content, plus <header>, <nav>, <footer> as appropriate.',
  },
  'landmark-one-main': {
    what: 'The page has no <main> landmark (or more than one).',
    why: 'Screen-reader users rely on a single <main> to jump straight to the primary content; without it they must wade through nav and header every time.',
    fix: 'Add exactly one <main> element wrapping the page’s primary content.',
  },
  'bypass': {
    what: 'The page has no way to skip repeated blocks (no skip link, landmarks, or headings) to reach the main content.',
    why: 'Keyboard and screen-reader users must tab through the entire nav on every page before reaching content — slow and exhausting.',
    fix: 'Add a “Skip to main content” link as the first focusable element, pointing to the <main> region’s id; ensure landmarks/headings exist.',
  },
  'link-in-text-block': {
    what: 'The link {el} is distinguished from surrounding text by colour alone, without sufficient contrast difference or another cue.',
    why: 'People with low vision or colour-blindness can’t see which words are links, so they miss navigation.',
    fix: 'Distinguish {el} by more than colour — underline links in body text, or ensure a 3:1 contrast difference vs surrounding text plus a non-colour cue on hover/focus.',
  },
  'duplicate-id-aria': {
    what: 'An id referenced by ARIA is used more than once, near {el}.',
    why: 'Duplicate ids break ARIA relationships (aria-labelledby/aria-describedby) — the wrong element, or none, is used for the name.',
    fix: 'Make every id unique on the page; update ARIA references on {el} to point at the correct unique id.',
  },
  'frame-title': {
    what: 'The <iframe> {el} has no title attribute.',
    why: 'Screen-reader users hear only “frame” with no idea what it contains (a video, a map, an ad), so they can’t decide whether to enter it.',
    fix: 'Add a descriptive title to {el}, e.g. <iframe title="Intro video">.',
  },
  'meta-viewport': {
    what: 'The viewport meta tag disables zoom (user-scalable=no or maximum-scale too low).',
    why: 'People with low vision can’t pinch-zoom to read, which is a hard barrier on mobile.',
    fix: 'Remove user-scalable=no and any maximum-scale below 2 from the <meta name="viewport"> tag so users can zoom.',
  },
  'scrollable-region-focusable': {
    what: 'The scrollable region {el} can’t be reached or scrolled by keyboard.',
    why: 'Keyboard-only users can’t scroll the content, so part of it is unreachable.',
    fix: 'Make {el} keyboard-focusable (tabindex="0") so users can scroll it with arrow keys, or ensure a focusable child sits inside it.',
  },
  'target-size': {
    what: 'The interactive control {el} is smaller than the 24×24 CSS-pixel minimum touch target.',
    why: 'Small targets are hard to tap accurately for people with motor impairments or on touchscreens, causing mis-taps.',
    fix: 'Increase {el}’s tappable size to at least 24×24px (44×44 recommended) via padding or min-width/height, or add spacing around it.',
  },
  'th-has-data-cells': {
    what: 'A table header in {el} is not associated with any data cells.',
    why: 'Screen readers can’t announce which header describes a cell, so tabular data becomes meaningless to navigate.',
    fix: 'Ensure headers and data cells are correctly associated — use <th scope="col/row"> and proper table structure around {el}.',
  },
}

/** WCAG principle impact, used as the fallback "why" for unmapped rules. */
export function principleImpact(criterion: string | null | undefined): string {
  switch (criterion ? criterion.charAt(0) : '') {
    case '1':
      return 'People who can’t fully perceive this — screen-reader users, people with low vision or colour-blindness — may miss the content or be unable to use the page.'
    case '2':
      return 'People who navigate by keyboard or assistive technology may be unable to operate this, blocking them from completing actions on the page.'
    case '3':
      return 'Visitors may misunderstand or be unable to complete this, which increases errors, confusion, and abandonment.'
    case '4':
      return 'Assistive technologies may fail to interpret this correctly, so screen-reader and other AT users get a broken experience — and it can hurt how search engines parse the page.'
    default:
      return 'This accessibility defect can prevent some visitors — especially those using assistive technology — from using part of the page.'
  }
}

export interface EnrichedAxe {
  what: string
  why: string
  fix: string
  reference: string | null
}

function fill(s: string, selector: string | null): string {
  return s.replace(/\{el\}/g, selector ? `\`${selector}\`` : 'this element')
}

/**
 * Produce surgical what/why/fix for an axe violation by combining the knowledge
 * base with the actual failing element. Unmapped rules fall back to the rule's
 * own help/description plus principle-based impact — so every site gets a usable,
 * non-generic finding.
 */
export function enrichAxeFinding(args: {
  ruleId: string
  help: string
  description: string
  helpUrl: string | null
  criterion: string | null
  selector: string | null
  count: number
}): EnrichedAxe {
  const k = AXE_RULE_KNOWLEDGE[args.ruleId]
  const countNote = args.count > 1
    ? ` ${args.count} elements on this page are affected${args.selector ? ` (e.g. \`${args.selector}\`)` : ''}.`
    : ''
  if (k) {
    return {
      what: fill(k.what, args.selector) + countNote,
      why: k.why,
      fix: fill(k.fix, args.selector),
      reference: args.helpUrl,
    }
  }
  // Fallback for any rule we haven't mapped yet — still specific to the element.
  const sel = args.selector ? ` Affected: \`${args.selector}\`.` : ''
  return {
    what: `${args.count} element${args.count === 1 ? '' : 's'} on this page ${args.count === 1 ? 'fails' : 'fail'} the check “${args.help}”.${sel} ${args.description}.`,
    why: principleImpact(args.criterion),
    fix: `${args.help}.${args.selector ? ` Apply this to \`${args.selector}\`.` : ''} See the technical reference for exact remediation steps.`,
    reference: args.helpUrl,
  }
}
