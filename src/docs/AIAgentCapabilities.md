# Specter Mobile AI Agent Capabilities

## Overview
The Specter Mobile AI system is designed as an **offline-first, agentic intelligence** that helps investors evaluate founders and companies. It uses on-device LLMs (via Cactus) augmented with real-time tool calling to Specter's API.

## Core Capabilities

### 1. Founder Analysis (Deep Dive)
**Agent**: `FounderAgent` (`src/ai/founderAgent.ts`)
**Model**: Qwen-2.5-0.5B / Qwen-2.5-1.5B (via Cactus)
**Flow**:
1.  **Context Injection**: Receives `Person` data + User Preferences + Active Persona Criteria.
2.  **Reasoning Loop**: The agent evaluates the profile. If it spots a company without funding data or wants to check investors, it triggers a **Tool Call**.
3.  **Tool Execution**: `lookup_company_funding`, `check_co_investors` fetches live data from Specter API.
4.  **Synthesis**: Generates a structured analysis:
    *   **Executive Summary**: 3-4 key points.
    *   **Key Signals**: Positive indicators matching the persona.
    *   **Risk Factors**: Potential red flags.

### 2. Investment Personas & Memory
**System**: `AgentMemory` (`src/ai/agentMemory.ts`)
**Storage**: Persistent `AsyncStorage` (migrated to v4 schema).
**Features**:
*   **Persona Isolation**: Each persona ("Stealth Hunter", "Growth Scout") has its own memory bank of likes/dislikes.
*   **Preference Learning**: Learns weights for Industries, Seniority, Regions, and Highlights based on interactions.
*   **Entity Notes**: Supports granular annotations on specific data points (e.g., "Like this specific Google experience").
*   **Justification**: Can explain *why* a profile matches based on learned patterns (e.g., "Matches your 'Big Tech + Top Tier' pattern").

### 3. Bulk Actions (Agentic Sourcing)
**System**: `HomeScreen` / `AgentMemory`
**Features**:
*   **Auto-Scoring**: Scores a list of 20+ profiles against the Active Persona.
*   **Auto-Process**: Can "Like All Matches" or "Pass All Non-Matches" automatically.
*   **Filtering**: Uses inferred fields (like Funding Stage) even if not explicitly in the primary filter set.

### 4. Multi-Modal Input
**System**: `InputManager` (`src/ai/inputManager.ts`)
**Features**:
*   **Voice**: Transcribes voice notes for context (e.g., "Find me more engineers like this").
*   **Interaction Tracking**: Tracks dwell time, scroll depth, and taps as implicit signals.

---

## Tooling & Data Flow

### Available Tools (`src/ai/analysisTools.ts`)
These are read-only tools the agent can call during analysis:

| Tool Name | Description | Inputs | Data Source |
|-----------|-------------|--------|-------------|
| `lookup_company_funding` | Get funding, investors, employees for a company ID | `company_id` | `fetchCompanyDetail` API |
| `check_co_investors` | List investors on the cap table | `company_id` | `fetchCompanyDetail` API |
| `find_similar_profiles` | (Placeholder) Find alumni/similar roles | `company_id`, `role` | *Future* |

### Data Flow Diagram
```
User View Profile 
       │
       ▼
[FounderAgent] <─── [AgentMemory] (Prefs, Persona)
       │
       │ (Reasoning Loop)
       ▼
   Needs Info? ──► [ToolManager] ──► [Specter API]
       │                 │
       │                 ▼
       │           [Verified Data]
       │                 │
       ▼                 │
[LLM Inference] ◄────────┘
       │
       ▼
[UI Display] (Analysis + "Investigating" state)
```

---

## Logging & Observability

### Key Logs
We log these events for troubleshooting:

*   **`FounderAgent`**:
    *   `Starting founder analysis`: Inputs (Person ID, context presence).
    *   `Agent triggering tools`: Count of tool calls requested.
    *   `Analysis complete`: Token speed, time taken, loop count.
*   **`AnalysisTool`**:
    *   `Executed [tool_name]`: Inputs and result snippet.
*   **`CactusClient`**:
    *   `🎭 PERSONA-AWARE COMPLETION`: Metadata about the active persona and context injected.
    *   `System prompt preview`: First 500 chars of the prompt.
*   **`AgentContext`**:
    *   `Recorded LIKE/DISLIKE`: User feedback actions.

### Diagnostics Screen
The in-app Diagnostics screen (`Settings -> AI & Data -> Diagnostics`) visualizes:
1.  **Prompt Inspector**: See exactly what was sent to the LLM and what it replied.
2.  **Memory Inspector**: View learned weights and entity notes per persona.
3.  **Logs**: Real-time stream of the logs mentioned above.

---

## Troubleshooting Guide

### Problem: "AI Analysis is generic / hallucinating"
*   **Check**: Diagnostics -> Prompts.
*   **Look for**: Is the `System Prompt` containing the `[Verified Data]` from tools? If not, the tool loop might be failing or maxing out steps.

### Problem: "Bulk actions aren't matching correctly"
*   **Check**: AgentMemory -> Active Persona criteria.
*   **Debug**: The scoring logic relies on `inferFundingStage` and `signalType`. Ensure the feed provides these (Talent feed does, People feed infers).

### Problem: "Investigating..." hangs
*   **Check**: Logs for `fetchCompanyDetail` errors (401/500).
*   **Cause**: API key issues or rate limits on the Specter API. The agent loop should handle errors gracefully, but a timeout might occur.

