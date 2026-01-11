import { TaskDefinition } from '../../core/types.js';
import { createInitialTravelState } from './state.js';

export const travelTask: TaskDefinition = {
  type: 'travel',
  name: 'Travel Itinerary Planner',
  description: 'Create personalized multi-day travel itineraries',
  patterns: [
    'travel',
    'trip',
    'itinerary',
    'vacation',
    'holiday',
    'visit',
    'bali',
    'paris',
    'tokyo',
    'flight',
    'hotel',
    'destination',
  ],
  intentExamples: [
    'create an itinerary for Bali',
    'plan a trip to Tokyo',
    'help me plan my vacation',
    'I want to visit Paris',
    'plan a week in Bali',
    'create a travel plan',
    'help me plan a trip',
  ],
  createInitialState: () => createInitialTravelState() as unknown as Record<string, unknown>,
  workflow: {
    stages: [
      {
        id: 'gathering_preferences',
        name: 'Gathering Preferences',
        agent: 'preference-gathering',
        next: 'searching_options',
      },
      {
        id: 'searching_options',
        name: 'Searching Options',
        agent: 'travel-search',
        next: 'generating_itinerary',
      },
      {
        id: 'generating_itinerary',
        name: 'Generating Itinerary',
        agent: 'itinerary-planning',
        next: 'reviewing',
      },
      {
        id: 'reviewing',
        name: 'Reviewing',
        agent: 'user-review',
        next: (state) =>
          state.workflowStage === 'finalized' ? null : 'refining',
      },
      {
        id: 'refining',
        name: 'Refining Itinerary',
        agent: 'refinement',
        next: 'reviewing',
      },
    ],
    initialStage: 'gathering_preferences',
  },
};

export { TravelWorkflow } from './workflow.js';
export * from './state.js';
