// AI Prompts for Founder Analysis
// Designed for on-device inference with Cactus

import type { Message } from './cactusClient';
import type { Person } from '../api/specter';

/**
 * Base system prompt for founder analysis
 * Optimized for concise, investor-relevant output
 */
const FOUNDER_ANALYSIS_BASE = `You are an AI analyst for venture capital investors using the Specter platform.

Your role is to analyze founders and provide investment-relevant insights.

Guidelines:
- Be concise and direct - investors are busy
- Focus on signals that matter for investment decisions
- Acknowledge when data is limited - don't hallucinate
- Highlight both opportunities and risks honestly
- Use bullet points for easy scanning`;

/**
 * Build system prompt with optional user context
 * @param userContext - Dynamic context from AgentContext (user preferences, saved searches)
 */
export function buildSystemPrompt(userContext?: string): string {
  if (!userContext) {
    return FOUNDER_ANALYSIS_BASE;
  }
  
  return `${FOUNDER_ANALYSIS_BASE}

User Context:
${userContext}

Use this context to personalize your analysis - highlight aspects that align with the user's interests and flag potential mismatches.`;
}

/**
 * Options for building prompts with context
 */
export interface PromptOptions {
  /** Dynamic user context from AgentContext */
  userContext?: string;
}

/**
 * Build a founder summary request
 * @param person - The person to analyze
 * @param options - Optional configuration including user context
 */
export function buildFounderSummaryPrompt(person: Person, options?: PromptOptions): Message[] {
  const personContext = formatPersonForPrompt(person);
  const systemPrompt = buildSystemPrompt(options?.userContext);

  return [
    {
      role: 'system',
      content: systemPrompt,
    },
    {
      role: 'user',
      content: `Analyze this founder for an investor:

${personContext}

Provide a brief analysis with these exact sections:

**SUMMARY**
(3-4 bullet points about this person as a founder/talent)

**STRENGTHS**
(2-3 points that would appeal to investors)

**RISKS**
(2-3 concerns or open questions to validate)

Be concise. Each bullet should be 1 line.`,
    },
  ];
}

/**
 * Build a follow-up question prompt
 * @param person - The person being discussed
 * @param previousAnalysis - The previous AI analysis
 * @param question - The follow-up question
 * @param options - Optional configuration including user context
 */
export function buildFollowUpPrompt(
  person: Person,
  previousAnalysis: string,
  question: string,
  options?: PromptOptions
): Message[] {
  const personContext = formatPersonForPrompt(person);
  const systemPrompt = buildSystemPrompt(options?.userContext);

  return [
    {
      role: 'system',
      content: systemPrompt,
    },
    {
      role: 'user',
      content: `Founder profile:
${personContext}

Previous analysis:
${previousAnalysis}`,
    },
    {
      role: 'assistant',
      content: previousAnalysis,
    },
    {
      role: 'user',
      content: question,
    },
  ];
}

/**
 * Build meeting prep prompt
 * @param person - The person you're meeting
 * @param options - Optional configuration including user context
 */
export function buildMeetingPrepPrompt(person: Person, options?: PromptOptions): Message[] {
  const personContext = formatPersonForPrompt(person);
  const systemPrompt = buildSystemPrompt(options?.userContext);

  return [
    {
      role: 'system',
      content: systemPrompt,
    },
    {
      role: 'user',
      content: `I'm about to meet with this person:

${personContext}

Give me a 60-second briefing:
1. Key background (2-3 points)
2. 3 smart questions to ask based on their profile
3. 2 things to validate/watch for`,
    },
  ];
}

/**
 * Format person data for prompt context
 */
function formatPersonForPrompt(person: Person): string {
  const lines: string[] = [];

  // Basic info
  const fullName = person.full_name || `${person.first_name} ${person.last_name}`;
  lines.push(`Name: ${fullName}`);

  if (person.tagline) {
    lines.push(`Tagline: ${person.tagline}`);
  }

  if (person.location) {
    lines.push(`Location: ${person.location}`);
  }

  if (person.seniority) {
    lines.push(`Seniority: ${person.seniority}`);
  }

  if (person.years_of_experience) {
    lines.push(`Experience: ${person.years_of_experience} years`);
  }

  // Current role
  const currentRole = person.experience?.find(e => e.is_current);
  if (currentRole) {
    lines.push(`Current Role: ${currentRole.title} at ${currentRole.company_name}`);
    if (currentRole.company_size) {
      lines.push(`Company Size: ${currentRole.company_size}`);
    }
    if (currentRole.total_funding_amount) {
      const fundingM = (currentRole.total_funding_amount / 1_000_000).toFixed(1);
      lines.push(`Company Funding: $${fundingM}M`);
    }
  }

  // Highlights (most important for investors)
  if (person.people_highlights && person.people_highlights.length > 0) {
    const highlights = person.people_highlights
      .map(h => h.replace(/_/g, ' '))
      .join(', ');
    lines.push(`Highlights: ${highlights}`);
  }

  // Education
  if (person.education_level) {
    lines.push(`Education: ${person.education_level}`);
  }

  // Experience summary
  if (person.experience && person.experience.length > 1) {
    const pastRoles = person.experience
      .filter(e => !e.is_current)
      .slice(0, 2)
      .map(e => `${e.title} at ${e.company_name}`)
      .join('; ');
    if (pastRoles) {
      lines.push(`Previous: ${pastRoles}`);
    }
  }

  // Social presence
  const socialLinks: string[] = [];
  if (person.linkedin_url) socialLinks.push('LinkedIn');
  if (person.twitter_url) socialLinks.push('Twitter');
  if (person.github_url) socialLinks.push('GitHub');
  if (socialLinks.length > 0) {
    lines.push(`Social: ${socialLinks.join(', ')}`);
  }

  return lines.join('\n');
}

/**
 * Parse structured response into sections
 */
export interface ParsedAnalysis {
  summary: string[];
  strengths: string[];
  risks: string[];
  raw: string;
}

export function parseAnalysisResponse(response: string): ParsedAnalysis {
  const result: ParsedAnalysis = {
    summary: [],
    strengths: [],
    risks: [],
    raw: response,
  };

  const lines = response.split('\n').map(l => l.trim()).filter(Boolean);

  let currentSection: 'summary' | 'strengths' | 'risks' | null = null;

  for (const line of lines) {
    const lower = line.toLowerCase();

    // Detect section headers
    if (lower.includes('summary')) {
      currentSection = 'summary';
      continue;
    }
    if (lower.includes('strength')) {
      currentSection = 'strengths';
      continue;
    }
    if (lower.includes('risk') || lower.includes('concern') || lower.includes('question')) {
      currentSection = 'risks';
      continue;
    }

    // Parse bullet points
    if (line.match(/^[-*•]\s+/) || line.match(/^\d+\.\s+/)) {
      const content = line
        .replace(/^[-*•]\s*/, '')
        .replace(/^\d+\.\s*/, '')
        .replace(/^\*\*/, '')
        .replace(/\*\*$/, '')
        .trim();

      if (content && currentSection) {
        result[currentSection].push(content);
      }
    }
  }

  return result;
}


