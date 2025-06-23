// Stripe helper functions for multi-currency support
import { supabase } from '../lib/supabase';
import { getEventCurrency, getCurrencyForCountry, convertCurrency } from './currencyUtils';

/**
 * Get the correct currency and amount for a booking based on event location
 */
export const getBookingCurrencyData = async (
  eventId: string,
  rawAmountUSD: number
): Promise<{ currency: string; amount: number; originalAmount: number; originalCurrency: string }> => {
  try {
    // Get event currency based on location
    const eventCurrency = await getEventCurrency(eventId);
    
    if (eventCurrency === 'USD') {
      return {
        currency: 'USD',
        amount: rawAmountUSD,
        originalAmount: rawAmountUSD,
        originalCurrency: 'USD'
      };
    }

    // Convert from USD to event currency
    const convertedAmount = await convertCurrency(rawAmountUSD, 'USD', eventCurrency);
    
    if (convertedAmount === null) {
      // Fallback to USD if conversion fails
      console.warn(`Currency conversion failed for ${eventCurrency}, using USD`);
      return {
        currency: 'USD',
        amount: rawAmountUSD,
        originalAmount: rawAmountUSD,
        originalCurrency: 'USD'
      };
    }

    return {
      currency: eventCurrency,
      amount: convertedAmount,
      originalAmount: rawAmountUSD,
      originalCurrency: 'USD'
    };
  } catch (error) {
    console.error('Error getting booking currency data:', error);
    return {
      currency: 'USD',
      amount: rawAmountUSD,
      originalAmount: rawAmountUSD,
      originalCurrency: 'USD'
    };
  }
};

/**
 * Get organizer cost pricing based on their primary country
 */
export const getOrganizerCostCurrency = async (organizerId: string): Promise<{
  ticketCostPerUnit: number;
  impressionCostPerUnit: number;
  currency: string;
}> => {
  try {
    // Get organizer's primary country from their events
    const { data: events, error } = await supabase
      .from('events')
      .select('country')
      .eq('organizer_id', organizerId)
      .not('country', 'is', null)
      .limit(10); // Get sample of events

    if (error || !events || events.length === 0) {
      // Default to SGD pricing
      return {
        ticketCostPerUnit: 0.50,
        impressionCostPerUnit: 0.0075,
        currency: 'SGD'
      };
    }

    // Find most common country
    const countryCount: Record<string, number> = {};
    events.forEach(event => {
      if (event.country) {
        countryCount[event.country] = (countryCount[event.country] || 0) + 1;
      }
    });

    const primaryCountry = Object.entries(countryCount)
      .sort(([,a], [,b]) => b - a)[0]?.[0];

    if (!primaryCountry) {
      return {
        ticketCostPerUnit: 0.50,
        impressionCostPerUnit: 0.0075,
        currency: 'SGD'
      };
    }

    const primaryCurrency = getCurrencyForCountry(primaryCountry);

    // Convert SGD base prices to primary currency
    if (primaryCurrency === 'SGD') {
      return {
        ticketCostPerUnit: 0.50,
        impressionCostPerUnit: 0.0075,
        currency: 'SGD'
      };
    }

    const convertedTicketCost = await convertCurrency(0.50, 'SGD', primaryCurrency);
    const convertedImpressionCost = await convertCurrency(0.0075, 'SGD', primaryCurrency);

    return {
      ticketCostPerUnit: convertedTicketCost || 0.50,
      impressionCostPerUnit: convertedImpressionCost || 0.0075,
      currency: convertedTicketCost && convertedImpressionCost ? primaryCurrency : 'SGD'
    };
  } catch (error) {
    console.error('Error getting organizer cost currency:', error);
    return {
      ticketCostPerUnit: 0.50,
      impressionCostPerUnit: 0.0075,
      currency: 'SGD'
    };
  }
};

/**
 * Enhanced payment intent creation with proper currency
 */
export const createEnhancedPaymentIntent = async (
  eventId: string,
  quantity: number,
  baseTicketPriceUSD: number
): Promise<{ clientSecret: string | null; currency: string; amount: number }> => {
  try {
    // Get proper currency and converted amount
    const bookingData = await getBookingCurrencyData(
      eventId,
      baseTicketPriceUSD * quantity
    );

    // Call the existing edge function with the correct currency
    const { data, error } = await supabase.functions.invoke('create-payment-intent-for-booking', {
      body: {
        eventId,
        quantity,
        // The edge function expects these fields - we provide them in the expected format
        // but with the correct currency information
        overrideCurrency: bookingData.currency,
        overrideAmount: Math.round(bookingData.amount * 100) // Stripe expects cents
      }
    });

    if (error) {
      console.error('Error creating enhanced payment intent:', error);
      return { clientSecret: null, currency: 'USD', amount: baseTicketPriceUSD * quantity };
    }

    return {
      clientSecret: data?.clientSecret || null,
      currency: bookingData.currency,
      amount: bookingData.amount
    };
  } catch (error) {
    console.error('Error in createEnhancedPaymentIntent:', error);
    return { clientSecret: null, currency: 'USD', amount: baseTicketPriceUSD * quantity };
  }
};

/**
 * Enhanced organizer subscription creation with proper currency
 */
export const createEnhancedOrganizerSubscription = async (
  organizerId: string,
  subscriptionType: 'TICKET_USAGE' | 'IMPRESSION_USAGE',
  email: string,
  companyName?: string
): Promise<{ success: boolean; subscriptionId?: string; currency?: string; error?: string }> => {
  try {
    // Get proper currency pricing for this organizer
    const costData = await getOrganizerCostCurrency(organizerId);

    // Determine which edge function to call
    const functionName = subscriptionType === 'TICKET_USAGE' 
      ? 'create-organizer-ticket-usage-subscription'
      : 'create-organizer-impression-subscription';

    const { data, error } = await supabase.functions.invoke(functionName, {
      body: {
        userId: organizerId,
        email,
        companyName,
        // Pass currency info as metadata or additional fields
        // The edge functions can use these for future enhancements
        preferredCurrency: costData.currency,
        costPerUnit: subscriptionType === 'TICKET_USAGE' 
          ? costData.ticketCostPerUnit 
          : costData.impressionCostPerUnit
      }
    });

    if (error) {
      console.error(`Error creating ${subscriptionType} subscription:`, error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      subscriptionId: data?.subscriptionId,
      currency: costData.currency
    };
  } catch (error: any) {
    console.error(`Error in createEnhanced${subscriptionType}Subscription:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Enhanced usage reporting with currency awareness
 */
export const reportEnhancedBookingUsage = async (
  eventId: string,
  quantity: number
): Promise<{ success: boolean; reportedUsage?: number; currency?: string; error?: string }> => {
  try {
    // Get event details for context
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('organizer_id, country')
      .eq('id', eventId)
      .single();

    if (eventError || !eventData) {
      throw new Error('Could not fetch event data for usage reporting');
    }

    // Get organizer's cost currency for context
    const costData = await getOrganizerCostCurrency(eventData.organizer_id);

    // Call the existing edge function
    const { data, error } = await supabase.functions.invoke('report-booking-usage', {
      body: {
        eventId,
        quantity,
        // Additional context for future enhancements
        eventCountry: eventData.country,
        organizerCurrency: costData.currency
      }
    });

    if (error) {
      console.error('Error reporting enhanced booking usage:', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      reportedUsage: data?.reportedUsage,
      currency: costData.currency
    };
  } catch (error: any) {
    console.error('Error in reportEnhancedBookingUsage:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get display-friendly pricing information for an event
 */
export const getEventPricingDisplay = async (
  eventId: string,
  baseTicketPriceUSD: number,
  quantity: number = 1
): Promise<{
  pricePerItem: string;
  totalPrice: string;
  currency: string;
  originalPriceUSD: number;
}> => {
  try {
    const bookingData = await getBookingCurrencyData(eventId, baseTicketPriceUSD);
    
    return {
      pricePerItem: `${getCurrencySymbol(bookingData.currency)}${bookingData.amount.toFixed(2)}`,
      totalPrice: `${getCurrencySymbol(bookingData.currency)}${(bookingData.amount * quantity).toFixed(2)}`,
      currency: bookingData.currency,
      originalPriceUSD: baseTicketPriceUSD
    };
  } catch (error) {
    console.error('Error getting event pricing display:', error);
    return {
      pricePerItem: `$${baseTicketPriceUSD.toFixed(2)}`,
      totalPrice: `$${(baseTicketPriceUSD * quantity).toFixed(2)}`,
      currency: 'USD',
      originalPriceUSD: baseTicketPriceUSD
    };
  }
};

// Helper function to get currency symbol (reuse from currencyUtils if exported)
const getCurrencySymbol = (currencyCode: string): string => {
  const symbols: Record<string, string> = {
    'USD': '$', 'EUR': '€', 'GBP': '£', 'JPY': '¥', 'SGD': 'S$',
    'CAD': 'C$', 'AUD': 'A$', 'CHF': 'Fr', 'CNY': '¥', 'INR': '₹'
  };
  return symbols[currencyCode.toUpperCase()] || currencyCode;
}; 