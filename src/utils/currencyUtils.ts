// Currency utilities for handling multi-currency event pricing
import { supabase } from '../lib/supabase';

// Comprehensive country to currency mapping
export const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  // Major currencies
  'United States': 'USD',
  'Canada': 'CAD',
  'United Kingdom': 'GBP',
  'European Union': 'EUR',
  'Germany': 'EUR',
  'France': 'EUR',
  'Italy': 'EUR',
  'Spain': 'EUR',
  'Netherlands': 'EUR',
  'Belgium': 'EUR',
  'Austria': 'EUR',
  'Portugal': 'EUR',
  'Finland': 'EUR',
  'Ireland': 'EUR',
  'Luxembourg': 'EUR',
  'Greece': 'EUR',
  'Slovenia': 'EUR',
  'Cyprus': 'EUR',
  'Malta': 'EUR',
  'Slovakia': 'EUR',
  'Estonia': 'EUR',
  'Latvia': 'EUR',
  'Lithuania': 'EUR',
  'Croatia': 'EUR',
  'Japan': 'JPY',
  'Australia': 'AUD',
  'New Zealand': 'NZD',
  'Switzerland': 'CHF',
  'Singapore': 'SGD',
  'Hong Kong': 'HKD',
  'China': 'CNY',
  'India': 'INR',
  'South Korea': 'KRW',
  'Brazil': 'BRL',
  'Mexico': 'MXN',
  'Russia': 'RUB',
  'South Africa': 'ZAR',
  'Norway': 'NOK',
  'Sweden': 'SEK',
  'Denmark': 'DKK',
  'Poland': 'PLN',
  'Czech Republic': 'CZK',
  'Hungary': 'HUF',
  'Romania': 'RON',
  'Bulgaria': 'BGN',
  'Israel': 'ILS',
  'Turkey': 'TRY',
  'Egypt': 'EGP',
  'Nigeria': 'NGN',
  'Kenya': 'KES',
  'Morocco': 'MAD',
  'Ghana': 'GHS',
  'Tunisia': 'TND',
  'Algeria': 'DZD',
  'Ethiopia': 'ETB',
  'Uganda': 'UGX',
  'Tanzania': 'TZS',
  'Zambia': 'ZMW',
  'Zimbabwe': 'ZWL',
  'Botswana': 'BWP',
  'Namibia': 'NAD',
  'Lesotho': 'LSL',
  'Swaziland': 'SZL',
  'Mauritius': 'MUR',
  'Seychelles': 'SCR',
  'Madagascar': 'MGA',
  'Comoros': 'KMF',
  'Djibouti': 'DJF',
  'Eritrea': 'ERN',
  'Somalia': 'SOS',
  'Sudan': 'SDG',
  'South Sudan': 'SSP',
  'Chad': 'XAF',
  'Central African Republic': 'XAF',
  'Cameroon': 'XAF',
  'Equatorial Guinea': 'XAF',
  'Gabon': 'XAF',
  'Republic of the Congo': 'XAF',
  'Democratic Republic of the Congo': 'CDF',
  'Angola': 'AOA',
  'Benin': 'XOF',
  'Burkina Faso': 'XOF',
  'Cape Verde': 'CVE',
  'Cote d\'Ivoire': 'XOF',
  'Gambia': 'GMD',
  'Guinea': 'GNF',
  'Guinea-Bissau': 'XOF',
  'Liberia': 'LRD',
  'Mali': 'XOF',
  'Mauritania': 'MRU',
  'Niger': 'XOF',
  'Senegal': 'XOF',
  'Sierra Leone': 'SLL',
  'Togo': 'XOF',
  'Argentina': 'ARS',
  'Bolivia': 'BOB',
  'Chile': 'CLP',
  'Colombia': 'COP',
  'Ecuador': 'USD',
  'Guyana': 'GYD',
  'Paraguay': 'PYG',
  'Peru': 'PEN',
  'Suriname': 'SRD',
  'Uruguay': 'UYU',
  'Venezuela': 'VES',
  'Belize': 'BZD',
  'Costa Rica': 'CRC',
  'El Salvador': 'USD',
  'Guatemala': 'GTQ',
  'Honduras': 'HNL',
  'Nicaragua': 'NIO',
  'Panama': 'PAB',
  'Bahamas': 'BSD',
  'Barbados': 'BBD',
  'Cuba': 'CUP',
  'Dominican Republic': 'DOP',
  'Haiti': 'HTG',
  'Jamaica': 'JMD',
  'Trinidad and Tobago': 'TTD',
  'Afghanistan': 'AFN',
  'Armenia': 'AMD',
  'Azerbaijan': 'AZN',
  'Bahrain': 'BHD',
  'Bangladesh': 'BDT',
  'Bhutan': 'BTN',
  'Brunei': 'BND',
  'Cambodia': 'KHR',
  'Georgia': 'GEL',
  'Indonesia': 'IDR',
  'Iran': 'IRR',
  'Iraq': 'IQD',
  'Jordan': 'JOD',
  'Kazakhstan': 'KZT',
  'Kuwait': 'KWD',
  'Kyrgyzstan': 'KGS',
  'Laos': 'LAK',
  'Lebanon': 'LBP',
  'Malaysia': 'MYR',
  'Maldives': 'MVR',
  'Mongolia': 'MNT',
  'Myanmar': 'MMK',
  'Nepal': 'NPR',
  'North Korea': 'KPW',
  'Oman': 'OMR',
  'Pakistan': 'PKR',
  'Palestine': 'ILS',
  'Philippines': 'PHP',
  'Qatar': 'QAR',
  'Saudi Arabia': 'SAR',
  'Sri Lanka': 'LKR',
  'Syria': 'SYP',
  'Tajikistan': 'TJS',
  'Thailand': 'THB',
  'Timor-Leste': 'USD',
  'Turkmenistan': 'TMT',
  'United Arab Emirates': 'AED',
  'Uzbekistan': 'UZS',
  'Vietnam': 'VND',
  'Yemen': 'YER',
  'Albania': 'ALL',
  'Andorra': 'EUR',
  'Belarus': 'BYN',
  'Bosnia and Herzegovina': 'BAM',
  'Iceland': 'ISK',
  'Kosovo': 'EUR',
  'Liechtenstein': 'CHF',
  'Moldova': 'MDL',
  'Monaco': 'EUR',
  'Montenegro': 'EUR',
  'North Macedonia': 'MKD',
  'San Marino': 'EUR',
  'Serbia': 'RSD',
  'Ukraine': 'UAH',
  'Vatican City': 'EUR',
  'Fiji': 'FJD',
  'Kiribati': 'AUD',
  'Marshall Islands': 'USD',
  'Micronesia': 'USD',
  'Nauru': 'AUD',
  'Palau': 'USD',
  'Papua New Guinea': 'PGK',
  'Samoa': 'WST',
  'Solomon Islands': 'SBD',
  'Tonga': 'TOP',
  'Tuvalu': 'AUD',
  'Vanuatu': 'VUV',
};

// Get currency code for a country
export const getCurrencyForCountry = (country: string): string => {
  return COUNTRY_CURRENCY_MAP[country] || 'USD'; // Default to USD if country not found
};

// Currency symbols mapping
export const CURRENCY_SYMBOLS: Record<string, string> = {
  'USD': '$',
  'EUR': '€',
  'GBP': '£',
  'JPY': '¥',
  'CAD': 'C$',
  'AUD': 'A$',
  'CHF': 'Fr',
  'CNY': '¥',
  'SEK': 'kr',
  'NZD': 'NZ$',
  'MXN': '$',
  'SGD': 'S$',
  'HKD': 'HK$',
  'NOK': 'kr',
  'TRY': '₺',
  'RUB': '₽',
  'INR': '₹',
  'BRL': 'R$',
  'ZAR': 'R',
  'KRW': '₩',
  'DKK': 'kr',
  'PLN': 'zł',
  'CZK': 'Kč',
  'HUF': 'Ft',
  'ILS': '₪',
  'CLP': '$',
  'PHP': '₱',
  'AED': 'د.إ',
  'SAR': '﷼',
  'THB': '฿',
  'MYR': 'RM',
  'IDR': 'Rp',
  'VND': '₫',
  // Add more as needed, default to currency code if not found
};

// Get currency symbol
export const getCurrencySymbol = (currencyCode: string): string => {
  return CURRENCY_SYMBOLS[currencyCode.toUpperCase()] || currencyCode;
};

// Format price with currency
export const formatPriceWithCurrency = (amount: number, currencyCode: string): string => {
  const symbol = getCurrencySymbol(currencyCode);
  
  // Handle specific formatting rules for different currencies
  switch (currencyCode.toUpperCase()) {
    case 'JPY':
    case 'KRW':
    case 'VND':
      // No decimal places for these currencies
      return `${symbol}${Math.round(amount).toLocaleString()}`;
    case 'BHD':
    case 'IQD':
    case 'JOD':
    case 'KWD':
    case 'OMR':
      // 3 decimal places for these currencies
      return `${symbol}${amount.toFixed(3)}`;
    default:
      // 2 decimal places for most currencies
      return `${symbol}${amount.toFixed(2)}`;
  }
};

// Call currency conversion edge function
export const convertCurrency = async (
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<number | null> => {
  if (fromCurrency === toCurrency) {
    return amount;
  }

  try {
    const { data, error } = await supabase.functions.invoke('currency-converter', {
      body: {
        amount,
        from: fromCurrency.toUpperCase(),
        to: toCurrency.toUpperCase()
      }
    });

    if (error) {
      console.error('Currency conversion error:', error);
      return null;
    }

    return data?.convertedAmount || null;
  } catch (error) {
    console.error('Currency conversion failed:', error);
    return null;
  }
};

// Get organizer's countries to determine if multi-country
export const getOrganizerCountries = async (organizerId: string): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('country')
      .eq('organizer_id', organizerId)
      .not('country', 'is', null);

    if (error) {
      console.error('Error fetching organizer countries:', error);
      return [];
    }

    const countries = [...new Set(data.map(event => event.country))].filter(Boolean) as string[];
    return countries;
  } catch (error) {
    console.error('Error getting organizer countries:', error);
    return [];
  }
};

// Determine if organizer should use SGD (multi-country) or local currency
export const shouldUseSGD = async (organizerId: string): Promise<boolean> => {
  const countries = await getOrganizerCountries(organizerId);
  return countries.length > 1;
};

// Get primary country for organizer (most events)
export const getOrganizerPrimaryCurrency = async (organizerId: string): Promise<string> => {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('country')
      .eq('organizer_id', organizerId)
      .not('country', 'is', null);

    if (error || !data || data.length === 0) {
      return 'SGD'; // Default to SGD
    }

    // Count occurrences of each country
    const countryCount: Record<string, number> = {};
    data.forEach(event => {
      if (event.country) {
        countryCount[event.country] = (countryCount[event.country] || 0) + 1;
      }
    });

    // Find the country with most events
    const primaryCountry = Object.entries(countryCount)
      .sort(([,a], [,b]) => b - a)[0]?.[0];

    return primaryCountry ? getCurrencyForCountry(primaryCountry) : 'SGD';
  } catch (error) {
    console.error('Error getting organizer primary currency:', error);
    return 'SGD';
  }
};

// Convert organizer costs to display currency
export const convertOrganizerCosts = async (
  costs: Array<{ amount: number; currency: string; eventId?: string }>,
  organizerId: string
): Promise<Array<{ amount: number; currency: string; originalAmount?: number; originalCurrency?: string }>> => {
  const useMultiCurrency = await shouldUseSGD(organizerId);
  const targetCurrency = useMultiCurrency ? 'SGD' : await getOrganizerPrimaryCurrency(organizerId);

  const convertedCosts = await Promise.all(
    costs.map(async (cost) => {
      if (cost.currency === targetCurrency) {
        return { ...cost, currency: targetCurrency };
      }

      const convertedAmount = await convertCurrency(cost.amount, cost.currency, targetCurrency);
      
      if (convertedAmount !== null) {
        return {
          amount: convertedAmount,
          currency: targetCurrency,
          originalAmount: cost.amount,
          originalCurrency: cost.currency
        };
      } else {
        // Fallback to original if conversion fails
        return cost;
      }
    })
  );

  return convertedCosts;
};

// Get Stripe-compatible currency for event location
export const getEventCurrency = async (eventId: string): Promise<string> => {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('country')
      .eq('id', eventId)
      .single();

    if (error || !data?.country) {
      return 'USD'; // Default fallback
    }

    return getCurrencyForCountry(data.country);
  } catch (error) {
    console.error('Error getting event currency:', error);
    return 'USD';
  }
}; 