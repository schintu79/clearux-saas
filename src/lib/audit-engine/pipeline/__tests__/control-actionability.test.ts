// ============================================================
// WCAG 3.3.2 / 1.3.1 label-check false-positive guard
// ============================================================
// Regression guard for the raseedinvest false positive: a WCAG 3.3.2
// "form inputs lack visible labels" finding was emitted for a page whose
// inputs are purely auto-populated / display-only (disabled or readOnly),
// not user-editable. `isNonActionableControl` excludes such controls so the
// label check only judges fields the user can actually operate.

import { isNonActionableControl, type ControlActionability } from '../wcag-checker'

/** A fully actionable, visible control with no exclusion flags set. */
function actionable(overrides: Partial<ControlActionability> = {}): ControlActionability {
  return {
    disabled: false,
    readOnly: false,
    ariaHidden: false,
    hidden: false,
    displayNone: false,
    visibilityHidden: false,
    role: null,
    ...overrides,
  }
}

describe('isNonActionableControl — excludes non-remediable controls from label checks', () => {
  test('a plain visible editable input is actionable (still subject to the label check)', () => {
    expect(isNonActionableControl(actionable())).toBe(false)
  })

  test('disabled control is skipped', () => {
    expect(isNonActionableControl(actionable({ disabled: true }))).toBe(true)
  })

  test('readOnly (auto-populated / display-only) control is skipped — the raseedinvest case', () => {
    // The user reported: inputs exist but are purely auto-populated/display-only,
    // not user input fields. A "missing label" finding there is a false positive.
    expect(isNonActionableControl(actionable({ readOnly: true }))).toBe(true)
  })

  test('HTML hidden attribute control is skipped', () => {
    expect(isNonActionableControl(actionable({ hidden: true }))).toBe(true)
  })

  test('aria-hidden control is skipped (not in the accessibility tree)', () => {
    expect(isNonActionableControl(actionable({ ariaHidden: true }))).toBe(true)
  })

  test('display:none control is skipped', () => {
    expect(isNonActionableControl(actionable({ displayNone: true }))).toBe(true)
  })

  test('visibility:hidden control is skipped', () => {
    expect(isNonActionableControl(actionable({ visibilityHidden: true }))).toBe(true)
  })

  test('role=presentation and role=none are skipped', () => {
    expect(isNonActionableControl(actionable({ role: 'presentation' }))).toBe(true)
    expect(isNonActionableControl(actionable({ role: 'none' }))).toBe(true)
  })

  test('a control with a meaningful role (e.g. textbox) is still actionable', () => {
    expect(isNonActionableControl(actionable({ role: 'textbox' }))).toBe(false)
  })
})
