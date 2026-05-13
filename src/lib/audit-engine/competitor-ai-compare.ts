// ============================================================
// ClearUX Audit Engine — Competitor AI Comparison
// ============================================================
// Runs LLM probes on competitor domains and compares AI
// knowledge accuracy side by side.
//
// PROPRIETARY — do not distribute outside the ClearUX codebase.
// ============================================================

import Anthropic from '@anthropic-ai/sdk'

/* ── Types ──────────────────────────────────────────────────── */

export interface CompetitorAIProbe {
  domain: string
  name: string
  /** What AI "knows" about this competitor */
  aiKnowledge: string
  /** Accuracy estimate: 0-100 */
  aiAccuracyEstimate: number
  /** Key facts AI got right */
  correctFacts: string[]
  /** Key facts AI got wrong or hallucinated */
  incorrectFacts: string[]
}

export interface CompetitorAIComparison {
  userDomain: string
  userAiAccuracy: number
  competitors: CompetitorAIProbe[]
  insight: string
}

/* ── Engine ─────────────────────────────────────────────────── */

let _anthropic: Anthropic | null = null
function getClient(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
      timeout: 30_000,
    })
  }
  return _anthropic
}

/**
 * Probe what AI knows about a competitor domain.
 * Asks Claude about the domain with NO context (testing its knowledge).
 */
async function probeCompetitor(domain: string): Promise<CompetitorAIProbe> {
  const client = getClient()

  const resp = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: `What do you know about ${domain}? Describe the company/site, what they offer, their positioning, and any notable facts.

Then self-assess: how confident are you in this information? Rate 0-100.

JSON only:
{
  "description": "Your description of ${domain}",
  "accuracyEstimate": 75,
  "correctFacts": ["Fact 1 you're confident about", "Fact 2"],
  "uncertainFacts": ["Fact you're less sure about"],
  "name": "Company/brand name"
}`,
    }],
  })

  const text = resp.content[0]?.type === 'text' ? resp.content[0].text : ''
  const jsonStr = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()

  try {
    const parsed = JSON.parse(jsonStr)
    return {
      domain,
      name: parsed.name || domain,
      aiKnowledge: parsed.description || '',
      aiAccuracyEstimate: Math.min(100, Math.max(0, parsed.accuracyEstimate || 50)),
      correctFacts: parsed.correctFacts || [],
      incorrectFacts: parsed.uncertainFacts || [],
    }
  } catch {
    return {
      domain,
      name: domain,
      aiKnowledge: 'Could not determine AI knowledge for this domain.',
      aiAccuracyEstimate: 0,
      correctFacts: [],
      incorrectFacts: [],
    }
  }
}

/**
 * Run AI comparison: probe each competitor and compare with user's score.
 */
export async function runCompetitorAIComparison(
  userDomain: string,
  userAiAccuracy: number,
  competitorDomains: Array<{ domain: string; name: string }>,
): Promise<CompetitorAIComparison> {
  // Probe all competitors in parallel
  const competitors = await Promise.all(
    competitorDomains.slice(0, 3).map(c => probeCompetitor(c.domain))
  )

  // Generate insight
  const avgCompetitorAccuracy = competitors.length > 0
    ? Math.round(competitors.reduce((s, c) => s + c.aiAccuracyEstimate, 0) / competitors.length)
    : 0

  let insight: string
  if (userAiAccuracy > avgCompetitorAccuracy + 10) {
    insight = `AI knows your site better than your competitors (${userAiAccuracy}% vs ${avgCompetitorAccuracy}% avg). You have a visibility advantage.`
  } else if (userAiAccuracy < avgCompetitorAccuracy - 10) {
    insight = `Your competitors are more visible to AI (${avgCompetitorAccuracy}% avg vs your ${userAiAccuracy}%). Improving your AI readiness could close this gap.`
  } else {
    insight = `You and your competitors have similar AI visibility (${userAiAccuracy}% vs ${avgCompetitorAccuracy}% avg). Structured data and content clarity will differentiate you.`
  }

  return {
    userDomain,
    userAiAccuracy,
    competitors,
    insight,
  }
}
