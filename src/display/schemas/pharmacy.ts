import { ResultDisplaySchema } from '../types.js';
import { PharmacyResult } from '../../services/search.js';

export const pharmacySchema: ResultDisplaySchema<PharmacyResult> = {
  type: 'pharmacy',
  name: 'Pharmacy',
  titleField: 'name',
  descriptionField: 'address',
  fields: [
    {
      key: 'distance',
      label: 'Distance',
      type: 'distance',
      format: 'mi',
      priority: 1,
      hideIfEmpty: true,
    },
    {
      key: 'rating',
      label: 'Rating',
      type: 'rating',
      color: 'yellow',
      priority: 2,
      hideIfEmpty: true,
    },
    {
      key: 'hours',
      label: 'Hours',
      type: 'text',
      priority: 3,
      hideIfEmpty: true,
    },
    {
      key: 'phone',
      label: 'Phone',
      type: 'text',
      priority: 4,
    },
  ],
  toSelectableOption: (pharmacy, index) => {
    const distance = pharmacy.distance ? `${pharmacy.distance.toFixed(1)} mi` : '';
    const status = pharmacy.isOpen !== undefined
      ? (pharmacy.isOpen ? 'Open' : 'Closed')
      : '';
    const parts = [pharmacy.address, distance, status].filter(Boolean);

    return {
      label: pharmacy.name,
      value: pharmacy,
      description: parts.join(' | '),
    };
  },
};
