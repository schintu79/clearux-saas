// ============================================================
// WCAG severity doctrine (2026-06-12, Stefano's calibration call)
// ============================================================
// CRITICAL = a user literally cannot complete a task. One critical
// caps the whole site at 55, so the tier is reserved for true
// blockers. Everything else demotes to high.

import { enforceWcagSeverityDoctrine } from '../pipeline/wcag-checker'

const f = (title: string, description: string, severity: 'critical' | 'high' | 'medium' | 'low') =>
  ({ title, description, severity } as any)

describe('enforceWcagSeverityDoctrine', () => {
  it('true blockers KEEP critical: global focus removal, zoom disabled, unlabeled inputs, keyboard traps', () => {
    const blockers = [
      f('WCAG 2.4.7: Focus Visible', 'Global styling rule removes focus outlines (*:focus { outline: none }).', 'critical'),
      f('WCAG 1.4.4: Resize Text', 'Viewport meta tag disables user scaling (maximum-scale=1 or user-scalable=no).', 'critical'),
      f('WCAG 3.3.2: Labels', '4 form inputs without a label or accessible name.', 'critical'),
      f('WCAG 2.1.2: No Keyboard Trap', 'Modal dialog creates a keyboard trap — focus cannot leave.', 'critical'),
    ]
    for (const out of enforceWcagSeverityDoctrine(blockers)) {
      expect(out.severity).toBe('critical')
    }
  })

  it('non-blockers marked critical are DEMOTED to high (e.g. sub-3:1 contrast)', () => {
    const out = enforceWcagSeverityDoctrine([
      f('WCAG 1.4.3: Contrast (Minimum)', 'Text contrast ratio 2.7:1 is below the 4.5:1 requirement on secondary copy.', 'critical'),
    ])
    expect(out[0].severity).toBe('high')
  })

  it('never touches non-critical severities', () => {
    const input = [
      f('WCAG 2.4.6: Headings and Labels', 'Heading structure skips levels: h2 → h4.', 'low'),
      f('WCAG 1.4.11: Non-text Contrast', 'Interactive element may lack sufficient boundary contrast.', 'medium'),
      f('WCAG 2.4.1: Bypass Blocks', 'Missing skip-to-main-content link.', 'high'),
    ]
    const out = enforceWcagSeverityDoctrine(input)
    expect(out.map((x: any) => x.severity)).toEqual(['low', 'medium', 'high'])
  })

  it('REGRESSION fixpath 2026-06-12: the Focus Visible critical that caps the site at 55 is doctrine-legitimate', () => {
    const out = enforceWcagSeverityDoctrine([
      f('WCAG 2.4.7: Focus Visible', '[WCAG 2.4.7] Global styling rule removes focus outlines (*:focus { outline: none }). Keyboard users cannot see which element is focused.', 'critical'),
    ])
    // Keyboard users genuinely cannot navigate — this one EARNS the 55 cap.
    expect(out[0].severity).toBe('critical')
  })
})
