import { z } from 'zod';
import { TaskPlugin } from '../../core/plugin/types.js';
import { TravelStateSchema, createInitialTravelState as createInitialState } from './state.js';
import { TravelWorkflowAdapter } from './agents/workflow-adapter.js';

export const travelPlugin: TaskPlugin = {
  id: 'travel',
  name: 'Travel Itinerary Planner',
  version: '1.0.0',
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
  ],

  stateSchema: TravelStateSchema,
  createInitialState,

  workflow: {
    id: 'travel',
    name: 'Travel Itinerary Planner Workflow',
    description: 'Create personalized travel itineraries with activities and recommendations',
    version: '1.0.0',
    initialStage: 'execute',

    stages: [
      {
        id: 'execute',
        name: 'Execute Travel Workflow',
        agent: 'travel:workflow',
        input: (state) => ({
          userInput: state.domain.userInput as string || '',
        }),
        next: null,
        timeout: 600000, // 10 minutes for interactive workflow with user input
      },
    ],
  },

  agents: [new TravelWorkflowAdapter()],

  tools: [],
};

export default travelPlugin;
