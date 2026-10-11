import { useEffect, useRef, useState } from 'react';
import plan from '../data/threePlotGeometry.json';
import { PLOT_STATUSES, usePlotRecords } from '../data/plotStore';
import { getColonyMapConfig, GOOGLE_MAPS_URL, GOOGLE_MAPS_EMBED_URL } from '../data/colonyLocation';
import './CommunityScene.css';

// Live plot availability from the records the 2D map uses (RESERVED = booked).
// Unconfirmed plots stay natural lawn; the others carry their status colour.
const STATUS_COLOURS = { AVAILABLE: '#0b9d58', RESERVED: '#f5c518', SOLD: '#d33a2f', UNKNOWN: '#6aa84f' };
const VIEW_LABELS = [['nature', 'Aerial view'], ['plan', 'Plan view'], ['community', 'Interior plaza'], ['connection', 'Entrance']];
// Start with the colony and nearby surroundings; Reset restores this view.
const DEFAULT_VIEW = 'nature';
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
export default function CommunityScene({ activeFeature = DEFAULT_VIEW, reducedMotion = false, onFeatureChange }) {
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
  useEffect(() => { featureRef.current = activeFeature; setViewName(activeFeature); apiRef.current?.preset(activeFeature); }, [activeFeature]);
  useEffect(() => { motionRef.current = reducedMotion; apiRef.current?.setReducedMotion(reducedMotion); }, [reducedMotion]);
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
      if (source === 'map') { setMapUnavailable(true); setSource('model'); }
      else setFallback(true);
    };
    const options = { host, plan, statusColours: STATUS_COLOURS, records: recordsRef.current, view: featureRef.current, reducedMotion: motionRef.current, onDragChange: flag => { if (!cancelled) setDragging(flag); }, onFail: failed, onHint: kind => showTipRef.current(kind) };
    (source === 'map' ? import('../scene/colonyMapScene.js') : import('../scene/colonyScene.js'))
      .then(module => cancelled ? null : source === 'map'
        ? module.createColonyMapScene({ ...options, config: MAP_CONFIG, signal: controller.signal })
        : module.createColonyScene(options))
      .then((value) => { if (!value) return; if (cancelled) { value.dispose(); return; } api = value; apiRef.current = value; value.setReducedMotion(motionRef.current); value.paintPlots(recordsRef.current); value.preset(featureRef.current); setReady(true); })
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
  const choose = name => { setViewName(name); apiRef.current?.preset(name); onFeatureChange?.(name); };
  const counts = {};
  records.forEach(record => { counts[record.status] = (counts[record.status] || 0) + 1; });
  return (
    <div className={`community-scene ${dragging ? 'is-dragging' : ''} ${fallback ? 'has-fallback' : ''} ${source === 'map' ? 'has-live-map' : ''}`} role="group" tabIndex={fallback || source === 'satellite' ? undefined : 0} aria-label="Interactive River Green colony and surroundings. Use the view buttons, zoom and tilt controls. Arrow keys turn and tilt, Shift and arrows pan, plus and minus zoom, Home resets." onKeyDown={handleKeyDown}>
      <div className="community-scene__mapbar">
        <div className="community-scene__map-controls" role="group" aria-label="Map display">
          <button type="button" aria-pressed={source === 'map'} onClick={() => { setMapUnavailable(false); setSource('map'); }}>3D + surroundings</button>
          <button type="button" aria-pressed={source === 'model'} onClick={() => setSource('model')}>Colony only</button>
          <button type="button" aria-pressed={source === 'satellite'} onClick={() => { if (source !== 'satellite') { setReady(false); setFallback(false); setSource('satellite'); } }}>Google satellite</button>
        </div>
        <a href={GOOGLE_MAPS_URL} target="_blank" rel="noreferrer">Directions ↗</a>
      </div>
      {mapUnavailable && <div className="community-scene__map-notice" role="status">The surrounding map is unavailable. You can still explore the colony or open the Google satellite view.</div>}
      {/* Controls sit in their own bar above the 3D view, never over the map. */}
      {!fallback && source !== 'satellite' && <div className="community-scene__toolbar">
        <div className="community-scene__view-controls" role="group" aria-label="Camera views">
          {VIEW_LABELS.map(([key, label]) => <button key={key} type="button" aria-pressed={viewName === key} onClick={() => choose(key)}>{label}</button>)}
        </div>
        <div className="community-scene__legend" aria-label="Plot availability">{Object.entries(STATUS_COLOURS).map(([status, colour]) => <span key={status}><i style={{ background: colour }} />{PLOT_STATUSES[status].label}<b>{counts[status] || 0}</b></span>)}</div>
      </div>}
      <div className="community-scene__viewport">
        {/* Zoom stays pinned on screen while the view scrolls past. */}
        {!fallback && source !== 'satellite' && <div className="community-scene__zoom" role="group" aria-label="Zoom and tilt"><button type="button" aria-label="Zoom in" onClick={() => apiRef.current?.zoom(1.22)}>+</button><button type="button" aria-label="Zoom out" onClick={() => apiRef.current?.zoom(.82)}>−</button><button type="button" className="community-scene__tilt" aria-label="View from higher" onClick={() => apiRef.current?.rotate(.12, true)}>▴</button><button type="button" className="community-scene__tilt" aria-label="View from lower" onClick={() => apiRef.current?.rotate(-.12, true)}>▾</button><button type="button" className="community-scene__reset" aria-label="Reset view" onClick={() => choose(DEFAULT_VIEW)}>Reset</button></div>}
        <div ref={hostRef} className="community-scene__canvas" hidden={source === 'satellite'} />
        {source === 'satellite' && <iframe className="community-scene__satellite" title="Google Maps satellite view of River Green and the surrounding area" src={GOOGLE_MAPS_EMBED_URL} onLoad={() => setReady(true)} referrerPolicy="no-referrer-when-downgrade" allowFullScreen />}
        {!ready && !fallback && <div className="community-scene__loading" aria-live="polite"><span />{source === 'map' ? 'Preparing your colony and surroundings…' : source === 'satellite' ? 'Loading satellite view…' : 'Preparing your colony view…'}</div>}
        {fallback && <div className="community-scene__fallback"><strong>The colony view could not load.</strong><p>Reload to try again, or explore the Google satellite view above.</p><button type="button" onClick={() => window.location.reload()}>Reload view ↻</button></div>}
        {!fallback && source !== 'satellite' && <span className="community-scene__keyboard-hint">Arrows turn · Shift + arrows pan · + / − zoom · Home resets</span>}
        {!fallback && source !== 'satellite' && <span className={`community-scene__tip${tip.visible ? ' is-visible' : ''}`} aria-live="polite">{tip.text}</span>}
      </div>
    </div>
  );
}
