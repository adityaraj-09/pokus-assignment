import { z } from 'zod';
import { TaskPlugin } from '../../core/plugin/types.js';
import { MedicineStateSchema, createInitialMedicineState as createInitialState } from './state.js';
import { MedicineWorkflowAdapter } from './agents/workflow-adapter.js';

export const medicinePlugin: TaskPlugin = {
  id: 'medicine',
  name: 'Medicine Finder',
  version: '1.0.0',
  description: 'Find medicine at nearby pharmacies and make reservations',

  patterns: [
    'medicine',
    'pharmacy',
    'drug',
    'prescription',
    'paracetamol',
    'ibuprofen',
    'aspirin',
    'medication',
    'pill',
    'tablet',
  ],

  intentExamples: [
    'find paracetamol near me',
    'I need medicine',
    'looking for ibuprofen',
    'where can I get aspirin',
    'find pharmacy with my medication',
  ],

  stateSchema: MedicineStateSchema,
  createInitialState,

  workflow: {
    id: 'medicine',
    name: 'Medicine Finder Workflow',
    description: 'Find and reserve medicine at nearby pharmacies',
    version: '1.0.0',
    initialStage: 'execute',

    stages: [
      {
        id: 'execute',
        name: 'Execute Medicine Workflow',
        agent: 'medicine:workflow',
        input: (state) => ({
          userInput: state.domain.userInput as string || '',
        }),
        next: null,
        timeout: 600000, // 10 minutes for interactive workflow with user input
      },
    ],
  },

  agents: [new MedicineWorkflowAdapter()],

  tools: [],
};

export default medicinePlugin;
