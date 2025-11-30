// Persona Recipes for VC Deal Sourcing
// Based on Early-Stage VC Investor (Stealth to Seed) – Deal Sourcing Recipe

export interface PersonaRecipe {
  id: string;
  name: string;
  description: string;
  
  // Positive signals (green flags)
  positiveHighlights: string[];
  
  // Negative signals (yellow flags)
  negativeHighlights: string[];
  
  // Red flags (deal breakers)
  redFlags: string[];
  
  // Initial weights for scoring
  weights: Record<string, number>;
  
  // Prompt template for AI analysis
  systemPrompt: string;
}

// ═══════════════════════════════════════════════════════════════════
// EARLY STAGE VC (Pre-seed to Seed)
// ═══════════════════════════════════════════════════════════════════
export const EARLY_STAGE_RECIPE: PersonaRecipe = {
  id: 'early',
  name: '🌱 Early Stage VC',
  description: 'Pre-seed to Seed investors looking for exceptional founders',
  
  positiveHighlights: [
    'serial_founder',
    'prior_exit',
    'yc_alumni',
    'techstars_alumni',
    'unicorn_experience',
    'fortune_500_experience',
    'vc_backed_experience',
    'stanford_alumni',
    'mit_alumni',
    'harvard_alumni',
    'phd_holder',
    'technical_background',
    'product_leader',
    'growth_leader',
    'domain_expert',
    'repeat_ceo',
    'scaled_team',
    'raised_funding'
  ],
  
  negativeHighlights: [
    'no_linkedin',
    'career_gap',
    'short_tenure',
    'no_technical_background',
    'no_startup_experience'
  ],
  
  redFlags: [
    'stealth_only',
    'no_experience',
    'junior_level',
    'consultant_only'
  ],
  
  weights: {
    serial_founder: 0.95,
    prior_exit: 0.90,
    yc_alumni: 0.85,
    techstars_alumni: 0.80,
    unicorn_experience: 0.85,
    fortune_500_experience: 0.70,
    vc_backed_experience: 0.75,
    stanford_alumni: 0.65,
    mit_alumni: 0.65,
    harvard_alumni: 0.60,
    phd_holder: 0.55,
    technical_background: 0.70,
    product_leader: 0.65,
    growth_leader: 0.60,
    domain_expert: 0.70,
    repeat_ceo: 0.80,
    scaled_team: 0.75,
    raised_funding: 0.70,
    // Negative weights
    no_linkedin: -0.30,
    career_gap: -0.20,
    short_tenure: -0.25,
    no_technical_background: -0.15,
    no_startup_experience: -0.40,
    stealth_only: -0.50,
    no_experience: -0.80,
    junior_level: -0.60,
    consultant_only: -0.35
  },
  
  systemPrompt: `You are an Early Stage VC analyst evaluating founders for Pre-seed to Seed investments.

EVALUATION CRITERIA:
1. FOUNDER QUALITY (40%): Serial founders, prior exits, top-tier accelerator alumni (YC, Techstars)
2. EXPERIENCE (30%): Unicorn/Fortune 500 experience, technical background, scaled teams before
3. EDUCATION (15%): Top universities, PhDs in relevant fields
4. SIGNALS (15%): Domain expertise, industry connections, previous fundraising success

SCORING:
- 80-100: Strong Pass - Schedule meeting immediately
- 60-79: Soft Pass - Worth a deeper look
- 40-59: Borderline - Need more context
- 0-39: Pass - Not a fit for early stage

Provide your analysis with:
1. Score (0-100)
2. Top 3 strengths
3. Top 3 concerns
4. Recommendation (STRONG_PASS / SOFT_PASS / BORDERLINE / PASS)
5. One-line summary`
};

// ═══════════════════════════════════════════════════════════════════
// GROWTH STAGE VC (Series A to C)
// ═══════════════════════════════════════════════════════════════════
export const GROWTH_STAGE_RECIPE: PersonaRecipe = {
  id: 'growth',
  name: '📈 Growth Stage VC',
  description: 'Series A to C investors looking for proven operators',
  
  positiveHighlights: [
    'scaled_company',
    'revenue_growth',
    'team_builder',
    'market_leader',
    'category_creator',
    'enterprise_sales',
    'international_expansion',
    'public_company_experience',
    'board_experience',
    'cfo_experience',
    'coo_experience',
    'vp_engineering',
    'vp_sales',
    'vp_marketing',
    'ipo_experience'
  ],
  
  negativeHighlights: [
    'early_stage_only',
    'no_scale_experience',
    'single_company',
    'small_team_only'
  ],
  
  redFlags: [
    'no_revenue_experience',
    'no_enterprise_experience',
    'startup_hopper'
  ],
  
  weights: {
    scaled_company: 0.90,
    revenue_growth: 0.85,
    team_builder: 0.80,
    market_leader: 0.85,
    category_creator: 0.90,
    enterprise_sales: 0.75,
    international_expansion: 0.70,
    public_company_experience: 0.75,
    board_experience: 0.80,
    cfo_experience: 0.70,
    coo_experience: 0.75,
    vp_engineering: 0.70,
    vp_sales: 0.70,
    vp_marketing: 0.65,
    ipo_experience: 0.85,
    // Negative weights
    early_stage_only: -0.40,
    no_scale_experience: -0.50,
    single_company: -0.20,
    small_team_only: -0.30,
    no_revenue_experience: -0.60,
    no_enterprise_experience: -0.35,
    startup_hopper: -0.45
  },
  
  systemPrompt: `You are a Growth Stage VC analyst evaluating executives for Series A to C investments.

EVALUATION CRITERIA:
1. SCALING EXPERIENCE (40%): Scaled companies from seed to growth, built large teams
2. REVENUE/GTM (30%): Enterprise sales experience, international expansion, revenue growth
3. LEADERSHIP (20%): C-suite experience, board roles, public company experience
4. TRACK RECORD (10%): IPO experience, successful exits, category creation

SCORING:
- 80-100: Strong Pass - Proven operator, schedule meeting
- 60-79: Soft Pass - Good experience, worth exploring
- 40-59: Borderline - May lack scale experience
- 0-39: Pass - Better fit for early stage

Provide your analysis with:
1. Score (0-100)
2. Top 3 strengths
3. Top 3 concerns
4. Recommendation (STRONG_PASS / SOFT_PASS / BORDERLINE / PASS)
5. One-line summary`
};

// ═══════════════════════════════════════════════════════════════════
// PRIVATE EQUITY
// ═══════════════════════════════════════════════════════════════════
export const PE_RECIPE: PersonaRecipe = {
  id: 'pe',
  name: '🏦 Private Equity',
  description: 'PE investors looking for operational excellence',
  
  positiveHighlights: [
    'fortune_500_executive',
    'turnaround_experience',
    'cost_optimization',
    'margin_improvement',
    'ma_experience',
    'integration_experience',
    'pe_backed_company',
    'ceo_experience',
    'cfo_experience',
    'coo_experience',
    'board_director',
    'industry_veteran',
    'operational_excellence',
    'ebitda_growth',
    'debt_management'
  ],
  
  negativeHighlights: [
    'startup_only',
    'no_p_and_l',
    'no_board_exposure',
    'tech_only'
  ],
  
  redFlags: [
    'no_corporate_experience',
    'junior_roles_only',
    'no_financial_acumen'
  ],
  
  weights: {
    fortune_500_executive: 0.85,
    turnaround_experience: 0.90,
    cost_optimization: 0.80,
    margin_improvement: 0.85,
    ma_experience: 0.80,
    integration_experience: 0.75,
    pe_backed_company: 0.85,
    ceo_experience: 0.90,
    cfo_experience: 0.85,
    coo_experience: 0.80,
    board_director: 0.75,
    industry_veteran: 0.70,
    operational_excellence: 0.80,
    ebitda_growth: 0.85,
    debt_management: 0.70,
    // Negative weights
    startup_only: -0.50,
    no_p_and_l: -0.45,
    no_board_exposure: -0.30,
    tech_only: -0.25,
    no_corporate_experience: -0.60,
    junior_roles_only: -0.70,
    no_financial_acumen: -0.55
  },
  
  systemPrompt: `You are a Private Equity analyst evaluating executives for portfolio companies.

EVALUATION CRITERIA:
1. OPERATIONAL EXCELLENCE (35%): Cost optimization, margin improvement, turnaround experience
2. FINANCIAL ACUMEN (30%): P&L ownership, EBITDA growth, debt management
3. CORPORATE EXPERIENCE (25%): Fortune 500, PE-backed companies, M&A integration
4. LEADERSHIP (10%): CEO/CFO/COO experience, board roles

SCORING:
- 80-100: Strong Fit - Proven operator for portfolio company
- 60-79: Good Fit - Solid experience, worth interviewing
- 40-59: Moderate Fit - May need more operational depth
- 0-39: Not a Fit - Better suited for VC-backed companies

Provide your analysis with:
1. Score (0-100)
2. Top 3 strengths
3. Top 3 concerns
4. Recommendation (STRONG_FIT / GOOD_FIT / MODERATE_FIT / NOT_FIT)
5. One-line summary`
};

// ═══════════════════════════════════════════════════════════════════
// INVESTMENT BANKER
// ═══════════════════════════════════════════════════════════════════
export const IB_RECIPE: PersonaRecipe = {
  id: 'ib',
  name: '🤝 Investment Banker',
  description: 'IB professionals looking for M&A and IPO candidates',
  
  positiveHighlights: [
    'market_leader',
    'category_leader',
    'high_growth',
    'profitable',
    'recurring_revenue',
    'strategic_asset',
    'ipo_ready',
    'acquisition_target',
    'strong_moat',
    'network_effects',
    'platform_play',
    'roll_up_potential',
    'international_presence',
    'blue_chip_customers',
    'regulatory_advantage'
  ],
  
  negativeHighlights: [
    'early_stage',
    'pre_revenue',
    'single_product',
    'concentrated_revenue'
  ],
  
  redFlags: [
    'declining_growth',
    'no_clear_exit',
    'regulatory_risk',
    'founder_dependent'
  ],
  
  weights: {
    market_leader: 0.90,
    category_leader: 0.85,
    high_growth: 0.80,
    profitable: 0.85,
    recurring_revenue: 0.80,
    strategic_asset: 0.85,
    ipo_ready: 0.90,
    acquisition_target: 0.80,
    strong_moat: 0.85,
    network_effects: 0.80,
    platform_play: 0.75,
    roll_up_potential: 0.70,
    international_presence: 0.70,
    blue_chip_customers: 0.75,
    regulatory_advantage: 0.70,
    // Negative weights
    early_stage: -0.50,
    pre_revenue: -0.60,
    single_product: -0.30,
    concentrated_revenue: -0.35,
    declining_growth: -0.70,
    no_clear_exit: -0.55,
    regulatory_risk: -0.45,
    founder_dependent: -0.40
  },
  
  systemPrompt: `You are an Investment Banking analyst evaluating companies for M&A and IPO opportunities.

EVALUATION CRITERIA:
1. MARKET POSITION (35%): Market/category leader, strong moat, network effects
2. FINANCIAL PROFILE (30%): Profitable, recurring revenue, high growth
3. EXIT POTENTIAL (25%): IPO ready, strategic acquisition target, platform play
4. RISK FACTORS (10%): Regulatory, concentration, founder dependency

SCORING:
- 80-100: Prime Target - Strong M&A/IPO candidate
- 60-79: Good Target - Worth pursuing for mandates
- 40-59: Watch List - May need more growth/scale
- 0-39: Not Ready - Too early for IB engagement

Provide your analysis with:
1. Score (0-100)
2. Top 3 strengths
3. Top 3 concerns
4. Recommendation (PRIME_TARGET / GOOD_TARGET / WATCH_LIST / NOT_READY)
5. One-line summary`
};

// ═══════════════════════════════════════════════════════════════════
// RECIPE REGISTRY
// ═══════════════════════════════════════════════════════════════════

export const PERSONA_RECIPES: Record<string, PersonaRecipe> = {
  early: EARLY_STAGE_RECIPE,
  growth: GROWTH_STAGE_RECIPE,
  pe: PE_RECIPE,
  ib: IB_RECIPE
};

export function getRecipe(personaId: string): PersonaRecipe | null {
  return PERSONA_RECIPES[personaId] || null;
}

export function getAllRecipes(): PersonaRecipe[] {
  return Object.values(PERSONA_RECIPES);
}

// ═══════════════════════════════════════════════════════════════════
// SCORING UTILITIES
// ═══════════════════════════════════════════════════════════════════

export interface ScoringResult {
  score: number;
  matchedPositive: string[];
  matchedNegative: string[];
  matchedRedFlags: string[];
  recommendation: string;
}

/**
 * Score a person against a persona recipe
 */
export function scorePersonAgainstRecipe(
  personHighlights: string[],
  recipe: PersonaRecipe,
  learnedWeights?: Record<string, number>
): ScoringResult {
  const normalizedHighlights = personHighlights.map(h => 
    h.toLowerCase().replace(/\s+/g, '_')
  );
  
  // Use learned weights if available, otherwise use recipe defaults
  const weights = learnedWeights || recipe.weights;
  
  let score = 50; // Start at neutral
  const matchedPositive: string[] = [];
  const matchedNegative: string[] = [];
  const matchedRedFlags: string[] = [];
  
  // Check positive highlights
  for (const highlight of recipe.positiveHighlights) {
    if (normalizedHighlights.some(h => h.includes(highlight) || highlight.includes(h))) {
      matchedPositive.push(highlight);
      score += (weights[highlight] || 0.5) * 20;
    }
  }
  
  // Check negative highlights
  for (const highlight of recipe.negativeHighlights) {
    if (normalizedHighlights.some(h => h.includes(highlight) || highlight.includes(h))) {
      matchedNegative.push(highlight);
      score += (weights[highlight] || -0.3) * 20;
    }
  }
  
  // Check red flags
  for (const flag of recipe.redFlags) {
    if (normalizedHighlights.some(h => h.includes(flag) || flag.includes(h))) {
      matchedRedFlags.push(flag);
      score += (weights[flag] || -0.5) * 30;
    }
  }
  
  // Clamp score
  score = Math.max(0, Math.min(100, Math.round(score)));
  
  // Determine recommendation
  let recommendation: string;
  if (score >= 80) recommendation = 'STRONG_PASS';
  else if (score >= 60) recommendation = 'SOFT_PASS';
  else if (score >= 40) recommendation = 'BORDERLINE';
  else recommendation = 'PASS';
  
  return {
    score,
    matchedPositive,
    matchedNegative,
    matchedRedFlags,
    recommendation
  };
}

