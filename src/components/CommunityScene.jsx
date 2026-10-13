import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, ChevronDown, MapPin, MousePointer2, Search, X } from 'lucide-react';
import plan from '../data/threePlotGeometry.json';
import { normalizePlotNumber, PLOT_STATUSES, usePlotRecords, usePlotStoreState } from '../data/plotStore';
import { getColonyMapConfig, GOOGLE_MAPS_URL, GOOGLE_MAPS_EMBED_URL } from '../data/colonyLocation';
import { NEARBY_PLACES, PLACE_CATEGORIES } from '../data/nearbyPlaces';
import './CommunityScene.css';

const PlotBookingModal = lazy(() => import('./PlotBookingModal'));

let mapSceneModule;
const loadMapScene = () => mapSceneModule ||= import('../scene/colonyMapScene.js').catch(error => { mapSceneModule = null; throw error; });
export const preloadCommunityScene = () => loadMapScene().then(module => module.preloadColonyMapScene());

// Live plot availability from the records the 2D map uses (RESERVED = booked).
// Unconfirmed plots keep the soil appearance while live ledger states add colour.
const STATUS_COLOURS = { AVAILABLE: '#0b9d58', RESERVED: '#f5c518', SOLD: '#d33a2f', UNKNOWN: '#b79a70' };
const VIEW_LABELS = [['booking', 'Choose a plot'], ['nature', 'Aerial view'], ['plan', 'Plan view'], ['community', 'Interior plaza'], ['connection', 'Entrance']];
// Start with the colony and nearby surroundings; Reset restores this view.
const DEFAULT_VIEW = 'booking';
const MAP_CONFIG = getColonyMapConfig(import.meta.env);
// Short tips over the map: how to explore (once per visit), and what to do when
// a plain scroll or one-finger swipe moves the page instead of the map.
const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const TIPS = {
  intro: `Drag to turn · Right-drag to move · ${MAC ? '⌘' : 'Ctrl'} + scroll to zoom where you point · Double-click to fly in`,
  introTouch: 'Swipe sideways to turn · Two fingers to move and pinch-zoom where you point · Double-tap to fly in',
  wheel: `Hold ${MAC ? '⌘' : 'Ctrl'} and scroll to zoom where you point`,
  touch: 'Use two fingers to move and zoom the map',
  mapIntro: `Drag to move · Right-drag to turn and tilt · ${MAC ? '⌘' : 'Ctrl'} + scroll to zoom`,
  mapIntroTouch: 'Use two fingers to move, pinch to zoom, and twist to turn the map',
};
export default function CommunityScene({ activeFeature = DEFAULT_VIEW, reducedMotion = false, onFeatureChange, bookingRequest = 0, onBookingFocus }) {
  const hostRef = useRef(null);
  const apiRef = useRef(null);
  const featureRef = useRef(activeFeature);
  const motionRef = useRef(reducedMotion);
  const [ready, setReady] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [source, setSource] = useState('map');
  const [mapUnavailable, setMapUnavailable] = useState(false);
  const [viewName, setViewName] = useState(activeFeature);
  const [tip, setTip] = useState({ text: '', visible: false });
  const [selectedPlot, setSelectedPlot] = useState(null);
  const [showBookingGuide, setShowBookingGuide] = useState(true);
  const handledBookingRequest = useRef(0);
  const bookingFocusRef = useRef(onBookingFocus); bookingFocusRef.current = onBookingFocus;
  const [plotQuery, setPlotQuery] = useState('');
  const [queryError, setQueryError] = useState('');
  const [openPanel, setOpenPanel] = useState(null);
  const [selectedPlace, setSelectedPlace] = useState('');
  const [placesVisible, setPlacesVisible] = useState(true);
  const selectedPlaceRef = useRef('');
  const placesVisibleRef = useRef(true);
  const featureChangeRef = useRef(onFeatureChange); featureChangeRef.current = onFeatureChange;
  const place = NEARBY_PLACES.find(value => value.id === selectedPlace);
  const store = usePlotStoreState();
  const tipRef = useRef({ timer: 0, shown: {} });
  const showTip = (kind, duration = 2400) => {
    const state = tipRef.current, now = Date.now();
    if (now - (state.shown[kind] || 0) < 7000) return; // the same tip at most every 7 s
    state.shown[kind] = now; clearTimeout(state.timer);
    setTip({ text: TIPS[kind], visible: true }); state.timer = setTimeout(() => setTip(value => ({ ...value, visible: false })), duration);
  };
  const showTipRef = useRef(showTip); showTipRef.current = showTip;
  useEffect(() => () => clearTimeout(tipRef.current.timer), []);
  useEffect(() => {
    if (!ready || source === 'satellite') return;
    let seen = false; try { seen = sessionStorage.getItem('rg-3d-tips') === '1'; sessionStorage.setItem('rg-3d-tips', '1'); } catch { /* Private mode: show the tip every visit. */ }
    if (!seen) showTipRef.current(window.matchMedia?.('(pointer: coarse)').matches ? source === 'map' ? 'mapIntroTouch' : 'introTouch' : source === 'map' ? 'mapIntro' : 'intro', 5200);
  }, [ready, source]);
  const records = usePlotRecords();
  const recordsRef = useRef(records);
  useEffect(() => { recordsRef.current = records; apiRef.current?.paintPlots(records); }, [records]);
  useEffect(() => { const changed = featureRef.current !== activeFeature; featureRef.current = activeFeature; setViewName(activeFeature); if (changed && !(activeFeature === 'booking' && bookingRequest) && !(activeFeature === 'nearby' && selectedPlaceRef.current)) apiRef.current?.preset(activeFeature); }, [activeFeature, bookingRequest]);
  useEffect(() => { placesVisibleRef.current = placesVisible; apiRef.current?.setPlacesVisible?.(placesVisible); }, [placesVisible]);
  useEffect(() => { motionRef.current = reducedMotion; apiRef.current?.setReducedMotion(reducedMotion); }, [reducedMotion]);
  useEffect(() => {
    if (!bookingRequest || handledBookingRequest.current === bookingRequest) return;
    setShowBookingGuide(true);
    selectedPlaceRef.current = ''; setSelectedPlace(''); setOpenPanel(null); setPlacesVisible(false);
    featureRef.current = 'booking'; setViewName('booking');
    if (source === 'satellite') { setSource(mapUnavailable ? 'model' : 'map'); return; }
    if (!ready || !apiRef.current) return;
    handledBookingRequest.current = bookingRequest;
    apiRef.current.preset('booking');
    bookingFocusRef.current?.();
  }, [bookingRequest, ready, source, mapUnavailable]);
  // Both the map and model stay lazy, and only one renderer owns the host.
  useEffect(() => {
    const host = hostRef.current;
    if (!host || source === 'satellite') return undefined;
    let cancelled = false; let api = null;
    const controller = new AbortController();
    setReady(false); setFallback(false); setDragging(false);
    const failed = error => {
      if (cancelled) return;
      console.error(`[River Green ${source} view]`, error);
      if (source === 'map') {
        setMapUnavailable(true);
        if (featureRef.current === 'nearby') { selectedPlaceRef.current = ''; setSelectedPlace(''); featureRef.current = DEFAULT_VIEW; setViewName(DEFAULT_VIEW); featureChangeRef.current?.(DEFAULT_VIEW); }
        setSource('model');
      }
      else setFallback(true);
    };
    const options = { host, plan, statusColours: STATUS_COLOURS, records: recordsRef.current, view: featureRef.current, reducedMotion: motionRef.current, onPlotSelect: number => { if (!cancelled) { setShowBookingGuide(false); setSelectedPlot(number); } }, onPlaceSelect: id => {
      if (cancelled) return;
      featureRef.current = 'nearby'; selectedPlaceRef.current = id; setSelectedPlace(id); setOpenPanel('places'); setPlacesVisible(true); setViewName('nearby'); featureChangeRef.current?.('nearby');
    }, onDragChange: flag => { if (!cancelled) setDragging(flag); }, onFail: failed, onHint: kind => showTipRef.current(kind) };
    (source === 'map' ? loadMapScene() : import('../scene/colonyScene.js'))
      .then(module => cancelled ? null : source === 'map'
        ? module.createColonyMapScene({ ...options, config: MAP_CONFIG, signal: controller.signal })
        : module.createColonyScene(options))
      .then((value) => { if (!value) return; if (cancelled) { value.dispose(); return; } api = value; apiRef.current = value; value.setReducedMotion(motionRef.current); value.paintPlots(recordsRef.current); if (featureRef.current !== options.view) value.preset(featureRef.current); value.setPlacesVisible?.(placesVisibleRef.current); if (selectedPlaceRef.current) value.focusPlace?.(selectedPlaceRef.current); setReady(true); })
      .catch(failed);
    return () => { cancelled = true; controller.abort(); api?.dispose(); apiRef.current = null; };
  }, [source]);

  const handleKeyDown = event => {
    if (event.target !== event.currentTarget || fallback || source === 'satellite') return;
    const pan = event.shiftKey && { ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40] }[event.key];
    const direction = { ArrowLeft: [-.14, false], ArrowRight: [.14, false], ArrowUp: [.045, true], ArrowDown: [-.045, true] }[event.key];
    if (pan) { event.preventDefault(); apiRef.current?.pan(...pan); }
    else if (direction) { event.preventDefault(); apiRef.current?.rotate(...direction); }
    else if (['+', '=', '-'].includes(event.key)) { event.preventDefault(); apiRef.current?.zoom(event.key === '-' ? .82 : 1.22); }
    else if (event.key === 'Home') { event.preventDefault(); choose(DEFAULT_VIEW); }
  };
  // One set of view controls; the page's chapter copy follows the choice.
  const choose = name => { setShowBookingGuide(name === 'booking'); featureRef.current = name; selectedPlaceRef.current = ''; setSelectedPlace(''); setViewName(name); if (name === 'nearby') { setPlacesVisible(true); setOpenPanel('places'); } apiRef.current?.preset(name); onFeatureChange?.(name); };
  const changeSource = next => { if (next !== 'map' && featureRef.current === 'nearby') choose(DEFAULT_VIEW); setSource(next); };
  const counts = {};
  records.forEach(record => { counts[record.status] = (counts[record.status] || 0) + 1; });
  return (
    <div className={`community-scene ${dragging ? 'is-dragging' : ''} ${fallback ? 'has-fallback' : ''} ${source === 'map' ? 'has-live-map' : ''}`} role="group" tabIndex={fallback || source === 'satellite' ? undefined : 0} aria-label="Interactive River Green colony and surroundings. Use the view buttons, zoom and tilt controls. Arrow keys turn and tilt, Shift and arrows pan, plus and minus zoom, Home resets." onKeyDown={handleKeyDown}>
      <aside className="community-scene__explorer" aria-label="Explore the colony" data-lenis-prevent>
        <div className="community-scene__panel-heading"><span>FIND YOUR SPACE</span><p>A plot. Your possibilities.</p></div>
        <label className="community-scene__source-label" htmlFor="scene-map-source">Map display</label>
        <div className="community-scene__select-wrap">
          <select id="scene-map-source" value={source} onChange={event => {
            const next = event.target.value;
            if (next === 'map') setMapUnavailable(false);
            if (next === 'satellite') { setReady(false); setFallback(false); }
            if (next !== 'map' && openPanel === 'places') setOpenPanel(null);
            changeSource(next);
          }}>
            <option value="map">3D + surroundings</option><option value="model">Colony only</option><option value="satellite">Google satellite</option>
          </select><ChevronDown size={15} aria-hidden="true" />
        </div>
        {mapUnavailable && <p className="community-scene__map-notice" role="status">Surroundings are unavailable. Explore the colony or switch to satellite.</p>}
        {!fallback && source !== 'satellite' && <div className="community-scene__views" role="group" aria-label="Camera views">
          {VIEW_LABELS.map(([key, label], index) => <button key={key} type="button" aria-pressed={viewName === key} onClick={() => choose(key)}><span aria-hidden="true">0{index + 1}</span>{label}<ArrowUpRight size={16} aria-hidden="true" /></button>)}
        </div>}
        {viewName === 'booking' && store.statusDisplayEnabled && <div className="community-scene__booking-key"><span>Plot availability</span><div className="community-scene__legend" aria-label="Plot availability colours">{Object.entries(STATUS_COLOURS).map(([status, colour]) => <span key={status}><i style={{ background: colour }} />{PLOT_STATUSES[status].label}</span>)}</div></div>}
        <div className="community-scene__disclosure">
          <button type="button" className="community-scene__disclosure-toggle" aria-expanded={openPanel === 'plot'} aria-controls="scene-plot-panel" onClick={() => setOpenPanel(value => value === 'plot' ? null : 'plot')}><Search size={16} aria-hidden="true" />Find a plot<ChevronDown size={15} aria-hidden="true" /></button>
          <div id="scene-plot-panel" className="community-scene__disclosure-body" hidden={openPanel !== 'plot'}>
            <form className="community-scene__plot-search" onSubmit={event => {
              event.preventDefault();
              const plot = records.find(record => normalizePlotNumber(record.number) === normalizePlotNumber(plotQuery));
              if (plot) { setQueryError(''); setSelectedPlot(plot.number); }
              else setQueryError('Enter a plot number from this layout, such as A-1 or S1.');
            }}>
              <label htmlFor="scene-plot-number">Plot number</label>
              <div><input id="scene-plot-number" placeholder="e.g. A-1 or S1" value={plotQuery} onChange={event => { setPlotQuery(event.target.value); setQueryError(''); }} maxLength={15} aria-invalid={!!queryError} aria-describedby={queryError ? 'scene-plot-error' : undefined} /><button type="submit" aria-label="View plot details"><ArrowUpRight size={18} /></button></div>
            </form>
            {queryError && <p id="scene-plot-error" className="community-scene__query-error" role="alert">{queryError}</p>}
            <p className="community-scene__availability-note" role="status">{!store.serverConnected ? 'Contact the team for current availability.' : !store.statusDisplayEnabled ? 'Contact the team for current plot availability.' : store.bookingConfig?.booking_enabled ? 'Select a plot to view details and request a booking.' : 'Live plot status · Online booking is currently paused.'}</p>
            {store.statusDisplayEnabled && <div className="community-scene__legend" aria-label="Plot availability">{Object.entries(STATUS_COLOURS).map(([status, colour]) => <span key={status}><i style={{ background: colour }} />{PLOT_STATUSES[status].label}<b>{counts[status] || 0}</b></span>)}</div>}
          </div>
        </div>
        {source === 'map' && !fallback && <div className="community-scene__disclosure">
          <button type="button" className="community-scene__disclosure-toggle" aria-expanded={openPanel === 'places'} aria-controls="scene-places-panel" onClick={() => {
            if (openPanel === 'places') setOpenPanel(null);
            else choose('nearby');
          }}><MapPin size={16} aria-hidden="true" />Nearby places<span className="community-scene__place-count">{NEARBY_PLACES.length}</span><ChevronDown size={15} aria-hidden="true" /></button>
          <div id="scene-places-panel" className="community-scene__disclosure-body" hidden={openPanel !== 'places'}>
            <label className="community-scene__source-label" htmlFor="scene-nearby-place">Around River Green</label>
            <div className="community-scene__select-wrap"><select id="scene-nearby-place" value={selectedPlace} disabled={!ready} onChange={event => event.target.value ? apiRef.current?.focusPlace(event.target.value) : choose('nearby')}>
              <option value="">Explore all nearby places</option>
              {NEARBY_PLACES.map(value => <option key={value.id} value={value.id}>{String(value.number).padStart(2, '0')} · {value.name}</option>)}
            </select><ChevronDown size={15} aria-hidden="true" /></div>
            {place ? <div className="community-scene__place-detail" aria-live="polite"><strong>{place.name}</strong><span>{PLACE_CATEGORIES[place.category].label}</span><a href={`https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`} target="_blank" rel="noreferrer">Get directions <ArrowUpRight size={14} /></a></div>
              : <p className="community-scene__place-note">Choose a place to take a closer look.</p>}
            <label className="community-scene__labels-toggle"><input type="checkbox" checked={placesVisible} onChange={event => setPlacesVisible(event.target.checked)} />Show place labels</label>
            <details className="community-scene__colour-key"><summary>Place colour key</summary><div className="community-scene__places-legend" aria-label="Nearby place colours">{Object.entries(PLACE_CATEGORIES).map(([key, category]) => <span key={key}><i style={{ background: category.colour }} />{category.label}</span>)}</div></details>
          </div>
        </div>}
        <a className="community-scene__directions" href={GOOGLE_MAPS_URL} target="_blank" rel="noreferrer"><MapPin size={15} aria-hidden="true" />Directions to River Green<ArrowUpRight size={15} aria-hidden="true" /></a>
      </aside>
      <div className="community-scene__viewport" id="plot-booking-map">
        {!fallback && source !== 'satellite' && showBookingGuide && <div className="community-scene__booking-guide" role="status">
          <span className="community-scene__booking-guide-icon"><MousePointer2 size={22} aria-hidden="true" /></span>
          <div><strong>{ready ? 'Click a plot to book your plot now.' : 'Your plot journey starts here.'}</strong><p>{ready ? 'Select a numbered plot to view details and booking options.' : 'Preparing the interactive plots…'}</p></div>
          <button type="button" onClick={() => setShowBookingGuide(false)} aria-label="Dismiss plot selection guide"><X size={16} /></button>
        </div>}
        {/* Zoom stays pinned on screen while the view scrolls past. */}
        {!fallback && source !== 'satellite' && <div className="community-scene__zoom" role="group" aria-label="Zoom and tilt"><button type="button" aria-label="Zoom in" onClick={() => apiRef.current?.zoom(1.22)}>+</button><button type="button" aria-label="Zoom out" onClick={() => apiRef.current?.zoom(.82)}>−</button><button type="button" className="community-scene__tilt" aria-label="View from higher" onClick={() => apiRef.current?.rotate(.12, true)}>▴</button><button type="button" className="community-scene__tilt" aria-label="View from lower" onClick={() => apiRef.current?.rotate(-.12, true)}>▾</button><button type="button" className="community-scene__reset" aria-label="Reset view" onClick={() => choose(DEFAULT_VIEW)}>Reset</button></div>}
        <div ref={hostRef} className="community-scene__canvas" hidden={source === 'satellite'} />
        {source === 'satellite' && <iframe className="community-scene__satellite" title="Google Maps satellite view of River Green and the surrounding area" src={GOOGLE_MAPS_EMBED_URL} loading="lazy" onLoad={() => setReady(true)} referrerPolicy="no-referrer-when-downgrade" allowFullScreen />}
        {!ready && !fallback && <div className="community-scene__loading" aria-live="polite"><span />{source === 'map' ? 'Preparing your colony and surroundings…' : source === 'satellite' ? 'Loading satellite view…' : 'Preparing your colony view…'}</div>}
        {fallback && <div className="community-scene__fallback"><strong>The colony view could not load.</strong><p>Reload to try again, or explore the Google satellite view above.</p><button type="button" onClick={() => window.location.reload()}>Reload view ↻</button></div>}
        {!fallback && source !== 'satellite' && <span className="community-scene__keyboard-hint">Arrows turn · Shift + arrows pan · + / − zoom · Home resets</span>}
        {!fallback && source !== 'satellite' && <span className={`community-scene__tip${tip.visible ? ' is-visible' : ''}`} aria-live="polite">{tip.text}</span>}
      </div>
      {selectedPlot && <Suspense fallback={<span role="status">Opening plot details…</span>}><PlotBookingModal key={selectedPlot} number={selectedPlot} onClose={() => setSelectedPlot(null)} /></Suspense>}
    </div>
  );
}
