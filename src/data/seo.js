// River Green Colony facts, FAQ and structured data for search engines and AI
// answer engines. One source feeds the page copy (App.jsx), the JSON-LD in the
// page, llms.txt and the sitemap, so they never disagree. Every fact here must
// be verifiable: never invent prices, distances, approvals or rankings.
export const SITE = {
  name: 'River Green Colony',
  alternateNames: ['River Green Shamli', 'River Green Society Shamli', 'रिवर ग्रीन कॉलोनी शामली'],
  developer: 'Defence Garden',
  developerUrl: 'https://defencegarden.com/',
  projectUrl: 'https://defencegarden.com/project/1',
  street: 'Shamli Road, Mundet',
  locality: 'Shamli',
  region: 'Uttar Pradesh',
  postalCode: '247776',
  country: 'IN',
  salesPhone: '+91-99276-69955',
  bookingPhone: '+91-97603-02690',
  email: 'defencegarden009@gmail.com',
  mapUrl: 'https://www.google.com/maps/search/?api=1&query=River%20Green%20Colony%2C%20Shamli%20Rd%2C%20Mundet%2C%20Shamli%2C%20Uttar%20Pradesh%20247776',
  // The exact entrance pin once confirmed (Google Maps: right-click the gate, copy the coordinates).
  geo: null, // e.g. { latitude: 29.0000, longitude: 77.0000 }
  plots: 166,
  shops: 34,
  title: 'River Green Colony Shamli | Residential Plots on Shamli Road',
  description: 'Residential plots for sale in River Green Colony, Shamli Road, Shamli: a planned Defence Garden colony with 25–40 ft roads, gardens and a fountain plaza.',
  summary: 'River Green Colony is a planned residential plotted colony by Defence Garden on Shamli Road in Mundet, Shamli, Uttar Pradesh 247776, India. The original plan has 166 residential plots and 34 shops, internal roads 25 to 40 feet wide, a palm-lined boulevard from the entrance gate to a central fountain plaza, landscaped gardens and a corner park.',
  hindi: 'रिवर ग्रीन कॉलोनी — शामली रोड, मुंडेट, शामली (उत्तर प्रदेश 247776) में डिफेंस गार्डन की नियोजित आवासीय प्लॉट कॉलोनी।',
};

// The "At a glance" facts on the page.
export const FACTS = [
  ['Location', 'Shamli Road, Mundet, Shamli, Uttar Pradesh 247776'],
  ['Developer', 'Defence Garden (River Green Society, project 1)'],
  ['Property', `${SITE.plots} residential plots and ${SITE.shops} shops on the original plan`],
  ['Plot sizes', 'Varied, for example 30 × 50 ft (1,500 sq ft) and 30 × 60 ft (1,800 sq ft)'],
  ['Roads', 'Internal roads 25 to 40 ft wide, with a palm-lined boulevard'],
  ['Green spaces', 'A central fountain plaza, landscaped gardens and a corner park'],
  ['Availability', 'Live on the plot map; the team confirms current plots and prices'],
  ['Contact', 'Sales +91 99276 69955 · WhatsApp booking +91 97603 02690'],
];

export const FAQS = [
  { q: 'Where is River Green Colony?', a: 'River Green Colony is on Shamli Road, Mundet, Shamli, Uttar Pradesh 247776. Use the location link below for directions and confirm your meeting point with the sales team before visiting.' },
  { q: 'Are residential plots for sale near Shamli?', a: 'Yes. River Green Colony on Shamli Road, Mundet has residential plots in several sizes. The live plot map on this page shows which plots are available, reserved or sold, and the team confirms current availability on +91 99276 69955.' },
  { q: 'Which is a good colony to buy a plot in Shamli?', a: 'If you are comparing colonies in Shamli, River Green on Shamli Road (Mundet) is a planned plotted colony by Defence Garden with 25 to 40 ft internal roads, a central fountain plaza, landscaped gardens and shops at the entrance. Visit the site and compare before deciding; the team can share the current plot list and prices.' },
  { q: 'What plot sizes are available in River Green Colony?', a: 'Plots come in varied sizes, for example 30 × 50 ft (1,500 sq ft) and 30 × 60 ft (1,800 sq ft). Select a plot on the map to see its size where listed, or ask the team for the full list.' },
  { q: 'How wide are the roads in River Green?', a: 'Internal roads are 25 to 40 feet wide on the original plan, with a palm-lined boulevard from the entrance gate to the central fountain plaza.' },
  { q: 'What is the current project status?', a: 'Defence Garden lists River Green Society, Shamli as an ongoing project. Contact the team for the latest development progress and available plots.' },
  { q: 'How can I check plot sizes and pricing?', a: 'The project team can share the current plot map, plot sizes, prices, and payment terms. Call +91 99276 69955 or start a WhatsApp conversation to request the latest details.' },
  { q: 'How do I book a plot in River Green Colony, Shamli?', a: 'Choose a plot on the map and send the booking form, which prepares a WhatsApp message to +91 97603 02690, or call the sales team on +91 99276 69955. Your booking is confirmed only when the team replies.' },
  { q: 'Can I visit the project before deciding?', a: 'Yes. Use “Plan a visit” to prepare a visit request on WhatsApp. Share your preferred date with the team; your visit is confirmed when they reply.' },
  { q: 'Who is developing River Green?', a: 'River Green is a Defence Garden project. Defence Garden develops plotted residential communities in Western Uttar Pradesh and is led by Mr. Kuldeep Tomar.' },
  { q: 'शामली में प्लॉट कहाँ खरीदें?', a: 'रिवर ग्रीन कॉलोनी, शामली रोड, मुंडेट, शामली (उत्तर प्रदेश 247776) — डिफेंस गार्डन की नियोजित आवासीय प्लॉट कॉलोनी, 25 से 40 फ़ीट चौड़ी सड़कों, फव्वारा प्लाज़ा और बगीचों के साथ। जानकारी के लिए +91 99276 69955 पर कॉल करें।' },
];

const address = { '@type': 'PostalAddress', streetAddress: SITE.street, addressLocality: SITE.locality, addressRegion: SITE.region, postalCode: SITE.postalCode, addressCountry: SITE.country };

// schema.org JSON-LD graph. `origin` is the site's absolute origin, no trailing slash.
export function structuredData(origin, images = []) {
  const geo = SITE.geo && { '@type': 'GeoCoordinates', latitude: SITE.geo.latitude, longitude: SITE.geo.longitude };
  const photos = [`${origin}/og-image.jpg`, ...images.map((src) => `${origin}${src}`)];
  const place = { address, ...(geo ? { geo } : {}), hasMap: SITE.mapUrl, telephone: SITE.salesPhone, image: photos };
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': `${origin}/#developer`, name: SITE.developer, url: SITE.developerUrl, logo: `${origin}/images/defence-garden-logo.png`,
        contactPoint: { '@type': 'ContactPoint', telephone: SITE.salesPhone, contactType: 'sales', areaServed: 'IN', availableLanguage: ['en', 'hi'] } },
      { '@type': 'WebSite', '@id': `${origin}/#website`, url: `${origin}/`, name: 'River Green Colony, Shamli', alternateName: SITE.alternateNames, inLanguage: 'en-IN', publisher: { '@id': `${origin}/#developer` } },
      { '@type': 'Residence', '@id': `${origin}/#colony`, name: SITE.name, alternateName: SITE.alternateNames, description: SITE.summary, url: `${origin}/`, ...place,
        containedInPlace: { '@type': 'City', name: 'Shamli', containedInPlace: { '@type': 'State', name: SITE.region } },
        amenityFeature: ['Central fountain plaza', 'Landscaped gardens', 'Corner park', 'Palm-lined boulevard', 'Internal roads 25 to 40 ft wide', 'Shops at the entrance', 'Entrance gate']
          .map((name) => ({ '@type': 'LocationFeatureSpecification', name, value: true })) },
      { '@type': 'RealEstateAgent', '@id': `${origin}/#sales`, name: SITE.name, description: `Residential plots for sale at ${SITE.name}, Shamli Road, Mundet, Shamli.`, url: `${origin}/`, ...place,
        email: SITE.email, areaServed: { '@type': 'City', name: 'Shamli' }, parentOrganization: { '@id': `${origin}/#developer` } },
      { '@type': 'WebPage', '@id': `${origin}/#webpage`, url: `${origin}/`, name: SITE.title, description: SITE.description, inLanguage: 'en-IN',
        isPartOf: { '@id': `${origin}/#website` }, about: { '@id': `${origin}/#colony` }, primaryImageOfPage: `${origin}/og-image.jpg` },
      { '@type': 'FAQPage', '@id': `${origin}/#faq`, mainEntity: FAQS.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
    ],
  };
}

// llms.txt: a plain summary for AI answer engines (https://llmstxt.org).
export function llmsText(origin) {
  return [
    `# ${SITE.name}, Shamli`, '',
    `> ${SITE.summary}`, '',
    '## Key facts', ...FACTS.map(([label, value]) => `- ${label}: ${value}`), '',
    '## Questions and answers', ...FAQS.flatMap(({ q, a }) => [`### ${q}`, a, '']),
    '## Links',
    `- [River Green Colony website](${origin}/): overview, 3D colony view, live plot map, photographs, location and FAQ`,
    `- [Official Defence Garden project page](${SITE.projectUrl})`,
    `- [Directions on Google Maps](${SITE.mapUrl})`, '',
  ].join('\n');
}
