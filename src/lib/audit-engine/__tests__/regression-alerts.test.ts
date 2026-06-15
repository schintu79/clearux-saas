import { detectRegressions, type RegressionInput } from '../pipeline/regression-alerts'

const base: RegressionInput = {
  previousScore: 80,
  currentScore: 80,
  previousFindings: [],
  currentFindings: [],
}

describe('detectRegressions — score drop', () => {
  it('warns on a drop ≥ threshold, escalates to critical on a big drop', () => {
    expect(detectRegressions({ ...base, previousScore: 80, currentScore: 73 })[0]).toMatchObject({ type: 'score_drop', level: 'warning' })
    expect(detectRegressions({ ...base, previousScore: 80, currentScore: 60 })[0]).toMatchObject({ type: 'score_drop', level: 'critical' })
  })
  it('ignores tiny drops and any improvement', () => {
    expect(detectRegressions({ ...base, previousScore: 80, currentScore: 78 })).toHaveLength(0)
    expect(detectRegressions({ ...base, previousScore: 70, currentScore: 85 })).toHaveLength(0)
  })
  it('never alerts on the first run (no previous score)', () => {
    expect(detectRegressions({ ...base, previousScore: null, currentScore: 40 })).toHaveLength(0)
  })
})

describe('detectRegressions — new findings', () => {
  it('flags a new critical and a new high that were not open last run', () => {
    const alerts = detectRegressions({
      ...base,
      previousFindings: [{ title: 'Old issue', severity: 'high' }],
      currentFindings: [
        { title: 'Old issue', severity: 'high' },          // carried — not new
        { title: 'Keyboard trap on checkout', severity: 'critical' }, // new critical
        { title: 'Contrast on hero', severity: 'high' },   // new high
        { title: 'Minor copy nit', severity: 'low' },      // ignored (low)
      ],
    })
    expect(alerts.find((a) => a.type === 'new_critical')?.meta.titles).toEqual(['Keyboard trap on checkout'])
    expect(alerts.find((a) => a.type === 'new_high')?.meta.titles).toEqual(['Contrast on hero'])
  })
  it('matches re-worded duplicates by normalized title (no false "new")', () => {
    const alerts = detectRegressions({
      ...base,
      previousFindings: [{ title: 'Missing <main> landmark', severity: 'high' }],
      currentFindings: [{ title: 'missing   MAIN landmark!!', severity: 'high' }],
    })
    expect(alerts).toHaveLength(0)
  })
})

describe('detectRegressions — AI answer flip (the wedge)', () => {
  it('fires when a model that vouched for you stops', () => {
    const alerts = detectRegressions({
      ...base,
      previousVerdicts: [{ model: 'DeepSeek', positive: true }, { model: 'GPT-4', positive: true }],
      currentVerdicts: [{ model: 'DeepSeek', positive: false }, { model: 'GPT-4', positive: true }],
    })
    const flip = alerts.find((a) => a.type === 'ai_answer_flip')
    expect(flip?.level).toBe('critical')
    expect(flip?.title).toMatch(/DeepSeek/)
    expect(flip?.meta).toMatchObject({ model: 'DeepSeek', to: 'negative' })
  })
  it('does not fire on an improvement (negative→positive) or a new model', () => {
    const alerts = detectRegressions({
      ...base,
      previousVerdicts: [{ model: 'DeepSeek', positive: false }],
      currentVerdicts: [{ model: 'DeepSeek', positive: true }, { model: 'Claude', positive: false }],
    })
    expect(alerts.filter((a) => a.type === 'ai_answer_flip')).toHaveLength(0)
  })
})

describe('detectRegressions — combined', () => {
  it('returns multiple alerts at once', () => {
    const alerts = detectRegressions({
      previousScore: 82,
      currentScore: 64,
      previousFindings: [],
      currentFindings: [{ title: 'New critical', severity: 'critical' }],
      previousVerdicts: [{ model: 'DeepSeek', positive: true }],
      currentVerdicts: [{ model: 'DeepSeek', positive: false }],
    })
    expect(alerts.map((a) => a.type).sort()).toEqual(['ai_answer_flip', 'new_critical', 'score_drop'])
  })
})
