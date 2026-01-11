import chalk from 'chalk';
import ora, { Ora } from 'ora';
import {
  MedicineState,
  Pharmacy,
  AvailabilityEntry,
  createInitialMedicineState,
} from './state.js';
import { generateStockInfo, SimulatedPharmacy } from '../../simulation/data-generator.js';
import { simulatePharmacyCall, formatTranscript } from '../../simulation/phone-call.js';
import { Coordinates } from '../../core/types.js';
import { findPharmacies, getSearchStatus, PharmacyResult } from '../../services/search.js';

export interface MedicineWorkflowContext {
  askUser: (question: string, options?: string[]) => Promise<string>;
  showProgress: (message: string) => Ora;
  log: (message: string) => void;
}

export class MedicineWorkflow {
  private state: MedicineState;
  private context: MedicineWorkflowContext;
  private searchMode: 'real' | 'simulated' = 'simulated';

  constructor(context: MedicineWorkflowContext) {
    this.state = createInitialMedicineState();
    this.context = context;
  }

  getState(): MedicineState {
    return { ...this.state };
  }

  private updateState(updates: Partial<MedicineState>): void {
    this.state = {
      ...this.state,
      ...updates,
      updatedAt: new Date(),
    };
  }

  async run(initialInput: string): Promise<MedicineState> {
    this.updateState({ status: 'active' });

    const searchStatus = getSearchStatus();
    this.context.log(chalk.dim(`\n[Search mode: ${searchStatus.mode}]`));
    if (!searchStatus.exaEnabled) {
      this.context.log(chalk.dim(`[${searchStatus.message}]\n`));
    }

    try {
      await this.gatherInformation(initialInput);
      await this.findPharmaciesStage();
      await this.checkAvailability();
      await this.selectAndReserve();

      this.updateState({ status: 'completed', workflowStage: 'completed' });
    } catch (error) {
      this.updateState({
        status: 'error',
        workflowStage: 'failed',
      });
      throw error;
    }

    return this.getState();
  }

  private async gatherInformation(initialInput: string): Promise<void> {
    this.updateState({ workflowStage: 'gathering_info' });

    const medicineMatch = initialInput.match(
      /(?:find|get|need|looking for|want)\s+(.+?)(?:\s+near|\s+in|\s+around|$)/i
    );
    let medicineName = medicineMatch?.[1]?.trim();

    if (!medicineName) {
      medicineName = await this.context.askUser(
        'What medicine are you looking for?'
      );
    }

    this.updateState({ medicineName });

    const quantityResponse = await this.context.askUser(
      `How many units of ${medicineName} do you need?`,
      ['1', '2', '5', '10', 'Other']
    );
    const quantity = parseInt(quantityResponse) || 1;
    this.updateState({ quantity });

    const urgency = await this.context.askUser(
      'How urgent is this?',
      ['Urgent - need it now', 'Today - within a few hours', 'Flexible - anytime this week']
    );
    const urgencyMap: Record<string, MedicineState['urgency']> = {
      'Urgent - need it now': 'urgent',
      'Today - within a few hours': 'today',
      'Flexible - anytime this week': 'flexible',
    };
    this.updateState({ urgency: urgencyMap[urgency] || 'flexible' });

    const locationResponse = await this.context.askUser(
      'What is your location? (city or zip code)',
      ['San Francisco, CA', 'New York, NY', 'Los Angeles, CA', 'Enter manually']
    );

    let locationString = locationResponse;
    if (locationResponse === 'Enter manually') {
      locationString = await this.context.askUser('Enter your city or zip code:');
    }

    this.updateState({
      userLocation: {
        latitude: 37.7749,
        longitude: -122.4194,
      },
    });

    (this.state as MedicineState & { locationString?: string }).locationString = locationString;

    this.context.log(
      chalk.green(`\n✓ Looking for ${quantity} units of ${medicineName} near ${locationString}`)
    );
  }

  private async findPharmaciesStage(): Promise<void> {
    this.updateState({ workflowStage: 'finding_pharmacies' });

    const spinner = this.context.showProgress('Searching for nearby pharmacies...');

    const locationString = (this.state as MedicineState & { locationString?: string }).locationString || 'San Francisco, CA';

    try {
      const { results, searchMode } = await findPharmacies(
        this.state.medicineName!,
        locationString,
        { maxResults: 6 }
      );

      this.searchMode = searchMode;

      const pharmacies: Pharmacy[] = results.map((r, index) => ({
        id: r.id,
        name: r.name,
        address: r.address,
        phone: r.phone,
        location: r.location || this.state.userLocation!,
        distance: r.distance || (index + 1) * 0.5,
        isOpen: r.isOpen ?? true,
        hours: r.hours || '9:00 AM - 9:00 PM',
        rating: r.rating || 4.0,
        reviewCount: r.reviewCount || 100,
      }));

      const filteredPharmacies =
        this.state.urgency === 'urgent'
          ? pharmacies.filter((p) => p.isOpen)
          : pharmacies;

      spinner.succeed(
        `Found ${filteredPharmacies.length} pharmacies nearby ${searchMode === 'real' ? chalk.cyan('(via Exa)') : chalk.dim('(simulated)')}`
      );

      this.updateState({ pharmacies: filteredPharmacies });

      this.context.log(chalk.bold('\nNearby Pharmacies:'));
      this.context.log(chalk.dim('─'.repeat(50)));

      filteredPharmacies.slice(0, 5).forEach((pharmacy, index) => {
        const statusIcon = pharmacy.isOpen ? chalk.green('●') : chalk.red('●');
        const distance = pharmacy.distance ? chalk.yellow(`${pharmacy.distance} mi`) : '';
        const rating = pharmacy.rating ? chalk.cyan(`★ ${pharmacy.rating}`) : '';

        this.context.log(`${index + 1}. ${pharmacy.name}`);
        this.context.log(
          `   ${pharmacy.address}${distance ? ` | ${distance}` : ''}${rating ? ` | ${rating}` : ''} ${statusIcon}`
        );
      });
      this.context.log('');
    } catch (error) {
      spinner.fail('Failed to search pharmacies');
      throw error;
    }
  }

  private async checkAvailability(): Promise<void> {
    this.updateState({ workflowStage: 'checking_availability' });

    const spinner = this.context.showProgress(
      `Checking ${this.state.medicineName} availability...`
    );

    const availability: AvailabilityEntry[] = [];

    for (const pharmacy of this.state.pharmacies.slice(0, 5)) {
      await new Promise((resolve) => setTimeout(resolve, 500));

      const stock = generateStockInfo(
        this.state.medicineName!,
        pharmacy.id.charCodeAt(pharmacy.id.length - 1)
      );

      availability.push({
        pharmacy,
        stock,
      });
    }

    spinner.succeed('Availability check complete ' + chalk.dim('(simulated)'));

    this.updateState({ availability });

    this.context.log(chalk.bold('\nAvailability Results:'));
    this.context.log(chalk.dim('─'.repeat(50)));

    const inStock = availability.filter((a) => a.stock.inStock);
    const outOfStock = availability.filter((a) => !a.stock.inStock);

    if (inStock.length > 0) {
      this.context.log(chalk.green.bold(`\n✓ In Stock (${inStock.length} pharmacies):`));
      inStock.forEach((entry, index) => {
        this.context.log(
          `  ${index + 1}. ${entry.pharmacy.name} - $${entry.stock.price.toFixed(2)} (${entry.stock.quantity} available)`
        );
      });
    }

    if (outOfStock.length > 0) {
      this.context.log(chalk.red.bold(`\n✗ Out of Stock (${outOfStock.length} pharmacies):`));
      outOfStock.forEach((entry) => {
        const restock = entry.stock.estimatedRestock
          ? `Restock: ${entry.stock.estimatedRestock}`
          : '';
        this.context.log(chalk.dim(`  - ${entry.pharmacy.name} ${restock}`));
      });
    }

    this.context.log('');
  }

  private async selectAndReserve(): Promise<void> {
    this.updateState({ workflowStage: 'selecting_pharmacy' });

    const inStockPharmacies = this.state.availability.filter((a) => a.stock.inStock);

    if (inStockPharmacies.length === 0) {
      this.context.log(
        chalk.yellow('\n⚠ No pharmacies currently have this medicine in stock.')
      );
      this.context.log(
        'You may want to try again later or check with your doctor for alternatives.'
      );
      return;
    }

    const options = inStockPharmacies.map(
      (entry) =>
        `${entry.pharmacy.name} - $${entry.stock.price.toFixed(2)}${entry.pharmacy.distance ? ` (${entry.pharmacy.distance} mi)` : ''}`
    );

    const selection = await this.context.askUser(
      'Which pharmacy would you like to reserve at?',
      options
    );

    const selectedIndex = options.findIndex((o) => o === selection);
    const selected = inStockPharmacies[selectedIndex >= 0 ? selectedIndex : 0];

    this.updateState({
      selectedPharmacy: selected.pharmacy,
      workflowStage: 'calling_pharmacy',
    });

    this.context.log(chalk.bold(`\nCalling ${selected.pharmacy.name}...`));
    this.context.log(chalk.dim('─'.repeat(50)));
    this.context.log(chalk.yellow.bold('\n📞 SIMULATED CALL TRANSCRIPT'));
    this.context.log(
      chalk.dim('(This is a simulated call for demonstration purposes)\n')
    );

    const callResult = await simulatePharmacyCall({
      pharmacy: selected.pharmacy as SimulatedPharmacy,
      medicineName: this.state.medicineName!,
      quantity: this.state.quantity!,
      customerName: 'Customer',
    });

    this.context.log(formatTranscript(callResult.transcript));
    this.context.log('');

    if (callResult.success && callResult.reservationId) {
      this.updateState({
        reservation: {
          id: callResult.reservationId,
          pharmacyId: selected.pharmacy.id,
          pharmacyName: selected.pharmacy.name,
          medicineName: this.state.medicineName!,
          quantity: this.state.quantity!,
          pickupTime: callResult.pickupTime!,
          holdDuration: callResult.holdDuration!,
          createdAt: new Date(),
        },
        callTranscript: callResult.transcript,
      });

      this.context.log(chalk.green.bold('\n✓ RESERVATION CONFIRMED'));
      this.context.log(chalk.dim('─'.repeat(50)));
      this.context.log(`  Reservation ID: ${chalk.cyan(callResult.reservationId)}`);
      this.context.log(`  Pharmacy: ${selected.pharmacy.name}`);
      this.context.log(`  Address: ${selected.pharmacy.address}`);
      this.context.log(`  Medicine: ${this.state.medicineName} x ${this.state.quantity}`);
      this.context.log(`  Price: $${selected.stock.price.toFixed(2)}`);
      this.context.log(`  Ready for pickup: ${chalk.green(callResult.pickupTime)}`);
      this.context.log(`  Hold time: ${callResult.holdDuration} minutes`);
      this.context.log(chalk.dim('─'.repeat(50)));
    } else {
      this.context.log(chalk.yellow(`\n⚠ Call result: ${callResult.outcome}`));
      if (callResult.alternativeSuggested) {
        this.context.log(`  Suggested alternative: ${callResult.alternativeSuggested}`);
      }
    }
  }
}
