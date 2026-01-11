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

export interface ClassificationResult {
  taskType: 'medicine' | 'travel' | 'unknown';
  confidence: number;
  extractedEntities: {
    medicineName?: string;
    destination?: string;
    location?: string;
    dates?: string;
  };
  reasoning: string;
}

export async function classifyIntent(userInput: string): Promise<ClassificationResult> {
  if (!isGeminiEnabled()) {
    throw new Error('Gemini is not enabled');
  }

  const gemini = getModel();

  const prompt = `You are a task classification system. Analyze the user's input and classify it into one of these categories:
- "medicine": User wants to find medicine, pharmacy, or medication
- "travel": User wants to plan a trip, create an itinerary, or travel somewhere
- "unknown": The request doesn't fit either category

User input: "${userInput}"

Respond in JSON format only:
{
  "taskType": "medicine" | "travel" | "unknown",
  "confidence": 0.0 to 1.0,
  "extractedEntities": {
    "medicineName": "extracted medicine name if applicable",
    "destination": "extracted destination if applicable",
    "location": "extracted location if applicable",
    "dates": "extracted dates if applicable"
  },
  "reasoning": "brief explanation"
}`;

  try {
    const result = await gemini.generateContent(prompt);
    const response = result.response.text();

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        taskType: parsed.taskType || 'unknown',
        confidence: parsed.confidence || 0.5,
        extractedEntities: parsed.extractedEntities || {},
        reasoning: parsed.reasoning || '',
      };
    }
  } catch (error) {
    console.error('Gemini classification error:', error);
  }

  return {
    taskType: 'unknown',
    confidence: 0,
    extractedEntities: {},
    reasoning: 'Failed to classify',
  };
}

export interface ItineraryDay {
  day: number;
  theme: string;
  activities: Array<{
    time: string;
    name: string;
    description: string;
    duration: string;
    estimatedCost: number;
  }>;
  meals: Array<{
    type: 'breakfast' | 'lunch' | 'dinner';
    suggestion: string;
    cuisine: string;
  }>;
  tips: string[];
}

export interface GeneratedItinerary {
  destination: string;
  summary: string;
  days: ItineraryDay[];
  totalEstimatedCost: number;
  packingTips: string[];
  bestTimeToVisit: string;
}

export async function generateItinerary(
  destination: string,
  nights: number,
  budget: 'budget' | 'mid-range' | 'luxury',
  interests: string[],
  pace: 'relaxed' | 'moderate' | 'packed',
  attractionsData?: string
): Promise<GeneratedItinerary> {
  if (!isGeminiEnabled()) {
    throw new Error('Gemini is not enabled');
  }

  const gemini = getModel();

  const budgetPerDay = budget === 'budget' ? 100 : budget === 'mid-range' ? 250 : 500;
  const activitiesPerDay = pace === 'relaxed' ? 2 : pace === 'moderate' ? 3 : 4;

  const prompt = `You are a travel planning expert. Create a detailed ${nights}-day itinerary for ${destination}.

Travel preferences:
- Budget: ${budget} (~$${budgetPerDay}/day)
- Pace: ${pace} (${activitiesPerDay} activities per day)
- Interests: ${interests.join(', ')}

${attractionsData ? `Here are some attractions from web search:\n${attractionsData}\n` : ''}

Create a realistic, detailed itinerary. Respond in JSON format:
{
  "destination": "${destination}",
  "summary": "2-3 sentence overview of the trip",
  "days": [
    {
      "day": 1,
      "theme": "Arrival & First Impressions",
      "activities": [
        {
          "time": "9:00 AM",
          "name": "Activity name",
          "description": "Brief description",
          "duration": "2-3 hours",
          "estimatedCost": 20
        }
      ],
      "meals": [
        {
          "type": "breakfast",
          "suggestion": "Restaurant or area name",
          "cuisine": "Local/Italian/etc"
        }
      ],
      "tips": ["Useful tip for this day"]
    }
  ],
  "totalEstimatedCost": ${budgetPerDay * nights},
  "packingTips": ["3-4 packing suggestions"],
  "bestTimeToVisit": "Best months to visit"
}

Make sure activities are realistic for ${destination} and match the ${pace} pace. Include ${activitiesPerDay} activities per day.`;

  try {
    const result = await gemini.generateContent(prompt);
    const response = result.response.text();

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed as GeneratedItinerary;
    }
  } catch (error) {
    console.error('Gemini itinerary generation error:', error);
  }

  return {
    destination,
    summary: `A ${nights}-day trip to ${destination}`,
    days: [],
    totalEstimatedCost: budgetPerDay * nights,
    packingTips: [],
    bestTimeToVisit: 'Year-round',
  };
}

export interface PharmacyRecommendation {
  recommendation: string;
  reasoning: string;
  alternativeMedicines: string[];
  urgencyAdvice: string;
}

export async function getPharmacyRecommendation(
  medicineName: string,
  pharmacyData: string,
  urgency: 'urgent' | 'today' | 'flexible'
): Promise<PharmacyRecommendation> {
  if (!isGeminiEnabled()) {
    throw new Error('Gemini is not enabled');
  }

  const gemini = getModel();

  const prompt = `You are a helpful pharmacy assistant. A user is looking for "${medicineName}" with ${urgency} urgency.

Here are the nearby pharmacies and availability data:
${pharmacyData}

Provide a recommendation in JSON format:
{
  "recommendation": "Which pharmacy to go to and why",
  "reasoning": "Brief explanation of your recommendation",
  "alternativeMedicines": ["List of generic or alternative options if applicable"],
  "urgencyAdvice": "Advice based on the urgency level"
}`;

  try {
    const result = await gemini.generateContent(prompt);
    const response = result.response.text();

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as PharmacyRecommendation;
    }
  } catch (error) {
    console.error('Gemini pharmacy recommendation error:', error);
  }

  return {
    recommendation: 'Please check the pharmacies listed above.',
    reasoning: 'Unable to generate AI recommendation.',
    alternativeMedicines: [],
    urgencyAdvice: urgency === 'urgent' ? 'Please visit the nearest open pharmacy immediately.' : 'You have time to compare options.',
  };
}

export async function generateResponse(
  context: string,
  userMessage: string
): Promise<string> {
  if (!isGeminiEnabled()) {
    throw new Error('Gemini is not enabled');
  }

  const gemini = getModel();

  const prompt = `${context}

User: ${userMessage}

Respond helpfully and concisely:`;

  try {
    const result = await gemini.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('Gemini response error:', error);
    return 'I apologize, I encountered an error processing your request.';
  }
}

export function getGeminiStatus(): {
  enabled: boolean;
  model: string;
  message: string;
} {
  if (isGeminiEnabled()) {
    return {
      enabled: true,
      model: config.gemini.model,
      message: `Gemini AI enabled (${config.gemini.model})`,
    };
  }

  return {
    enabled: false,
    model: '',
    message: 'Gemini AI not configured - using rule-based logic. Set GEMINI_API_KEY to enable AI.',
  };
}
