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
    AED: 'د.إ',     // UAE Dirham
    AFN: '؋',       // Afghan Afghani
    ALL: 'L',       // Albanian Lek
    AMD: '֏',       // Armenian Dram
    ANG: 'ƒ',       // Netherlands Antillean Guilder
    AOA: 'Kz',      // Angolan Kwanza
    ARS: '$',       // Argentine Peso
    AUD: 'A$',      // Australian Dollar
    AWG: 'ƒ',       // Aruban Florin
    AZN: '₼',       // Azerbaijani Manat
    BAM: 'КМ',      // Bosnia-Herzegovina Convertible Mark
    BBD: '$',       // Barbadian Dollar
    BDT: '৳',       // Bangladeshi Taka
    BGN: 'лв',      // Bulgarian Lev
    BHD: '.د.ب',    // Bahraini Dinar
    BIF: 'Fr',      // Burundian Franc
    BMD: '$',       // Bermudan Dollar
    BND: '$',       // Brunei Dollar
    BOB: 'Bs.',     // Bolivian Boliviano
    BRL: 'R$',      // Brazilian Real
    BSD: '$',       // Bahamian Dollar
    BTN: 'Nu.',     // Bhutanese Ngultrum
    BWP: 'P',       // Botswanan Pula
    BYN: 'Br',      // Belarusian Ruble
    BZD: '$',       // Belize Dollar
    CAD: 'C$',      // Canadian Dollar
    CDF: 'Fr',      // Congolese Franc
    CHF: 'Fr',      // Swiss Franc
    CLP: '$',       // Chilean Peso
    CNY: '¥',       // Chinese Yuan
    COP: '$',       // Colombian Peso
    CRC: '₡',       // Costa Rican Colón
    CUP: '$',       // Cuban Peso
    CVE: '$',       // Cape Verdean Escudo
    CZK: 'Kč',      // Czech Koruna
    DJF: 'Fr',      // Djiboutian Franc
    DKK: 'kr',      // Danish Krone
    DOP: '$',       // Dominican Peso
    DZD: 'د.ج',     // Algerian Dinar
    EGP: '£',       // Egyptian Pound
    ERN: 'Nfk',     // Eritrean Nakfa
    ETB: 'Br',      // Ethiopian Birr
    EUR: '€',       // Euro
    FJD: '$',       // Fijian Dollar
    FKP: '£',       // Falkland Islands Pound
    GBP: '£',       // British Pound Sterling
    GEL: '₾',       // Georgian Lari
    GHS: '₵',       // Ghanaian Cedi
    GIP: '£',       // Gibraltar Pound
    GMD: 'D',       // Gambian Dalasi
    GNF: 'Fr',      // Guinean Franc
    GTQ: 'Q',       // Guatemalan Quetzal
    GYD: '$',       // Guyanaese Dollar
    HKD: 'HK$',     // Hong Kong Dollar
    HNL: 'L',       // Honduran Lempira
    HRK: 'kn',      // Croatian Kuna (historical, now EUR)
    HTG: 'G',       // Haitian Gourde
    HUF: 'Ft',      // Hungarian Forint
    IDR: 'Rp',      // Indonesian Rupiah
    ILS: '₪',       // Israeli New Sheqel
    INR: '₹',       // Indian Rupee
    IQD: 'ع.د',     // Iraqi Dinar
    IRR: '﷼',       // Iranian Rial
    ISK: 'kr',      // Icelandic Króna
    JMD: '$',       // Jamaican Dollar
    JOD: 'د.ا',     // Jordanian Dinar
    JPY: '¥',       // Japanese Yen
    KES: 'Sh',      // Kenyan Shilling
    KGS: 'с',       // Kyrgystani Som
    KHR: '៛',       // Cambodian Riel
    KMF: 'Fr',      // Comorian Franc
    KPW: '₩',       // North Korean Won
    KRW: '₩',       // South Korean Won
    KWD: 'د.ك',     // Kuwaiti Dinar
    KYD: '$',       // Cayman Islands Dollar
    KZT: '₸',       // Kazakhstani Tenge
    LAK: '₭',       // Laotian Kip
    LBP: 'ل.ل',     // Lebanese Pound
    LKR: 'Rs',      // Sri Lankan Rupee
    LRD: '$',       // Liberian Dollar
    LSL: 'L',       // Lesotho Loti
    LYD: 'ل.د',     // Libyan Dinar
    MAD: 'د.م.',    // Moroccan Dirham
    MDL: 'L',       // Moldovan Leu
    MGA: 'Ar',      // Malagasy Ariary
    MKD: 'ден',     // Macedonian Denar
    MMK: 'Ks',      // Myanmar Kyat
    MNT: '₮',       // Mongolian Tugrik
    MOP: 'P',       // Macanese Pataca
    MRU: 'UM',      // Mauritanian Ouguiya
    MUR: '₨',       // Mauritian Rupee
    MVR: '.ރ',      // Maldivian Rufiyaa
    MWK: 'MK',      // Malawian Kwacha
    MXN: '$',       // Mexican Peso
    MYR: 'RM',      // Malaysian Ringgit
    MZN: 'MT',      // Mozambican Metical
    NAD: '$',       // Namibian Dollar
    NGN: '₦',       // Nigerian Naira
    NIO: 'C$',      // Nicaraguan Córdoba
    NOK: 'kr',      // Norwegian Krone
    NPR: '₨',       // Nepalese Rupee
    NZD: 'NZ$',     // New Zealand Dollar
    OMR: 'ر.ع.',    // Omani Rial
    PAB: 'B/.',     // Panamanian Balboa
    PEN: 'S/',      // Peruvian Nuevo Sol
    PGK: 'K',       // Papua New Guinean Kina
    PHP: '₱',       // Philippine Peso
    PKR: '₨',       // Pakistani Rupee
    PLN: 'zł',      // Polish Zloty
    PYG: '₲',       // Paraguayan Guarani
    QAR: 'ر.ق',     // Qatari Rial
    RON: 'lei',     // Romanian Leu
    RSD: 'дин.',    // Serbian Dinar
    RUB: '₽',       // Russian Ruble
    RWF: 'Fr',      // Rwandan Franc
    SAR: 'ر.س',     // Saudi Riyal
    SBD: '$',       // Solomon Islands Dollar
    SCR: '₨',       // Seychellois Rupee
    SDG: 'ج.س.',    // Sudanese Pound
    SEK: 'kr',      // Swedish Krona
    SGD: 'S$',      // Singapore Dollar
    SHP: '£',       // Saint Helena Pound
    SLL: 'Le',      // Sierra Leonean Leone
    SOS: 'Sh',      // Somali Shilling
    SRD: '$',       // Surinamese Dollar
    SSP: '£',       // South Sudanese Pound
    STN: 'Db',      // São Tomé and Príncipe Dobra
    SYP: 'ل.س',     // Syrian Pound
    SZL: 'L',       // Swazi Lilangeni
    THB: '฿',       // Thai Baht
    TJS: 'ЅМ',      // Tajikistani Somoni
    TMT: 'm',       // Turkmenistani Manat
    TND: 'د.ت',     // Tunisian Dinar
    TOP: 'T$',      // Tongan Paʻanga
    TRY: '₺',       // Turkish Lira
    TTD: '$',       // Trinidad and Tobago Dollar
    TWD: 'NT$',     // New Taiwan Dollar
    TZS: 'Sh',      // Tanzanian Shilling
    UAH: '₴',       // Ukrainian Hryvnia
    UGX: 'Sh',      // Ugandan Shilling
    USD: '$',       // US Dollar
    UYU: '$',       // Uruguayan Peso
    UZS: 'so\'m',   // Uzbekistan Som
    VES: 'Bs.S',    // Venezuelan Bolívar Soberano
    VND: '₫',       // Vietnamese Dong
    VUV: 'Vt',      // Vanuatu Vatu
    WST: 'T',       // Samoan Tala
    XAF: 'Fr',      // CFA Franc BEAC
    XCD: '$',       // East Caribbean Dollar
    XOF: 'Fr',      // CFA Franc BCEAO
    XPF: 'Fr',      // CFP Franc
    YER: '﷼',       // Yemeni Rial
    ZAR: 'R',       // South African Rand
    ZMW: 'ZK',      // Zambian Kwacha
    ZWL: '$',       // Zimbabwean Dollar
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