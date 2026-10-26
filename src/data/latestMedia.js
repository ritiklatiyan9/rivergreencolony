// Latest supplied River Green footage with four user-requested landscape visualisations.
// Daylight stills illustrate finished surfaces and even grass plots; the night image
// and both videos retain the original site footage. Source records: /images/latest/provenance.json.
const image = (name) => `/images/latest/river-green-${name}.webp`;

export const riverGreenMedia = {
  hero: {
    src: '/images/latest/river-green-hero-v1.webp',
    portrait: '/images/latest/river-green-hero-portrait-v1.webp',
    alt: 'A cinematic view of River Green’s fountain plaza and palm-lined avenue in soft evening light. Enhanced landscape visualisation.',
  },
  film: '/videos/river-green-film.mp4',
  loop: '/videos/river-green-loop.mp4',
  poster: image('fountain'),
  og: '/images/latest/river-green-og.jpg',
  shots: [
    {
      src: image('gate'),
      title: 'The River Green welcome',
      subtitle: 'A closer look at the entrance',
      category: 'Entrance',
      alt: 'River Green lettering above the entrance gate, with the paved approach and landscaped grass beyond.',
    },
    {
      src: image('avenue'),
      title: 'An evening, a little slower',
      subtitle: 'Palms, paving and a warm evening sky',
      category: 'Streets',
      alt: 'The red-striped River Green avenue and stone fountain plaza framed by palms and ornamental lamps at sunset.',
    },
    {
      src: image('fountain'),
      title: 'At the heart of the neighbourhood',
      subtitle: 'The fountain plaza from above',
      category: 'Green spaces',
      alt: 'An aerial view of River Green’s circular stone fountain plaza, with palms, hedges, paved streets and grass plots.',
    },
    {
      src: image('aerial'),
      title: 'Room for your next chapter',
      subtitle: 'The wider River Green setting',
      category: 'Aerial views',
      alt: 'River Green Society from above, showing its entrance, planned streets, fountain roundabout and landscaped plots among surrounding fields.',
    },
    {
      src: image('night'),
      title: 'When the neighbourhood lights up',
      subtitle: 'An illuminated evening at River Green',
      category: 'Evenings',
      alt: 'River Green’s circular fountain plaza and surrounding palm-lined streets illuminated at night.',
    },
  ],
};
