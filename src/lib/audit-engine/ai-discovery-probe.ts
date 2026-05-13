// ============================================================
// ClearUX Audit Engine — AI Discovery File Probe
// ============================================================
// Probes for AI-specific discovery files that indicate a site's
// readiness for LLM and AI agent consumption:
//   - /llms.txt (LLM-friendly site description)
//   - /.well-known/ai-plugin.json (OpenAI plugin manifest)
//   - robots.txt AI bot directives (GPTBot, ClaudeBot, etc.)
//
// PROPRIETARY — do not distribute outside the ClearUX codebase.
// ============================================================

export interface AIDiscoveryResult {
  /** /llms.txt probe */
  llmsTxt: {
    exists: boolean
    content: string | null
    sizeBytes: number
  }
  /** /.well-known/ai-plugin.json probe */
  aiPlugin: {
    exists: boolean
    manifest: Record<string, unknown> | null
    schemaVersion: string | null
  }
  /** robots.txt AI bot analysis */
  robotsAI: {
    hasRobotsTxt: boolean
    /** AI bots explicitly mentioned in robots.txt */
    mentionedBots: string[]
    /** Whether any AI bot is blocked */
    blocksAIBots: boolean
    /** Whether any AI bot is explicitly allowed */
    allowsAIBots: boolean
    /** Raw relevant lines from robots.txt */
    relevantLines: string[]
  }
  /** Overall AI readiness signals */
  summary: {
    hasLlmsTxt: boolean
    hasAiPlugin: boolean
    aiBotsAllowed: boolean
    aiBotsBlocked: boolean
    signalCount: number      // 0-4 readiness signals present
  }
}

// AI bot user-agent strings to look for in robots.txt
const AI_BOT_AGENTS = [
  'gptbot',
  'chatgpt-user',
  'claudebot',
  'claude-web',
  'anthropic-ai',
  'google-extended',
  'googleother',
  'perplexitybot',
  'cohere-ai',
  'bytespider',
  'ccbot',
  'meta-externalagent',
  'facebookbot',
  'amazonbot',
  'youbot',
]

/**
 * Probe a site for AI discovery files and bot directives.
 * Runs all probes concurrently for speed.
 */
export async function probeAIDiscovery(baseUrl: string, timeoutMs: number = 10000): Promise<AIDiscoveryResult> {
  // Normalize base URL
  const url = new URL(baseUrl)
  const origin = url.origin

  const [llmsTxt, aiPlugin, robotsAI] = await Promise.all([
    probeLlmsTxt(origin, timeoutMs),
    probeAiPlugin(origin, timeoutMs),
    probeRobotsAI(origin, timeoutMs),
  ])

  const signalCount = [
    llmsTxt.exists,
    aiPlugin.exists,
    robotsAI.allowsAIBots,
    robotsAI.hasRobotsTxt && !robotsAI.blocksAIBots,
  ].filter(Boolean).length

  return {
    llmsTxt,
    aiPlugin,
    robotsAI,
    summary: {
      hasLlmsTxt: llmsTxt.exists,
      hasAiPlugin: aiPlugin.exists,
      aiBotsAllowed: robotsAI.allowsAIBots,
      aiBotsBlocked: robotsAI.blocksAIBots,
      signalCount,
    },
  }
}

/** Format AI discovery results as text for analyzer context */
export function formatAIDiscoveryForAnalysis(result: AIDiscoveryResult): string {
  const lines: string[] = ['AI Discovery Signals:']

  // llms.txt
  if (result.llmsTxt.exists) {
    lines.push(`  llms.txt: FOUND (${result.llmsTxt.sizeBytes} bytes)`)
    if (result.llmsTxt.content) {
      const preview = result.llmsTxt.content.substring(0, 300).replace(/\n/g, ' ')
      lines.push(`  llms.txt preview: ${preview}`)
    }
  } else {
    lines.push('  llms.txt: NOT FOUND')
  }

  // AI plugin manifest
  if (result.aiPlugin.exists) {
    const manifest = result.aiPlugin.manifest
    lines.push(`  ai-plugin.json: FOUND (schema ${result.aiPlugin.schemaVersion || 'unknown'})`)
    if (manifest) {
      if (manifest.name_for_human) lines.push(`    name: ${manifest.name_for_human}`)
      if (manifest.description_for_human) lines.push(`    description: ${String(manifest.description_for_human).substring(0, 200)}`)
    }
  } else {
    lines.push('  ai-plugin.json: NOT FOUND')
  }

  // Robots.txt AI directives
  if (result.robotsAI.hasRobotsTxt) {
    if (result.robotsAI.mentionedBots.length > 0) {
      lines.push(`  robots.txt AI bots: ${result.robotsAI.mentionedBots.join(', ')}`)
      if (result.robotsAI.blocksAIBots) lines.push('  robots.txt: BLOCKS some AI bots')
      if (result.robotsAI.allowsAIBots) lines.push('  robots.txt: ALLOWS some AI bots')
    } else {
      lines.push('  robots.txt: No AI bot directives found')
    }
  } else {
    lines.push('  robots.txt: NOT FOUND')
  }

  lines.push(`  AI readiness signals: ${result.summary.signalCount}/4`)
  return lines.join('\n')
}

// ── Internal probe functions ────────────────────────────────

async function safeFetch(url: string, timeoutMs: number): Promise<Response | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'ClearUX-Audit/1.0' },
    })
    return resp
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

async function probeLlmsTxt(origin: string, timeoutMs: number) {
  const resp = await safeFetch(`${origin}/llms.txt`, timeoutMs)
  if (!resp || !resp.ok) {
    return { exists: false, content: null, sizeBytes: 0 }
  }
  const text = await resp.text()
  // Validate it looks like actual llms.txt content (not an error page)
  if (text.length < 10 || text.includes('<!DOCTYPE') || text.includes('<html')) {
    return { exists: false, content: null, sizeBytes: 0 }
  }
  return { exists: true, content: text.substring(0, 2000), sizeBytes: text.length }
}

async function probeAiPlugin(origin: string, timeoutMs: number) {
  const resp = await safeFetch(`${origin}/.well-known/ai-plugin.json`, timeoutMs)
  if (!resp || !resp.ok) {
    return { exists: false, manifest: null, schemaVersion: null }
  }
  try {
    const json = await resp.json()
    if (!json || typeof json !== 'object' || !json.schema_version) {
      return { exists: false, manifest: null, schemaVersion: null }
    }
    return {
      exists: true,
      manifest: json as Record<string, unknown>,
      schemaVersion: String(json.schema_version),
    }
  } catch {
    return { exists: false, manifest: null, schemaVersion: null }
  }
}

async function probeRobotsAI(origin: string, timeoutMs: number) {
  const resp = await safeFetch(`${origin}/robots.txt`, timeoutMs)
  if (!resp || !resp.ok) {
    return {
      hasRobotsTxt: false,
      mentionedBots: [],
      blocksAIBots: false,
      allowsAIBots: false,
      relevantLines: [],
    }
  }

  const text = await resp.text()
  if (text.includes('<!DOCTYPE') || text.includes('<html')) {
    return {
      hasRobotsTxt: false,
      mentionedBots: [],
      blocksAIBots: false,
      allowsAIBots: false,
      relevantLines: [],
    }
  }

  const lines = text.split('\n').map((l) => l.trim())
  const mentionedBots: string[] = []
  let blocksAIBots = false
  let allowsAIBots = false
  const relevantLines: string[] = []
  let currentAgent = ''

  for (const line of lines) {
    const lowerLine = line.toLowerCase()

    // Track current user-agent block
    const uaMatch = lowerLine.match(/^user-agent:\s*(.+)/)
    if (uaMatch) {
      currentAgent = uaMatch[1].trim()
      const isAIBot = AI_BOT_AGENTS.some((bot) => currentAgent.includes(bot))
      if (isAIBot && !mentionedBots.includes(currentAgent)) {
        mentionedBots.push(currentAgent)
        relevantLines.push(line)
      }
      continue
    }

    // Check if current block applies to an AI bot
    const isAIBotBlock = AI_BOT_AGENTS.some((bot) => currentAgent.includes(bot))
    if (!isAIBotBlock && currentAgent !== '*') continue

    // Check for disallow/allow directives
    if (lowerLine.startsWith('disallow:')) {
      const path = lowerLine.replace('disallow:', '').trim()
      if (path === '/' || path === '/*') {
        if (isAIBotBlock) {
          blocksAIBots = true
          relevantLines.push(line)
        }
      }
    } else if (lowerLine.startsWith('allow:')) {
      if (isAIBotBlock) {
        allowsAIBots = true
        relevantLines.push(line)
      }
    }
  }

  return {
    hasRobotsTxt: true,
    mentionedBots,
    blocksAIBots,
    allowsAIBots,
    relevantLines: relevantLines.slice(0, 20), // Limit to 20 lines
  }
}
