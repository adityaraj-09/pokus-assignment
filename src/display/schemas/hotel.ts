import { ResultDisplaySchema } from '../types.js';
import { HotelResult } from '../../services/search.js';

export const hotelSchema: ResultDisplaySchema<HotelResult> = {
  type: 'hotel',
  name: 'Hotel',
  titleField: 'name',
  descriptionField: 'location',
  fields: [
    {
      key: 'rating',
      label: 'Rating',
      type: 'rating',
      color: 'yellow',
      priority: 1,
    },
    {
      key: 'pricePerNight',
      label: 'Price',
      type: 'price',
      format: '{value}/night',
      priority: 2,
    },
    {
      key: 'amenities',
      label: 'Amenities',
      type: 'list',
      format: '3',
      priority: 3,
      hideIfEmpty: true,
    },
    {
      key: 'reviewScore',
      label: 'Reviews',
      type: 'text',
      format: '{value}/10',
      priority: 4,
      hideIfEmpty: true,
    },
  ],
  toSelectableOption: (hotel, index) => {
    const price = hotel.pricePerNight ? `$${hotel.pricePerNight}/night` : 'Price on request';
    const rating = hotel.rating ? `Rating: ${hotel.rating}` : '';
    const parts = [hotel.location, rating, price].filter(Boolean);

    return {
      label: hotel.name,
      value: hotel,
      description: parts.join(' | '),
    };
  },
};
