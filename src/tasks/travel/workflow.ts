import chalk from 'chalk';
import ora, { Ora } from 'ora';
import {
  TravelState,
  DayPlan,
  Activity,
  Itinerary,
  createInitialTravelState,
  TravelPreferences,
  Budget,
  DateRange,
} from './state.js';
import { getDestinationData } from '../../simulation/data-generator.js';
import {
  findAttractions,
  findHotels,
  getSearchStatus,
  AttractionResult,
  HotelResult,
} from '../../services/search.js';
import {
  generateItinerary as geminiGenerateItinerary,
  getGeminiStatus,
} from '../../services/gemini.js';
import { isGeminiEnabled } from '../../config.js';

export interface TravelWorkflowContext {
  askUser: (question: string, options?: string[]) => Promise<string>;
  showProgress: (message: string) => Ora;
  log: (message: string) => void;
}

export class TravelWorkflow {
  private state: TravelState;
  private context: TravelWorkflowContext;
  private searchMode: 'real' | 'simulated' = 'simulated';
  private attractions: AttractionResult[] = [];
  private hotels: HotelResult[] = [];

  constructor(context: TravelWorkflowContext) {
    this.state = createInitialTravelState();
    this.context = context;
  }

  getState(): TravelState {
    return { ...this.state };
  }

  private updateState(updates: Partial<TravelState>): void {
    this.state = {
      ...this.state,
      ...updates,
      updatedAt: new Date(),
    };
  }

  async run(initialInput: string): Promise<TravelState> {
    this.updateState({ status: 'active' });

    const searchStatus = getSearchStatus();
    this.context.log(chalk.dim(`\n[Search mode: ${searchStatus.mode}]`));
    if (!searchStatus.exaEnabled) {
      this.context.log(chalk.dim(`[${searchStatus.message}]\n`));
    }

    try {
      await this.gatherPreferences(initialInput);
      await this.searchDestinationInfo();
      await this.generateItinerary();
      await this.reviewAndRefine();

      this.updateState({ status: 'completed', workflowStage: 'finalized' });
    } catch (error) {
      this.updateState({
        status: 'error',
        workflowStage: 'failed',
      });
      throw error;
    }

    return this.getState();
  }

  private async gatherPreferences(initialInput: string): Promise<void> {
    this.updateState({ workflowStage: 'gathering_preferences' });

    const destinationMatch = initialInput.match(
      /(?:itinerary|trip|travel|visit|go)\s+(?:to|for)\s+(.+?)(?:\s+for|\s+in|$)/i
    );
    let destination = destinationMatch?.[1]?.trim();

    if (!destination) {
      destination = await this.context.askUser(
        'What destination would you like to plan a trip to?'
      );
    }

    this.updateState({ destination });
    this.context.log(chalk.green(`\n✓ Destination: ${destination}`));

    const datesResponse = await this.context.askUser(
      'When are you planning to travel?',
      ['Next week', 'Next month', '2-3 months from now', 'I have specific dates']
    );

    let dates: DateRange;
    if (datesResponse === 'I have specific dates') {
      const startDate = await this.context.askUser('What is your departure date? (MM/DD)');
      const nights = await this.context.askUser('How many nights?', ['3', '5', '7', '10', '14']);

      const start = new Date();
      const [month, day] = startDate.split('/').map(Number);
      start.setMonth((month || 1) - 1);
      start.setDate(day || 1);

      const nightCount = parseInt(nights) || 5;
      const end = new Date(start);
      end.setDate(end.getDate() + nightCount);

      dates = {
        start: start.toLocaleDateString(),
        end: end.toLocaleDateString(),
        nights: nightCount,
      };
    } else {
      const start = new Date();
      const daysToAdd = datesResponse === 'Next week' ? 7 : datesResponse === 'Next month' ? 30 : 60;
      start.setDate(start.getDate() + daysToAdd);

      const nightsResponse = await this.context.askUser('How many nights?', ['3', '5', '7', '10', '14']);
      const nights = parseInt(nightsResponse) || 5;

      const end = new Date(start);
      end.setDate(end.getDate() + nights);

      dates = {
        start: start.toLocaleDateString(),
        end: end.toLocaleDateString(),
        nights,
      };
    }

    this.updateState({ dates });
    this.context.log(chalk.green(`✓ Dates: ${dates.start} - ${dates.end} (${dates.nights} nights)`));

    const budgetCategory = await this.context.askUser(
      'What is your budget level?',
      ['Budget-friendly', 'Mid-range', 'Luxury']
    );

    const budgetMap: Record<string, Budget['category']> = {
      'Budget-friendly': 'budget',
      'Mid-range': 'mid-range',
      'Luxury': 'luxury',
    };

    const perDayEstimates = {
      'budget': 100,
      'mid-range': 250,
      'luxury': 500,
    };

    const category = budgetMap[budgetCategory] || 'mid-range';
    const budget: Budget = {
      category,
      perDay: perDayEstimates[category],
      total: perDayEstimates[category] * dates.nights,
    };

    this.updateState({ budget });
    this.context.log(chalk.green(`✓ Budget: ${budgetCategory} (~$${budget.perDay}/day)`));

    const interestsResponse = await this.context.askUser(
      'What are your main interests?',
      ['Culture & History', 'Nature & Adventure', 'Food & Dining', 'Relaxation & Beach', 'Shopping & Nightlife']
    );

    const interests = interestsResponse.split(',').map((i) => i.trim());

    const paceResponse = await this.context.askUser(
      'How would you describe your ideal travel pace?',
      ['Relaxed - plenty of downtime', 'Moderate - balanced schedule', 'Packed - see everything!']
    );

    const paceMap: Record<string, TravelPreferences['pace']> = {
      'Relaxed - plenty of downtime': 'relaxed',
      'Moderate - balanced schedule': 'moderate',
      'Packed - see everything!': 'packed',
    };

    const preferences: TravelPreferences = {
      interests,
      pace: paceMap[paceResponse] || 'moderate',
      accommodation: category,
      priorities: interests,
    };

    this.updateState({ preferences });
    this.context.log(chalk.green(`✓ Preferences saved\n`));
  }

  private async searchDestinationInfo(): Promise<void> {
    this.updateState({ workflowStage: 'searching_options' });

    const destination = this.state.destination!;

    const attractionsSpinner = this.context.showProgress(`Searching for attractions in ${destination}...`);

    try {
      const { results: attractionResults, searchMode } = await findAttractions(destination, {
        maxResults: 15,
      });
      this.attractions = attractionResults;
      this.searchMode = searchMode;

      attractionsSpinner.succeed(
        `Found ${attractionResults.length} attractions ${searchMode === 'real' ? chalk.cyan('(via Exa)') : chalk.dim('(simulated)')}`
      );
    } catch (error) {
      attractionsSpinner.fail('Failed to search attractions');
      this.attractions = [];
    }

    const hotelsSpinner = this.context.showProgress(`Searching for hotels in ${destination}...`);

    try {
      const { results: hotelResults, searchMode } = await findHotels(
        destination,
        this.state.dates!.nights,
        this.state.budget!.category,
        { maxResults: 5 }
      );
      this.hotels = hotelResults;

      hotelsSpinner.succeed(
        `Found ${hotelResults.length} hotels ${searchMode === 'real' ? chalk.cyan('(via Exa)') : chalk.dim('(simulated)')}`
      );
    } catch (error) {
      hotelsSpinner.fail('Failed to search hotels');
      this.hotels = [];
    }
  }

  private async generateItinerary(): Promise<void> {
    this.updateState({ workflowStage: 'generating_itinerary' });

    const destination = this.state.destination!;
    const dates = this.state.dates!;
    const budget = this.state.budget!;
    const preferences = this.state.preferences!;

    if (isGeminiEnabled()) {
      await this.generateItineraryWithGemini(destination, dates, budget, preferences);
    } else {
      await this.generateItineraryFallback(destination, dates, budget, preferences);
    }
  }

  private async generateItineraryWithGemini(
    destination: string,
    dates: DateRange,
    budget: Budget,
    preferences: TravelPreferences
  ): Promise<void> {
    const spinner = this.context.showProgress('Creating your personalized itinerary with Gemini AI...');

    try {
      const attractionsData = this.attractions.length > 0
        ? this.attractions.map(a => `- ${a.name}: ${a.description} (${a.category})`).join('\n')
        : undefined;

      const geminiItinerary = await geminiGenerateItinerary(
        destination,
        dates.nights,
        budget.category,
        preferences.interests,
        preferences.pace,
        attractionsData
      );

      spinner.succeed(chalk.cyan('Itinerary created with Gemini AI!'));

      const days: DayPlan[] = geminiItinerary.days.map((day, idx) => {
        const dayDate = new Date(dates.start);
        dayDate.setDate(dayDate.getDate() + idx);

        return {
          day: day.day,
          date: dayDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          theme: day.theme,
          activities: day.activities.map((activity, actIdx) => ({
            id: `activity-${day.day}-${actIdx}`,
            name: activity.name,
            category: 'attraction',
            time: activity.time,
            duration: activity.duration,
            description: activity.description,
            price: activity.estimatedCost,
            location: destination,
          })),
          meals: day.meals.map(meal => ({
            type: meal.type,
            suggestion: meal.suggestion,
            cuisine: meal.cuisine,
            priceRange: '$$',
          })),
          estimatedCost: day.activities.reduce((sum, a) => sum + a.estimatedCost, 0) + budget.perDay * 0.3,
          notes: day.tips,
        };
      });

      const selectedHotel = this.hotels[0];

      const itinerary: Itinerary = {
        destination,
        dates,
        days,
        hotel: selectedHotel ? {
          id: selectedHotel.id,
          name: selectedHotel.name,
          rating: selectedHotel.rating,
          pricePerNight: selectedHotel.pricePerNight || budget.perDay * 0.4,
          location: selectedHotel.location,
          amenities: selectedHotel.amenities || [],
          reviewScore: selectedHotel.reviewScore || 8.0,
        } : undefined,
        totalCost: geminiItinerary.totalEstimatedCost,
        version: 1,
        aiGenerated: true,
        packingTips: geminiItinerary.packingTips,
        bestTimeToVisit: geminiItinerary.bestTimeToVisit,
        summary: geminiItinerary.summary,
      };

      this.updateState({ itinerary });
      this.displayItinerary(itinerary);
    } catch (error) {
      spinner.fail('Gemini AI generation failed, using fallback...');
      console.error(chalk.dim(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
      await this.generateItineraryFallback(destination, dates, budget, preferences);
    }
  }

  private async generateItineraryFallback(
    destination: string,
    dates: DateRange,
    budget: Budget,
    preferences: TravelPreferences
  ): Promise<void> {
    const spinner = this.context.showProgress('Creating your personalized itinerary...');

    await new Promise((resolve) => setTimeout(resolve, 1500));

    const days: DayPlan[] = [];
    let totalCost = 0;

    const activitiesPerDay = preferences.pace === 'relaxed' ? 2 : preferences.pace === 'moderate' ? 3 : 4;

    const shuffledAttractions = [...this.attractions].sort(() => Math.random() - 0.5);

    for (let i = 0; i < dates.nights; i++) {
      const dayDate = new Date(dates.start);
      dayDate.setDate(dayDate.getDate() + i);

      const dayActivities: Activity[] = [];
      const startIdx = i * activitiesPerDay;

      for (let j = 0; j < activitiesPerDay && startIdx + j < shuffledAttractions.length; j++) {
        const attraction = shuffledAttractions[startIdx + j];
        const times = ['9:00 AM', '11:00 AM', '2:00 PM', '4:00 PM'];

        dayActivities.push({
          id: attraction.id,
          name: attraction.name,
          category: attraction.category,
          time: times[j] || '10:00 AM',
          duration: attraction.duration || '2-3 hours',
          description: attraction.description,
          price: attraction.price || 0,
          location: destination,
        });
      }

      const destData = getDestinationData(destination);
      const meals = [
        {
          type: 'breakfast' as const,
          suggestion: 'Hotel breakfast or local café',
          cuisine: 'Local',
          priceRange: '$',
        },
        {
          type: 'lunch' as const,
          suggestion: destData?.restaurants[i % destData.restaurants.length]?.name || 'Local restaurant',
          cuisine: destData?.restaurants[i % destData.restaurants.length]?.cuisine || 'Local',
          priceRange: destData?.restaurants[i % destData.restaurants.length]?.priceRange || '$$',
        },
        {
          type: 'dinner' as const,
          suggestion: destData?.restaurants[(i + 1) % destData.restaurants.length]?.name || 'Local restaurant',
          cuisine: destData?.restaurants[(i + 1) % destData.restaurants.length]?.cuisine || 'Local',
          priceRange: destData?.restaurants[(i + 1) % destData.restaurants.length]?.priceRange || '$$',
        },
      ];

      const dayCost = dayActivities.reduce((sum, a) => sum + a.price, 0) + budget.perDay * 0.5;
      totalCost += dayCost;

      const themes = [
        'Arrival & Exploration',
        'Cultural Immersion',
        'Nature & Adventure',
        'Local Experience',
        'Relaxation Day',
        'Hidden Gems',
        'Departure Day',
      ];

      days.push({
        day: i + 1,
        date: dayDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        theme: themes[i] || `Day ${i + 1} Adventures`,
        activities: dayActivities,
        meals,
        estimatedCost: Math.round(dayCost),
        notes: i === 0 ? ['Check-in at hotel', 'Get local SIM card'] : undefined,
      });
    }

    const selectedHotel = this.hotels[0];
    if (selectedHotel) {
      totalCost += (selectedHotel.pricePerNight || budget.perDay * 0.4) * dates.nights;
    }

    const itinerary: Itinerary = {
      destination,
      dates,
      days,
      hotel: selectedHotel ? {
        id: selectedHotel.id,
        name: selectedHotel.name,
        rating: selectedHotel.rating,
        pricePerNight: selectedHotel.pricePerNight || budget.perDay * 0.4,
        location: selectedHotel.location,
        amenities: selectedHotel.amenities || [],
        reviewScore: selectedHotel.reviewScore || 8.0,
      } : undefined,
      totalCost: Math.round(totalCost),
      version: 1,
    };

    spinner.succeed('Itinerary created!');

    this.updateState({ itinerary });
    this.displayItinerary(itinerary);
  }

  private displayItinerary(itinerary: Itinerary): void {
    this.context.log(chalk.bold.cyan(`\n${'═'.repeat(60)}`));
    this.context.log(chalk.bold.cyan(`  ${itinerary.destination.toUpperCase()} ITINERARY`));
    this.context.log(chalk.bold.cyan(`  ${itinerary.dates.start} - ${itinerary.dates.end}`));

    const attributions: string[] = [];
    if (itinerary.aiGenerated) attributions.push('Gemini AI');
    if (this.searchMode === 'real') attributions.push('Exa search');
    if (attributions.length > 0) {
      this.context.log(chalk.cyan(`  Powered by ${attributions.join(' + ')}`));
    }
    this.context.log(chalk.bold.cyan(`${'═'.repeat(60)}\n`));

    if (itinerary.summary) {
      this.context.log(chalk.italic(`"${itinerary.summary}"\n`));
    }

    if (itinerary.hotel) {
      this.context.log(chalk.bold('🏨 Accommodation'));
      this.context.log(`   ${itinerary.hotel.name}`);
      this.context.log(`   ${itinerary.hotel.location} | ★ ${itinerary.hotel.rating} | $${itinerary.hotel.pricePerNight}/night`);
      if (itinerary.hotel.amenities && itinerary.hotel.amenities.length > 0) {
        this.context.log(`   Amenities: ${itinerary.hotel.amenities.slice(0, 4).join(', ')}`);
      }
      this.context.log('');
    }

    for (const day of itinerary.days) {
      this.context.log(chalk.bold.yellow(`\n📅 Day ${day.day}: ${day.theme}`));
      this.context.log(chalk.dim(`   ${day.date}`));
      this.context.log(chalk.dim('   ' + '─'.repeat(40)));

      for (const activity of day.activities) {
        const priceTag = activity.price > 0 ? chalk.green(`$${activity.price}`) : chalk.green('Free');
        this.context.log(`   ${chalk.cyan(activity.time)} ${activity.name}`);
        this.context.log(chalk.dim(`      ${activity.category} • ${activity.duration} • ${priceTag}`));
      }

      this.context.log(chalk.dim(`\n   🍽️  Meals:`));
      for (const meal of day.meals) {
        this.context.log(chalk.dim(`      ${meal.type}: ${meal.suggestion} (${meal.priceRange})`));
      }

      if (day.notes && day.notes.length > 0) {
        this.context.log(chalk.dim(`\n   📝 Notes:`));
        day.notes.forEach((note) => this.context.log(chalk.dim(`      • ${note}`)));
      }
    }

    this.context.log(chalk.bold.green(`\n${'─'.repeat(60)}`));
    this.context.log(chalk.bold.green(`  💰 ESTIMATED TOTAL: $${itinerary.totalCost}`));
    this.context.log(chalk.dim(`     (Accommodation + Activities + Meals)`));
    this.context.log(chalk.bold.green(`${'─'.repeat(60)}\n`));

    if (itinerary.bestTimeToVisit) {
      this.context.log(chalk.bold('🌤️  Best Time to Visit'));
      this.context.log(`   ${itinerary.bestTimeToVisit}\n`);
    }

    if (itinerary.packingTips && itinerary.packingTips.length > 0) {
      this.context.log(chalk.bold('🧳 Packing Tips'));
      itinerary.packingTips.forEach(tip => {
        this.context.log(`   • ${tip}`);
      });
      this.context.log('');
    }
  }

  private async reviewAndRefine(): Promise<void> {
    this.updateState({ workflowStage: 'reviewing' });

    let continueRefining = true;

    while (continueRefining && this.state.refinementCount < 5) {
      const response = await this.context.askUser(
        'What would you like to do with this itinerary?',
        [
          'Looks great! Finalize it',
          'Add more activities',
          'Make it more relaxed',
          'Focus on different interests',
          'Change accommodation',
        ]
      );

      if (response === 'Looks great! Finalize it') {
        continueRefining = false;
      } else {
        await this.applyRefinement(response);
      }
    }
  }

  private async applyRefinement(feedback: string): Promise<void> {
    this.updateState({
      workflowStage: 'refining',
      refinementCount: this.state.refinementCount + 1,
      userFeedback: [...this.state.userFeedback, feedback],
    });

    const spinner = this.context.showProgress('Refining your itinerary...');

    if (this.state.itinerary) {
      this.updateState({
        previousVersions: [...this.state.previousVersions, this.state.itinerary],
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));

    const itinerary = { ...this.state.itinerary! };

    if (feedback.includes('more relaxed')) {
      itinerary.days = itinerary.days.map((day) => ({
        ...day,
        activities: day.activities.slice(0, -1),
        theme: day.theme.replace('Adventure', 'Relaxation'),
      }));
    } else if (feedback.includes('more activities')) {
      itinerary.days = itinerary.days.map((day) => ({
        ...day,
        notes: [...(day.notes || []), 'Consider adding evening entertainment or night market visit'],
      }));
    } else if (feedback.includes('accommodation')) {
      if (this.hotels.length > 1) {
        const newHotel = this.hotels[1];
        itinerary.hotel = {
          id: newHotel.id,
          name: newHotel.name,
          rating: newHotel.rating,
          pricePerNight: newHotel.pricePerNight || this.state.budget!.perDay * 0.4,
          location: newHotel.location,
          amenities: newHotel.amenities || [],
          reviewScore: newHotel.reviewScore || 8.0,
        };
      }
    }

    itinerary.version++;

    spinner.succeed('Itinerary updated');

    this.updateState({ itinerary, workflowStage: 'reviewing' });
    this.displayItinerary(itinerary);
  }
}
