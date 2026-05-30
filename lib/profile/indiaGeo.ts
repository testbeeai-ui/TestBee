/**
 * Indian states/UTs and city lists for dependent dropdowns.
 * City lists are representative; expand as needed.
 */

export const INDIAN_STATES_AND_UTS: string[] = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
].sort((a, b) => a.localeCompare(b));

const CITY_BY_STATE: Record<string, string[]> = {
  Haryana: [
    "Ambala",
    "Faridabad",
    "Gurugram",
    "Hisar",
    "Karnal",
    "Panipat",
    "Rohtak",
    "Sonipat",
    "Yamunanagar",
  ],
  Karnataka: [
    "Bengaluru",
    "Hubballi",
    "Mysuru",
    "Mangaluru",
    "Belagavi",
    "Kalaburagi",
    "Davangere",
    "Tumakuru",
  ],
  Maharashtra: ["Mumbai", "Pune", "Nagpur", "Thane", "Nashik", "Aurangabad", "Solapur", "Kolhapur"],
  "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", "Tirunelveli"],
  "Andhra Pradesh": ["Visakhapatnam", "Vijayawada", "Guntur", "Nellore", "Tirupati", "Kurnool"],
  Telangana: ["Hyderabad", "Warangal", "Nizamabad", "Karimnagar", "Khammam"],
  Kerala: ["Thiruvananthapuram", "Kochi", "Kozhikode", "Thrissur", "Kollam"],
  Delhi: ["New Delhi", "Central Delhi", "North Delhi", "South Delhi", "East Delhi", "West Delhi"],
  Gujarat: ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar", "Jamnagar"],
  Rajasthan: ["Jaipur", "Jodhpur", "Udaipur", "Kota", "Bikaner", "Ajmer"],
  "Uttar Pradesh": ["Lucknow", "Kanpur", "Varanasi", "Agra", "Noida", "Ghaziabad", "Prayagraj"],
  "Madhya Pradesh": ["Bhopal", "Indore", "Gwalior", "Jabalpur", "Ujjain"],
  "West Bengal": ["Kolkata", "Howrah", "Durgapur", "Asansol", "Siliguri"],
  Punjab: ["Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda"],
  Bihar: ["Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Darbhanga"],
  Odisha: ["Bhubaneswar", "Cuttack", "Rourkela", "Berhampur", "Sambalpur"],
  Assam: ["Guwahati", "Silchar", "Dibrugarh", "Jorhat", "Nagaon"],
  Jharkhand: ["Ranchi", "Jamshedpur", "Dhanbad", "Bokaro", "Deoghar"],
  Chhattisgarh: ["Raipur", "Bhilai", "Bilaspur", "Korba", "Durg"],
  Goa: ["Panaji", "Margao", "Vasco da Gama", "Mapusa"],
  "Himachal Pradesh": ["Shimla", "Dharamshala", "Mandi", "Solan"],
  Uttarakhand: ["Dehradun", "Haridwar", "Roorkee", "Haldwani", "Rudrapur"],
  "Arunachal Pradesh": ["Itanagar", "Naharlagun", "Pasighat"],
  Manipur: ["Imphal", "Thoubal", "Bishnupur"],
  Meghalaya: ["Shillong", "Tura", "Jowai"],
  Mizoram: ["Aizawl", "Lunglei"],
  Nagaland: ["Kohima", "Dimapur", "Mokokchung"],
  Sikkim: ["Gangtok", "Namchi", "Mangan"],
  Tripura: ["Agartala", "Udaipur", "Dharmanagar"],
  "Jammu and Kashmir": ["Srinagar", "Jammu", "Anantnag", "Baramulla"],
  Ladakh: ["Leh", "Kargil"],
  Puducherry: ["Puducherry", "Karaikal", "Mahe", "Yanam"],
  Chandigarh: ["Chandigarh"],
  Lakshadweep: ["Kavaratti"],
  "Andaman and Nicobar Islands": ["Port Blair"],
  "Dadra and Nagar Haveli and Daman and Diu": ["Daman", "Silvassa", "Diu"],
};

export function getCitiesForState(state: string | null | undefined): string[] {
  if (!state) return [];
  const list = CITY_BY_STATE[state];
  if (!list) {
    return ["Other"];
  }
  return [...list].sort((a, b) => a.localeCompare(b));
}

export function toStateSelectItems(): { label: string; value: string }[] {
  return [
    { label: "Select state", value: "" },
    ...INDIAN_STATES_AND_UTS.map((s) => ({ label: s, value: s })),
  ];
}

export function toCitySelectItems(cities: string[]): { label: string; value: string }[] {
  return [
    { label: "Select city / town", value: "" },
    ...cities.map((c) => ({ label: c, value: c })),
  ];
}
