import Exa from 'exa-js';
import { config, isSearchEnabled } from '../config.js';

let exaClient: Exa | null = null;

function getExaClient(): Exa {
  if (!exaClient) {
    if (!config.exa.apiKey) {
      throw new Error('EXA_API_KEY is not set. Please set it in your .env file.');
    }
    exaClient = new Exa(config.exa.apiKey);
  }
  return exaClient;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
  author?: string;
  score?: number;
}

export interface PharmacySearchResult {
  name: string;
  address: string;
  phone?: string;
  website?: string;
  hours?: string;
  distance?: string;
  source: string;
}

export interface TravelSearchResult {
  title: string;
  description: string;
  url: string;
  category: 'attraction' | 'hotel' | 'restaurant' | 'activity' | 'general';
  price?: string;
  rating?: string;
  source: string;
}

export async function search(
  query: string,
  options: {
    numResults?: number;
    type?: 'auto' | 'neural' | 'keyword';
    includeDomains?: string[];
    excludeDomains?: string[];
  } = {}
): Promise<SearchResult[]> {
  if (!isSearchEnabled()) {
    throw new Error('Exa search is not enabled. Set EXA_API_KEY in environment.');
  }

  const exa = getExaClient();

  try {
    const response = await exa.search(query, {
      numResults: options.numResults || config.search.numResults,
      type: options.type || 'auto',
      includeDomains: options.includeDomains,
      excludeDomains: options.excludeDomains,
    });

    return response.results.map((result) => ({
      title: result.title || '',
      url: result.url,
      snippet: result.text || '',
      publishedDate: result.publishedDate,
      author: result.author,
      score: result.score,
    }));
  } catch (error) {
    console.error('Exa search error:', error);
    throw error;
  }
}

export async function searchWithContent(
  query: string,
  options: {
    numResults?: number;
    type?: 'auto' | 'neural' | 'keyword';
    includeDomains?: string[];
    excludeDomains?: string[];
    textLengthLimit?: number;
  } = {}
): Promise<SearchResult[]> {
  if (!isSearchEnabled()) {
    throw new Error('Exa search is not enabled. Set EXA_API_KEY in environment.');
  }

  const exa = getExaClient();

  try {
    const response = await exa.searchAndContents(query, {
      numResults: options.numResults || config.search.numResults,
      type: options.type || 'auto',
      includeDomains: options.includeDomains,
      excludeDomains: options.excludeDomains,
      text: {
        maxCharacters: options.textLengthLimit || 1000,
      },
    });

    return response.results.map((result) => ({
      title: result.title || '',
      url: result.url,
      snippet: result.text || '',
      publishedDate: result.publishedDate,
      author: result.author,
      score: result.score,
    }));
  } catch (error) {
    console.error('Exa search error:', error);
    throw error;
  }
}

export async function searchPharmacies(
  medicine: string,
  location: string
): Promise<PharmacySearchResult[]> {
  const query = `${medicine} pharmacy near ${location} stock availability`;

  const results = await searchWithContent(query, {
    numResults: 10,
    type: 'neural',
    includeDomains: [
      'cvs.com',
      'walgreens.com',
      'riteaid.com',
      'walmart.com',
      'costco.com',
      'target.com',
      'kroger.com',
      'yelp.com',
      'google.com/maps',
    ],
  });

  return results.map((result) => ({
    name: extractPharmacyName(result.title, result.url),
    address: extractAddress(result.snippet) || 'Address not available',
    phone: extractPhone(result.snippet),
    website: result.url,
    hours: extractHours(result.snippet),
    source: new URL(result.url).hostname,
  }));
}

export async function searchDestination(
  destination: string,
  category: 'attractions' | 'hotels' | 'restaurants' | 'activities' | 'general' = 'general'
): Promise<TravelSearchResult[]> {
  const queryMap = {
    attractions: `best attractions things to do in ${destination} tourist spots`,
    hotels: `best hotels accommodations in ${destination} where to stay`,
    restaurants: `best restaurants food dining in ${destination} where to eat`,
    activities: `activities tours experiences in ${destination}`,
    general: `${destination} travel guide itinerary tips`,
  };

  const domainMap = {
    attractions: ['tripadvisor.com', 'viator.com', 'lonelyplanet.com', 'timeout.com'],
    hotels: ['booking.com', 'hotels.com', 'tripadvisor.com', 'expedia.com'],
    restaurants: ['tripadvisor.com', 'yelp.com', 'timeout.com', 'eater.com'],
    activities: ['viator.com', 'getyourguide.com', 'tripadvisor.com', 'klook.com'],
    general: ['lonelyplanet.com', 'tripadvisor.com', 'nomadicmatt.com', 'worldnomads.com'],
  };

  const query = queryMap[category];
  const domains = domainMap[category];

  const results = await searchWithContent(query, {
    numResults: 10,
    type: 'neural',
    includeDomains: domains,
    textLengthLimit: 500,
  });

  return results.map((result) => ({
    title: result.title,
    description: result.snippet,
    url: result.url,
    category: category === 'general' ? 'general' : category.slice(0, -1) as TravelSearchResult['category'],
    rating: extractRating(result.snippet),
    price: extractPrice(result.snippet),
    source: new URL(result.url).hostname,
  }));
}

export async function searchFlights(
  origin: string,
  destination: string,
  date: string
): Promise<TravelSearchResult[]> {
  const query = `flights from ${origin} to ${destination} ${date} prices booking`;

  const results = await searchWithContent(query, {
    numResults: 5,
    type: 'neural',
    includeDomains: ['google.com/flights', 'skyscanner.com', 'kayak.com', 'expedia.com'],
  });

  return results.map((result) => ({
    title: result.title,
    description: result.snippet,
    url: result.url,
    category: 'general' as const,
    price: extractPrice(result.snippet),
    source: new URL(result.url).hostname,
  }));
}

function extractPharmacyName(title: string, url: string): string {
  const chains = ['CVS', 'Walgreens', 'Rite Aid', 'Walmart', 'Costco', 'Target', 'Kroger'];
  for (const chain of chains) {
    if (title.toLowerCase().includes(chain.toLowerCase()) || url.toLowerCase().includes(chain.toLowerCase())) {
      return chain + ' Pharmacy';
    }
  }
  return title.split('|')[0]?.trim() || title.split('-')[0]?.trim() || 'Local Pharmacy';
}

function extractAddress(text: string): string | undefined {
  const addressPattern = /\d+\s+[\w\s]+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Way|Ln|Lane)[,.\s]/i;
  const match = text.match(addressPattern);
  return match ? match[0].trim() : undefined;
}

function extractPhone(text: string): string | undefined {
  const phonePattern = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
  const match = text.match(phonePattern);
  return match ? match[0] : undefined;
}

function extractHours(text: string): string | undefined {
  const hoursPattern = /(?:open|hours?)[\s:]*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*[-–to]+\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i;
  const match = text.match(hoursPattern);
  return match ? match[1] : undefined;
}

function extractRating(text: string): string | undefined {
  const ratingPattern = /(\d+\.?\d*)\s*(?:\/\s*5|stars?|rating)/i;
  const match = text.match(ratingPattern);
  return match ? `${match[1]}/5` : undefined;
}

function extractPrice(text: string): string | undefined {
  const pricePattern = /\$\d+(?:,\d{3})*(?:\.\d{2})?/;
  const match = text.match(pricePattern);
  return match ? match[0] : undefined;
}
