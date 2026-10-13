import { RIVER_GREEN_LOCATION } from './colonyLocation.js';

export const PLACE_CATEGORIES = Object.freeze({
  healthcare: { label: 'Healthcare', colour: '#b52f46' },
  education: { label: 'Education', colour: '#245fba' },
  police: { label: 'Police', colour: '#6741af' },
  civic: { label: 'Civic services', colour: '#995014' },
  transport: { label: 'Roads & transport', colour: '#087387' },
  community: { label: 'Community', colour: '#247344' },
  shopping: { label: 'Shopping', colour: '#a32d78' },
  sports: { label: 'Sports', colour: '#b74321' },
});

// Coordinates supplied by the project owner. Keep even the nearly coincident
// Cricket Academy and Government hospital as separate, precisely anchored POIs.
export const NEARBY_PLACES = Object.freeze([
  { id: 'ma-godavari-hospital', name: 'Ma Godavari Hospital', lat: 29.4662096, lng: 77.2979776, category: 'healthcare' },
  { id: 'cricket-academy', name: 'Cricket Academy', lat: 29.4550497, lng: 77.2786973, category: 'sports' },
  { id: 'government-hospital', name: 'Government hospital', lat: 29.4550493, lng: 77.2786973, category: 'healthcare' },
  { id: 'sent-rc-school', name: 'Sent RC School', lat: 29.4656382, lng: 77.3052775, category: 'education' },
  { id: 'aadarsh-mandi-thana', name: 'Aadarsh Mandi Thana', lat: 29.4698034, lng: 77.3103307, category: 'police' },
  { id: 'ring-road-shamli', name: 'Ring Road Shamli', lat: 29.469778, lng: 77.230504, category: 'transport' },
  { id: 'rto-office', name: 'R T O office', lat: 29.4901337, lng: 77.3138353, category: 'transport' },
  { id: 'navoday-vidyalay', name: 'Navoday Vidyalay', lat: 29.4956792, lng: 77.310491, category: 'education' },
  { id: 'police-chauki', name: 'Police chauki', lat: 29.4681883, lng: 77.2987542, category: 'police' },
  { id: 'defence-garden-phase-2', name: 'Defence Garden Phase 2', lat: 29.4755011, lng: 77.3057535, category: 'community' },
  { id: 'vv-degree-college', name: 'V. V Degree College Shamli', lat: 29.4467274, lng: 77.2695495, category: 'education' },
  { id: 'new-mandi', name: 'New Mandi', lat: 29.4622475, lng: 77.3097123, category: 'shopping' },
  { id: 'district-court', name: 'District court', lat: 29.4858465, lng: 77.2957941, category: 'civic' },
  { id: 'vikas-bhavan', name: 'Vikas Bhavan', lat: 29.4739867, lng: 77.290977, category: 'civic' },
  { id: 'sdm-aawas', name: 'SDM Aawas', lat: 29.483904, lng: 77.2898718, category: 'civic' },
  { id: 'police-line', name: 'Police line', lat: 29.4877117, lng: 77.3094951, category: 'police' },
  { id: 'helipad-sp-office', name: 'Helipad sp office', lat: 29.4934606, lng: 77.3131952, category: 'police' },
  { id: 'petrol-pump', name: 'Petrol pump', lat: 29.4605438, lng: 77.310779, category: 'transport' },
  { id: 'reliance-smart-point', name: 'Reliance smart point', lat: 29.4642671, lng: 77.3086767, category: 'shopping' },
  { id: 'kisan-degree-college', name: 'Kisan Degree College', lat: 29.451908, lng: 77.2941616, category: 'education' },
].map((place, index) => Object.freeze({ ...place, number: index + 1,
  // Fixed heights stagger the heads of the two colocated structures.
  heightMetres: place.id === 'cricket-academy' ? 112 : place.id === 'government-hospital' ? 62 : [66, 74, 82, 90][index % 4],
})));

export function nearbyPlacesBounds() {
  const points = [...NEARBY_PLACES, RIVER_GREEN_LOCATION];
  return [
    [Math.min(...points.map(p => p.lng)), Math.min(...points.map(p => p.lat))],
    [Math.max(...points.map(p => p.lng)), Math.max(...points.map(p => p.lat))],
  ];
}
