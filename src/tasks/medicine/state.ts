import { z } from 'zod';
import { BaseStateSchema, CoordinatesSchema } from '../../core/types.js';

export const PharmacySchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  phone: z.string(),
  location: CoordinatesSchema,
  distance: z.number(),
  isOpen: z.boolean(),
  hours: z.string(),
  rating: z.number(),
  reviewCount: z.number(),
});
export type Pharmacy = z.infer<typeof PharmacySchema>;

export const StockInfoSchema = z.object({
  inStock: z.boolean(),
  quantity: z.number(),
  price: z.number(),
  genericAvailable: z.boolean(),
  estimatedRestock: z.string().optional(),
});
export type StockInfo = z.infer<typeof StockInfoSchema>;

export const AvailabilityEntrySchema = z.object({
  pharmacy: PharmacySchema,
  stock: StockInfoSchema,
});
export type AvailabilityEntry = z.infer<typeof AvailabilityEntrySchema>;

export const ReservationSchema = z.object({
  id: z.string(),
  pharmacyId: z.string(),
  pharmacyName: z.string(),
  medicineName: z.string(),
  quantity: z.number(),
  pickupTime: z.string(),
  holdDuration: z.number(),
  createdAt: z.date(),
});
export type Reservation = z.infer<typeof ReservationSchema>;

export const MedicineWorkflowStage = z.enum([
  'gathering_info',
  'finding_pharmacies',
  'checking_availability',
  'selecting_pharmacy',
  'calling_pharmacy',
  'completed',
  'failed',
]);
export type MedicineWorkflowStageType = z.infer<typeof MedicineWorkflowStage>;

export const MedicineStateSchema = BaseStateSchema.extend({
  domain: z.literal('medicine'),

  medicineName: z.string().optional(),
  dosage: z.string().optional(),
  quantity: z.number().optional(),
  urgency: z.enum(['urgent', 'today', 'flexible']).optional(),

  userLocation: CoordinatesSchema.optional(),
  searchRadius: z.number().default(5),

  pharmacies: z.array(PharmacySchema).default([]),
  availability: z.array(AvailabilityEntrySchema).default([]),
  selectedPharmacy: PharmacySchema.optional(),

  reservation: ReservationSchema.optional(),
  callTranscript: z.array(z.string()).optional(),

  workflowStage: MedicineWorkflowStage.default('gathering_info'),
});

export type MedicineState = z.infer<typeof MedicineStateSchema>;

export function createInitialMedicineState(): MedicineState {
  return {
    sessionId: '',
    status: 'idle',
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    domain: 'medicine',
    searchRadius: 5,
    pharmacies: [],
    availability: [],
    workflowStage: 'gathering_info',
  };
}
