/**
 * Audit Pipeline Specification — v1
 *
 * IMMUTABLE once deployed. To change the pipeline, create v2.
 * This file is the single source of truth for pipeline stages,
 * progress weights, timeouts, and activity feed messages.
 */

export const PIPELINE_VERSION = 'v1' as const

export type PipelineStageId =
  | 'preflight'
  | 'crawling'
  | 'checking'
  | 'probing'
  | 'analysing'
  | 'quality_gates'
  | 'reconciliation'
  | 'reporting'
  | 'enriching'
  | 'complete'

export interface PipelineStage {
  id: PipelineStageId
  /** Human-readable label for the progress UI */
  label: string
  /** Shorter label for compact displays */
  shortLabel: string
  /** Weight as percentage of total pipeline (must sum to 100) */
  progressStart: number
  progressEnd: number
  /** Hard timeout in milliseconds — stage is marked stalled if exceeded */
  timeoutMs: number
  /** Whether this stage is shown in the UI progress tracker */
  visible: boolean
  /** Activity feed messages logged at start of this stage */
  activityMessages: string[]
}

export const PIPELINE_STAGES: readonly PipelineStage[] = [
  {
    id: 'preflight',
    label: 'Preflight checks',
    shortLabel: 'Preflight',
    progressStart: 0,
    progressEnd: 4,
    timeoutMs: 30_000,
    visible: true,
    activityMessages: ['Running preflight checks...', 'Validating site accessibility...'],
  },
  {
    id: 'crawling',
    label: 'Crawling pages',
    shortLabel: 'Crawling',
    progressStart: 4,
    progressEnd: 15,
    timeoutMs: 120_000,
    visible: true,
    activityMessages: ['Discovering site pages...', 'Crawling and extracting content...'],
  },
  {
    id: 'checking',
    label: 'Running site checks',
    shortLabel: 'Checking',
    progressStart: 15,
    progressEnd: 20,
    timeoutMs: 120_000,
    visible: true,
    activityMessages: ['Testing page speed...', 'Checking responsive design...', 'Running accessibility checks...'],
  },
  {
    id: 'probing',
    label: 'AI visibility probes',
    shortLabel: 'Probing',
    progressStart: 20,
    progressEnd: 28,
    timeoutMs: 90_000,
    visible: true,
    activityMessages: ['Probing AI models for brand knowledge...', 'Testing search visibility...'],
  },
  {
    id: 'analysing',
    label: 'Analysing content',
    shortLabel: 'Analysing',
    progressStart: 28,
    progressEnd: 65,
    timeoutMs: 300_000,
    visible: true,
    activityMessages: ['Analysing UX patterns...', 'Evaluating content clarity...', 'Checking mobile experience...', 'Reviewing navigation structure...'],
  },
  {
    id: 'quality_gates',
    label: 'Quality gates',
    shortLabel: 'Quality',
    progressStart: 65,
    progressEnd: 75,
    timeoutMs: 60_000,
    visible: false,
    activityMessages: ['Running quality checks on findings...'],
  },
  {
    id: 'reconciliation',
    label: 'Reconciling findings',
    shortLabel: 'Reconciling',
    progressStart: 75,
    progressEnd: 82,
    timeoutMs: 60_000,
    visible: false,
    activityMessages: ['Deduplicating and reconciling findings...'],
  },
  {
    id: 'reporting',
    label: 'Generating report',
    shortLabel: 'Reporting',
    progressStart: 82,
    progressEnd: 90,
    timeoutMs: 120_000,
    visible: true,
    activityMessages: ['Writing executive summary...', 'Calculating category scores...'],
  },
  {
    id: 'enriching',
    label: 'Enriching results',
    shortLabel: 'Enriching',
    progressStart: 90,
    progressEnd: 99,
    timeoutMs: 180_000,
    visible: true,
    activityMessages: ['Running industry benchmarks...', 'Generating fix playbooks...', 'Finalizing results...'],
  },
  {
    id: 'complete',
    label: 'Complete',
    shortLabel: 'Done',
    progressStart: 100,
    progressEnd: 100,
    timeoutMs: 0,
    visible: true,
    activityMessages: ['Audit complete!'],
  },
] as const

/** Get a stage by ID */
export function getStage(id: PipelineStageId): PipelineStage {
  const stage = PIPELINE_STAGES.find(s => s.id === id)
  if (!stage) throw new Error(`Unknown pipeline stage: ${id}`)
  return stage
}

/** Get the visible stages for UI rendering */
export function getVisibleStages(): PipelineStage[] {
  return PIPELINE_STAGES.filter(s => s.visible)
}

/** Calculate progress percentage for a position within a stage */
export function stageProgress(stageId: PipelineStageId, fractionComplete: number): number {
  const stage = getStage(stageId)
  const clamped = Math.max(0, Math.min(1, fractionComplete))
  return Math.round(stage.progressStart + (stage.progressEnd - stage.progressStart) * clamped)
}

/** Total number of visible stages (for "X of Y complete" display) */
export const VISIBLE_STAGE_COUNT = PIPELINE_STAGES.filter(s => s.visible && s.id !== 'complete').length

/** Map from old AuditStage values to PipelineStageId for backwards compat */
export function legacyStageToSpec(stage: string): PipelineStageId {
  const map: Record<string, PipelineStageId> = {
    preflight: 'preflight',
    crawling: 'crawling',
    checking: 'checking',
    probing: 'probing',
    analysing: 'analysing',
    reporting: 'reporting',
    enriching: 'enriching',
    complete: 'complete',
  }
  return map[stage] ?? 'preflight'
}

/** Status values that indicate an audit is actively running */
export const IN_PROGRESS_STATUSES = ['payment_received', 'crawling', 'analysing', 'generating_report'] as const

/** Status values that indicate a terminal state */
export const TERMINAL_STATUSES = ['completed', 'failed', 'completed_with_warnings', 'stalled'] as const
