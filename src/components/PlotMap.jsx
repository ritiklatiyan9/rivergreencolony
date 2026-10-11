import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Check, Expand, Grip, Minus, Plus, RotateCcw, Search, X } from 'lucide-react';
import PlotLayout, { MAP_HEIGHT, MAP_WIDTH } from '../data/plotLayout';
import PlotVehicles from '../data/plotVehicles';
import { normalizePlotNumber, PLOT_STATUSES, usePlotRecords, usePlotStoreState } from '../data/plotStore';
import './PlotMap.css';

const ExactLayout = memo(PlotLayout);
const vehicleOverlay = <PlotVehicles />;
const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const normalize = normalizePlotNumber;
const clampZoom = (value) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
const STATUS = PLOT_STATUSES;

// Booking requests go straight to the team's WhatsApp; nothing is stored here.
function BookingForm({ plot, status, phone }) {
  const [state, setState] = useState({ error: '', sent: false });
  const kind = plot.id.startsWith('S') ? 'shop' : 'plot';
  const sold = plot.status === 'SOLD';
  const submit = (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = data.get('name').trim();
    const raw = data.get('mobile').replace(/\D/g, '');
    const mobile = raw.length === 12 && raw.startsWith('91') ? raw.slice(2) : raw;
    if (!name || !/^[6-9]\d{9}$/.test(mobile)) { setState({ error: 'Please enter your name and a valid 10-digit Indian mobile number.', sent: false }); return; }
    const note = data.get('note').trim();
    const message = `Hello River Green team, I would like to ${sold ? 'enquire about a plot similar to' : 'book'} ${kind} ${plot.id} at River Green Colony, Shamli.\nName: ${name}\nMobile: +91 ${mobile}\nStatus on the website: ${status}${note ? `\nMessage: ${note}` : ''}\nPlease confirm availability, pricing and the next steps.`;
    window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    setState({ error: '', sent: true });
  };
  return <form className="plot-map-booking" onSubmit={submit}>
    <strong>{sold ? `${plot.id} is sold` : `Book ${kind} ${plot.id}`}</strong>
    {sold && <p>Send your details and the team will suggest similar plots.</p>}
    <label>Your name<input name="name" placeholder="Full name" autoComplete="name" required maxLength={80} /></label>
    <label>Mobile number<input name="mobile" type="tel" placeholder="10-digit mobile number" autoComplete="tel" required maxLength={17} /></label>
    <label>Message <span>(optional)</span><textarea name="note" rows={2} maxLength={300} placeholder="Best time to call, budget…" /></label>
    {state.error && <p className="plot-map-booking-error" role="alert">{state.error}</p>}
    {state.sent && <p className="plot-map-booking-sent" role="status"><Check size={14} /> WhatsApp opened with your request. Send it there to reach the team.</p>}
    <button type="submit" className="plot-map-enquire">Send on WhatsApp<ArrowUpRight size={16} /></button>
    <small>Sends to {phone} on WhatsApp.</small>
  </form>;
}

export default function PlotMap({ onEnquire, onSelectPlot, selectedPlotId, actionLabel, bookingPhone, className = '' }) {
  const viewportRef = useRef(null);
  const mapRef = useRef(null);
  const registryRef = useRef([]);
  const selectRef = useRef(null);
  const dragRef = useRef(null);
  const suppressClickRef = useRef(false);
  const pointerPositions = useRef(new Map());
  const pinchRef = useRef(null);
  const viewRef = useRef({ zoom: 1, x: 0, y: 0 });
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const [view, setView] = useState(viewRef.current);
  const [plotLabels, setPlotLabels] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState('');
  const [searchError, setSearchError] = useState('');
  const [dragging, setDragging] = useState(false);
  const availability = usePlotRecords();
  const availabilityState = usePlotStoreState();
  const [expanded, setExpanded] = useState(false);

  const publicPlots = useMemo(() => Object.fromEntries(availability.map((plot) => [normalize(plot.plot_number), plot])), [availability]);
  const selectedLayout = registryRef.current.find((plot) => plot.id === selectedId);
  const selectedPublic = selectedId ? publicPlots[normalize(selectedId)] : null;
  const selectedStatus = STATUS[selectedPublic?.status] || STATUS.UNKNOWN;
  const selected = selectedLayout ? { ...selectedLayout, ...selectedPublic, plot_number: selectedLayout.id, status: selectedPublic?.status || 'UNKNOWN' } : null;
  const fit = bounds.width && bounds.height ? Math.min((bounds.width - 24) / MAP_WIDTH, (bounds.height - 24) / MAP_HEIGHT) : 0.3;
  const scale = fit * view.zoom;

  const updateView = useCallback((next) => {
    setView((previous) => {
      const result = typeof next === 'function' ? next(previous) : next;
      viewRef.current = result;
      return result;
    });
  }, []);

  const reset = useCallback(() => updateView({ zoom: 1, x: 0, y: 0 }), [updateView]);
  const zoomAt = useCallback((nextZoom, point) => {
    updateView((current) => {
      const zoom = clampZoom(typeof nextZoom === 'function' ? nextZoom(current.zoom) : nextZoom);
      const rect = viewportRef.current?.getBoundingClientRect();
      const anchorX = point && rect ? point.x - rect.left - rect.width / 2 : 0;
      const anchorY = point && rect ? point.y - rect.top - rect.height / 2 : 0;
      const ratio = zoom / current.zoom;
      return { zoom, x: anchorX - (anchorX - current.x) * ratio, y: anchorY - (anchorY - current.y) * ratio };
    });
  }, [updateView]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(([entry]) => {
      setBounds({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const plots = [];
    map.querySelectorAll('.box-border').forEach((element) => {
      const labels = Array.from(element.children).filter((child) => child.tagName === 'SPAN');
      const text = labels[0]?.textContent?.trim() || '';
      // This is the same selector used by the original project map; landscaped
      // areas deliberately remain noninteractive.
      if (!/^(?:\(?[A-Z]{1,2}[.\-]?\d+(?:\.\d+)?\)?|\d+\.\d+)$/.test(text.toUpperCase())) return;
      const id = text.replace(/[()]/g, '').trim().toUpperCase();
      element.dataset.plotId = id;
      element.setAttribute('role', 'button');
      element.tabIndex = plots.length === 0 ? 0 : -1;
      element.style.backgroundColor = STATUS.UNKNOWN.color;
      element.style.borderColor = '#111111';
      labels.forEach((label) => { label.style.color = '#f5fff8'; });
      plots.push({ id, element, planLabels: [...new Set(labels.slice(1).map((label) => label.textContent?.trim()).filter(Boolean))] });
    });
    registryRef.current = plots;
    setPlotLabels(plots.map((plot) => plot.id));
  }, []);

  useEffect(() => {
    registryRef.current.forEach(({ id, element }) => {
      const state = STATUS[publicPlots[normalize(id)]?.status] || STATUS.UNKNOWN;
      element.style.backgroundColor = state.color;
      element.setAttribute('title', `${id} — ${state.label}`);
      element.setAttribute('aria-label', `${id.startsWith('S') ? 'Shop' : 'Plot'} ${id}, ${state.label}`);
      element.setAttribute('aria-pressed', String(id === selectedId));
      element.dataset.selected = String(id === selectedId);
      element.tabIndex = id === selectedId || (!selectedId && id === registryRef.current[0]?.id) ? 0 : -1;
    });
  }, [publicPlots, selectedId, plotLabels]);

  useEffect(() => {
    if (selectedPlotId === undefined) return;
    const match = plotLabels.find((id) => normalize(id) === normalize(selectedPlotId));
    setSelectedId(match || null);
  }, [selectedPlotId, plotLabels]);

  selectRef.current = (id, { locate = false } = {}) => {
    const plot = registryRef.current.find((item) => normalize(item.id) === normalize(id));
    if (!plot) return false;
    setSelectedId(plot.id);
    setSearchError('');
    onSelectPlot?.({ ...publicPlots[normalize(plot.id)], number: plot.id, id: plot.id, plot_number: plot.id });
    if (locate) {
      const mapBox = mapRef.current.getBoundingClientRect();
      const plotBox = plot.element.getBoundingClientRect();
      const currentScale = fit * viewRef.current.zoom;
      const localX = (plotBox.left + plotBox.width / 2 - mapBox.left) / currentScale;
      const localY = (plotBox.top + plotBox.height / 2 - mapBox.top) / currentScale;
      const zoom = Math.max(viewRef.current.zoom, 2.6);
      updateView({ zoom, x: (MAP_WIDTH / 2 - localX) * fit * zoom, y: (MAP_HEIGHT / 2 - localY) * fit * zoom });
      plot.element.focus({ preventScroll: true });
    }
    return true;
  };

  const handleMapClick = useCallback((event) => {
    if (suppressClickRef.current) { suppressClickRef.current = false; return; }
    const plot = event.target.closest('[data-plot-id]');
    if (plot && mapRef.current?.contains(plot)) selectRef.current?.(plot.dataset.plotId);
  }, []);

  const handlePlotKey = useCallback((event) => {
    const plot = event.target.closest('[data-plot-id]');
    if (!plot) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); event.stopPropagation(); selectRef.current?.(plot.dataset.plotId);
    } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault(); event.stopPropagation();
      const plots = registryRef.current;
      const index = plots.findIndex((item) => item.id === plot.dataset.plotId);
      const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
      const next = plots[(index + direction + plots.length) % plots.length];
      plots.forEach((item) => { item.element.tabIndex = item === next ? 0 : -1; });
      next.element.focus({ preventScroll: true });
    }
  }, []);

  const viewportKey = (event) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomAt((zoom) => zoom * 1.25); }
    else if (event.key === '-') { event.preventDefault(); zoomAt((zoom) => zoom / 1.25); }
    else if (event.key === '0' || event.key.toLowerCase() === 'r') { event.preventDefault(); reset(); }
    else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      updateView((current) => ({ ...current, x: current.x + (event.key === 'ArrowLeft' ? 50 : event.key === 'ArrowRight' ? -50 : 0), y: current.y + (event.key === 'ArrowUp' ? 50 : event.key === 'ArrowDown' ? -50 : 0) }));
    }
  };

  useEffect(() => {
    const viewport = viewportRef.current;
    const wheel = (event) => {
      // Ordinary wheel scrolling continues through the page. Ctrl/⌘ + wheel
      // zooms the drawing around the cursor, without changing browser zoom.
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      zoomAt((zoom) => zoom * Math.exp(-event.deltaY * 0.006), { x: event.clientX, y: event.clientY });
    };
    viewport?.addEventListener('wheel', wheel, { passive: false });
    return () => viewport?.removeEventListener('wheel', wheel);
  }, [zoomAt]);

  const pointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pointerPositions.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    suppressClickRef.current = false;
    if (pointerPositions.current.size === 1) dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, view: viewRef.current, moved: false };
    if (pointerPositions.current.size === 2) {
      const [a, b] = [...pointerPositions.current.values()];
      pinchRef.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom: viewRef.current.zoom };
      suppressClickRef.current = true;
    }
  };

  const pointerMove = (event) => {
    if (!pointerPositions.current.has(event.pointerId)) return;
    pointerPositions.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointerPositions.current.size === 2 && pinchRef.current) {
      const [a, b] = [...pointerPositions.current.values()];
      zoomAt(pinchRef.current.zoom * Math.hypot(a.x - b.x, a.y - b.y) / pinchRef.current.distance, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      setDragging(true);
    } else if (dragRef.current?.id === event.pointerId) {
      const drag = dragRef.current;
      const x = event.clientX - drag.x;
      const y = event.clientY - drag.y;
      if (Math.hypot(x, y) > 5) {
        drag.moved = true;
        suppressClickRef.current = true;
        setDragging(true);
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.setPointerCapture(event.pointerId);
      }
      if (drag.moved) updateView({ ...drag.view, x: drag.view.x + x, y: drag.view.y + y });
    }
  };

  const pointerUp = (event) => {
    pointerPositions.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    pinchRef.current = null;
    dragRef.current = null;
    setDragging(false);
    setTimeout(() => { suppressClickRef.current = false; }, 50);
  };

  const search = (event) => {
    event.preventDefault();
    if (!selectRef.current?.(query, { locate: true })) setSearchError('This number is not shown on the official layout. Try A-2, B-3 or C-19.');
  };

  const enquire = () => {
    if (!selected) return;
    const { element, ...details } = selected;
    if (expanded) setExpanded(false);
    if (onEnquire) onEnquire({ ...details, number: selected.id });
    else window.open(`https://wa.me/919927669955?text=${encodeURIComponent(`Hello Defence Garden, I’m interested in ${selected.id.startsWith('S') ? 'shop' : 'plot'} ${selected.id} at River Green Colony, Shamli. Please share its current availability, dimensions and pricing, and arrange a site visit.`)}`, '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    const previouslyFocused = document.activeElement;
    document.body.style.overflow = 'hidden';
    const container = viewportRef.current?.closest('.plot-map');
    container?.querySelector('.plot-map-expand')?.focus();
    const key = (event) => {
      if (event.key === 'Escape') setExpanded(false);
      if (event.key !== 'Tab') return;
      const focusable = Array.from(container?.querySelectorAll('button:not([disabled]), input, a[href], [tabindex="0"]') || []);
      if (!focusable.length) return;
      if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1).focus(); }
      else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0].focus(); }
    };
    document.addEventListener('keydown', key);
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', key); previouslyFocused?.focus?.(); };
  }, [expanded]);

  return <div className={`plot-map ${className} ${expanded ? 'plot-map-expanded' : ''}`} role={expanded ? 'dialog' : undefined} aria-modal={expanded ? 'true' : undefined} aria-label="Official River Green project layout">
    <div className="plot-map-toolbar">
      <div className="plot-map-title"><span /><strong>THE OFFICIAL LAYOUT</strong><small>RIVER GREEN, SHAMLI</small></div>
      <button type="button" className="plot-map-expand" aria-label={expanded ? 'Close expanded map' : 'Expand layout map'} aria-pressed={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? <X size={16} /> : <Expand size={16} />}<span>{expanded ? 'Close' : 'Expand'}</span></button>
    </div>
    <div className="plot-map-body">
      <div className="plot-map-drawing">
        <div ref={viewportRef} className={`plot-map-viewport ${dragging ? 'is-dragging' : ''}`} data-lenis-prevent-touch tabIndex={0} role="region" aria-label="Interactive project map. Drag to pan. Use plus and minus to zoom, R to reset. Arrow keys navigate plots when a plot is focused." onKeyDown={viewportKey} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}>
          <div className="plot-map-transform" style={{ width: MAP_WIDTH, height: MAP_HEIGHT, transform: `translate(${bounds.width / 2 - MAP_WIDTH * scale / 2 + view.x}px, ${bounds.height / 2 - MAP_HEIGHT * scale / 2 + view.y}px) scale(${scale})` }}>
            <ExactLayout mapRef={mapRef} onClick={handleMapClick} onKeyDown={handlePlotKey} overlay={vehicleOverlay} />
          </div>
        </div>
        <div className="plot-map-zoom" aria-label="Map controls">
          <button type="button" aria-label="Zoom in on layout" disabled={view.zoom >= MAX_ZOOM} onClick={() => zoomAt((zoom) => zoom * 1.3)}><Plus size={18} /></button>
          <span aria-live="polite">{Math.round(view.zoom * 100)}%</span>
          <button type="button" aria-label="Zoom out of layout" disabled={view.zoom <= MIN_ZOOM} onClick={() => zoomAt((zoom) => zoom / 1.3)}><Minus size={18} /></button>
          <button type="button" aria-label="Reset layout view" onClick={reset}><RotateCcw size={15} /></button>
        </div>
        <div className="plot-map-hint"><Grip size={13} /><span>Drag to explore · Pinch or + / − to zoom</span></div>
      </div>
      <aside className="plot-map-sidebar" aria-label="Plot information">
        <form className="plot-map-search" onSubmit={search}>
          <label htmlFor="plot-map-search">FIND YOUR SPACE</label>
          <div><Search size={15} /><input id="plot-map-search" value={query} onChange={(event) => { setQuery(event.target.value); setSearchError(''); }} placeholder="Plot no. e.g. A-2" list="river-green-plot-numbers" aria-describedby={searchError ? 'plot-map-search-error' : undefined} /><button type="submit" aria-label="Find plot on map"><ArrowUpRight size={18} /></button></div>
          <datalist id="river-green-plot-numbers">{plotLabels.map((id) => <option key={id} value={id} />)}</datalist>
          {searchError && <p id="plot-map-search-error" className="plot-map-error" role="alert">{searchError}</p>}
        </form>
        <div className="plot-map-details" aria-live="polite">
          {selected ? <>
            <div className="plot-map-detail-heading"><span>{selected.id.startsWith('S') ? 'COMMERCIAL SPACE' : 'YOUR SELECTED PLOT'}</span><button type="button" onClick={() => setSelectedId(null)} aria-label="Clear selected plot"><X size={16} /></button></div>
            <h3>{selected.id.startsWith('S') ? 'Shop' : 'Plot'} <em>{selected.id}</em></h3>
            <div className="plot-map-status"><i style={{ background: selectedStatus.color }} />{selectedStatus.label}</div>
            {/* The booking form opens right under the plot name; details follow. */}
            {bookingPhone && <BookingForm key={selected.id} plot={selected} status={selectedStatus.label} phone={bookingPhone} />}
            <dl>
              {selected.dimensions && <div><dt>Listed dimensions</dt><dd>{selected.dimensions.replace(/\*/g, ' × ')}</dd></div>}
              {selected.area_sqft && <div><dt>Listed area</dt><dd>{Number(selected.area_sqft).toLocaleString('en-IN')} sq ft</dd></div>}
              {selected.area_sqm && <div><dt>Area in sq m</dt><dd>{Number(selected.area_sqm).toLocaleString('en-IN')} sq m</dd></div>}
              {selected.facing && <div><dt>Facing</dt><dd>{selected.facing}</dd></div>}
              {selected.block && <div><dt>Block</dt><dd>{selected.block}</dd></div>}
              {selected.total_price && <div><dt>Listed price</dt><dd>₹{Number(selected.total_price).toLocaleString('en-IN')}</dd></div>}
              {selected.price_per_sqft && <div><dt>Price per sq ft</dt><dd>₹{Number(selected.price_per_sqft).toLocaleString('en-IN')}</dd></div>}
              {selected.planLabels.length > 0 && <div><dt>Plan edge labels</dt><dd>{selected.planLabels.join(' / ')}</dd></div>}
            </dl>
            {selected.notes && <p className="plot-map-public-note">{selected.notes}</p>}
            {!bookingPhone && <>
              <p className="plot-map-confirm">The team can confirm this space’s latest availability, measurements and pricing.</p>
              <button type="button" className="plot-map-enquire" onClick={enquire}>{actionLabel || `Enquire about ${selected.id}`}<ArrowUpRight size={16} /></button>
            </>}
          </> : <>
            <div className="plot-map-empty-mark" aria-hidden="true"><span /><span /><span /><span /></div>
            <h3>Choose your<br /><em>plot.</em></h3>
            <p>Select a plot on the map to see its details and book it, or search by its number.</p>
          </>}
        </div>
        <div className="plot-map-legend"><span>AVAILABILITY</span><div>{Object.entries(STATUS).map(([key, state]) => <div key={key}><i style={{ background: state.color }} />{state.label}</div>)}</div></div>
        <div className="plot-map-source"><Check size={12} /><p>{availabilityState.serverConnected && availabilityState.updatedAt ? 'Project availability synced.' : availabilityState.source === 'public' ? 'Public availability checked on opening.' : 'Public snapshot · 7 October 2026.'}<br />Contact the team for live availability.</p></div>
      </aside>
    </div>
    <div className="plot-map-foot"><span>Original plot numbers, roads & layout from Defence Garden.</span><a href="https://defencegarden.com/project/1" target="_blank" rel="noreferrer">View official project<ArrowUpRight size={13} /></a></div>
  </div>;
}
