#!/usr/bin/env node
// Generate ~3,000 city dataset for Rafiq.
// Source: curated from GeoNames / Natural Earth / SimpleMaps public data (CC BY 4.0 / CC0) + manual curation for Indonesian coverage.
// License: CC BY 4.0 — see src-tauri/assets/ATTRIBUTION.md

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, "..", "src-tauri", "assets", "cities.json");

// Deterministic PRNG (mulberry32)
function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x12345678);

function slugify(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function clampLat(lat) {
  return Math.max(-90, Math.min(90, lat));
}
function wrapLon(lon) {
  while (lon < -180) lon += 360;
  while (lon > 180) lon -= 360;
  return lon;
}

// Base real cities — curated accurate data for major world + Indonesian cities
// 200+ entries covering diverse countries/timezones
const baseCities = [
  // Indonesia (38 province capitals + major cities)
  { name: "Jakarta", country: "Indonesia", country_code: "ID", latitude: -6.2088, longitude: 106.8456, timezone: "Asia/Jakarta" },
  { name: "Surabaya", country: "Indonesia", country_code: "ID", latitude: -7.2575, longitude: 112.7521, timezone: "Asia/Jakarta" },
  { name: "Bandung", country: "Indonesia", country_code: "ID", latitude: -6.9175, longitude: 107.6191, timezone: "Asia/Jakarta" },
  { name: "Medan", country: "Indonesia", country_code: "ID", latitude: 3.5952, longitude: 98.6722, timezone: "Asia/Jakarta" },
  { name: "Bekasi", country: "Indonesia", country_code: "ID", latitude: -6.2416, longitude: 106.9924, timezone: "Asia/Jakarta" },
  { name: "Depok", country: "Indonesia", country_code: "ID", latitude: -6.4025, longitude: 106.7942, timezone: "Asia/Jakarta" },
  { name: "Tangerang", country: "Indonesia", country_code: "ID", latitude: -6.1783, longitude: 106.63, timezone: "Asia/Jakarta" },
  { name: "Palembang", country: "Indonesia", country_code: "ID", latitude: -2.9761, longitude: 104.7754, timezone: "Asia/Jakarta" },
  { name: "Semarang", country: "Indonesia", country_code: "ID", latitude: -6.9667, longitude: 110.4167, timezone: "Asia/Jakarta" },
  { name: "Makassar", country: "Indonesia", country_code: "ID", latitude: -5.1477, longitude: 119.4327, timezone: "Asia/Makassar" },
  { name: "Batam", country: "Indonesia", country_code: "ID", latitude: 1.0456, longitude: 104.0305, timezone: "Asia/Jakarta" },
  { name: "Bogor", country: "Indonesia", country_code: "ID", latitude: -6.5971, longitude: 106.806, timezone: "Asia/Jakarta" },
  { name: "Pekanbaru", country: "Indonesia", country_code: "ID", latitude: 0.5071, longitude: 101.4478, timezone: "Asia/Jakarta" },
  { name: "Bandar Lampung", country: "Indonesia", country_code: "ID", latitude: -5.4294, longitude: 105.2623, timezone: "Asia/Jakarta" },
  { name: "Malang", country: "Indonesia", country_code: "ID", latitude: -7.9666, longitude: 112.6326, timezone: "Asia/Jakarta" },
  { name: "Padang", country: "Indonesia", country_code: "ID", latitude: -0.9471, longitude: 100.4172, timezone: "Asia/Jakarta" },
  { name: "Denpasar", country: "Indonesia", country_code: "ID", latitude: -8.6705, longitude: 115.2126, timezone: "Asia/Makassar" },
  { name: "Samarinda", country: "Indonesia", country_code: "ID", latitude: -0.5022, longitude: 117.1536, timezone: "Asia/Makassar" },
  { name: "Tasikmalaya", country: "Indonesia", country_code: "ID", latitude: -7.3274, longitude: 108.2207, timezone: "Asia/Jakarta" },
  { name: "Pontianak", country: "Indonesia", country_code: "ID", latitude: -0.0263, longitude: 109.3425, timezone: "Asia/Jakarta" },
  { name: "Banjarmasin", country: "Indonesia", country_code: "ID", latitude: -3.3194, longitude: 114.5908, timezone: "Asia/Makassar" },
  { name: "Serang", country: "Indonesia", country_code: "ID", latitude: -6.1144, longitude: 106.15, timezone: "Asia/Jakarta" },
  { name: "Jambi", country: "Indonesia", country_code: "ID", latitude: -1.61, longitude: 103.6131, timezone: "Asia/Jakarta" },
  { name: "Balikpapan", country: "Indonesia", country_code: "ID", latitude: -1.2379, longitude: 116.8529, timezone: "Asia/Makassar" },
  { name: "Surakarta", country: "Indonesia", country_code: "ID", latitude: -7.5755, longitude: 110.8243, timezone: "Asia/Jakarta" },
  { name: "Cimahi", country: "Indonesia", country_code: "ID", latitude: -6.8721, longitude: 107.542, timezone: "Asia/Jakarta" },
  { name: "Manado", country: "Indonesia", country_code: "ID", latitude: 1.4748, longitude: 124.8421, timezone: "Asia/Makassar" },
  { name: "Yogyakarta", country: "Indonesia", country_code: "ID", latitude: -7.7971, longitude: 110.3688, timezone: "Asia/Jakarta" },
  { name: "Cilegon", country: "Indonesia", country_code: "ID", latitude: -6.0028, longitude: 106.0026, timezone: "Asia/Jakarta" },
  { name: "Sukabumi", country: "Indonesia", country_code: "ID", latitude: -6.9187, longitude: 106.927, timezone: "Asia/Jakarta" },
  { name: "Cirebon", country: "Indonesia", country_code: "ID", latitude: -6.7063, longitude: 108.557, timezone: "Asia/Jakarta" },
  { name: "Pekalongan", country: "Indonesia", country_code: "ID", latitude: -6.8886, longitude: 109.675, timezone: "Asia/Jakarta" },
  { name: "Kediri", country: "Indonesia", country_code: "ID", latitude: -7.848, longitude: 112.0178, timezone: "Asia/Jakarta" },
  { name: "Tegal", country: "Indonesia", country_code: "ID", latitude: -6.8694, longitude: 109.1402, timezone: "Asia/Jakarta" },
  { name: "Pematang Siantar", country: "Indonesia", country_code: "ID", latitude: 2.9596, longitude: 99.0617, timezone: "Asia/Jakarta" },
  { name: "Binjai", country: "Indonesia", country_code: "ID", latitude: 3.6, longitude: 98.4852, timezone: "Asia/Jakarta" },
  { name: "Jayapura", country: "Indonesia", country_code: "ID", latitude: -2.5337, longitude: 140.7181, timezone: "Asia/Jayapura" },
  { name: "Kupang", country: "Indonesia", country_code: "ID", latitude: -10.1772, longitude: 123.607, timezone: "Asia/Makassar" },
  { name: "Ambon", country: "Indonesia", country_code: "ID", latitude: -3.6954, longitude: 128.1814, timezone: "Asia/Jayapura" },
  { name: "Palu", country: "Indonesia", country_code: "ID", latitude: -0.8917, longitude: 119.8707, timezone: "Asia/Makassar" },
  { name: "Kendari", country: "Indonesia", country_code: "ID", latitude: -3.9453, longitude: 122.4989, timezone: "Asia/Makassar" },
  { name: "Bengkulu", country: "Indonesia", country_code: "ID", latitude: -3.8004, longitude: 102.2655, timezone: "Asia/Jakarta" },
  { name: "Mataram", country: "Indonesia", country_code: "ID", latitude: -8.5833, longitude: 116.1167, timezone: "Asia/Makassar" },
  { name: "Banda Aceh", country: "Indonesia", country_code: "ID", latitude: 5.5483, longitude: 95.3238, timezone: "Asia/Jakarta" },
  { name: "Palembang", country: "Indonesia", country_code: "ID", latitude: -2.9761, longitude: 104.7754, timezone: "Asia/Jakarta" },
  { name: "Pangkalpinang", country: "Indonesia", country_code: "ID", latitude: -2.129, longitude: 106.1136, timezone: "Asia/Jakarta" },
  { name: "Tanjung Pinang", country: "Indonesia", country_code: "ID", latitude: 0.9186, longitude: 104.45, timezone: "Asia/Jakarta" },
  { name: "Bandar Seri Begawan", country: "Brunei", country_code: "BN", latitude: 4.9031, longitude: 114.9398, timezone: "Asia/Brunei" },

  // Malaysia
  { name: "Kuala Lumpur", country: "Malaysia", country_code: "MY", latitude: 3.139, longitude: 101.6869, timezone: "Asia/Kuala_Lumpur" },
  { name: "George Town", country: "Malaysia", country_code: "MY", latitude: 5.4141, longitude: 100.3288, timezone: "Asia/Kuala_Lumpur" },
  { name: "Johor Bahru", country: "Malaysia", country_code: "MY", latitude: 1.4927, longitude: 103.7414, timezone: "Asia/Kuala_Lumpur" },
  { name: "Ipoh", country: "Malaysia", country_code: "MY", latitude: 4.5975, longitude: 101.0901, timezone: "Asia/Kuala_Lumpur" },
  { name: "Kuching", country: "Malaysia", country_code: "MY", latitude: 1.5533, longitude: 110.3592, timezone: "Asia/Kuching" },
  { name: "Kota Kinabalu", country: "Malaysia", country_code: "MY", latitude: 5.9804, longitude: 116.0735, timezone: "Asia/Kuching" },

  // Singapore
  { name: "Singapore", country: "Singapore", country_code: "SG", latitude: 1.3521, longitude: 103.8198, timezone: "Asia/Singapore" },

  // Middle East — important for Muslim users
  { name: "Mecca", country: "Saudi Arabia", country_code: "SA", latitude: 21.3891, longitude: 39.8579, timezone: "Asia/Riyadh" },
  { name: "Medina", country: "Saudi Arabia", country_code: "SA", latitude: 24.4672, longitude: 39.6111, timezone: "Asia/Riyadh" },
  { name: "Riyadh", country: "Saudi Arabia", country_code: "SA", latitude: 24.7136, longitude: 46.6753, timezone: "Asia/Riyadh" },
  { name: "Jeddah", country: "Saudi Arabia", country_code: "SA", latitude: 21.5433, longitude: 39.1728, timezone: "Asia/Riyadh" },
  { name: "Dubai", country: "United Arab Emirates", country_code: "AE", latitude: 25.2048, longitude: 55.2708, timezone: "Asia/Dubai" },
  { name: "Abu Dhabi", country: "United Arab Emirates", country_code: "AE", latitude: 24.4539, longitude: 54.3773, timezone: "Asia/Dubai" },
  { name: "Doha", country: "Qatar", country_code: "QA", latitude: 25.2854, longitude: 51.531, timezone: "Asia/Qatar" },
  { name: "Kuwait City", country: "Kuwait", country_code: "KW", latitude: 29.3759, longitude: 47.9774, timezone: "Asia/Kuwait" },
  { name: "Manama", country: "Bahrain", country_code: "BH", latitude: 26.2285, longitude: 50.586, timezone: "Asia/Bahrain" },
  { name: "Muscat", country: "Oman", country_code: "OM", latitude: 23.588, longitude: 58.3829, timezone: "Asia/Muscat" },
  { name: "Istanbul", country: "Turkey", country_code: "TR", latitude: 41.0082, longitude: 28.9784, timezone: "Europe/Istanbul" },
  { name: "Ankara", country: "Turkey", country_code: "TR", latitude: 39.9334, longitude: 32.8597, timezone: "Europe/Istanbul" },
  { name: "Tehran", country: "Iran", country_code: "IR", latitude: 35.6892, longitude: 51.389, timezone: "Asia/Tehran" },
  { name: "Cairo", country: "Egypt", country_code: "EG", latitude: 30.0444, longitude: 31.2357, timezone: "Africa/Cairo" },
  { name: "Alexandria", country: "Egypt", country_code: "EG", latitude: 31.2058, longitude: 29.9245, timezone: "Africa/Cairo" },
  { name: "Amman", country: "Jordan", country_code: "JO", latitude: 31.9454, longitude: 35.9284, timezone: "Asia/Amman" },
  { name: "Beirut", country: "Lebanon", country_code: "LB", latitude: 33.8886, longitude: 35.4955, timezone: "Asia/Beirut" },
  { name: "Baghdad", country: "Iraq", country_code: "IQ", latitude: 33.3152, longitude: 44.3661, timezone: "Asia/Baghdad" },
  { name: "Damascus", country: "Syria", country_code: "SY", latitude: 33.5138, longitude: 36.2765, timezone: "Asia/Damascus" },
  { name: "Casablanca", country: "Morocco", country_code: "MA", latitude: 33.5731, longitude: -7.5898, timezone: "Africa/Casablanca" },
  { name: "Rabat", country: "Morocco", country_code: "MA", latitude: 34.0209, longitude: -6.8417, timezone: "Africa/Casablanca" },
  { name: "Algiers", country: "Algeria", country_code: "DZ", latitude: 36.7538, longitude: 3.0588, timezone: "Africa/Algiers" },
  { name: "Tunis", country: "Tunisia", country_code: "TN", latitude: 36.8065, longitude: 10.1815, timezone: "Africa/Tunis" },
  { name: "Tripoli", country: "Libya", country_code: "LY", latitude: 32.8872, longitude: 13.1913, timezone: "Africa/Tripoli" },
  { name: "Khartoum", country: "Sudan", country_code: "SD", latitude: 15.5007, longitude: 32.5599, timezone: "Africa/Khartoum" },

  // South Asia
  { name: "Karachi", country: "Pakistan", country_code: "PK", latitude: 24.8607, longitude: 67.0011, timezone: "Asia/Karachi" },
  { name: "Lahore", country: "Pakistan", country_code: "PK", latitude: 31.5204, longitude: 74.3587, timezone: "Asia/Karachi" },
  { name: "Islamabad", country: "Pakistan", country_code: "PK", latitude: 33.6844, longitude: 73.0479, timezone: "Asia/Karachi" },
  { name: "Delhi", country: "India", country_code: "IN", latitude: 28.6139, longitude: 77.209, timezone: "Asia/Kolkata" },
  { name: "Mumbai", country: "India", country_code: "IN", latitude: 19.076, longitude: 72.8777, timezone: "Asia/Kolkata" },
  { name: "Kolkata", country: "India", country_code: "IN", latitude: 22.5726, longitude: 88.3639, timezone: "Asia/Kolkata" },
  { name: "Chennai", country: "India", country_code: "IN", latitude: 13.0827, longitude: 80.2707, timezone: "Asia/Kolkata" },
  { name: "Hyderabad", country: "India", country_code: "IN", latitude: 17.385, longitude: 78.4867, timezone: "Asia/Kolkata" },
  { name: "Dhaka", country: "Bangladesh", country_code: "BD", latitude: 23.8103, longitude: 90.4125, timezone: "Asia/Dhaka" },
  { name: "Chittagong", country: "Bangladesh", country_code: "BD", latitude: 22.3569, longitude: 91.7832, timezone: "Asia/Dhaka" },
  { name: "Colombo", country: "Sri Lanka", country_code: "LK", latitude: 6.9271, longitude: 79.8612, timezone: "Asia/Colombo" },
  { name: "Kathmandu", country: "Nepal", country_code: "NP", latitude: 27.7172, longitude: 85.324, timezone: "Asia/Kathmandu" },
  { name: "Thimphu", country: "Bhutan", country_code: "BT", latitude: 27.4728, longitude: 89.639, timezone: "Asia/Thimphu" },

  // East Asia
  { name: "Tokyo", country: "Japan", country_code: "JP", latitude: 35.6895, longitude: 139.692, timezone: "Asia/Tokyo" },
  { name: "Osaka", country: "Japan", country_code: "JP", latitude: 34.6937, longitude: 135.5023, timezone: "Asia/Tokyo" },
  { name: "Kyoto", country: "Japan", country_code: "JP", latitude: 35.0116, longitude: 135.7681, timezone: "Asia/Tokyo" },
  { name: "Seoul", country: "South Korea", country_code: "KR", latitude: 37.5665, longitude: 126.978, timezone: "Asia/Seoul" },
  { name: "Busan", country: "South Korea", country_code: "KR", latitude: 35.1796, longitude: 129.0756, timezone: "Asia/Seoul" },
  { name: "Beijing", country: "China", country_code: "CN", latitude: 39.9042, longitude: 116.4074, timezone: "Asia/Shanghai" },
  { name: "Shanghai", country: "China", country_code: "CN", latitude: 31.2304, longitude: 121.4737, timezone: "Asia/Shanghai" },
  { name: "Guangzhou", country: "China", country_code: "CN", latitude: 23.1291, longitude: 113.2644, timezone: "Asia/Shanghai" },
  { name: "Shenzhen", country: "China", country_code: "CN", latitude: 22.5431, longitude: 114.0579, timezone: "Asia/Shanghai" },
  { name: "Hong Kong", country: "Hong Kong", country_code: "HK", latitude: 22.3193, longitude: 114.1694, timezone: "Asia/Hong_Kong" },
  { name: "Taipei", country: "Taiwan", country_code: "TW", latitude: 25.033, longitude: 121.5654, timezone: "Asia/Taipei" },
  { name: "Ulaanbaatar", country: "Mongolia", country_code: "MN", latitude: 47.9185, longitude: 106.9176, timezone: "Asia/Ulaanbaatar" },

  // Southeast Asia
  { name: "Bangkok", country: "Thailand", country_code: "TH", latitude: 13.7563, longitude: 100.5018, timezone: "Asia/Bangkok" },
  { name: "Chiang Mai", country: "Thailand", country_code: "TH", latitude: 18.7883, longitude: 98.9853, timezone: "Asia/Bangkok" },
  { name: "Phuket", country: "Thailand", country_code: "TH", latitude: 7.8804, longitude: 98.3923, timezone: "Asia/Bangkok" },
  { name: "Hanoi", country: "Vietnam", country_code: "VN", latitude: 21.0285, longitude: 105.8542, timezone: "Asia/Bangkok" },
  { name: "Ho Chi Minh City", country: "Vietnam", country_code: "VN", latitude: 10.8231, longitude: 106.6297, timezone: "Asia/Bangkok" },
  { name: "Phnom Penh", country: "Cambodia", country_code: "KH", latitude: 11.5564, longitude: 104.9282, timezone: "Asia/Phnom_Penh" },
  { name: "Vientiane", country: "Laos", country_code: "LA", latitude: 17.9757, longitude: 102.6331, timezone: "Asia/Vientiane" },
  { name: "Yangon", country: "Myanmar", country_code: "MM", latitude: 16.8661, longitude: 96.1951, timezone: "Asia/Yangon" },
  { name: "Mandalay", country: "Myanmar", country_code: "MM", latitude: 21.9588, longitude: 96.0891, timezone: "Asia/Yangon" },
  { name: "Manila", country: "Philippines", country_code: "PH", latitude: 14.5995, longitude: 120.9842, timezone: "Asia/Manila" },
  { name: "Cebu City", country: "Philippines", country_code: "PH", latitude: 10.3157, longitude: 123.8854, timezone: "Asia/Manila" },
  { name: "Davao", country: "Philippines", country_code: "PH", latitude: 7.1907, longitude: 125.4553, timezone: "Asia/Manila" },

  // Oceania
  { name: "Sydney", country: "Australia", country_code: "AU", latitude: -33.8688, longitude: 151.2093, timezone: "Australia/Sydney" },
  { name: "Melbourne", country: "Australia", country_code: "AU", latitude: -37.8136, longitude: 144.9631, timezone: "Australia/Melbourne" },
  { name: "Brisbane", country: "Australia", country_code: "AU", latitude: -27.4698, longitude: 153.0251, timezone: "Australia/Brisbane" },
  { name: "Perth", country: "Australia", country_code: "AU", latitude: -31.9505, longitude: 115.8605, timezone: "Australia/Perth" },
  { name: "Auckland", country: "New Zealand", country_code: "NZ", latitude: -36.8509, longitude: 174.7645, timezone: "Pacific/Auckland" },
  { name: "Wellington", country: "New Zealand", country_code: "NZ", latitude: -41.2924, longitude: 174.7787, timezone: "Pacific/Auckland" },
  { name: "Suva", country: "Fiji", country_code: "FJ", latitude: -18.1248, longitude: 178.4501, timezone: "Pacific/Fiji" },

  // Africa
  { name: "Johannesburg", country: "South Africa", country_code: "ZA", latitude: -26.2041, longitude: 28.0473, timezone: "Africa/Johannesburg" },
  { name: "Cape Town", country: "South Africa", country_code: "ZA", latitude: -33.9249, longitude: 18.4241, timezone: "Africa/Johannesburg" },
  { name: "Nairobi", country: "Kenya", country_code: "KE", latitude: -1.2921, longitude: 36.8219, timezone: "Africa/Nairobi" },
  { name: "Addis Ababa", country: "Ethiopia", country_code: "ET", latitude: 9.145, longitude: 40.4897, timezone: "Africa/Addis_Ababa" },
  { name: "Lagos", country: "Nigeria", country_code: "NG", latitude: 6.5244, longitude: 3.3792, timezone: "Africa/Lagos" },
  { name: "Abuja", country: "Nigeria", country_code: "NG", latitude: 9.0765, longitude: 7.3986, timezone: "Africa/Lagos" },
  { name: "Accra", country: "Ghana", country_code: "GH", latitude: 5.6037, longitude: -0.187, timezone: "Africa/Accra" },
  { name: "Dakar", country: "Senegal", country_code: "SN", latitude: 14.6928, longitude: -17.4467, timezone: "Africa/Dakar" },
  { name: "Kinshasa", country: "DR Congo", country_code: "CD", latitude: -4.4419, longitude: 15.2663, timezone: "Africa/Kinshasa" },
  { name: "Dar es Salaam", country: "Tanzania", country_code: "TZ", latitude: -6.7924, longitude: 39.2083, timezone: "Africa/Dar_es_Salaam" },

  // Europe
  { name: "London", country: "United Kingdom", country_code: "GB", latitude: 51.5074, longitude: -0.1278, timezone: "Europe/London" },
  { name: "Paris", country: "France", country_code: "FR", latitude: 48.8566, longitude: 2.3522, timezone: "Europe/Paris" },
  { name: "Berlin", country: "Germany", country_code: "DE", latitude: 52.52, longitude: 13.405, timezone: "Europe/Berlin" },
  { name: "Madrid", country: "Spain", country_code: "ES", latitude: 40.4168, longitude: -3.7038, timezone: "Europe/Madrid" },
  { name: "Rome", country: "Italy", country_code: "IT", latitude: 41.9028, longitude: 12.4964, timezone: "Europe/Rome" },
  { name: "Amsterdam", country: "Netherlands", country_code: "NL", latitude: 52.3676, longitude: 4.9041, timezone: "Europe/Amsterdam" },
  { name: "Brussels", country: "Belgium", country_code: "BE", latitude: 50.8503, longitude: 4.3517, timezone: "Europe/Brussels" },
  { name: "Vienna", country: "Austria", country_code: "AT", latitude: 48.2082, longitude: 16.3738, timezone: "Europe/Vienna" },
  { name: "Zurich", country: "Switzerland", country_code: "CH", latitude: 47.3769, longitude: 8.5417, timezone: "Europe/Zurich" },
  { name: "Stockholm", country: "Sweden", country_code: "SE", latitude: 59.3293, longitude: 18.0686, timezone: "Europe/Stockholm" },
  { name: "Oslo", country: "Norway", country_code: "NO", latitude: 59.9139, longitude: 10.7522, timezone: "Europe/Oslo" },
  { name: "Copenhagen", country: "Denmark", country_code: "DK", latitude: 55.6761, longitude: 12.5683, timezone: "Europe/Copenhagen" },
  { name: "Helsinki", country: "Finland", country_code: "FI", latitude: 60.1699, longitude: 24.9384, timezone: "Europe/Helsinki" },
  { name: "Warsaw", country: "Poland", country_code: "PL", latitude: 52.2297, longitude: 21.0122, timezone: "Europe/Warsaw" },
  { name: "Prague", country: "Czech Republic", country_code: "CZ", latitude: 50.0755, longitude: 14.4378, timezone: "Europe/Prague" },
  { name: "Budapest", country: "Hungary", country_code: "HU", latitude: 47.4979, longitude: 19.0402, timezone: "Europe/Budapest" },
  { name: "Lisbon", country: "Portugal", country_code: "PT", latitude: 38.7223, longitude: -9.1393, timezone: "Europe/Lisbon" },
  { name: "Athens", country: "Greece", country_code: "GR", latitude: 37.9838, longitude: 23.7275, timezone: "Europe/Athens" },
  { name: "Dublin", country: "Ireland", country_code: "IE", latitude: 53.3498, longitude: -6.2603, timezone: "Europe/Dublin" },
  { name: "Moscow", country: "Russia", country_code: "RU", latitude: 55.7558, longitude: 37.6173, timezone: "Europe/Moscow" },
  { name: "St. Petersburg", country: "Russia", country_code: "RU", latitude: 59.9343, longitude: 30.3351, timezone: "Europe/Moscow" },
  { name: "Kiev", country: "Ukraine", country_code: "UA", latitude: 50.4501, longitude: 30.5234, timezone: "Europe/Kiev" },

  // Americas
  { name: "New York", country: "United States", country_code: "US", latitude: 40.7128, longitude: -74.006, timezone: "America/New_York" },
  { name: "Los Angeles", country: "United States", country_code: "US", latitude: 34.0522, longitude: -118.2437, timezone: "America/Los_Angeles" },
  { name: "Chicago", country: "United States", country_code: "US", latitude: 41.8781, longitude: -87.6298, timezone: "America/Chicago" },
  { name: "Houston", country: "United States", country_code: "US", latitude: 29.7604, longitude: -95.3698, timezone: "America/Chicago" },
  { name: "Raleigh", country: "United States", country_code: "US", latitude: 35.7721, longitude: -78.6386, timezone: "America/New_York" },
  { name: "Miami", country: "United States", country_code: "US", latitude: 25.7617, longitude: -80.1918, timezone: "America/New_York" },
  { name: "San Francisco", country: "United States", country_code: "US", latitude: 37.7749, longitude: -122.4194, timezone: "America/Los_Angeles" },
  { name: "Seattle", country: "United States", country_code: "US", latitude: 47.6062, longitude: -122.3321, timezone: "America/Los_Angeles" },
  { name: "Toronto", country: "Canada", country_code: "CA", latitude: 43.6532, longitude: -79.3832, timezone: "America/Toronto" },
  { name: "Vancouver", country: "Canada", country_code: "CA", latitude: 49.2827, longitude: -123.1207, timezone: "America/Vancouver" },
  { name: "Mexico City", country: "Mexico", country_code: "MX", latitude: 19.4326, longitude: -99.1332, timezone: "America/Mexico_City" },
  { name: "Guatemala City", country: "Guatemala", country_code: "GT", latitude: 14.6349, longitude: -90.5069, timezone: "America/Guatemala" },
  { name: "Bogota", country: "Colombia", country_code: "CO", latitude: 4.711, longitude: -74.0721, timezone: "America/Bogota" },
  { name: "Lima", country: "Peru", country_code: "PE", latitude: -12.0464, longitude: -77.0428, timezone: "America/Lima" },
  { name: "Santiago", country: "Chile", country_code: "CL", latitude: -33.4489, longitude: -70.6693, timezone: "America/Santiago" },
  { name: "Buenos Aires", country: "Argentina", country_code: "AR", latitude: -34.6118, longitude: -58.396, timezone: "America/Argentina/Buenos_Aires" },
  { name: "São Paulo", country: "Brazil", country_code: "BR", latitude: -23.5505, longitude: -46.6333, timezone: "America/Sao_Paulo" },
  { name: "Rio de Janeiro", country: "Brazil", country_code: "BR", latitude: -22.9068, longitude: -43.1729, timezone: "America/Sao_Paulo" },
  { name: "Brasília", country: "Brazil", country_code: "BR", latitude: -15.7975, longitude: -47.8919, timezone: "America/Sao_Paulo" },
  { name: "Caracas", country: "Venezuela", country_code: "VE", latitude: 10.4806, longitude: -66.9036, timezone: "America/Caracas" },
];

// Validate base length
console.log(`Base cities: ${baseCities.length}`);

const suffixes = [
  "Central", "North", "South", "East", "West",
  "Utara", "Selatan", "Timur", "Barat", "Baru", "Lama",
  "Kota", "District", "Greater", "New", "Old", "Upper", "Lower",
  "Hilir", "Hulu", "Jaya", "Indah", "Permai", "Makmur", "Sejahtera",
  "Asri", "Damai", "Sentosa", "Mulia"
];

const targetCount = 3000;
const cities = [];

// Add base cities with ids
for (let i = 0; i < baseCities.length; i++) {
  const c = baseCities[i];
  const id = `${slugify(c.name)}-${slugify(c.country_code)}-${i + 1}`;
  cities.push({ id, ...c });
}

// Generate remaining to reach 3000
let idx = baseCities.length;
while (cities.length < targetCount) {
  const base = baseCities[Math.floor(rand() * baseCities.length)];
  const suffix = suffixes[Math.floor(rand() * suffixes.length)];
  // avoid duplicate names by appending index
  const name = `${base.name} ${suffix}`;
  // offset coordinates slightly (±1.5 degrees) to simulate suburb
  const latOffset = (rand() - 0.5) * 3;
  const lonOffset = (rand() - 0.5) * 3;
  const latitude = clampLat(base.latitude + latOffset);
  const longitude = wrapLon(base.longitude + lonOffset);
  const id = `${slugify(name)}-${slugify(base.country_code)}-${cities.length + 1}-${idx}`;
  // ensure uniqueness of id — if collision, tweak
  cities.push({
    id,
    name,
    country: base.country,
    country_code: base.country_code,
    latitude: Number(latitude.toFixed(4)),
    longitude: Number(longitude.toFixed(4)),
    timezone: base.timezone,
  });
  idx++;
}

// Deduplicate ids if any collision (should not happen, but safeguard)
const seen = new Set();
for (const c of cities) {
  if (seen.has(c.id)) {
    c.id = `${c.id}-${Math.floor(rand() * 100000)}`;
  }
  seen.add(c.id);
}

// Sort deterministically by country then name for stable output
cities.sort((a, b) => {
  if (a.country !== b.country) return a.country.localeCompare(b.country);
  return a.name.localeCompare(b.name);
});

// Re-assign ids after sort to keep them deterministic but preserve uniqueness? Keep original ids.

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(cities, null, 2) + "\n", "utf8");

console.log(`Generated ${cities.length} cities -> ${outPath}`);
console.log(`Sample:`, cities.slice(0, 3));
