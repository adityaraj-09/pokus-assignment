/**
 * Generalized LLM-based data extraction service.
 * This service can extract structured data from raw search content using Gemini AI.
 *
 * To add a new entity type:
 * 1. Define an ExtractionSchema for your entity
 * 2. Call extractEntities() with your schema and raw content
 *
 * Example:
 * ```typescript
 * const restaurantSchema: ExtractionSchema = {
 *   entityType: 'restaurant',
 *   pluralName: 'restaurants',
 *   description: 'restaurants and dining places',
 *   fields: [
 *     { name: 'name', type: 'string', required: true },
 *     { name: 'cuisine', type: 'string', required: true },
 *     { name: 'priceRange', type: 'string', required: false },
 *     { name: 'rating', type: 'number', required: false },
 *   ],
 *   example: {
 *     name: 'Warung Babi Guling',
 *     cuisine: 'Balinese',
 *     priceRange: '$$',
 *     rating: 4.5,
 *   },
 * };
 *
 * const restaurants = await extractEntities(restaurantSchema, 'Bali', rawContent);
 * ```
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { config, isGeminiEnabled } from '../config.js';

let genAI: GoogleGenerativeAI | null = null;
let model: GenerativeModel | null = null;

function getModel(): GenerativeModel {
  if (!model) {
    if (!config.gemini.apiKey) {
      throw new Error('GEMINI_API_KEY is not set. Please set it in your .env file.');
    }
    genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    model = genAI.getGenerativeModel({ model: config.gemini.model });
  }
  return model;
}

/**
 * Field definition for an extraction schema
 */
export interface FieldDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  required: boolean;
  description?: string;
}

/**
 * Schema that defines how to extract entities from raw content
 */
export interface ExtractionSchema {
  /** Singular name of the entity type (e.g., 'attraction', 'hotel', 'restaurant') */
  entityType: string;
  /** Plural name for prompts (e.g., 'attractions', 'hotels', 'restaurants') */
  pluralName: string;
  /** Description for the LLM (e.g., 'tourist attractions and points of interest') */
  description: string;
  /** Fields to extract */
  fields: FieldDefinition[];
  /** Example entity for the LLM prompt */
  example: Record<string, unknown>;
  /** Categories if applicable (e.g., ['temple', 'beach', 'museum']) */
  categories?: string[];
  /** Additional context for extraction */
  extractionHints?: string;
}

/**
 * Raw content from search results
 */
export interface RawContent {
  title: string;
  snippet: string;
  url: string;
}

/**
 * Extract structured entities from raw search content using LLM
 */
export async function extractEntities<T>(
  schema: ExtractionSchema,
  context: string,
  rawContent: RawContent[],
  options: { maxResults?: number; additionalContext?: string } = {}
): Promise<T[]> {
  if (!isGeminiEnabled()) {
    return [];
  }

  if (rawContent.length === 0) {
    return [];
  }

  const gemini = getModel();
  const maxResults = options.maxResults || 10;

  // Build content summary from raw search results
  const contentSummary = rawContent
    .slice(0, 5)
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet.slice(0, 400)}`)
    .join('\n\n');

  // Build field descriptions for the prompt
  const fieldDescriptions = schema.fields
    .map((f) => `    "${f.name}": ${f.type}${f.required ? ' (required)' : ' (optional)'}${f.description ? ` - ${f.description}` : ''}`)
    .join('\n');

  // Build category hint if available
  const categoryHint = schema.categories
    ? `\nCategories: ${schema.categories.join(', ')}`
    : '';

  const prompt = `You are a data extraction expert. Extract individual ${schema.pluralName} from these search results about ${context}.

Search results:
${contentSummary}

Extract ${maxResults}-${maxResults + 5} specific ${schema.pluralName} (${schema.description}) mentioned in the content.
Do NOT include article titles or website names as ${schema.pluralName}.
Only extract actual ${schema.pluralName} that are real places or items.
${schema.extractionHints || ''}
${categoryHint}
${options.additionalContext || ''}

Respond in JSON format only:
{
  "${schema.pluralName}": [
    ${JSON.stringify(schema.example, null, 4).split('\n').map(line => '    ' + line).join('\n').trim()}
  ]
}

Required fields for each ${schema.entityType}:
${fieldDescriptions}`;

  try {
    const result = await gemini.generateContent(prompt);
    const response = result.response.text();

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const entities = parsed[schema.pluralName] || parsed[schema.entityType + 's'] || [];
      return entities.slice(0, maxResults + 5) as T[];
    }
  } catch (error) {
    console.error(`Extraction error for ${schema.entityType}:`, error);
  }

  return [];
}

// ============================================================================
// Pre-defined schemas for common entity types
// ============================================================================

/**
 * Schema for extracting tourist attractions
 */
export const attractionExtractionSchema: ExtractionSchema = {
  entityType: 'attraction',
  pluralName: 'attractions',
  description: 'tourist attractions and points of interest like temples, beaches, landmarks, museums',
  fields: [
    { name: 'name', type: 'string', required: true, description: 'Name of the attraction' },
    { name: 'category', type: 'string', required: true, description: 'Type of attraction' },
    { name: 'description', type: 'string', required: true, description: 'Brief description' },
    { name: 'duration', type: 'string', required: false, description: 'Typical visit duration' },
    { name: 'price', type: 'number', required: false, description: 'Entry fee in USD (0 for free)' },
  ],
  example: {
    name: 'Tanah Lot Temple',
    category: 'temple',
    description: 'Iconic sea temple perched on a rocky outcrop',
    duration: '2-3 hours',
    price: 5,
  },
  categories: ['temple', 'beach', 'nature', 'museum', 'landmark', 'market', 'adventure', 'wildlife', 'culture'],
  extractionHints: 'Set price to 0 for free attractions, or estimate typical entry fee in USD.',
};

/**
 * Schema for extracting hotels
 */
export const hotelExtractionSchema: ExtractionSchema = {
  entityType: 'hotel',
  pluralName: 'hotels',
  description: 'hotels, resorts, and accommodation options',
  fields: [
    { name: 'name', type: 'string', required: true, description: 'Name of the hotel' },
    { name: 'rating', type: 'number', required: true, description: 'Star rating (1-5)' },
    { name: 'pricePerNight', type: 'number', required: false, description: 'Price per night in USD' },
    { name: 'location', type: 'string', required: true, description: 'Location/area within the destination' },
    { name: 'amenities', type: 'array', required: false, description: 'List of amenities' },
  ],
  example: {
    name: 'Grand Hyatt Bali',
    rating: 4.8,
    pricePerNight: 285,
    location: 'Nusa Dua, Bali',
    amenities: ['Pool', 'Spa', 'Beach Access', 'Restaurant'],
  },
};

/**
 * Schema for extracting restaurants
 */
export const restaurantExtractionSchema: ExtractionSchema = {
  entityType: 'restaurant',
  pluralName: 'restaurants',
  description: 'restaurants, cafes, and dining establishments',
  fields: [
    { name: 'name', type: 'string', required: true, description: 'Name of the restaurant' },
    { name: 'cuisine', type: 'string', required: true, description: 'Type of cuisine' },
    { name: 'priceRange', type: 'string', required: false, description: 'Price range ($, $$, $$$)' },
    { name: 'rating', type: 'number', required: false, description: 'Rating out of 5' },
    { name: 'specialty', type: 'string', required: false, description: 'Signature dish or specialty' },
  ],
  example: {
    name: 'Warung Babi Guling Ibu Oka',
    cuisine: 'Balinese',
    priceRange: '$$',
    rating: 4.5,
    specialty: 'Roast suckling pig',
  },
  categories: ['local', 'international', 'fine-dining', 'street-food', 'cafe', 'seafood'],
};

/**
 * Schema for extracting pharmacies (for medicine finder)
 */
export const pharmacyExtractionSchema: ExtractionSchema = {
  entityType: 'pharmacy',
  pluralName: 'pharmacies',
  description: 'pharmacies and drugstores',
  fields: [
    { name: 'name', type: 'string', required: true, description: 'Name of the pharmacy' },
    { name: 'address', type: 'string', required: true, description: 'Street address' },
    { name: 'phone', type: 'string', required: false, description: 'Phone number' },
    { name: 'hours', type: 'string', required: false, description: 'Operating hours' },
    { name: 'hasStock', type: 'boolean', required: false, description: 'Whether medicine is in stock' },
  ],
  example: {
    name: 'CVS Pharmacy',
    address: '123 Main St, San Francisco, CA',
    phone: '(415) 555-1234',
    hours: '8am - 10pm',
    hasStock: true,
  },
};

// ============================================================================
// Helper functions for common extraction tasks
// ============================================================================

export interface ExtractedAttraction {
  name: string;
  category: string;
  description: string;
  duration?: string;
  price?: number;
}

export interface ExtractedHotel {
  name: string;
  rating: number;
  pricePerNight?: number;
  location: string;
  amenities?: string[];
}

export interface ExtractedRestaurant {
  name: string;
  cuisine: string;
  priceRange?: string;
  rating?: number;
  specialty?: string;
}

/**
 * Extract attractions from search content
 */
export async function extractAttractions(
  destination: string,
  rawContent: RawContent[]
): Promise<ExtractedAttraction[]> {
  return extractEntities<ExtractedAttraction>(
    attractionExtractionSchema,
    destination,
    rawContent,
    { maxResults: 12 }
  );
}

/**
 * Extract hotels from search content
 */
export async function extractHotels(
  destination: string,
  budget: string,
  rawContent: RawContent[]
): Promise<ExtractedHotel[]> {
  return extractEntities<ExtractedHotel>(
    hotelExtractionSchema,
    destination,
    rawContent,
    {
      maxResults: 8,
      additionalContext: `Budget preference: ${budget}. Estimate realistic prices based on this budget and the destination.`,
    }
  );
}

/**
 * Extract restaurants from search content
 */
export async function extractRestaurants(
  destination: string,
  rawContent: RawContent[]
): Promise<ExtractedRestaurant[]> {
  return extractEntities<ExtractedRestaurant>(
    restaurantExtractionSchema,
    destination,
    rawContent,
    { maxResults: 10 }
  );
}
