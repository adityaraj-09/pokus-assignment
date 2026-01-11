# Pokus - Real-World Task Completion System

A multi-agent AI system designed to **complete real-world tasks**, not just answer questions. Pokus goes beyond suggestions to gather information, handle uncertainty, and drive tasks to clear completion.

## Overview

Most AI assistants stop at suggestions. Pokus is different:

- **Gathers missing information** through conversational clarification
- **Handles uncertainty** with progressive disclosure and fallbacks
- **Simulates end-mile execution** (phone calls, reservations) with realistic transcripts
- **Drives to completion** with clear, actionable outcomes

## Demo Tasks

### 1. Medicine Finder
```
"Find paracetamol near me"
```
- Gathers medicine details, quantity, urgency
- Discovers nearby pharmacies with real-time availability
- Simulates pharmacy phone call with realistic transcript
- Returns reservation confirmation with pickup details

### 2. Travel Itinerary Planner
```
"Create an itinerary for Bali"
```
- Collects preferences (dates, budget, interests, pace)
- Generates multi-day itinerary with activities and meals (AI-powered when Gemini is enabled)
- Supports iterative refinement based on feedback
- Produces a complete, followable travel plan with packing tips and best time to visit

---

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env to add your API keys

# Build the project
npm run build

# Run the interactive CLI (Inquirer-based)
npm start

# Or run the simple CLI (Readline-based)
npm run simple

# Run demo mode
npm start demo
```

---

## API Configuration

Pokus uses two external APIs for enhanced functionality. Both are optional - the system gracefully falls back to simulated data when not configured.

### Google Gemini AI

Gemini powers intelligent features:
- **Intent Classification**: AI-powered task type detection with confidence scoring
- **Itinerary Generation**: Rich travel plans with summaries, packing tips, and recommendations

Setup:
1. Get an API key from [Google AI Studio](https://aistudio.google.com/apikey)
2. Add to your `.env` file:
```bash
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash  # Optional, defaults to gemini-1.5-flash
```

### Exa Web Search

Exa provides real web search for:
- Real pharmacies near the user's location
- Actual attractions, hotels, and restaurants at travel destinations
- Up-to-date information from TripAdvisor, Booking.com, etc.

Setup:
1. Get an API key from [Exa](https://exa.ai)
2. Add to your `.env` file:
```bash
EXA_API_KEY=your_exa_api_key_here
```

### Feature Availability Matrix

| Feature | With API Keys | Without API Keys |
|---------|--------------|------------------|
| **Intent Classification** | AI-powered via Gemini | Rule-based pattern matching |
| **Itinerary Generation** | AI-generated with rich details | Template-based generation |
| **Pharmacy Search** | Real web search via Exa | Simulated pharmacy data |
| **Attraction Search** | Real TripAdvisor data | Pre-generated mock data |

The system displays status on startup:
```
✓ Gemini AI enabled (gemini-1.5-flash)
✓ Exa API enabled - using real web search
```
or
```
⚠ Gemini AI not configured - using rule-based logic
⚠ Exa API not configured - using simulated data
```

---

## Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLI INTERFACE                             │
│  [CommandParser] → [UserSession] → [ProgressUI] → [Output]      │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│                     SUPERVISOR AGENT                             │
│  • Classifies user intent (Gemini AI or pattern matching)        │
│  • Routes to appropriate domain agent                            │
│  • Manages global conversation state                             │
└───────────────────────────────┬─────────────────────────────────┘
                    ┌───────────┴───────────┐
                    │                       │
          ┌─────────▼─────────┐   ┌─────────▼─────────┐
          │  MEDICINE DOMAIN  │   │   TRAVEL DOMAIN   │
          │      WORKFLOW     │   │      WORKFLOW     │
          └─────────┬─────────┘   └─────────┬─────────┘
                    │                       │
    ┌───────────────┼───────────────┐       │
    │               │               │       ├───────────────┐
    ▼               ▼               ▼       ▼               ▼
┌─────────┐   ┌─────────┐   ┌─────────┐  ┌─────────┐  ┌─────────┐
│Pharmacy │   │Availab- │   │Pharmacy │  │Preference│  │Itinerary│
│Discovery│   │ility    │   │Caller   │  │Gathering │  │Planning │
│         │   │Check    │   │         │  │          │  │(Gemini) │
└─────────┘   └─────────┘   └─────────┘  └─────────┘  └─────────┘
                                │
                                ▼
              ┌─────────────────────────────────────┐
              │         SERVICES LAYER              │
              │  [Gemini AI] [Exa Search] [Phone]   │
              └─────────────────────────────────────┘
```

### Multi-Agent Coordination Pattern

Pokus uses a **Supervisor + Domain Workflow** pattern:

1. **Supervisor Agent**: Classifies intent (AI or rule-based), routes to domain workflows
2. **Domain Workflows**: Orchestrate multi-step task execution
3. **Services Layer**: Gemini AI for generation, Exa for search, simulation for fallback

This hybrid approach balances:
- Central control (supervisor knows global state)
- Domain autonomy (workflows manage their own logic)
- Clear handoffs (explicit stage transitions)
- Graceful degradation (AI → rule-based fallback)

---

## Core Components

### 1. Task Registry (`src/core/registry.ts`)

The scalability backbone with AI-enhanced classification:

```typescript
interface TaskDefinition {
  type: string;
  name: string;
  patterns: string[];
  intentExamples: string[];
  createInitialState: () => State;
  workflow: WorkflowDefinition;
}
```

**Classification Methods**:
- `classify(input)`: Rule-based pattern matching
- `classifyWithAI(input)`: Gemini-powered classification with fallback

### 2. Gemini Service (`src/services/gemini.ts`)

AI-powered capabilities:
- `classifyIntent(input)`: Task type detection with confidence
- `generateItinerary(...)`: Rich travel plan generation
- `getPharmacyRecommendation(...)`: Smart pharmacy suggestions

### 3. Search Service (`src/services/search.ts`)

Unified search interface:
- `searchPharmacies(location)`: Find nearby pharmacies
- `searchAttractions(destination, interests)`: Find activities
- Automatic fallback from Exa to simulated data

### 4. State Store (`src/core/state-store.ts`)

Immutable state management with:
- **Base state**: Session, status, messages
- **Domain state**: Task-specific fields
- **History**: Previous states for undo/debug
- **Listeners**: UI updates on state changes

### 5. Simulation Layer (`src/simulation/`)

Realistic mock APIs for demo/testing:

| Simulator | Purpose |
|-----------|---------|
| `data-generator.ts` | Pharmacies, hotels, attractions |
| `phone-call.ts` | Call transcripts with scenarios |

---

## Workflow Design

### Medicine Finder Workflow

```
┌─────────────────┐
│ GATHERING_INFO  │  ← Collect medicine name, quantity, urgency
└────────┬────────┘
         │
┌────────▼────────┐
│ FINDING_PHARMA  │  ← Search nearby pharmacies (Exa or simulated)
└────────┬────────┘
         │
┌────────▼────────┐
│ CHECK_AVAILAB   │  ← Check stock at each pharmacy
└────────┬────────┘
         │
┌────────▼────────┐
│ SELECT_PHARMACY │  ← User selects from available options
└────────┬────────┘
         │
┌────────▼────────┐
│ CALLING_PHARMA  │  ← Simulate phone call with transcript
└────────┬────────┘
         │
┌────────▼────────┐
│   COMPLETED     │  ← Reservation confirmed
└─────────────────┘
```

### Travel Planner Workflow

```
┌─────────────────┐
│ GATHER_PREFS    │  ← Destination, dates, budget, interests
└────────┬────────┘
         │
┌────────▼────────┐
│ GEN_ITINERARY   │  ← Create multi-day plan (Gemini or template)
└────────┬────────┘
         │
┌────────▼────────┐
│   REVIEWING     │◄─────────────────┐
└────────┬────────┘                  │
         │                           │
    ┌────┴────┐                      │
    │ Approve │ Refine               │
    ▼         ▼                      │
┌────────┐ ┌────────┐                │
│FINALIZE│ │REFINING│────────────────┘
└────────┘ └────────┘
```

When Gemini is enabled, itineraries include:
- AI-generated daily themes and activities
- Personalized restaurant recommendations
- Trip summary with highlights
- Packing tips for the destination
- Best time to visit information

---

## CLI Modes

### Interactive CLI (`npm start`)
Uses Inquirer.js for rich interactive prompts with arrow key navigation.

### Simple CLI (`npm run simple`)
Uses Node.js readline for lightweight terminal interaction.

Both modes display:
- API status on startup
- Detected task type with confidence
- Progress spinners during operations
- Formatted results

---

## Project Structure

```
pokus/
├── package.json
├── tsconfig.json
├── .env.example
├── README.md
│
└── src/
    ├── index.ts                 # Entry point
    ├── config.ts                # Configuration management
    │
    ├── core/
    │   ├── types.ts             # Shared type definitions
    │   ├── state-store.ts       # State management
    │   └── registry.ts          # Task registry with AI classification
    │
    ├── agents/
    │   ├── base-agent.ts        # Base agent class (Gemini)
    │   └── supervisor.ts        # Supervisor agent
    │
    ├── services/
    │   ├── gemini.ts            # Gemini AI service
    │   ├── exa-search.ts        # Exa web search
    │   └── search.ts            # Unified search interface
    │
    ├── tasks/
    │   ├── medicine/
    │   │   ├── index.ts         # Task definition
    │   │   ├── state.ts         # State schema
    │   │   └── workflow.ts      # Workflow implementation
    │   │
    │   └── travel/
    │       ├── index.ts
    │       ├── state.ts         # Includes AI-generated fields
    │       └── workflow.ts      # Gemini integration for itinerary
    │
    ├── simulation/
    │   ├── data-generator.ts    # Mock data generation
    │   └── phone-call.ts        # Call simulation
    │
    └── cli/
        ├── index.ts             # Inquirer-based CLI
        ├── simple.ts            # Readline-based CLI
        └── prompts.ts           # User interaction utilities
```

---

## Scalability: Adding New Tasks

Adding a new task (e.g., "Book a plumber") requires:

### 1. Create Task Directory

```
src/tasks/plumber/
├── index.ts      # Task definition
├── state.ts      # State schema
└── workflow.ts   # Workflow implementation
```

### 2. Define Task Schema

```typescript
export const PlumberStateSchema = BaseStateSchema.extend({
  domain: z.literal('plumber'),
  issueType: z.string().optional(),
  urgency: z.enum(['emergency', 'urgent', 'scheduled']).optional(),
  preferredTime: z.string().optional(),
  selectedPlumber: PlumberSchema.optional(),
  booking: BookingSchema.optional(),
});
```

### 3. Implement Workflow

```typescript
export class PlumberWorkflow {
  async run(input: string): Promise<PlumberState> {
    await this.gatherIssueDetails(input);
    await this.findPlumbers();
    await this.checkAvailability();
    await this.bookAppointment();
    return this.getState();
  }
}
```

### 4. Register Task

```typescript
export const plumberTask: TaskDefinition = {
  type: 'plumber',
  name: 'Plumber Booking',
  patterns: ['plumber', 'pipe', 'leak', 'drain', 'faucet'],
  intentExamples: ['I need a plumber', 'fix my leaky pipe'],
  createInitialState: () => createInitialPlumberState(),
  workflow: plumberWorkflow,
};

registry.register(plumberTask);
```

**No changes to core system required.**

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | No | Google Gemini API key for AI features |
| `GEMINI_MODEL` | No | Model to use (default: `gemini-1.5-flash`) |
| `EXA_API_KEY` | No | Exa API key for web search |

Example `.env`:
```bash
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash
EXA_API_KEY=your_exa_api_key_here
```

---

## Design Decisions & Trade-offs

| Decision | Rationale | Trade-off |
|----------|-----------|-----------|
| **Gemini AI** | Fast, cost-effective, good JSON output | Google ecosystem dependency |
| **Supervisor pattern** | Central control over routing | Supervisor becomes bottleneck at scale |
| **Zod for schemas** | Runtime + compile-time type safety | Extra dependency |
| **Full simulation** | Demo without real APIs | Must keep simulations realistic |
| **Workflow-based** | Clear stage transitions | Less flexible than pure agent chat |
| **CLI-first** | Faster development, testable | No visual UI (optional extension) |

### Hybrid AI Approach

Pokus uses a **hybrid approach**:
- Gemini AI for classification and content generation
- Deterministic workflows for task execution
- Graceful fallback to rule-based logic when AI unavailable
- Simulations for external interactions

---

## Future Extensions

### Generative UI (Web)
```typescript
<PharmacySelector
  pharmacies={state.pharmacies}
  availability={state.availability}
  onSelect={(pharmacy) => workflow.selectPharmacy(pharmacy)}
/>
```

### Real API Integration
Replace simulation layer with real APIs:
- Google Places API for pharmacy search
- Twilio for actual phone calls
- Stripe for payments

### Additional Tasks
- **Grocery Pickup**: Find items, check store inventory, schedule pickup
- **Home Services**: Book electrician, cleaner, handyman
- **Appointment Booking**: Doctor, dentist, salon

---

## References

- [Google Gemini API](https://ai.google.dev/docs)
- [Exa Search API](https://docs.exa.ai)
- [LangGraph Multi-Agent Systems](https://langchain-ai.github.io/langgraphjs/concepts/multi_agent/)
- [CopilotKit Generative UI](https://docs.copilotkit.ai/)

---

## License

MIT

---

## Author

Built as a design exercise for real-world AI task completion systems.
