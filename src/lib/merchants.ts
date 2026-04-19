// Merchant → category mapper
// Maps common merchant names and keywords to reward categories

import type { Category } from "./cards";

interface MerchantMatch {
  category: Category;
  label: string; // friendly category name for display
}

const MERCHANT_MAP: Array<{ keywords: string[]; category: Category; label: string }> = [
  // Marriott brands
  {
    keywords: ["marriott", "westin", "sheraton", "w hotel", "ritz-carlton", "ritz carlton", "st. regis", "st regis", "courtyard", "residence inn", "fairfield", "springhill", "towneplace", "delta hotel", "autograph", "renaissance", "tribute portfolio", "design hotel", "le meridien", "four points", "aloft", "element", "ac hotel", "moxy"],
    category: "marriott",
    label: "Marriott Hotel",
  },

  // Flights
  {
    keywords: ["united", "delta", "american airlines", "southwest", "jetblue", "spirit", "frontier", "alaska airlines", "lufthansa", "british airways", "air france", "klm", "emirates", "turkish airlines", "air canada", "singapore airlines", "virgin atlantic", "flight", "airline"],
    category: "flight",
    label: "Flight",
  },

  // Rental cars
  {
    keywords: ["enterprise", "hertz", "avis", "budget", "national car", "alamo", "dollar rental", "thrifty", "sixt", "zipcar", "car rental", "rental car"],
    category: "rental_car",
    label: "Rental Car",
  },

  // Non-Marriott hotels
  {
    keywords: ["hilton", "hyatt", "ihg", "intercontinental", "holiday inn", "hampton inn", "embassy suites", "doubletree", "kimpton", "airbnb", "vrbo", "hotel", "inn", "suites", "motel"],
    category: "hotel",
    label: "Hotel",
  },

  // Rideshare / transit / parking
  {
    keywords: ["uber", "lyft", "divvy", "metra", "cta", "transit", "parking", "toll", "impark", "sp plus", "spplus", "greyhound", "amtrak"],
    category: "travel",
    label: "Transit / Rideshare",
  },

  // Online grocery
  {
    keywords: ["amazon fresh", "instacart", "shipt", "fresh direct", "freshdirect"],
    category: "online_grocery",
    label: "Online Grocery",
  },

  // Grocery stores
  {
    keywords: ["whole foods", "trader joe", "jewel", "mariano", "jewel-osco", "marianos", "kroger", "safeway", "aldi", "costco", "sam's club", "sams club", "publix", "wegmans", "sprouts", "fresh market", "grocery", "supermarket"],
    category: "groceries",
    label: "Grocery Store",
  },

  // Streaming
  {
    keywords: ["netflix", "spotify", "hulu", "disney+", "disney plus", "hbo max", "max", "apple tv", "peacock", "paramount+", "paramount plus", "youtube premium", "amazon prime", "twitch", "tidal", "pandora", "sirius", "crunchyroll"],
    category: "streaming",
    label: "Streaming",
  },

  // Drugstore
  {
    keywords: ["walgreens", "cvs", "rite aid", "duane reade", "pharmacy"],
    category: "drugstore",
    label: "Drugstore",
  },

  // Gas
  {
    keywords: ["shell", "bp", "exxon", "mobil", "chevron", "marathon", "speedway", "circle k", "casey's", "pilot", "love's", "kwik trip", "gas station", "gas", "fuel"],
    category: "gas",
    label: "Gas Station",
  },

  // Dining
  {
    keywords: ["chipotle", "mcdonald", "starbucks", "dunkin", "subway", "chick-fil-a", "chick fil a", "taco bell", "wendy's", "wendys", "burger king", "domino", "pizza hut", "papa john", "panera", "panda express", "five guys", "shake shack", "sweetgreen", "doordash", "grubhub", "ubereats", "uber eats", "postmates", "seamless", "restaurant", "cafe", "coffee", "bar", "grill", "kitchen", "eatery", "pizzeria", "sushi", "ramen", "bistro", "tavern", "pub", "diner", "bagel", "bakery", "donut", "doughnut", "chicken", "steakhouse", "seafood", "thai", "chinese", "mexican", "italian", "japanese", "indian", "mediterranean", "burrito", "tacos", "wing", "bbq", "barbecue"],
    category: "dining",
    label: "Dining",
  },
];

export function getMerchantCategory(input: string): MerchantMatch | null {
  const normalized = input.toLowerCase().trim();
  if (!normalized) return null;

  for (const entry of MERCHANT_MAP) {
    for (const keyword of entry.keywords) {
      if (normalized.includes(keyword)) {
        return { category: entry.category, label: entry.label };
      }
    }
  }

  // Check if it sounds like a category directly
  const categoryKeywords: Array<{ words: string[]; category: Category; label: string }> = [
    { words: ["dining", "food", "eat", "lunch", "dinner", "breakfast", "drink"], category: "dining", label: "Dining" },
    { words: ["grocery", "groceries", "supermarket"], category: "groceries", label: "Grocery Store" },
    { words: ["gas", "fuel"], category: "gas", label: "Gas Station" },
    { words: ["travel", "transit", "ride", "transport"], category: "travel", label: "Travel / Transit" },
    { words: ["flight", "fly", "plane", "airport"], category: "flight", label: "Flight" },
    { words: ["hotel", "stay", "lodging"], category: "hotel", label: "Hotel" },
    { words: ["streaming", "subscription"], category: "streaming", label: "Streaming" },
    { words: ["pharmacy", "drugstore", "drug store"], category: "drugstore", label: "Drugstore" },
    { words: ["rental car", "car rental"], category: "rental_car", label: "Rental Car" },
    { words: ["marriott", "bonvoy"], category: "marriott", label: "Marriott Hotel" },
  ];

  for (const entry of categoryKeywords) {
    for (const word of entry.words) {
      if (normalized.includes(word)) {
        return { category: entry.category, label: entry.label };
      }
    }
  }

  return null;
}

export function getCategoryLabel(category: Category): string {
  const labels: Record<Category, string> = {
    dining: "Dining",
    groceries: "Groceries",
    online_grocery: "Online Grocery",
    streaming: "Streaming",
    drugstore: "Drugstore",
    travel: "Travel / Transit",
    gas: "Gas",
    marriott: "Marriott Hotel",
    hotel: "Hotel",
    rental_car: "Rental Car",
    flight: "Flight",
    other: "Other",
  };
  return labels[category] ?? "Other";
}
