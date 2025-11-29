# Specter Mobile: RL Deal Agent Training Environment

## ⚡ CORE PRINCIPLE: ACTION BIAS

**This is NOT a lookup app. This is a training environment.**

Every screen, every interaction exists to **force user input** that trains the deal agent:
- **No passive browsing** - Users MUST like/dislike/save before moving on
- **No information overload** - Show just enough to force a decision
- **Every tap is a label** - Platform actions, text, voice → all feed the agent

```
USER ACTION → LABELED DATA → AGENT MEMORY → BETTER RECOMMENDATIONS
```

---

## The RL Loop (Track 1: Building Environments)

The app implements the classic RL loop:

```
┌─────────────────────────────────────────────────────────────┐
│                    RL TRAINING LOOP                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌──────────┐     ┌──────────┐     ┌──────────┐           │
│   │  AGENT   │────▶│  ACTION  │────▶│   ENV    │           │
│   │ (Cactus) │     │(surface  │     │ (User +  │           │
│   │          │     │ profile) │     │  App UI) │           │
│   └──────────┘     └──────────┘     └────┬─────┘           │
│        ▲                                  │                  │
│        │                                  ▼                  │
│   ┌────┴─────┐                    ┌──────────┐              │
│   │  UPDATE  │◀───────────────────│  REWARD  │              │
│   │ (memory) │                    │ (+1/-1)  │              │
│   └──────────┘                    └──────────┘              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### State Space
- User's accumulated preferences (industries, seniority, regions, highlights)
- Interaction history (last 100 likes/dislikes)
- Session context (time, frequency, recent searches)

### Action Space
- Which entity to surface next (person, company, signal)
- What order to present saved searches
- Which AI insights to highlight

### Reward Signals
| User Action | Reward | Why |
|-------------|--------|-----|
| **Like** | +1.0 | Positive preference signal |
| **Dislike** | -1.0 | Negative preference signal (equally valuable!) |
| **Save to List** | +2.0 | High-intent action |
| **View >10s** | +0.5 | Implicit interest |
| **Skip without action** | -0.2 | Penalize passive browsing |
| **Voice/Text input** | +0.3 | Explicit preference expression |
| **AI action accepted** | +1.5 | Agent recommendation validated |

---

## Forced Interaction Design

### Rule 1: No Exit Without Input
Every profile view MUST capture input before allowing navigation:
- Like / Dislike / Save buttons always visible
- "Not Interested" counts as valid input (dislike)
- Time spent is tracked even if no button pressed

### Rule 2: Input Modalities
Users can express preferences via:
1. **Platform Actions**: Like, Dislike, Save, Skip
2. **Voice**: "I like this founder's fintech background"
3. **Text**: "Too early stage for me"

ALL modalities feed the same AgentMemory.

### Rule 3: Entity-Specific Feedback
Every input MUST be tied to a specific entity:
- Person ID
- Company ID  
- Signal ID

No generic "I like fintech" - it must be "I like THIS fintech founder"

---

## Implementation Phases

### Phase 1: Profile Navigation ✅
Every signal type navigates to a detail screen:
- [x] People → PersonDetailScreen
- [x] Talent Signals → PersonDetailScreen (via person_id)
- [x] Interest Signals (Person) → PersonDetailScreen
- [ ] Companies → CompanyDetailScreen
- [ ] Interest Signals (Company) → CompanyDetailScreen

### Phase 2: Forced Interaction UI 🔄
- [ ] Add persistent action bar to ALL detail screens
- [ ] Block "back" navigation until action taken (or 10s elapsed)
- [ ] Add voice input button to action bar
- [ ] Add text input field for notes
- [ ] Show "Skip" as explicit dislike option

### Phase 3: Memory Integration ✅
- [x] AgentMemory class with persistence
- [x] Record all interactions with entity context
- [x] Learn preferences from patterns
- [x] Inject memory into Cactus prompts

### Phase 4: Agent Personalization
- [ ] Rank entities by predicted preference score
- [ ] Surface "Why you might like this" explanations
- [ ] Proactive notifications for high-match signals
- [ ] Export training data for offline RL

---

## Technical Stack

### On-Device AI (Cactus SDK)
- Model: Qwen3-0.6B (fast, runs on mobile)
- Tool Calling: Native function execution for Specter API
- Memory: Dynamic system prompt injection

### Data Flow
```typescript
// Every interaction follows this pattern
async function handleUserAction(
  action: 'like' | 'dislike' | 'save' | 'voice' | 'text',
  entity: { type: 'person' | 'company' | 'signal', id: string },
  context?: string // voice transcription or text note
) {
  // 1. Record to AgentMemory
  await agentMemory.recordInteraction(action, entity, context);
  
  // 2. Extract and update preferences
  await agentMemory.learnFromInteraction(entity);
  
  // 3. Rebuild system prompt for next AI call
  const newPrompt = agentMemory.buildSystemPrompt();
  
  // 4. Log for offline training export
  await trainingLogger.log({ action, entity, context, timestamp: Date.now() });
}
```

---

## Alignment with RL Hackathon

### Track 1: Building Environments ✅
The app IS the environment. `step()` = user interaction.

### Track 2: Building Task Curricula ✅
Automatic curriculum via preference learning:
1. Start with diverse entities
2. Narrow based on observed preferences
3. Occasionally inject "exploration" entities to test boundaries

### Track 3: Training Agents ✅
On-device Cactus LLM with:
- Memory-injected prompts (pseudo-training)
- Tool calling for real-time API queries
- Exportable interaction logs for offline GRPO/PPO training

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Actions per session** | 20+ | Likes + Dislikes + Saves |
| **Skip rate** | <10% | Users skipping without action |
| **Voice/Text usage** | 30%+ | Sessions with voice/text input |
| **Preference accuracy** | 80%+ | Predicted likes match actual |
| **Session frequency** | 5+/week | Return rate |

---

## Current To-Dos

### Completed ✅
- [x] Cactus SDK integration with model pre-warming
- [x] AgentContext and AgentMemory with persistence
- [x] HomeScreen with feed switching and collapsible searches
- [x] All saved search API endpoints working
- [x] Talent signal → PersonDetail navigation
- [x] Interest signal (person) → PersonDetail navigation
- [x] Company logos via Specter API
- [x] Agentic AI with Specter API tool calling

### In Progress 🔄
- [ ] CompanyDetailScreen with forced interaction
- [ ] Add action bar to PersonDetailScreen
- [ ] Track view duration on all detail screens
- [ ] Voice input integration on detail screens

### Planned 📋
- [ ] Block navigation until action taken
- [ ] Text note input for preferences
- [ ] Training data export for offline RL
- [ ] Preference-based entity ranking
- [ ] "Why you might like this" AI explanations
