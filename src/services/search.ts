import chalk from 'chalk';
import { config, isSearchEnabled, getSearchMode, isGeminiEnabled } from '../config.js';
import {
  searchPharmacies as exaSearchPharmacies,
  searchDestination as exaSearchDestination,
  PharmacySearchResult,
  TravelSearchResult,
} from './exa-search.js';
import {
  generatePharmacies,
  generateAttractions,
  generateHotels,
  SimulatedPharmacy,
  SimulatedAttraction,
  SimulatedHotel,
} from '../simulation/data-generator.js';
import { Coordinates } from '../core/types.js';
import {
  extractAttractions as extractAttractionsFromContent,
  extractHotels as extractHotelsFromContent,
} from './extractor.js';

export interface PharmacyResult {
  id: string;
  name: string;
  address: string;
  phone: string;
  website?: string;
  location?: Coordinates;
  distance?: number;
  isOpen?: boolean;
  hours?: string;
  rating?: number;
  reviewCount?: number;
  source: 'exa' | 'simulated';
}

export interface AttractionResult {
  id: string;
  name: string;
  category: string;
  description: string;
  rating?: number;
  duration?: string;
  price?: number;
  url?: string;
  source: 'exa' | 'simulated';
}

export interface HotelResult {
  id: string;
  name: string;
  rating: number;
  pricePerNight?: number;
  location: string;
  amenities?: string[];
  reviewScore?: number;
  url?: string;
  source: 'exa' | 'simulated';
}

export async function findPharmacies(
  medicine: string,
  location: string | Coordinates,
  options: { maxResults?: number } = {}
): Promise<{ results: PharmacyResult[]; searchMode: 'real' | 'simulated' }> {
  const maxResults = options.maxResults || 6;

  if (isSearchEnabled()) {
    try {
      console.log(chalk.dim('  Using Exa API for pharmacy search...'));

      const locationStr = typeof location === 'string'
        ? location
        : `${location.latitude}, ${location.longitude}`;

      const exaResults = await exaSearchPharmacies(medicine, locationStr);

      const results: PharmacyResult[] = exaResults.slice(0, maxResults).map((r, i) => ({
        id: `exa-pharmacy-${i + 1}`,
        name: r.name,
        address: r.address,
        phone: r.phone || 'N/A',
        website: r.website,
        hours: r.hours,
        source: 'exa' as const,
      }));

      return { results, searchMode: 'real' };
    } catch (error) {
      console.log(chalk.yellow('  Exa search failed, falling back to simulation...'));
      console.log(chalk.dim(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  }

  console.log(chalk.dim('  Using simulated pharmacy data...'));

  const coords: Coordinates = typeof location === 'string'
    ? { latitude: 37.7749, longitude: -122.4194 }
    : location;

  const simulated = generatePharmacies(coords, maxResults, Date.now());

  const results: PharmacyResult[] = simulated.map((p) => ({
    id: p.id,
    name: p.name,
    address: p.address,
    phone: p.phone,
    location: p.location,
    distance: p.distance,
    isOpen: p.isOpen,
    hours: p.hours,
    rating: p.rating,
    reviewCount: p.reviewCount,
    source: 'simulated' as const,
  }));

  return { results, searchMode: 'simulated' };
}

export async function findAttractions(
  destination: string,
  options: { maxResults?: number } = {}
): Promise<{ results: AttractionResult[]; searchMode: 'real' | 'simulated' }> {
  const maxResults = options.maxResults || 10;

  if (isSearchEnabled()) {
    try {
      console.log(chalk.dim('  Using Exa API for attraction search...'));

      const exaResults = await exaSearchDestination(destination, 'attractions');

      // If Gemini is available, use LLM to extract actual attraction names
      if (isGeminiEnabled() && exaResults.length > 0) {
        console.log(chalk.dim('  Extracting attractions with Gemini AI...'));

        const rawContent = exaResults.map((r) => ({
          title: r.title,
          snippet: r.description,
          url: r.url,
        }));

        const extracted = await extractAttractionsFromContent(destination, rawContent);

        if (extracted.length > 0) {
          const results: AttractionResult[] = extracted.slice(0, maxResults).map((a, i) => ({
            id: `exa-attraction-${i + 1}`,
            name: a.name,
            category: a.category,
            description: a.description,
            duration: a.duration,
            price: a.price,
            source: 'exa' as const,
          }));

          return { results, searchMode: 'real' };
        }
      }

      // Fallback: use raw Exa results (webpage titles)
      const results: AttractionResult[] = exaResults.slice(0, maxResults).map((r, i) => ({
        id: `exa-attraction-${i + 1}`,
        name: r.title,
        category: r.category,
        description: r.description,
        rating: r.rating ? parseFloat(r.rating.replace('/5', '')) : undefined,
        price: r.price ? parseFloat(r.price.replace('$', '')) : undefined,
        url: r.url,
        source: 'exa' as const,
      }));

      return { results, searchMode: 'real' };
    } catch (error) {
      console.log(chalk.yellow('  Exa search failed, falling back to simulation...'));
    }
  }

  console.log(chalk.dim('  Using simulated attraction data...'));

  const simulated = generateAttractions(destination);

  const results: AttractionResult[] = simulated.slice(0, maxResults).map((a) => ({
    id: a.id,
    name: a.name,
    category: a.category,
    description: a.description,
    rating: a.rating,
    duration: a.duration,
    price: a.price,
    source: 'simulated' as const,
  }));

  return { results, searchMode: 'simulated' };
}

export async function findHotels(
  destination: string,
  nights: number,
  budget: 'budget' | 'mid-range' | 'luxury' = 'mid-range',
  options: { maxResults?: number } = {}
): Promise<{ results: HotelResult[]; searchMode: 'real' | 'simulated' }> {
  const maxResults = options.maxResults || 5;

  if (isSearchEnabled()) {
    try {
      console.log(chalk.dim('  Using Exa API for hotel search...'));

      const exaResults = await exaSearchDestination(destination, 'hotels');

      // If Gemini is available, use LLM to extract actual hotel names
      if (isGeminiEnabled() && exaResults.length > 0) {
        console.log(chalk.dim('  Extracting hotels with Gemini AI...'));

        const rawContent = exaResults.map((r) => ({
          title: r.title,
          snippet: r.description,
          url: r.url,
        }));

        const extracted = await extractHotelsFromContent(destination, budget, rawContent);

        if (extracted.length > 0) {
          const results: HotelResult[] = extracted.slice(0, maxResults).map((h, i) => ({
            id: `exa-hotel-${i + 1}`,
            name: h.name,
            rating: h.rating,
            pricePerNight: h.pricePerNight,
            location: h.location || destination,
            amenities: h.amenities,
            source: 'exa' as const,
          }));

          return { results, searchMode: 'real' };
        }
      }

      // Fallback: use raw Exa results
      const results: HotelResult[] = exaResults.slice(0, maxResults).map((r, i) => ({
        id: `exa-hotel-${i + 1}`,
        name: r.title,
        rating: r.rating ? parseFloat(r.rating.replace('/5', '')) : 4.0,
        pricePerNight: r.price ? parseFloat(r.price.replace('$', '').replace(',', '')) : undefined,
        location: destination,
        url: r.url,
        source: 'exa' as const,
      }));

      return { results, searchMode: 'real' };
    } catch (error) {
      console.log(chalk.yellow('  Exa search failed, falling back to simulation...'));
    }
  }

  console.log(chalk.dim('  Using simulated hotel data...'));

  const simulated = generateHotels(destination, nights, budget, maxResults);

  const results: HotelResult[] = simulated.map((h) => ({
    id: h.id,
    name: h.name,
    rating: h.rating,
    pricePerNight: h.pricePerNight,
    location: h.location,
    amenities: h.amenities,
    reviewScore: h.reviewScore,
    source: 'simulated' as const,
  }));

  return { results, searchMode: 'simulated' };
}

export async function findRestaurants(
  destination: string,
  options: { maxResults?: number } = {}
): Promise<{ results: TravelSearchResult[]; searchMode: 'real' | 'simulated' }> {
  const maxResults = options.maxResults || 5;

  if (isSearchEnabled()) {
    try {
      console.log(chalk.dim('  Using Exa API for restaurant search...'));

      const exaResults = await exaSearchDestination(destination, 'restaurants');

      return {
        results: exaResults.slice(0, maxResults),
        searchMode: 'real',
      };
    } catch (error) {
      console.log(chalk.yellow('  Exa search failed, falling back to simulation...'));
    }
  }

  console.log(chalk.dim('  Using simulated restaurant data...'));

  return {
    results: [
      {
        title: 'Local Restaurant 1',
        description: 'Popular local dining spot',
        url: '',
        category: 'restaurant',
        source: 'simulated',
      },
      {
        title: 'Local Restaurant 2',
        description: 'Traditional cuisine',
        url: '',
        category: 'restaurant',
        source: 'simulated',
      },
    ],
    searchMode: 'simulated',
  };
}

export function getSearchStatus(): {
  mode: 'real' | 'simulated';
  exaEnabled: boolean;
  message: string;
} {
  if (isSearchEnabled()) {
    return {
      mode: 'real',
      exaEnabled: true,
      message: 'Exa API enabled - using real web search',
    };
  }

  return {
    mode: 'simulated',
    exaEnabled: false,
    message: 'Exa API not configured - using simulated data. Set EXA_API_KEY to enable real search.',
  };
}
