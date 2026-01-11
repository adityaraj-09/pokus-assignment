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
- **Searches real hotels and attractions** via Exa + Gemini extraction
- **Interactive selection**: Arrow-key navigation to choose hotel and attractions
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

# Run the CLI
npm start
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
- `findPharmacies(medicine, location)`: Find nearby pharmacies
- `findAttractions(destination)`: Find tourist attractions
- `findHotels(destination, nights, budget)`: Find accommodations
- Automatic fallback from Exa to simulated data

### 4. Extractor Service (`src/services/extractor.ts`)

Generalized LLM-based data extraction from web search results:

```typescript
// Define a schema for any entity type
const restaurantSchema: ExtractionSchema = {
  entityType: 'restaurant',
  pluralName: 'restaurants',
  description: 'restaurants and dining places',
  fields: [
    { name: 'name', type: 'string', required: true },
    { name: 'cuisine', type: 'string', required: true },
    { name: 'priceRange', type: 'string', required: false },
  ],
  example: { name: 'Warung Ibu Oka', cuisine: 'Balinese', priceRange: '$$' },
};

// Extract entities from raw search content
const restaurants = await extractEntities(restaurantSchema, 'Bali', rawContent);
```

**Pre-defined schemas:**
- `attractionExtractionSchema` - Tourist attractions
- `hotelExtractionSchema` - Hotels and accommodations
- `restaurantExtractionSchema` - Restaurants and cafes
- `pharmacyExtractionSchema` - Pharmacies

**No core changes needed** to add new entity types - just define a schema!

### 5. State Store (`src/core/state-store.ts`)

Immutable state management with:
- **Base state**: Session, status, messages
- **Domain state**: Task-specific fields
- **History**: Previous states for undo/debug
- **Listeners**: UI updates on state changes

### 6. Simulation Layer (`src/simulation/`)

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
│ SEARCH_OPTIONS  │  ← Search hotels & attractions (Exa + Gemini extraction)
└────────┬────────┘
         │
┌────────▼────────┐
│ SELECT_HOTEL    │  ← User selects hotel (arrow-key navigation)
└────────┬────────┘
         │
┌────────▼────────┐
│SELECT_ATTRACTIONS│ ← User selects attractions (multi-select)
└────────┬────────┘
         │
┌────────▼────────┐
│ GEN_ITINERARY   │  ← Create multi-day plan using selections
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

## CLI

Run with `npm start`. The CLI displays:
- System status (Gemini AI, Exa API)
- Loaded plugins
- Detected task type with confidence
- Progress spinners during operations
- Formatted results

---

## Enhanced User Interface

Pokus features an interactive terminal UI for better user experience:

### Arrow-Key Selection

Instead of typing numbers, navigate with arrow keys:

```
Select your hotel: (use arrows, enter to select)
> The Oberoi Beach Resort, Bali
  Four Seasons Resort Bali at Sayan
  COMO Uma Ubud
  Alila Villas Uluwatu
```

**Controls:**
- `↑`/`↓` or `j`/`k` - Move cursor
- `Enter` - Select
- `Esc` - Cancel

### Multi-Select for Attractions

Select multiple attractions with checkboxes:

```
Select attractions for your trip (up to 9):
(arrows to move, space to toggle, enter to confirm)
> [x] Tanah Lot Temple
  [x] Tegallalang Rice Terraces
  [ ] Ubud Monkey Forest
  [x] Uluwatu Temple
Selected: 3/9
```

**Controls:**
- `Space` - Toggle selection
- `Ctrl+A` - Select all
- `Enter` - Confirm selection

### Display Schemas

Results are displayed with structured cards showing relevant details:

```
Hotels:
  1. Grand Hyatt Bali
     Rating: 4.8 | $285/night | Pool, Spa, Beach Access

Attractions:
  1. Tanah Lot Temple
     temple | 2-3 hours | $5
```

---

## Multi-Agent Architecture

Pokus uses a scalable plugin-based architecture where tasks are self-contained plugins:

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLI / Interface                           │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│                      Plugin Loader                               │
│  • Auto-discovers tasks from /tasks/*/plugin.ts                 │
│  • Registers agents, tools, workflows                           │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│                    Workflow Executor                             │
│  • Interprets WorkflowDefinition stages                         │
│  • Dispatches to registered agents                              │
│  • Manages state transitions                                    │
└───────────────────────────────┬─────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
┌───────▼───────┐       ┌───────▼───────┐       ┌───────▼───────┐
│ Shared Agents │       │ Domain Agents │       │    Tools      │
│ - Selection   │       │ - MedicineInfo│       │ - Search      │
│ - Confirmation│       │ - Itinerary   │       │ - PhoneCall   │
│ - UserInput   │       │ - Custom...   │       │ - Booking     │
└───────────────┘       └───────────────┘       └───────────────┘
                                │
                    ┌───────────▼───────────┐
                    │    State Manager      │
                    │  • Centralized state  │
                    │  • Pub/sub updates    │
                    │  • History/rollback   │
                    └───────────────────────┘
```

### Agent Types

| Category | Responsibility | Examples |
|----------|---------------|----------|
| **InformationGathering** | Collect user data via Q&A | `MedicineInfoAgent`, `PreferenceAgent` |
| **Search** | Query external services | `PharmacySearchAgent`, `AttractionSearchAgent` |
| **Generation** | Create content using LLM | `ItineraryAgent`, `RecommendationAgent` |
| **Communication** | Interact with external services | `PharmacyCallerAgent`, `BookingAgent` |
| **Shared** | Reusable across tasks | `SelectionAgent`, `ConfirmationAgent`, `ReviewAgent` |

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
    │   ├── registry.ts          # Task registry with AI classification
    │   ├── agent/               # Agent infrastructure
    │   │   ├── types.ts         # Agent interfaces
    │   │   └── base-agent.ts    # Base agent implementation
    │   ├── state/               # State management
    │   │   ├── types.ts         # State interfaces
    │   │   └── manager.ts       # Centralized StateManager
    │   ├── tools/               # Tool system
    │   │   ├── types.ts         # Tool interfaces
    │   │   ├── executor.ts      # Tool execution
    │   │   └── registry.ts      # Global tool registry
    │   ├── workflow/            # Workflow execution
    │   │   ├── types.ts         # Workflow definitions
    │   │   └── executor.ts      # Generic workflow executor
    │   └── plugin/              # Plugin system
    │       ├── types.ts         # Plugin interfaces
    │       └── loader.ts        # Auto-discovery loader
    │
    ├── agents/
    │   ├── shared/              # Reusable agents
    │   │   ├── selection-agent.ts
    │   │   ├── confirmation-agent.ts
    │   │   ├── user-input-agent.ts
    │   │   └── review-agent.ts
    │   ├── base-agent.ts        # Legacy base agent
    │   └── supervisor.ts        # Supervisor agent
    │
    ├── services/
    │   ├── gemini.ts            # Gemini AI service
    │   ├── exa-search.ts        # Exa web search
    │   ├── search.ts            # Unified search interface
    │   └── extractor.ts         # Generalized LLM data extraction
    │
    ├── ui/                      # Terminal UI components
    │   ├── types.ts             # SelectConfig, SelectResult
    │   └── terminal/
    │       ├── select.ts        # Arrow-key single selection
    │       ├── multi-select.ts  # Checkbox multi-selection
    │       └── renderer.ts      # ANSI escape utilities
    │
    ├── display/                 # Data display system
    │   ├── types.ts             # ResultDisplaySchema
    │   ├── formatters.ts        # Value formatters
    │   ├── card-builder.ts      # Card rendering
    │   └── schemas/             # Entity display schemas
    │       ├── hotel.ts
    │       ├── attraction.ts
    │       └── pharmacy.ts
    │
    ├── tasks/
    │   ├── medicine/
    │   │   ├── plugin.ts        # Task plugin definition
    │   │   ├── index.ts         # Legacy task definition
    │   │   ├── state.ts         # State schema
    │   │   ├── workflow.ts      # Workflow implementation
    │   │   └── agents/          # Domain-specific agents
    │   │
    │   └── travel/
    │       ├── plugin.ts        # Task plugin definition
    │       ├── index.ts         # Legacy task definition
    │       ├── state.ts         # State schema
    │       ├── workflow.ts      # Workflow implementation
    │       └── agents/          # Domain-specific agents
    │
    ├── simulation/
    │   ├── data-generator.ts    # Mock data generation
    │   └── phone-call.ts        # Call simulation
    │
    └── cli/
        └── simple.ts            # Plugin-based CLI
```

---

## Scalability: Adding New Tasks

With the plugin architecture, adding a new task (e.g., "Book a plumber") is simple:

### 1. Create Task Directory

```
src/tasks/plumber/
├── plugin.ts     # Plugin definition (required)
├── state.ts      # State schema
└── agents/       # Domain-specific agents
    └── workflow-adapter.ts
```

### 2. Create Plugin Definition

```typescript
// src/tasks/plumber/plugin.ts
import { TaskPlugin } from '../../core/plugin/types.js';
import { PlumberStateSchema, createInitialState } from './state.js';
import { PlumberWorkflowAdapter } from './agents/workflow-adapter.js';

export const plumberPlugin: TaskPlugin = {
  id: 'plumber',
  name: 'Book a Plumber',
  version: '1.0.0',
  description: 'Find and book plumbers for repairs',

  patterns: ['plumber', 'pipe', 'leak', 'drain', 'faucet'],
  intentExamples: ['I need a plumber', 'fix my leaky pipe'],

  stateSchema: PlumberStateSchema,
  createInitialState,

  workflow: {
    id: 'plumber',
    name: 'Plumber Booking Workflow',
    description: 'Find and book plumbers',
    version: '1.0.0',
    initialStage: 'execute',
    stages: [
      {
        id: 'execute',
        name: 'Execute Plumber Workflow',
        agent: 'plumber:workflow',
        next: null,
      },
    ],
  },

  agents: [new PlumberWorkflowAdapter()],
  tools: [],
};

export default plumberPlugin;
```

### 3. Load Plugin in CLI

```typescript
import { plumberPlugin } from '../tasks/plumber/plugin.js';
await pluginLoader.load(plumberPlugin);
```

**Result:** New task works immediately with:
- ✓ No changes to core system
- ✓ Automatic intent classification
- ✓ Workflow execution via plugin system
- ✓ State management via StateManager
- ✓ Access to shared agents (selection, confirmation, etc.)

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
