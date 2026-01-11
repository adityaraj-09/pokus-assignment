import { z } from 'zod';
import { BaseStateSchema } from '../../core/types.js';

export const DateRangeSchema = z.object({
  start: z.string(),
  end: z.string(),
  nights: z.number(),
});
export type DateRange = z.infer<typeof DateRangeSchema>;

export const BudgetSchema = z.object({
  total: z.number(),
  perDay: z.number(),
  category: z.enum(['budget', 'mid-range', 'luxury']),
});
export type Budget = z.infer<typeof BudgetSchema>;

export const TravelPreferencesSchema = z.object({
  interests: z.array(z.string()),
  pace: z.enum(['relaxed', 'moderate', 'packed']),
  accommodation: z.enum(['budget', 'mid-range', 'luxury']),
  priorities: z.array(z.string()),
});
export type TravelPreferences = z.infer<typeof TravelPreferencesSchema>;

export const ActivitySchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  time: z.string(),
  duration: z.string(),
  description: z.string(),
  price: z.number(),
  location: z.string().optional(),
});
export type Activity = z.infer<typeof ActivitySchema>;

export const DayPlanSchema = z.object({
  day: z.number(),
  date: z.string(),
  theme: z.string(),
  activities: z.array(ActivitySchema),
  meals: z.array(
    z.object({
      type: z.enum(['breakfast', 'lunch', 'dinner']),
      suggestion: z.string(),
      cuisine: z.string(),
      priceRange: z.string(),
    })
  ),
  notes: z.array(z.string()).optional(),
  estimatedCost: z.number(),
});
export type DayPlan = z.infer<typeof DayPlanSchema>;

export const HotelSchema = z.object({
  id: z.string(),
  name: z.string(),
  rating: z.number(),
  pricePerNight: z.number(),
  location: z.string(),
  amenities: z.array(z.string()),
  reviewScore: z.number(),
});
export type Hotel = z.infer<typeof HotelSchema>;

export const FlightSchema = z.object({
  id: z.string(),
  airline: z.string(),
  flightNumber: z.string(),
  departure: z.string(),
  arrival: z.string(),
  duration: z.string(),
  price: z.number(),
  stops: z.number(),
});
export type Flight = z.infer<typeof FlightSchema>;

export const ItinerarySchema = z.object({
  destination: z.string(),
  dates: DateRangeSchema,
  days: z.array(DayPlanSchema),
  hotel: HotelSchema.optional(),
  flights: z
    .object({
      outbound: FlightSchema.optional(),
      return: FlightSchema.optional(),
    })
    .optional(),
  totalCost: z.number(),
  version: z.number(),
  aiGenerated: z.boolean().optional(),
  summary: z.string().optional(),
  packingTips: z.array(z.string()).optional(),
  bestTimeToVisit: z.string().optional(),
});
export type Itinerary = z.infer<typeof ItinerarySchema>;

export const TravelWorkflowStage = z.enum([
  'gathering_preferences',
  'searching_options',
  'generating_itinerary',
  'reviewing',
  'refining',
  'finalized',
  'failed',
]);
export type TravelWorkflowStageType = z.infer<typeof TravelWorkflowStage>;

export const TravelStateSchema = BaseStateSchema.extend({
  domain: z.literal('travel'),

  destination: z.string().optional(),
  origin: z.string().optional(),

  dates: DateRangeSchema.optional(),
  flexibility: z.enum(['fixed', 'flexible']).optional(),

  budget: BudgetSchema.optional(),

  preferences: TravelPreferencesSchema.optional(),

  itinerary: ItinerarySchema.optional(),
  previousVersions: z.array(ItinerarySchema).default([]),

  refinementCount: z.number().default(0),
  userFeedback: z.array(z.string()).default([]),

  workflowStage: TravelWorkflowStage.default('gathering_preferences'),
});

export type TravelState = z.infer<typeof TravelStateSchema>;

export function createInitialTravelState(): TravelState {
  return {
    sessionId: '',
    status: 'idle',
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    domain: 'travel',
    previousVersions: [],
    refinementCount: 0,
    userFeedback: [],
    workflowStage: 'gathering_preferences',
  };
}
