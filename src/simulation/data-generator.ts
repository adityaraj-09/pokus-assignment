import { Coordinates } from '../core/types.js';

class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick<T>(array: T[]): T {
    return array[Math.floor(this.next() * array.length)];
  }

  shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}

export interface SimulatedPharmacy {
  id: string;
  name: string;
  address: string;
  phone: string;
  location: Coordinates;
  distance: number;
  isOpen: boolean;
  hours: string;
  rating: number;
  reviewCount: number;
}

export interface StockInfo {
  inStock: boolean;
  quantity: number;
  price: number;
  genericAvailable: boolean;
  estimatedRestock?: string;
}

const PHARMACY_CHAINS = [
  'CVS Pharmacy',
  'Walgreens',
  'Rite Aid',
  'Walmart Pharmacy',
  'Costco Pharmacy',
  'Target Pharmacy',
  'Kroger Pharmacy',
  'Safeway Pharmacy',
];

const STREET_NAMES = [
  'Main St',
  'Oak Ave',
  'Maple Blvd',
  'First St',
  'Broadway',
  'Park Ave',
  'Market St',
  'Washington Blvd',
  'Jefferson Ave',
  'Lincoln Way',
];

export function generatePharmacies(
  center: Coordinates,
  count: number = 5,
  seed: number = 42
): SimulatedPharmacy[] {
  const rng = new SeededRandom(seed);
  const pharmacies: SimulatedPharmacy[] = [];

  for (let i = 0; i < count; i++) {
    const chain = rng.pick(PHARMACY_CHAINS);
    const streetNum = rng.nextInt(100, 9999);
    const street = rng.pick(STREET_NAMES);
    const distance = rng.next() * 5;

    const latOffset = (rng.next() - 0.5) * 0.1;
    const lngOffset = (rng.next() - 0.5) * 0.1;

    const currentHour = new Date().getHours();
    const opensAt = rng.nextInt(7, 9);
    const closesAt = rng.nextInt(20, 23);
    const isOpen = currentHour >= opensAt && currentHour < closesAt;

    pharmacies.push({
      id: `pharmacy-${i + 1}`,
      name: `${chain} #${rng.nextInt(1000, 9999)}`,
      address: `${streetNum} ${street}`,
      phone: `(${rng.nextInt(200, 999)}) ${rng.nextInt(200, 999)}-${rng.nextInt(1000, 9999)}`,
      location: {
        latitude: center.latitude + latOffset,
        longitude: center.longitude + lngOffset,
      },
      distance: Math.round(distance * 10) / 10,
      isOpen,
      hours: `${opensAt}:00 AM - ${closesAt > 12 ? closesAt - 12 : closesAt}:00 ${closesAt >= 12 ? 'PM' : 'AM'}`,
      rating: Math.round((3.5 + rng.next() * 1.5) * 10) / 10,
      reviewCount: rng.nextInt(50, 500),
    });
  }

  return pharmacies.sort((a, b) => a.distance - b.distance);
}

export function generateStockInfo(
  medicineName: string,
  seed: number = 42
): StockInfo {
  const rng = new SeededRandom(seed + medicineName.length);
  const inStock = rng.next() > 0.2;

  if (inStock) {
    return {
      inStock: true,
      quantity: rng.nextInt(5, 50),
      price: Math.round((5 + rng.next() * 20) * 100) / 100,
      genericAvailable: rng.next() > 0.5,
    };
  } else {
    const restockDays = rng.nextInt(1, 5);
    const restockDate = new Date();
    restockDate.setDate(restockDate.getDate() + restockDays);

    return {
      inStock: false,
      quantity: 0,
      price: 0,
      genericAvailable: false,
      estimatedRestock: restockDate.toLocaleDateString(),
    };
  }
}

export interface SimulatedFlight {
  id: string;
  airline: string;
  flightNumber: string;
  departure: string;
  arrival: string;
  duration: string;
  price: number;
  stops: number;
}

export interface SimulatedHotel {
  id: string;
  name: string;
  rating: number;
  pricePerNight: number;
  location: string;
  amenities: string[];
  reviewScore: number;
}

export interface SimulatedAttraction {
  id: string;
  name: string;
  category: string;
  rating: number;
  duration: string;
  price: number;
  description: string;
}

const AIRLINES = ['United', 'Delta', 'American', 'Southwest', 'JetBlue', 'Alaska'];
const HOTEL_CHAINS = ['Marriott', 'Hilton', 'Hyatt', 'IHG', 'Wyndham', 'Best Western'];
const HOTEL_TYPES = ['Resort', 'Hotel', 'Inn', 'Suites', 'Lodge'];
const AMENITIES = ['Pool', 'Spa', 'Gym', 'Restaurant', 'Bar', 'Free WiFi', 'Breakfast', 'Beach Access', 'Room Service'];

interface DestinationData {
  attractions: { name: string; category: string; duration: string; price: number; description: string }[];
  restaurants: { name: string; cuisine: string; priceRange: string }[];
  neighborhoods: string[];
}

const DESTINATION_DATA: Record<string, DestinationData> = {
  bali: {
    attractions: [
      { name: 'Uluwatu Temple', category: 'Temple', duration: '2-3 hours', price: 5, description: 'Stunning clifftop temple with ocean views and traditional Kecak dance at sunset' },
      { name: 'Tegallalang Rice Terraces', category: 'Nature', duration: '2-3 hours', price: 0, description: 'Iconic stepped rice paddies with scenic walks and swing attractions' },
      { name: 'Sacred Monkey Forest', category: 'Nature', duration: '2-3 hours', price: 8, description: 'Ancient temple complex inhabited by hundreds of grey macaques' },
      { name: 'Tanah Lot Temple', category: 'Temple', duration: '2 hours', price: 5, description: 'Iconic sea temple perched on a rock formation' },
      { name: 'Mount Batur Sunrise Trek', category: 'Adventure', duration: '5-6 hours', price: 40, description: 'Early morning hike to watch sunrise from an active volcano' },
      { name: 'Tirta Empul Temple', category: 'Temple', duration: '1-2 hours', price: 3, description: 'Sacred water temple where locals and visitors participate in ritual purification' },
      { name: 'Seminyak Beach', category: 'Beach', duration: '3-4 hours', price: 0, description: 'Popular beach with upscale resorts, boutiques, and sunset views' },
      { name: 'Ubud Art Market', category: 'Shopping', duration: '2-3 hours', price: 0, description: 'Vibrant market selling handcrafted goods, textiles, and souvenirs' },
      { name: 'Waterbom Bali', category: 'Water Park', duration: '4-5 hours', price: 35, description: "Asia's best water park with thrilling slides and lazy rivers" },
      { name: 'Nusa Penida Day Trip', category: 'Day Trip', duration: 'Full day', price: 60, description: 'Island excursion to see dramatic cliffs, beaches, and manta rays' },
    ],
    restaurants: [
      { name: 'Locavore', cuisine: 'Indonesian Fine Dining', priceRange: '$$$' },
      { name: 'Warung Babi Guling', cuisine: 'Traditional Balinese', priceRange: '$' },
      { name: 'La Lucciola', cuisine: 'Italian/Seafood', priceRange: '$$' },
    ],
    neighborhoods: ['Seminyak', 'Ubud', 'Canggu', 'Kuta', 'Nusa Dua', 'Uluwatu'],
  },
  tokyo: {
    attractions: [
      { name: 'Senso-ji Temple', category: 'Temple', duration: '2 hours', price: 0, description: "Tokyo's oldest temple with iconic Thunder Gate and shopping street" },
      { name: 'Tokyo Skytree', category: 'Landmark', duration: '2 hours', price: 25, description: "World's tallest tower with panoramic city views" },
      { name: 'Shibuya Crossing', category: 'Landmark', duration: '1 hour', price: 0, description: "World's busiest pedestrian crossing and iconic Tokyo sight" },
      { name: 'Meiji Shrine', category: 'Shrine', duration: '1-2 hours', price: 0, description: 'Peaceful Shinto shrine surrounded by forest in central Tokyo' },
      { name: 'teamLab Borderless', category: 'Museum', duration: '3-4 hours', price: 30, description: 'Immersive digital art museum with stunning interactive exhibits' },
      { name: 'Tsukiji Outer Market', category: 'Food', duration: '2-3 hours', price: 0, description: 'Famous fish market area with fresh sushi and street food' },
      { name: 'Akihabara', category: 'Shopping', duration: '3-4 hours', price: 0, description: 'Electric town famous for anime, manga, and electronics' },
      { name: 'Imperial Palace Gardens', category: 'Nature', duration: '2 hours', price: 0, description: 'Beautiful gardens surrounding the Imperial Palace' },
    ],
    restaurants: [
      { name: 'Sukiyabashi Jiro', cuisine: 'Sushi', priceRange: '$$$$' },
      { name: 'Ichiran Ramen', cuisine: 'Ramen', priceRange: '$' },
      { name: 'Narisawa', cuisine: 'Innovative Japanese', priceRange: '$$$$' },
    ],
    neighborhoods: ['Shibuya', 'Shinjuku', 'Asakusa', 'Ginza', 'Harajuku', 'Roppongi'],
  },
  paris: {
    attractions: [
      { name: 'Eiffel Tower', category: 'Landmark', duration: '2-3 hours', price: 26, description: 'Iconic iron tower with stunning city views from multiple levels' },
      { name: 'Louvre Museum', category: 'Museum', duration: '4-5 hours', price: 17, description: "World's largest art museum housing the Mona Lisa" },
      { name: 'Notre-Dame Cathedral', category: 'Landmark', duration: '1 hour', price: 0, description: 'Gothic masterpiece under restoration after 2019 fire' },
      { name: 'Montmartre & Sacré-Cœur', category: 'Neighborhood', duration: '3-4 hours', price: 0, description: 'Artistic hilltop neighborhood with white basilica' },
      { name: 'Musée d\'Orsay', category: 'Museum', duration: '3 hours', price: 14, description: 'Impressionist art museum in a former railway station' },
      { name: 'Palace of Versailles', category: 'Day Trip', duration: 'Full day', price: 20, description: 'Opulent royal palace with stunning gardens' },
      { name: 'Arc de Triomphe', category: 'Landmark', duration: '1 hour', price: 13, description: 'Triumphal arch with rooftop views of the Champs-Élysées' },
      { name: 'Seine River Cruise', category: 'Tour', duration: '1-2 hours', price: 15, description: 'Scenic boat ride past major Paris landmarks' },
    ],
    restaurants: [
      { name: 'Le Comptoir du Panthéon', cuisine: 'French Bistro', priceRange: '$$' },
      { name: 'L\'Ambroisie', cuisine: 'French Fine Dining', priceRange: '$$$$' },
      { name: 'Café de Flore', cuisine: 'French Café', priceRange: '$$' },
    ],
    neighborhoods: ['Marais', 'Latin Quarter', 'Montmartre', 'Saint-Germain', 'Champs-Élysées'],
  },
};

export function generateFlights(
  origin: string,
  destination: string,
  date: string,
  count: number = 5,
  seed: number = 42
): SimulatedFlight[] {
  const rng = new SeededRandom(seed);
  const flights: SimulatedFlight[] = [];

  for (let i = 0; i < count; i++) {
    const airline = rng.pick(AIRLINES);
    const departHour = rng.nextInt(6, 22);
    const duration = rng.nextInt(2, 16);
    const stops = rng.next() > 0.6 ? 0 : rng.nextInt(1, 2);

    const arrivalHour = (departHour + duration) % 24;

    flights.push({
      id: `flight-${i + 1}`,
      airline,
      flightNumber: `${airline.substring(0, 2).toUpperCase()}${rng.nextInt(100, 9999)}`,
      departure: `${departHour.toString().padStart(2, '0')}:${rng.nextInt(0, 59).toString().padStart(2, '0')}`,
      arrival: `${arrivalHour.toString().padStart(2, '0')}:${rng.nextInt(0, 59).toString().padStart(2, '0')}`,
      duration: `${duration}h ${rng.nextInt(0, 59)}m`,
      price: rng.nextInt(200, 1500),
      stops,
    });
  }

  return flights.sort((a, b) => a.price - b.price);
}

export function generateHotels(
  destination: string,
  nights: number,
  budget: 'budget' | 'mid-range' | 'luxury' = 'mid-range',
  count: number = 5,
  seed: number = 42
): SimulatedHotel[] {
  const rng = new SeededRandom(seed);
  const hotels: SimulatedHotel[] = [];
  const destData = DESTINATION_DATA[destination.toLowerCase()] || DESTINATION_DATA.bali;

  const priceRanges = {
    'budget': { min: 30, max: 80 },
    'mid-range': { min: 80, max: 200 },
    'luxury': { min: 200, max: 600 },
  };

  const range = priceRanges[budget];

  for (let i = 0; i < count; i++) {
    const chain = rng.pick(HOTEL_CHAINS);
    const type = rng.pick(HOTEL_TYPES);
    const neighborhood = rng.pick(destData.neighborhoods);
    const amenityCount = rng.nextInt(3, 6);
    const amenities = rng.shuffle([...AMENITIES]).slice(0, amenityCount);

    hotels.push({
      id: `hotel-${i + 1}`,
      name: `${chain} ${type} ${neighborhood}`,
      rating: Math.round((3 + rng.next() * 2) * 10) / 10,
      pricePerNight: rng.nextInt(range.min, range.max),
      location: neighborhood,
      amenities,
      reviewScore: Math.round((7 + rng.next() * 3) * 10) / 10,
    });
  }

  return hotels.sort((a, b) => a.pricePerNight - b.pricePerNight);
}

export function generateAttractions(
  destination: string,
  seed: number = 42
): SimulatedAttraction[] {
  const rng = new SeededRandom(seed);
  const destData = DESTINATION_DATA[destination.toLowerCase()] || DESTINATION_DATA.bali;

  return destData.attractions.map((attr, i) => ({
    id: `attraction-${i + 1}`,
    name: attr.name,
    category: attr.category,
    rating: Math.round((4 + rng.next()) * 10) / 10,
    duration: attr.duration,
    price: attr.price,
    description: attr.description,
  }));
}

export function getDestinationData(destination: string): DestinationData | undefined {
  return DESTINATION_DATA[destination.toLowerCase()];
}
