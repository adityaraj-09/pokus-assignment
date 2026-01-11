import { SimulatedPharmacy } from './data-generator.js';

export interface CallRequest {
  pharmacy: SimulatedPharmacy;
  medicineName: string;
  quantity: number;
  customerName: string;
}

export interface CallResult {
  success: boolean;
  outcome: 'reservation_made' | 'out_of_stock' | 'busy' | 'voicemail' | 'callback_requested';
  transcript: string[];
  reservationId?: string;
  pickupTime?: string;
  holdDuration?: number;
  alternativeSuggested?: string;
  callDuration: string;
}

const CALL_SCENARIOS = {
  success: {
    weight: 0.70,
    generate: (req: CallRequest): CallResult => {
      const reservationId = `RES-${Date.now().toString(36).toUpperCase()}`;
      const pickupMinutes = Math.floor(Math.random() * 30) + 15;
      const pickupTime = new Date(Date.now() + pickupMinutes * 60000);

      return {
        success: true,
        outcome: 'reservation_made',
        transcript: [
          `[Call connected to ${req.pharmacy.name}]`,
          ``,
          `Pharmacist: "Hello, ${req.pharmacy.name.split('#')[0].trim()}, how can I help you today?"`,
          ``,
          `Agent: "Hi, I'm calling on behalf of ${req.customerName}. I'd like to check if you have ${req.medicineName} in stock."`,
          ``,
          `Pharmacist: "Let me check for you... Yes, we do have ${req.medicineName} available."`,
          ``,
          `Agent: "That's great! Could I reserve ${req.quantity} ${req.quantity === 1 ? 'unit' : 'units'} for pickup?"`,
          ``,
          `Pharmacist: "Absolutely. I'll put that aside for you. Your reservation number is ${reservationId}. We'll hold it for 2 hours."`,
          ``,
          `Agent: "Thank you so much. When would be a good time to pick it up?"`,
          ``,
          `Pharmacist: "It'll be ready in about ${pickupMinutes} minutes. You can come by anytime after that."`,
          ``,
          `Agent: "Perfect. Thanks for your help!"`,
          ``,
          `Pharmacist: "You're welcome. See you soon!"`,
          ``,
          `[Call ended]`,
        ],
        reservationId,
        pickupTime: pickupTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        holdDuration: 120,
        callDuration: '1m 23s',
      };
    },
  },
  out_of_stock: {
    weight: 0.15,
    generate: (req: CallRequest): CallResult => {
      const alternatives = ['generic equivalent', 'different brand', 'different dosage'];
      const suggested = alternatives[Math.floor(Math.random() * alternatives.length)];

      return {
        success: false,
        outcome: 'out_of_stock',
        transcript: [
          `[Call connected to ${req.pharmacy.name}]`,
          ``,
          `Pharmacist: "Hello, ${req.pharmacy.name.split('#')[0].trim()}, how can I help you?"`,
          ``,
          `Agent: "Hi, I'm checking if you have ${req.medicineName} in stock."`,
          ``,
          `Pharmacist: "Let me look... I'm sorry, we're currently out of stock on that specific medication."`,
          ``,
          `Agent: "Oh, do you have any alternatives available?"`,
          ``,
          `Pharmacist: "We do have a ${suggested} that might work. Would you like me to check with the pharmacist if it would be suitable?"`,
          ``,
          `Agent: "That would be helpful, but I'll need to confirm with the customer first. When do you expect to restock the original?"`,
          ``,
          `Pharmacist: "We're expecting a shipment in 2-3 days. I can put you on a callback list if you'd like."`,
          ``,
          `Agent: "I'll let the customer know. Thank you for your help."`,
          ``,
          `[Call ended]`,
        ],
        alternativeSuggested: suggested,
        callDuration: '1m 45s',
      };
    },
  },
  busy: {
    weight: 0.10,
    generate: (req: CallRequest): CallResult => {
      return {
        success: false,
        outcome: 'busy',
        transcript: [
          `[Dialing ${req.pharmacy.name}...]`,
          ``,
          `[Ring... Ring... Ring...]`,
          ``,
          `Automated Message: "All of our pharmacy staff are currently assisting other customers. Please hold or try again later."`,
          ``,
          `[After 2 minutes on hold]`,
          ``,
          `Automated Message: "We apologize for the wait. Your call is important to us."`,
          ``,
          `[Call disconnected after 3 minute hold]`,
        ],
        callDuration: '3m 12s',
      };
    },
  },
  voicemail: {
    weight: 0.05,
    generate: (req: CallRequest): CallResult => {
      return {
        success: false,
        outcome: 'voicemail',
        transcript: [
          `[Dialing ${req.pharmacy.name}...]`,
          ``,
          `[Ring... Ring... Ring... Ring... Ring...]`,
          ``,
          `Voicemail: "You've reached ${req.pharmacy.name.split('#')[0].trim()}. Our pharmacy hours are ${req.pharmacy.hours}. Please leave a message and we'll return your call as soon as possible."`,
          ``,
          `[BEEP]`,
          ``,
          `Agent: "Hello, I'm calling on behalf of ${req.customerName} to check availability of ${req.medicineName}. Please call back at your earliest convenience. Thank you."`,
          ``,
          `[Message left]`,
        ],
        callDuration: '0m 45s',
      };
    },
  },
};

export async function simulatePharmacyCall(request: CallRequest): Promise<CallResult> {
  await new Promise((resolve) => setTimeout(resolve, 2000 + Math.random() * 2000));

  const random = Math.random();
  let cumulative = 0;

  for (const [_, scenario] of Object.entries(CALL_SCENARIOS)) {
    cumulative += scenario.weight;
    if (random <= cumulative) {
      return scenario.generate(request);
    }
  }

  return CALL_SCENARIOS.success.generate(request);
}

export function formatTranscript(transcript: string[]): string {
  const lines = transcript.map((line) => {
    if (line.startsWith('[')) {
      return `\x1b[90m${line}\x1b[0m`;
    } else if (line.startsWith('Pharmacist:')) {
      return `\x1b[36m${line}\x1b[0m`;
    } else if (line.startsWith('Agent:')) {
      return `\x1b[33m${line}\x1b[0m`;
    } else if (line.startsWith('Automated') || line.startsWith('Voicemail')) {
      return `\x1b[35m${line}\x1b[0m`;
    }
    return line;
  });

  return lines.join('\n');
}
