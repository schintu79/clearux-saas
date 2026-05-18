/**
 * Shared status logic for the AI X-Ray feature.
 *
 * Both the dashboard overview card and the full /dashboard/ai-readability
 * section render the same set of providers and need to agree on:
 *
 *   - which providers are "measured" vs "skipped" vs "errored" vs "not yet run"
 *   - what user-facing label to show for each non-measured state
 *   - how the average / visibility score is calculated and described
 *
 * Provider failures (e.g. Gemini 429 quota exceeded) MUST NOT silently count
 * as 0 — that would make a brand look invisible when the truth is "we
 * couldn't ask this model". The average is calculated from measured
 * providers only, and coverage is surfaced separately.
 */

export const AI_PLATFORMS: ReadonlyArray<{
  key: 'claude' | 'gpt4o' | 'gemini' | 'perplexity';
  label: string;
  note: string;
}> = [
  { key: 'claude',     label: 'Claude',     note: 'Anthropic' },
  { key: 'gpt4o',      label: 'ChatGPT',    note: 'OpenAI GPT-4o' },
  { key: 'gemini',     label: 'Gemini',     note: 'Google' },
  { key: 'perplexity', label: 'Perplexity', note: 'Sonar' },
];

export type ProviderKey = typeof AI_PLATFORMS[number]['key'];

export type ProbeRow = {
  model_id: string;
  model_label?: string;
  accuracy_score: number;
  status?: 'measured' | 'skipped' | 'error' | null;
  error_message?: string | null;
};

export type ProviderStatusKind = 'measured' | 'skipped' | 'error' | 'unmeasured';

export type ProviderErrorReason = 'quota' | 'auth' | 'rate_limit' | 'generic';

export type ProviderRow = {
  key: ProviderKey;
  label: string;
  note: string;
  status: ProviderStatusKind;
  /** 0-100 score if status === 'measured', else null. */
  score: number | null;
  /** Raw error_message from the provider, if any. May be long — do not render directly. */
  errorMessage: string | null;
  /** Classified reason for an error status. Null when status !== 'error'. */
  errorReason: ProviderErrorReason | null;
  /** Short, user-safe label for the non-measured state (e.g. "Quota exceeded"). */
  statusLabel: string;
  /** Longer tooltip / detail text safe to render. */
  statusTooltip: string;
};

const QUOTA_PATTERNS = [
  /\b429\b/i,
  /quota/i,
  /billing/i,
  /exceeded.*plan/i,
  /resource_?exhausted/i,
  /insufficient.*credit/i,
];

const AUTH_PATTERNS = [
  /\b401\b/i,
  /\b403\b/i,
  /unauthori[sz]ed/i,
  /forbidden/i,
  /invalid.*api.*key/i,
  /authentication/i,
];

const RATE_LIMIT_PATTERNS = [
  /rate.?limit/i,
  /too many requests/i,
];

/** Classify an error message into a coarse reason. Defensive against null. */
export function classifyProviderError(errorMessage: string | null | undefined): ProviderErrorReason {
  const msg = (errorMessage || '').trim();
  if (!msg) return 'generic';
  if (QUOTA_PATTERNS.some((re) => re.test(msg))) return 'quota';
  if (AUTH_PATTERNS.some((re) => re.test(msg))) return 'auth';
  if (RATE_LIMIT_PATTERNS.some((re) => re.test(msg))) return 'rate_limit';
  return 'generic';
}

/**
 * User-facing label for an error reason. Short enough to fit in a badge.
 * Never returns raw API response text or secrets.
 */
export function errorReasonLabel(reason: ProviderErrorReason): string {
  switch (reason) {
    case 'quota': return 'Quota exceeded';
    case 'auth': return 'Auth failed';
    case 'rate_limit': return 'Rate limited';
    case 'generic': return 'Probe failed';
  }
}

/**
 * Longer tooltip text for an error reason. Tells the user what to do.
 * Still does not expose raw API response.
 */
export function errorReasonTooltip(reason: ProviderErrorReason, providerLabel: string): string {
  switch (reason) {
    case 'quota':
      return `${providerLabel} returned a quota/billing error. Re-scan will keep failing until the provider API quota or billing is restored.`;
    case 'auth':
      return `${providerLabel} rejected the request as unauthorized. The API key for this provider is missing or invalid in this environment.`;
    case 'rate_limit':
      return `${providerLabel} rate-limited the request. Try Re-scan in a few minutes.`;
    case 'generic':
      return `${providerLabel} returned an error when asked about this brand. Re-scan may succeed if the issue is transient.`;
  }
}

/**
 * Build the per-provider rows used by both the overview card and the full
 * AI X-Ray section. Always returns one row per AI_PLATFORMS entry, in order.
 */
export function buildProviderRows(probes: ReadonlyArray<ProbeRow>): ProviderRow[] {
  const byId = new Map(probes.map((p) => [p.model_id, p]));

  return AI_PLATFORMS.map((platform) => {
    const probe = byId.get(platform.key);
    // Legacy rows that pre-date the `status` column treat presence-of-row
    // as "measured" so existing audits keep rendering correctly.
    const status: ProviderStatusKind = probe
      ? (probe.status ?? 'measured')
      : 'unmeasured';

    const score = probe && status === 'measured'
      ? Math.max(0, Math.min(100, Math.round(probe.accuracy_score)))
      : null;

    const errorMessage = probe?.error_message || null;
    const errorReason = status === 'error' ? classifyProviderError(errorMessage) : null;

    let statusLabel: string;
    let statusTooltip: string;
    if (status === 'measured') {
      statusLabel = '';
      statusTooltip = '';
    } else if (status === 'error' && errorReason) {
      statusLabel = errorReasonLabel(errorReason);
      statusTooltip = errorReasonTooltip(errorReason, platform.label);
    } else if (status === 'skipped') {
      statusLabel = 'Not configured';
      statusTooltip = `${platform.label} API key is not set in this environment.`;
    } else {
      statusLabel = 'Not yet measured';
      statusTooltip = 'Re-scan to probe this provider for the current brand.';
    }

    return {
      key: platform.key,
      label: platform.label,
      note: platform.note,
      status,
      score,
      errorMessage,
      errorReason,
      statusLabel,
      statusTooltip,
    };
  });
}

export type CoverageSummary = {
  /** Number of providers with a real score. */
  measuredCount: number;
  /** Total providers (always AI_PLATFORMS.length). */
  totalCount: number;
  /** Names of providers in an error state. */
  erroredProviderLabels: string[];
  /** Names of providers that errored specifically because of quota/billing. */
  quotaBlockedProviderLabels: string[];
  /** Average accuracy across measured providers only, or null when none. */
  average: number | null;
  /** True if any provider errored — caller should surface this. */
  hasErrors: boolean;
  /** True if at least one provider has a quota/billing error. */
  hasQuotaError: boolean;
};

/**
 * Score-coverage summary. The average is calculated from measured providers
 * only — failures are NOT treated as 0.
 */
export function summarizeCoverage(rows: ReadonlyArray<ProviderRow>): CoverageSummary {
  const measured = rows.filter((r) => r.status === 'measured' && r.score != null);
  const errored = rows.filter((r) => r.status === 'error');
  const quotaBlocked = errored.filter((r) => r.errorReason === 'quota');
  const average = measured.length > 0
    ? Math.round(measured.reduce((sum, r) => sum + (r.score as number), 0) / measured.length)
    : null;

  return {
    measuredCount: measured.length,
    totalCount: rows.length,
    erroredProviderLabels: errored.map((r) => r.label),
    quotaBlockedProviderLabels: quotaBlocked.map((r) => r.label),
    average,
    hasErrors: errored.length > 0,
    hasQuotaError: quotaBlocked.length > 0,
  };
}

/**
 * Short coverage caption shown in the UI, e.g. "3 of 4 models measured" or
 * "Gemini unavailable". Returns null when everything is measured.
 */
export function coverageCaption(coverage: CoverageSummary): string | null {
  if (coverage.measuredCount === coverage.totalCount) return null;
  if (coverage.measuredCount === 0) return 'No models measured yet';
  const unmeasured = coverage.totalCount - coverage.measuredCount;
  if (unmeasured === 1 && coverage.erroredProviderLabels.length === 1) {
    return `${coverage.erroredProviderLabels[0]} unavailable · ${coverage.measuredCount} of ${coverage.totalCount} models measured`;
  }
  return `${coverage.measuredCount} of ${coverage.totalCount} models measured`;
}
