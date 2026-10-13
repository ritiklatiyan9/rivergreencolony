import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowDown, ArrowUpRight, ArrowRight, ChevronLeft, ChevronRight, Plus, Minus, X, Menu, MapPin, Phone, Play, Pause, Leaf, Trees, Route, House, Maximize2, Mail, Compass, Check } from 'lucide-react';
import useSiteMotion from './hooks/useSiteMotion';
import gallery from './data/gallery';
import { FACTS, FAQS, SITE, structuredData } from './data/seo';
import { imageProps } from './data/imageProps';
import { GOOGLE_MAPS_URL, GOOGLE_MAPS_EMBED_URL } from './data/colonyLocation';

const loadCommunityScene = () => import('./components/CommunityScene');
const CommunityScene = lazy(loadCommunityScene);
const PlotManager = lazy(() => import('./components/PlotManager'));
const SALES_PHONE = '+919521018879';
const BOOKING_PHONE = '+91 97603 02690';
const PLOT_ENQUIRY_URL = `https://wa.me/${BOOKING_PHONE.replace(/\D/g, '')}?text=${encodeURIComponent('Hello Defence Garden, please share the latest plot sizes, availability and pricing for River Green Colony, Shamli.')}`;
const MAP_URL = GOOGLE_MAPS_URL;
const features = [
  { title: 'A landmark fountain plaza', text: 'A landscaped fountain plaza brings a distinctive centre to the community. A place to pause, take a walk, and enjoy the surroundings.', image: '/images/fountain-evening/fountain-families.webp', alt: 'Families sitting together on benches around River Green’s illuminated stone fountain at dusk. AI visualisation.', caption: 'EVENINGS AT RIVER GREEN · AI VISUALISATION', icon: Trees },
  { title: 'Room for everyday journeys', text: 'Wide internal roads and planted avenues shape the arrival experience, connecting the entrance with the spaces within the colony.', image: '/images/hd/rivergreen-02.webp', icon: Route },
  { title: 'A plot. Your possibilities.', text: 'Explore residential plots with the Defence Garden team and find a space that suits your plans. Ask for the current plot map, sizes, and availability.', image: '/images/hd/rivergreen-01.webp', icon: House },
];
const sceneChapters = [
  { key: 'booking', label: 'Choose a plot', icon: MapPin, title: 'Your next chapter starts with a plot.', text: 'Click a numbered plot to see its size, availability and booking options. Explore the layout and find the space for your plans.' },
  { key: 'nature', label: 'Full plan', icon: Leaf, title: 'Every plot. A clearer perspective.', text: 'Explore the original colony layout in 3D, with its plot boundaries, internal roads and central fountain plaza.' },
  { key: 'plan', label: 'Plan view', icon: Leaf, title: 'Every plot, from above.', text: 'A top-down view of all 200 plots and shops, coloured by live availability, with the internal roads and the fountain plaza.' },
  { key: 'community', label: 'Neighbourhood', icon: House, title: 'At the heart of River Green.', text: 'Explore the landscaped plaza around the interior fountain, with shaded garden pockets and open connections to the surrounding streets.' },
  { key: 'connection', label: 'Entrance', icon: Route, title: 'A welcome you can recognise.', text: 'The white entrance portal, low-rise shop wings and planted avenue take their character from actual photographs of the colony.' },
  { key: 'nearby', label: 'Nearby places', icon: MapPin, title: 'Your connections around Shamli.', text: 'Find schools, hospitals, shopping and transport around River Green. Choose a place to explore its location.' },
];
// FAQ copy lives in src/data/seo.js with the structured data built from it.
const questions = FAQS;
const visitSteps = [
  { title: 'Explore the layout.', text: 'See the plot boundaries, internal roads and central fountain plaza. Select a plot in the colony view to inspect its listed details.', link: 'Explore the colony', target: '#experience' },
  { title: 'Talk to the team.', text: 'Ask for current plot sizes, prices and payment terms. The Defence Garden team confirms availability and answers your questions.', link: 'View project details', target: '#at-a-glance' },
  { title: 'Walk the colony.', text: 'Prepare a visit request with your preferred date. The team replies with your visit time and meeting point, so you can see River Green in person.', link: 'Plan your visit' },
  { title: 'Decide with clarity.', text: 'Review the project documents, payment terms and current plot details with the team before making your decision.', link: 'Talk to the team', target: `tel:${SALES_PHONE}` },
];

function Brand({ footer = false }) {
  return <a className={`brand ${footer ? 'brand-footer' : ''}`} href="#home" aria-label="River Green home">
    <span className="brand-wordmark"><img src="/branding/river-green-wordmark.png" alt="River Green — original entrance gate lettering" width="2172" height="724" /></span>
    <small>BY DEFENCE GARDEN</small>
  </a>;
}
function Eyebrow({ children, light = false, className = '' }) { return <div className={`eyebrow ${light ? 'eyebrow-light' : ''} ${className}`}><span />{children}</div>; }
function RoundArrow({ children, className = '', ...props }) { return <button className={`round-arrow ${className}`} {...props}>{children || <ArrowUpRight size={20} />}</button>; }

function HeroMedia() {
  const ref = useRef(null);
  useEffect(() => {
    const element = ref.current;
    let visible = true;
    const sync = () => element?.classList.toggle('is-in-view', visible && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    if (element) observer.observe(element);
    document.addEventListener('visibilitychange', sync);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', sync); };
  }, []);
  return <div ref={ref} className="hero-image-wrap"><div className="hero-media">
    <div className="hero-depth-layer hero-layer-architecture" data-hero-depth="0.18"><picture><source media="(max-width: 600px)" srcSet="/images/editorial-hero/open-portrait-720.webp 720w, /images/editorial-hero/open-portrait-1080.webp 1080w, /images/editorial-hero/open-portrait-1440.webp 1440w" sizes="max(100vw, 60svh)" width="1440" height="2559" /><img className="hero-image" {...imageProps('/images/editorial-hero/open-landscape-3840.webp', '(max-width: 600px) 100vw, max(100vw, 180svh)')} alt="The River Green entrance beneath a wide blue sky, with a family walking toward the landscaped avenue and fountain. Architectural visualisation." loading="eager" fetchPriority="high" decoding="async" /></picture></div>
  </div></div>;
}

function Dialog({ children, onClose, title, className = '' }) {
  const ref = useRef(null);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    const prior = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const shell = document.getElementById('page-shell');
    if (shell) shell.inert = true;
    const timer = setTimeout(() => ref.current?.querySelector('button, input, a, [tabindex="0"]')?.focus(), 80);
    const keys = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab') return;
      const focusable = Array.from(ref.current?.querySelectorAll('button:not([disabled]), input, select, textarea, a[href], [tabindex="0"]') || []);
      if (!focusable.length) return;
      if (e.shiftKey && document.activeElement === focusable[0]) { e.preventDefault(); focusable.at(-1).focus(); }
      else if (!e.shiftKey && document.activeElement === focusable.at(-1)) { e.preventDefault(); focusable[0].focus(); }
    };
    document.addEventListener('keydown', keys);
    return () => { clearTimeout(timer); document.removeEventListener('keydown', keys); document.body.style.overflow = previousOverflow; if (shell) shell.inert = false; prior?.focus?.(); };
  }, [onClose]);
  return createPortal(<motion.div className="modal-overlay" data-lenis-prevent initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <motion.div ref={ref} className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={title} initial={{ opacity: 0, y: reduceMotion ? 0 : 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
      <button className="modal-close" aria-label="Close dialog" onClick={onClose}><X size={22} /></button>{children}
    </motion.div>
  </motion.div>, document.body);
}

function VisitForm({ onClose, plot }) {
  const [opened, setOpened] = useState(false);
  const [error, setError] = useState('');
  function submit(e) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = data.get('name').trim();
    const raw = data.get('phone').replace(/\D/g, '');
    const phone = raw.length === 12 && raw.startsWith('91') ? raw.slice(2) : raw;
    if (!name || !/^[6-9]\d{9}$/.test(phone)) { setError('Please enter your name and a valid 10-digit Indian mobile number.'); return; }
    const date = data.get('date');
    const message = `Hello Defence Garden, I would like to visit River Green Colony, Shamli.\nName: ${name}\nMobile: +91 ${phone}\nPreferred date: ${date || 'Please suggest a suitable date'}\nInterest: ${data.get('interest')}${plot?.number ? `\nPlot of interest: ${plot.number}` : ''}\nPlease confirm the visit time and meeting point.`;
    const link = document.createElement('a');
    link.href = `https://wa.me/919521018879?text=${encodeURIComponent(message)}`;
    link.target = '_blank'; link.rel = 'noopener noreferrer'; link.click();
    setError(''); setOpened(true);
  }
  const dateParts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const today = ['year', 'month', 'day'].map((type) => dateParts.find((part) => part.type === type).value).join('-');
  return <Dialog onClose={onClose} title="Plan your River Green visit" className="visit-modal">
    <Eyebrow>COME EXPERIENCE RIVER GREEN</Eyebrow><h2>Let’s take<br /><em>a walk.</em></h2><p>Arrange a visit to River Green with the project team.</p>
    <form onSubmit={submit}>
      {plot?.number && <div className="selected-plot-note"><MapPin size={15} /> Enquiry for plot {plot.number}</div>}
      <label>Your name<input name="name" placeholder="Full name" autoComplete="name" required maxLength={80} /></label>
      <label>Mobile number<input name="phone" type="tel" placeholder="Your 10-digit mobile number" autoComplete="tel" required maxLength={17} /></label>
      <div className="form-row"><label>Preferred date <span>(optional)</span><input name="date" type="date" min={today} /></label><label>I’m interested in<select name="interest"><option>Exploring residential plots</option><option>Current pricing & availability</option><option>A guided project visit</option></select></label></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {opened && <p className="form-success" role="status"><Check size={17} /> Your request is ready in WhatsApp. Send it there to contact the team.</p>}
      <button className="button button-green w-full justify-between" type="submit">Continue on WhatsApp <ArrowUpRight size={19} /></button>
      <small className="form-note">Opens WhatsApp with your details ready to send. The team will confirm your visit.</small>
    </form>
  </Dialog>;
}

function PublicSite({ seoOrigin, copyrightYear }) {
  const rootRef = useRef(null);
  const reducedMotion = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [headerHidden, setHeaderHidden] = useState(false);
  const headerRef = useRef(null);
  const menuButtonRef = useRef(null);
  const [modal, setModal] = useState(null);
  const [enquiryPlot, setEnquiryPlot] = useState(null);
  const [feature, setFeature] = useState(0);
  const { scrollTo, activeSection } = useSiteMotion(rootRef, reducedMotion, setFeature);
  const [sceneFeature, setSceneFeature] = useState('booking');
  const [bookingRequest, setBookingRequest] = useState(0);
  const focusBookingMap = useCallback(() => scrollTo('#plot-booking-map', { immediate: true }), [scrollTo]);
  const [filter, setFilter] = useState('All views');
  const [lightbox, setLightbox] = useState(0);
  const [faq, setFaq] = useState(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const sceneRef = useRef(null);
  const closeModal = useRef(() => setModal(null)).current;
  const chapter = sceneChapters.find((c) => c.key === sceneFeature);
  const filtered = filter === 'All views' ? gallery : gallery.filter((item) => item.category === filter);
  useEffect(() => {
    let disposed = false;
    const limitedConnection = navigator.connection?.saveData || /(^|-)2g$/.test(navigator.connection?.effectiveType || '');
    const prepare = () => {
      if (disposed) return;
      // Fetch the component, map and model builders while the visitor reads
      // the first screen. The renderer stays mounted when they scroll away.
      loadCommunityScene().then(module => module.preloadCommunityScene()).catch(() => {});
      setSceneReady(true);
    };
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { prepare(); observer.disconnect(); }
    }, { rootMargin: limitedConnection ? '0px' : '1200px' });
    if (sceneRef.current) observer.observe(sceneRef.current);
    const idle = !limitedConnection && window.requestIdleCallback
      ? window.requestIdleCallback(prepare, { timeout: 600 }) : null;
    const timer = !limitedConnection && idle === null ? window.setTimeout(prepare, 100) : null;
    return () => { disposed = true; observer.disconnect(); if (idle !== null) window.cancelIdleCallback(idle); if (timer !== null) window.clearTimeout(timer); };
  }, []);
  useEffect(() => {
    if (modal !== 'gallery') return;
    const keys = (e) => { if (e.key === 'ArrowRight') setLightbox((v) => (v + 1) % gallery.length); if (e.key === 'ArrowLeft') setLightbox((v) => (v + gallery.length - 1) % gallery.length); };
    document.addEventListener('keydown', keys);
    return () => document.removeEventListener('keydown', keys);
  }, [modal]);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => { if (e.key === 'Escape') { setMenuOpen(false); menuButtonRef.current?.focus(); } };
    const closeOutside = (e) => { if (!headerRef.current?.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('keydown', close);
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('focusin', closeOutside);
    return () => {
      document.removeEventListener('keydown', close);
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('focusin', closeOutside);
    };
  }, [menuOpen]);
  useEffect(() => {
    let previousY = Math.max(0, window.scrollY);
    let scrollFrame = 0;
    const hero = rootRef.current?.querySelector('.hero');
    const updateHeader = () => {
      scrollFrame = 0;
      setHeaderScrolled(Boolean(hero && hero.getBoundingClientRect().bottom <= (headerRef.current?.offsetHeight || 100) + 32));
      const currentY = Math.max(0, window.scrollY);
      const delta = currentY - previousY;
      if (currentY < 80 || menuOpen || modal) {
        setHeaderHidden(false);
        previousY = currentY;
      } else if (delta > 48 || delta < -24) {
        setHeaderHidden(delta > 0);
        previousY = currentY;
      }
    };
    const onScroll = () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(updateHeader); };
    const desktop = window.matchMedia('(min-width: 1025px)');
    const onResize = () => { if (desktop.matches) setMenuOpen(false); };
    updateHeader();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    desktop.addEventListener('change', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      desktop.removeEventListener('change', onResize);
      cancelAnimationFrame(scrollFrame);
    };
  }, [menuOpen, modal]);
  function navigate(e, id) { e.preventDefault(); setMenuOpen(false); scrollTo(id); history.replaceState(null, '', id); }
  function startBooking(event) {
    event?.preventDefault();
    setMenuOpen(false); setSceneReady(true); setSceneFeature('booking'); setBookingRequest(value => value + 1);
    loadCommunityScene().then(module => module.preloadCommunityScene()).catch(() => {});
    scrollTo(document.getElementById('plot-booking-map') ? '#plot-booking-map' : '#experience', { immediate: true });
  }
  function planVisit(plot = null) { setMenuOpen(false); setEnquiryPlot(plot); setModal('visit'); }
  function openPhoto(index) { setLightbox(index); setModal('gallery'); }

  return <>
    <div id="page-shell" className={headerScrolled ? 'is-past-hero' : ''} ref={rootRef}>
      <a className="skip-link" href="#overview">Skip to content</a>
      <div className="scroll-progress" aria-hidden="true" />
      <aside className="reading-rail" aria-hidden="true"><span className="reading-progress-label">00</span><span className="reading-progress-track"><i className="reading-progress-fill" /></span><span className="reading-rail-caption">SCROLL TO EXPLORE</span><ArrowDown size={16} strokeWidth={1} /></aside>
      <header ref={headerRef} onFocusCapture={() => setHeaderHidden(false)} className={`site-header${headerScrolled ? ' is-scrolled' : ''}${menuOpen ? ' menu-is-open' : ''}${headerHidden && !menuOpen && !modal ? ' is-hidden' : ''}`}>
        <div className="header-inner">
          <Brand />
          <nav aria-label="Main navigation" className="desktop-nav">
            {[['Book a plot', '#experience'], ['Community', '#overview'], ['At a glance', '#at-a-glance'], ['Gallery', '#gallery'], ['Location', '#location']].map(([name, id]) => <a key={id} href={id} aria-current={activeSection === id ? 'location' : undefined} onClick={(e) => id === '#experience' ? startBooking(e) : navigate(e, id)}>{name}</a>)}
          </nav>
          <div className="header-actions">
            <div className="header-contact"><a className="header-plot" href={PLOT_ENQUIRY_URL} target="_blank" rel="noreferrer">Plot enquiries <ArrowUpRight size={17} aria-hidden="true" /></a><button className="header-visit" onClick={() => planVisit()} aria-label="Plan a visit">Plan a visit</button></div>
            <button ref={menuButtonRef} className="menu-toggle" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} aria-controls={menuOpen ? 'mobile-navigation' : undefined} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}</button>
          </div>
        </div>
        <AnimatePresence>{menuOpen && <motion.nav id="mobile-navigation" aria-label="Mobile navigation" className="mobile-nav" data-lenis-prevent initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: reducedMotion ? 0 : 0.22 }}>
          {[['Book your plot', '#experience'], ['The community', '#overview'], ['At a glance', '#at-a-glance'], ['Gallery', '#gallery'], ['Location', '#location']].map(([name, id]) => <a key={id} href={id} aria-current={activeSection === id ? 'location' : undefined} onClick={(e) => id === '#experience' ? startBooking(e) : navigate(e, id)}>{name}<ArrowUpRight size={18} /></a>)}
          <a className="mobile-nav-contact" href={`tel:${SALES_PHONE}`}><span><Phone size={15} aria-hidden="true" /> Talk to the team</span><span>+91 95210 18879</span></a>
        </motion.nav>}</AnimatePresence>
      </header>

      <main>
        <section className="hero" id="home" aria-labelledby="hero-title">
          <HeroMedia />
          <div className="hero-shade" />
          <div className="hero-content">
            <div className="hero-topline"><Eyebrow>A DEFENCE GARDEN COMMUNITY</Eyebrow></div>
            <h1 id="hero-title"><span className="hero-line-mask"><span className="hero-title-line">River Green</span></span></h1>
            <div className="hero-booking"><button type="button" className="hero-booking-button" onClick={startBooking}><span className="hero-booking-label">Book Your Plot</span><span className="hero-booking-arrow"><ArrowUpRight size={19} aria-hidden="true" /></span></button><span>Choose your space on the 3D map</span></div>
            <p className="hero-colony">Colony · Shamli</p>
            <p className="hero-subline"><span>A place to begin.</span><span>A life of your own.</span></p>
          </div>
          <div className="hero-bottom"><span className="hero-address">RESIDENTIAL PLOTS · SHAMLI ROAD</span><a href="#overview" onClick={(e) => navigate(e, '#overview')} className="hero-discover">Discover River Green <ArrowDown size={16} strokeWidth={1.25} /></a><span className="hero-status">Entrance visualisation</span></div>
        </section>

        <section className="experience section-padding" id="experience" aria-labelledby="experience-title" ref={sceneRef}>
          <div className="section-top" data-reveal><Eyebrow light>01 / CHOOSE YOUR SPACE</Eyebrow><span className="section-side-note"><Compass size={15} /> SELECT A PLOT TO BEGIN</span></div>
          <div className="experience-heading" data-reveal><h2 id="experience-title">Book your plot<br /><em>on the 3D map.</em></h2><p>Explore the layout. Click a numbered plot to view details and start your booking.</p></div>
          <ol className="booking-steps" aria-label="How to book a plot"><li><span>01</span>Explore the map</li><li><span>02</span>Click a plot</li><li><span>03</span>Start your booking</li></ol>
          <div className="experience-grid">
            <div className="scene-area">{sceneReady ? <Suspense fallback={<div className="scene-placeholder" role="status"><Leaf size={40} /><span>Preparing your colony view…</span></div>}><CommunityScene activeFeature={sceneFeature} reducedMotion={reducedMotion} onFeatureChange={setSceneFeature} bookingRequest={bookingRequest} onBookingFocus={focusBookingMap} /></Suspense> : <div className="scene-placeholder"><Leaf size={40} /><span>Explore the colony layout</span></div>}</div><small className="scene-disclaimer">Original plot geometry · Architecture and landscaping visualised from project photographs</small>
            <div className="experience-copy" data-reveal><AnimatePresence initial={false} mode="wait"><motion.div key={sceneFeature} className="chapter-content" aria-live="polite" initial={{ opacity: 0, y: reducedMotion ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.25 }}><span className="chapter-number">0{sceneChapters.findIndex((c) => c.key === sceneFeature) + 1}</span><h3>{chapter.title}</h3><p>{chapter.text}</p></motion.div></AnimatePresence><button className="text-link" onClick={() => planVisit()}>Experience it in person <ArrowUpRight size={18} /></button><div className="experience-footnote"><span />YOUR SPACE. YOUR NEXT CHAPTER.</div></div>
          </div>
        </section>

        <nav className="project-guide" aria-label="Project essentials">
          <a href="#experience" onClick={(e) => navigate(e, '#experience')}><span className="guide-number">01 / THE LAYOUT</span><strong>200 plots & shops</strong><span>Explore the colony plan <ArrowUpRight size={18} /></span></a>
          <a href="#at-a-glance" onClick={(e) => navigate(e, '#at-a-glance')}><span className="guide-number">02 / THE DETAILS</span><strong>Room to begin.</strong><span>Plot sizes, roads & contacts <ArrowUpRight size={18} /></span></a>
          <a href="#location" onClick={(e) => navigate(e, '#location')}><span className="guide-number">03 / THE ADDRESS</span><strong>Shamli Road, Mundet</strong><span>Find us & plan your visit <ArrowUpRight size={18} /></span></a>
        </nav>

        <section className="overview section-padding" id="overview" aria-labelledby="overview-title">
          <div className="section-top" data-reveal><Eyebrow>02 / THE COMMUNITY</Eyebrow><span className="section-side-note">RIVER GREEN COLONY, SHAMLI</span></div>
          <div className="community-intro">
            <span className="editorial-kicker" data-reveal>THE IDEA</span>
            <h2 id="overview-title" data-line-reveal><span className="heading-line-mask"><span>A place to put down roots.</span></span><span className="heading-line-mask"><span>A place to call your own.</span></span></h2>
            <p className="community-intro-copy" data-reading-reveal>A distinctive entrance. Landscaped avenues. A fountain at the heart of it all. Discover a new address on Shamli Road.</p>
            <span className="editorial-flower" aria-hidden="true">✳</span>
          </div>
          <div className="overview-grid">
            <div className="overview-copy" data-reveal><p className="lead-copy">Land to make your own.<br />A place connected to Shamli.</p><p>River Green is a plotted residential community by Defence Garden on Shamli Road. A distinctive entrance, landscaped avenues and a fountain plaza give the colony its character.</p><a href="#experience" className="text-link" onClick={(e) => navigate(e, '#experience')}>Take a look around <ArrowUpRight size={20} /></a></div>
            <div className="overview-visual" data-reveal><div className="overview-photo story-image"><img data-parallax {...imageProps('/images/hd/rivergreen-aerial-gate.webp', '(max-width: 600px) 155vw, (max-width: 900px) 90vw, 75vw')} alt="AI visualisation of the River Green entrance and completed houses beyond the gate" loading="lazy" /></div><div className="overview-inset"><img {...imageProps('/images/hd/rivergreen-03.webp', '(max-width: 600px) 45vw, 25vw')} alt="The interior fountain plaza at River Green" loading="lazy" /><span>THE FOUNTAIN PLAZA</span></div><div className="photo-caption"><span>01 — The entrance, from above.</span><span>AI VISUALISATION</span></div></div>
          </div>
          <div className="project-details" data-reveal><div><small>THE ADDRESS</small><strong>Shamli Road, Mundet</strong></div><div><small>THE DEVELOPMENT</small><strong>Residential plots</strong></div><div><small>THE ORIGINAL LAYOUT</small><strong>200 plots & shops</strong></div><div><small>THE NAME BEHIND IT</small><strong>Defence Garden</strong></div></div>
        </section>

        <section className="features-section section-padding" id="everyday" aria-labelledby="features-title">
          <div className="section-top" data-reveal><Eyebrow>03 / THE EVERYDAY</Eyebrow><span className="section-side-note">THREE PERSPECTIVES. ONE COMMUNITY.</span></div>
          <div className="features-grid feature-story">
            <div className="feature-story-copy">
              <div data-reveal><h2 id="features-title">Built around<br /><em>daily life.</em></h2><p className="features-intro">The entrance, the avenue and the spaces between.</p></div>
              <div className="feature-list story-list">{features.map(({ title, text, image, alt, caption, icon: Icon }, index) => <article className={`feature-step${feature === index ? ' is-active' : ''}`} id={`everyday-${index}`} data-story-step={index} key={title} aria-labelledby={`feature-title-${index}`}>
                <span className="feature-step-number"><Icon size={20} strokeWidth={1.5} aria-hidden="true" /> PERSPECTIVE 0{index + 1} / 03</span>
                <h3 id={`feature-title-${index}`}>{title}</h3><p>{text}</p>
                <div className="feature-mobile-photo"><img {...imageProps(image, '(max-width: 600px) 88vw, 88vw')} alt={alt || title} loading="lazy" /><small>{caption || 'THE RIVER GREEN EXPERIENCE'}</small></div>
              </article>)}</div>
            </div>
            <div className="feature-story-visual">
              <div className="feature-photo-wrap">
                {features.map(({ image, alt, title }, index) => <div key={image} className={`feature-photo-layer${feature === index ? ' is-active' : ''}`} aria-hidden={feature !== index}><img className="feature-photo" {...imageProps(image, '(max-width: 899px) 1px, max(45vw, 65svh)')} alt={alt || title} loading="lazy" /></div>)}
                <div className="feature-photo-label"><span>{features[feature].caption || 'THE RIVER GREEN EXPERIENCE'}</span><span>0{feature + 1} / 03</span></div>
              </div>
              <div className="story-position" aria-label="Community perspectives">{features.map(({ title }, index) => <a key={title} href={`#everyday-${index}`} aria-label={`Read perspective ${index + 1}: ${title}`} aria-current={feature === index ? 'step' : undefined} onClick={(e) => { setFeature(index); navigate(e, `#everyday-${index}`); }}><span>0{index + 1}</span><i /></a>)}</div>
            </div>
          </div>
        </section>



        <section className="film-banner" aria-label="Watch the River Green project film"><div className="film-banner-image"><img data-parallax {...imageProps('/images/hd/rivergreen-02.webp')} alt="Paved avenue framed by greenery at River Green" loading="lazy" /></div><div className="film-banner-shade" /><div className="film-banner-content" data-reveal><Eyebrow light>THE ACTUAL PROJECT FILM</Eyebrow><h2>Walk<br /><em>the avenue.</em></h2><button onClick={() => setModal('film')} className="large-play" aria-label="Play River Green project film"><Play size={23} fill="currentColor" /></button><span className="film-banner-caption">Step inside River Green <ArrowUpRight size={16} /></span></div></section>

        <section className="gallery-section section-padding" id="gallery" aria-labelledby="gallery-title"><div className="section-top" data-reveal><Eyebrow>05 / PROJECT VIEWS</Eyebrow><a className="text-link gallery-official" href="https://defencegarden.com/project/1" target="_blank" rel="noreferrer">Official project <ArrowUpRight size={16} /></a></div><div className="gallery-heading" data-reveal><h2 id="gallery-title">On the<br /><em>ground.</em></h2><p>The entrance, streets and green spaces.<br />AI visualisations with finished buildings and cleared grounds.</p></div><div className="gallery-filters" aria-label="Filter project views">{['All views', 'Green spaces', 'Streets', 'Entrance'].map((item) => <button key={item} aria-pressed={filter === item} onClick={() => setFilter(item)} className={filter === item ? 'active' : ''}>{item}{item === 'All views' && <span>{gallery.length.toString().padStart(2, '0')}</span>}</button>)}</div><motion.div layout={!reducedMotion} layoutDependency={filter} className="gallery-grid"><AnimatePresence initial={false} mode="popLayout">{filtered.map((item) => <motion.button layout={!reducedMotion} layoutDependency={filter} key={item.src} className="gallery-item" onClick={() => openPhoto(gallery.indexOf(item))} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} aria-label={`View image: ${item.title}`}><div className="gallery-image"><img {...imageProps(item.src, '(max-width: 600px) 88vw, 42vw')} alt={item.alt} loading="lazy" /><span className="gallery-expand"><Maximize2 size={19} /></span><span className="gallery-tag">{item.category}</span></div><div className="gallery-caption"><div><h3>{item.title}</h3><p>{item.subtitle}</p></div><ArrowUpRight size={22} strokeWidth={1.4} /></div><div className="gallery-card-facts" aria-hidden="true"><span>View type<strong>{item.category}</strong></span><span>Project<strong>River Green, Shamli</strong></span></div></motion.button>)}</AnimatePresence></motion.div></section>

        <section className="location-section section-padding" id="location" aria-labelledby="location-title"><div className="section-top" data-reveal><Eyebrow light>06 / THE LOCATION</Eyebrow><span className="location-coordinates">MUNDET · UTTAR PRADESH</span></div><div className="location-grid"><div className="location-copy" data-reveal><h2 id="location-title">Right here.<br /><em>In Shamli.</em></h2><p>Find River Green on Shamli Road in Mundet. Get directions, speak with the team and arrange a walk around the colony.</p><div className="location-address"><MapPin size={21} strokeWidth={1.5} /><div><strong>River Green Colony</strong><span>Shamli Road, Mundet, Shamli<br />Uttar Pradesh 247776</span></div></div><a href={MAP_URL} target="_blank" rel="noreferrer" className="button button-cream">Get directions <ArrowUpRight size={18} /></a><button className="location-visit-link" onClick={() => planVisit()}>Arrange a guided visit <ArrowRight size={17} /></button></div><div className="location-map" data-reveal>{mapReady ? <iframe title="River Green Colony location on Google Maps" src={GOOGLE_MAPS_EMBED_URL} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen /> : <div className="map-preview"><img {...imageProps('/images/hd/rivergreen-aerial.webp', '(max-width: 600px) 160vw, (max-width: 900px) 110vw, 85vw')} alt="AI aerial visualisation of River Green with completed houses and cleared plots" loading="lazy" /><div className="map-marker"><MapPin size={32} /><strong>River Green</strong><span>SHAMLI, UTTAR PRADESH</span></div><button onClick={() => setMapReady(true)} className="map-load">Explore on Google Maps <ArrowUpRight size={17} /></button><small>Project visualisation · Open the live map for directions</small></div>}<a className="map-external" href={MAP_URL} target="_blank" rel="noreferrer" aria-label="Open River Green location in Google Maps"><ArrowUpRight size={20} /></a></div></div></section>

        <section className="glance-section section-padding" id="at-a-glance" aria-labelledby="glance-title"><div className="glance-grid"><div className="glance-intro" data-reveal><Eyebrow>AT A GLANCE</Eyebrow><h2 id="glance-title">River Green<br />at a glance.</h2><p className="glance-lead">Looking for a residential plot in Shamli?</p><p>{SITE.summary}</p></div><dl className="glance-facts" data-reveal>{FACTS.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></div></section>

        <section className="process-section section-padding" id="visit-process" aria-labelledby="process-title">
          <div className="section-top" data-reveal><Eyebrow>A CLEAR NEXT STEP</Eyebrow><span className="section-side-note">FROM A FIRST LOOK TO A SITE VISIT</span></div>
          <div className="process-heading"><h2 id="process-title">Your River Green<br /><em>journey.</em></h2><p data-reading-reveal>Explore at your own pace. Ask the questions that matter. Then come and see the place for yourself.</p></div>
          <ol className="process-list">{visitSteps.map(({ title, text, link, target }, index) => <li className="process-step" key={title}>
            <span className="process-number" aria-hidden="true">0{index + 1}</span><div className="process-step-title"><h3 data-heading-reveal>{title}</h3>{target?.startsWith('#') ? <a href={target} onClick={(e) => navigate(e, target)}>{link}<ArrowUpRight size={18} /></a> : target ? <a href={target}>{link}<ArrowUpRight size={18} /></a> : <button onClick={() => planVisit()}>{link}<ArrowUpRight size={18} /></button>}</div><p data-reveal>{text}</p>
          </li>)}</ol>
        </section>

        <section className="faq-section section-padding" aria-labelledby="faq-title"><div className="faq-intro" data-reveal><Eyebrow>GOOD TO KNOW</Eyebrow><h2 id="faq-title">Before<br /><em>you visit.</em></h2><p>Plot details, visits and the team behind River Green.</p><a className="text-link" href={`tel:${SALES_PHONE}`}>Let’s talk <ArrowUpRight size={18} /></a></div><div className="faq-list" data-reveal>{questions.map(({ q, a }, index) => <div className="faq-item" key={q} lang={/[\u0900-\u097F]/.test(q) ? 'hi' : undefined}><button aria-expanded={faq === index} aria-controls={`faq-${index}`} onClick={() => setFaq(faq === index ? null : index)}><span>{q}</span>{faq === index ? <Minus size={18} /> : <Plus size={18} />}</button>{/* Answers stay in the page while collapsed, so search engines can read them. */}<motion.div id={`faq-${index}`} initial={false} animate={faq === index ? { height: 'auto', opacity: 1 } : { height: 0, opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.25 }} style={{ overflow: 'hidden' }} aria-hidden={faq !== index}><p>{a}</p></motion.div></div>)}</div></section>

        <section className="visit-section"><div className="visit-pattern" aria-hidden="true"><svg viewBox="0 0 600 600"><path d="M170 580C100 350 130 60 530 20c10 260-85 470-350 465M80 600 425 150M0 550c230-160 290 70 610-75" /></svg></div><div className="visit-content" data-reveal><Eyebrow>COME SEE RIVER GREEN</Eyebrow><h2>See it<br /><em>for yourself.</em></h2><p>Walk the avenue. Explore the layout. Meet the team.</p><button className="button button-green" onClick={() => planVisit()}>Let’s plan your visit <ArrowUpRight size={19} /></button></div><span className="visit-bottom-note">RIVER GREEN COLONY · SHAMLI</span></section>
        {/* schema.org data for search and AI engines; prerendered pages carry __SITE_URL__ for the server to fill. */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData(seoOrigin || (typeof window === 'undefined' ? '__SITE_URL__' : window.location.origin), gallery.map(({ src }) => src))).replace(/</g, '\\u003c') }} />
      </main>

      <footer className="site-footer"><div className="footer-wordmark"><div className="footer-wordmark-title"><div className="footer-wordmark-logo"><img src="/branding/river-green-wordmark.png" alt="River Green" width="2172" height="724" loading="lazy" /></div><div className="footer-wordmark-colony">Colony</div></div><span>BY DEFENCE GARDEN</span></div><div className="footer-main"><div className="footer-brand"><Brand footer /><p>River Green Colony.<br />Residential plots on Shamli Road.</p><a href="https://defencegarden.com/" target="_blank" rel="noreferrer" className="footer-developer">A DEFENCE GARDEN COMMUNITY <ArrowUpRight size={14} /></a></div><div className="footer-nav"><small>EXPLORE</small>{[['Book your plot', '#experience'], ['The community', '#overview'], ['At a glance', '#at-a-glance'], ['Project gallery', '#gallery'], ['Find River Green', '#location']].map(([name, id]) => <a href={id} key={id} onClick={(e) => id === '#experience' ? startBooking(e) : navigate(e, id)}>{name}</a>)}</div><div className="footer-contact"><a href={`tel:${SALES_PHONE}`}>+91 95210 18879</a><a href="mailto:defencegarden009@gmail.com"><Mail size={16} /> defencegarden009@gmail.com</a><span><MapPin size={16} /> Shamli Road, Mundet, Shamli, U.P.</span></div><button className="footer-top" onClick={() => scrollTo('#home')} aria-label="Back to top"><ArrowDown size={20} /></button></div><div className="footer-bottom"><span>© {copyrightYear ?? new Date().getFullYear()} River Green Colony · Defence Garden</span><span>Project details & availability: contact the sales team.</span><span>SHAMLI, UTTAR PRADESH</span></div></footer>
    </div>
    <AnimatePresence>
      {modal === 'visit' && <VisitForm onClose={closeModal} plot={enquiryPlot} />}
      {modal === 'film' && <Dialog onClose={closeModal} title="River Green project film" className="film-modal"><div className="film-modal-heading"><Eyebrow light>THE RIVER GREEN PROJECT FILM</Eyebrow><h2>A look around <em>River Green.</em></h2></div><video src="/images/rivergreen-film.mp4" poster="/images/hd/rivergreen-02.webp" controls playsInline autoPlay={!reducedMotion} preload="metadata" onLoadedMetadata={(e) => { e.currentTarget.currentTime = 5; }} /><p>Actual project film · River Green Colony, Shamli</p></Dialog>}
      {modal === 'gallery' && <Dialog onClose={closeModal} title={gallery[lightbox].title} className="lightbox-modal"><img className="lightbox-image" {...imageProps(gallery[lightbox].src, '90vw')} loading="eager" fetchPriority="high" alt={gallery[lightbox].alt} /><div className="lightbox-bottom"><div><h3>{gallery[lightbox].title}</h3><p>{gallery[lightbox].subtitle}</p></div><div className="lightbox-controls"><RoundArrow aria-label="Previous image" onClick={() => setLightbox((v) => (v + gallery.length - 1) % gallery.length)}><ChevronLeft size={21} /></RoundArrow><span>{lightbox + 1} / {gallery.length}</span><RoundArrow aria-label="Next image" onClick={() => setLightbox((v) => (v + 1) % gallery.length)}><ChevronRight size={21} /></RoundArrow></div></div></Dialog>}
    </AnimatePresence>
  </>;
}

export default function App({ seoOrigin, copyrightYear } = {}) {
  if (typeof window !== 'undefined' && window.location.pathname.replace(/\/+$/, '') === '/plot-manager') {
    return <Suspense fallback={<div className="manager-loading">Loading plot management…</div>}><PlotManager /></Suspense>;
  }
  return <PublicSite seoOrigin={seoOrigin} copyrightYear={copyrightYear} />;
}
