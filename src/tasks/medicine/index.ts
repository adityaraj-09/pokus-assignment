import { TaskDefinition } from '../../core/types.js';
import { createInitialMedicineState } from './state.js';

export const medicineTask: TaskDefinition = {
  type: 'medicine',
  name: 'Medicine Finder',
  description: 'Find and reserve medicine at nearby pharmacies',
  patterns: [
    'medicine',
    'pharmacy',
    'drug',
    'prescription',
    'paracetamol',
    'ibuprofen',
    'aspirin',
    'antibiotic',
    'medication',
    'pill',
    'tablet',
  ],
  intentExamples: [
    'find paracetamol near me',
    'I need medicine',
    'where can I get aspirin',
    'find a pharmacy',
    'looking for ibuprofen',
    'need to buy medicine',
    'get my prescription filled',
  ],
  createInitialState: () => createInitialMedicineState() as unknown as Record<string, unknown>,
  workflow: {
    stages: [
      {
        id: 'gathering_info',
        name: 'Gathering Information',
        agent: 'medicine-info-gatherer',
        next: 'finding_pharmacies',
      },
      {
        id: 'finding_pharmacies',
        name: 'Finding Pharmacies',
        agent: 'pharmacy-discovery',
        next: 'checking_availability',
      },
      {
        id: 'checking_availability',
        name: 'Checking Availability',
        agent: 'availability-check',
        next: 'selecting_pharmacy',
      },
      {
        id: 'selecting_pharmacy',
        name: 'Selecting Pharmacy',
        agent: 'user-selection',
        next: 'calling_pharmacy',
      },
      {
        id: 'calling_pharmacy',
        name: 'Calling Pharmacy',
        agent: 'pharmacy-caller',
        next: null,
      },
    ],
    initialStage: 'gathering_info',
  },
};

export { MedicineWorkflow } from './workflow.js';
export * from './state.js';
