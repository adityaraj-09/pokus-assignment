import { ResultDisplaySchema } from '../types.js';
import { AttractionResult } from '../../services/search.js';

export const attractionSchema: ResultDisplaySchema<AttractionResult> = {
  type: 'attraction',
  name: 'Attraction',
  titleField: 'name',
  descriptionField: 'description',
  fields: [
    {
      key: 'category',
      label: 'Type',
      type: 'badge',
      color: 'cyan',
      priority: 1,
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
      key: 'duration',
      label: 'Duration',
      type: 'duration',
      priority: 3,
      hideIfEmpty: true,
    },
    {
      key: 'price',
      label: 'Price',
      type: 'price',
      priority: 4,
    },
  ],
  toSelectableOption: (attraction, index) => {
    const price = attraction.price ? `$${attraction.price}` : 'Free';
    const duration = attraction.duration || '2-3 hrs';
    const parts = [attraction.category, duration, price].filter(Boolean);

    return {
      label: attraction.name,
      value: attraction,
      description: parts.join(' | '),
    };
  },
};
