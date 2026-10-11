import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Check, Download, Eye, LockKeyhole, LogOut, MapPin, RefreshCw, Save, Search, ShieldCheck, Upload, X } from 'lucide-react';
import PlotMap from './PlotMap';
import { discardAllPlotUpdates, discardPlotUpdate, exportPlotOverrides, getAdminSession, getPlotRecords, importPlotOverrides, loginPlotManager, logoutPlotManager, normalizePlotNumber, PLOT_FIELDS, PLOT_STATUSES, refreshPlotRecords, resetPlotRecord, saveAllPlotUpdates, savePlotRecord, setupPlotManager, stagePlotUpdate, usePlotRecords, usePlotStoreState } from '../data/plotStore';
import './PlotManager.css';

const fieldsForForm = (record) => Object.fromEntries(PLOT_FIELDS.map((field) => [field, record?.[field] ?? (field === 'status' ? 'UNKNOWN' : '')]));

export default function PlotManager() {
  useEffect(() => {
    const previousTitle = document.title;
    const existing = document.head.querySelector('meta[name="robots"]');
    const previousRobots = existing?.content;
    const robots = existing || document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex, nofollow';
    if (!existing) document.head.appendChild(robots);
    document.title = 'River Green — Plot Management';
    return () => {
      document.title = previousTitle;
      if (existing) robots.content = previousRobots;
      else robots.remove();
    };
  }, []);
  const records = usePlotRecords();
  const store = usePlotStoreState();
  const [session, setSession] = useState({ loading: true, authenticated: false, setupRequired: false, canSetup: false });
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [authError, setAuthError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState('A-2');
  const selectedRef = useRef(selectedNumber);
  selectedRef.current = selectedNumber;
  const draftNumberRef = useRef(null);
  const [draft, setDraft] = useState(fieldsForForm());
  const [formDirty, setFormDirty] = useState(false);
  const [formError, setFormError] = useState('');
  const [message, setMessage] = useState('');
  const [autoSave, setAutoSave] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [showMap, setShowMap] = useState(false);
  const importRef = useRef(null);
  const editorRef = useRef(null);
  const selected = records.find((record) => record.number === selectedNumber);
  const counts = useMemo(() => records.reduce((result, record) => ({ ...result, [record.status]: (result[record.status] || 0) + 1 }), {}), [records]);
  const filtered = useMemo(() => records.filter((record) => (filter === 'ALL' || record.status === filter) && (!query || normalizePlotNumber(record.number).includes(normalizePlotNumber(query)) || `${record.block} ${record.facing}`.toLowerCase().includes(query.toLowerCase()))), [records, query, filter]);

  useEffect(() => {
    let active = true;
    getAdminSession().then((data) => {
      if (typeof data.authenticated !== 'boolean') throw new Error('Start the project server to open the plot manager.');
      if (active) setSession({ ...data, loading: false });
    }).catch((error) => { if (active) { setAuthError(error.message); setSession((current) => ({ ...current, loading: false })); } });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selected) return;
    const activeInput = typeof document !== 'undefined' && editorRef.current?.contains(document.activeElement) && document.activeElement?.matches('input, textarea, select');
    if (draftNumberRef.current !== selectedNumber || (!formDirty && !selected.isPending && !activeInput)) {
      draftNumberRef.current = selectedNumber;
      setDraft(fieldsForForm(selected));
      setFormDirty(false);
      setFormError('');
    }
  }, [selected, selectedNumber, formDirty]);

  useEffect(() => {
    if (!session.authenticated || !autoSave || !store.pendingCount || store.saving || store.error || formError) return;
    const timer = setTimeout(() => {
      saveAllPlotUpdates().then(() => {
        if (!getPlotRecords().find((record) => record.number === selectedRef.current)?.isPending) setFormDirty(false);
        setMessage('Saved. The website now shows your changes.');
      }).catch((error) => {
        setFormError(error.message);
        if (error.status === 401) setSession((current) => ({ ...current, authenticated: false }));
      });
    }, 650);
    return () => clearTimeout(timer);
  }, [session.authenticated, autoSave, store.revision, store.pendingCount, store.saving, store.error, formError]);

  async function authenticate(event) {
    event.preventDefault();
    setAuthError('');
    if (session.setupRequired && password !== confirmation) { setAuthError('The passwords do not match.'); return; }
    setBusy(true);
    try {
      await (session.setupRequired ? setupPlotManager(password) : loginPlotManager(password));
      const next = await getAdminSession();
      setSession({ ...next, loading: false });
      setPassword(''); setConfirmation('');
      refreshPlotRecords();
    } catch (error) { setAuthError(error.message); }
    finally { setBusy(false); }
  }

  async function run(action, successMessage) {
    setBusy(true); setFormError(''); setMessage('');
    try {
      const result = await action();
      setMessage(typeof successMessage === 'function' ? successMessage(result) : successMessage);
      return result;
    } catch (error) {
      setFormError(error.message);
      if (error.status === 401) { setAuthError('Sign in again to save your changes.'); setSession((current) => ({ ...current, authenticated: false })); }
      return null;
    } finally { setBusy(false); }
  }

  function change(field, value) {
    const next = { ...draft, [field]: value };
    setDraft(next); setFormDirty(true); setMessage('');
    try { stagePlotUpdate(selectedNumber, next); setFormError(''); }
    catch (error) { setFormError(error.message); }
  }

  async function save(event) {
    event.preventDefault();
    const result = await run(async () => { stagePlotUpdate(selectedNumber, draft); return savePlotRecord(selectedNumber); }, `Plot ${selectedNumber} saved for all visitors.`);
    if (result) setFormDirty(false);
  }

  function choose(number) {
    setSelectedNumber(number); setMessage('');
  }

  function discard() {
    discardPlotUpdate(selectedNumber);
    setDraft(fieldsForForm(getPlotRecords().find((record) => record.number === selectedNumber)));
    setFormDirty(false); setFormError(''); setMessage('Unsaved changes discarded.');
  }

  async function revert() {
    const result = await run(async () => { await resetPlotRecord(selectedNumber); return true; }, `Plot ${selectedNumber} now uses its original public listing.`);
    if (result) { setFormDirty(false); setDraft(fieldsForForm(getPlotRecords().find((record) => record.number === selectedNumber))); }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(exportPlotOverrides(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `river-green-plots-${new Date().toISOString().slice(0, 10)}.json`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function importJson(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const result = await run(async () => {
      if (file.size > 1000000) throw new Error('Choose a plot JSON file smaller than 1 MB.');
      let data;
      try { data = JSON.parse(await file.text()); } catch { throw new Error('The selected file is not valid JSON.'); }
      return importPlotOverrides(data);
    }, (count) => `${count} plot ${count === 1 ? 'record' : 'records'} imported and saved for all visitors.`);
    if (result != null) { setFormDirty(false); setDraft(fieldsForForm(getPlotRecords().find((record) => record.number === selectedNumber))); }
  }

  async function logout() {
    await run(async () => {
      if (store.pendingCount) await saveAllPlotUpdates();
      await logoutPlotManager();
      discardAllPlotUpdates();
      setSession((current) => ({ ...current, authenticated: false }));
      setFormDirty(false);
    }, '');
  }

  const saveLabel = store.saving ? 'Saving to project server…' : store.pendingCount ? `${store.pendingCount} ${store.pendingCount === 1 ? 'plot has' : 'plots have'} unsaved changes` : store.updatedAt ? 'All changes saved to the project server' : 'Ready to update the project';

  if (!session.authenticated) return <main className="plot-manager plot-manager-auth">
    <div className="pm-auth-brand">River Green<small>SHAMLI · PROJECT MANAGEMENT</small></div>
    <div className="pm-auth-card">
      <div className="pm-auth-symbol"><LockKeyhole size={22} /></div>
      <span className="pm-eyebrow">PLOT MANAGEMENT</span>
      <h1>{session.loading ? 'Opening the manager.' : session.setupRequired ? 'Set up your access.' : 'Welcome back.'}</h1>
      <p>{session.loading ? 'Checking the project server…' : session.setupRequired ? 'Create your manager password to begin updating the River Green plot plan.' : 'Sign in to update plot availability and public details.'}</p>
      {!session.loading && (!session.setupRequired || session.canSetup) && <form onSubmit={authenticate}>
        <label>{session.setupRequired ? 'Create a password' : 'Your password'}<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={session.setupRequired ? 'new-password' : 'current-password'} minLength={session.setupRequired ? 12 : undefined} maxLength={256} required /></label>
        {session.setupRequired && <><small className="pm-password-hint">Use at least 12 characters.</small><label>Confirm password<input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" minLength={12} maxLength={256} required /></label></>}
        {authError && <p className="pm-feedback pm-feedback-error" role="alert">{authError}</p>}
        <button className="pm-button pm-button-gold" disabled={busy} type="submit">{busy ? 'Please wait…' : session.setupRequired ? 'Create manager access' : 'Sign in'}<ArrowUpRight size={16} /></button>
      </form>}
      {!session.loading && session.setupRequired && !session.canSetup && <p className="pm-feedback pm-feedback-error">Complete the initial manager setup on the project server before signing in.</p>}
      <div className="pm-auth-note"><ShieldCheck size={13} /><span>Your saved updates are shared with all website visitors.</span></div>
    </div>
  </main>;

  return <main className="plot-manager">
    <header className="pm-header"><div className="pm-header-brand">River Green<small>PROJECT MANAGEMENT</small></div><div><a href="/" target="_blank" rel="noreferrer"><Eye size={15} /><span>View website</span><ArrowUpRight size={13} /></a><button type="button" disabled={busy || store.saving} onClick={logout}><LogOut size={15} /><span>Sign out</span></button></div></header>
    <div className="pm-content">
      <div className="pm-intro"><div><span className="pm-eyebrow">THE ORIGINAL 200-SPACE LAYOUT</span><h1>Manage the <em>plot plan.</em></h1><p>Update availability, dimensions and public details. Saved changes appear on the website’s 2D and 3D maps.</p></div><div className={`pm-save-status ${store.pendingCount ? 'is-pending' : ''}`} aria-live="polite">{store.saving ? <RefreshCw size={14} className="pm-spinning" /> : <Check size={14} />}<span>{saveLabel}</span></div></div>
      <div className="pm-summary"><button type="button" className={filter === 'ALL' ? 'active' : ''} onClick={() => setFilter('ALL')}><small>ALL SPACES</small><strong>{records.length}</strong></button>{Object.entries(PLOT_STATUSES).map(([key, state]) => <button type="button" className={filter === key ? 'active' : ''} key={key} onClick={() => setFilter(key)}><small><i style={{ background: state.color }} />{state.label.toUpperCase()}</small><strong>{counts[key] || 0}</strong></button>)}</div>
      <div className="pm-tools"><label className="pm-auto-save"><input type="checkbox" checked={autoSave} onChange={(event) => { setAutoSave(event.target.checked); setFormError(''); if (event.target.checked && selected?.isPending) stagePlotUpdate(selectedNumber, draft); }} /><span>Auto-save</span><small>Saved on the project server</small></label><div><button type="button" onClick={() => setShowMap(!showMap)} aria-expanded={showMap} aria-controls="pm-map-preview"><MapPin size={14} />{showMap ? 'Hide map' : 'Show map'}</button><button type="button" disabled={busy} onClick={() => run(() => refreshPlotRecords({ refreshSource: true }), 'Availability refreshed.')}><RefreshCw size={14} />Refresh</button><button type="button" onClick={exportJson}><Download size={14} />Export JSON</button><button type="button" disabled={busy || store.saving} onClick={() => importRef.current?.click()}><Upload size={14} />Import JSON</button><input ref={importRef} type="file" accept="application/json,.json" hidden onChange={importJson} /></div></div>
      {(formError || store.error || message) && <div className={`pm-feedback ${formError || store.error ? 'pm-feedback-error' : 'pm-feedback-success'}`} role={formError || store.error ? 'alert' : 'status'}>{formError || store.error || message}</div>}
      <div className="pm-workspace">
        <aside className="pm-plot-list" aria-label="Choose a plot to edit"><div className="pm-list-search"><Search size={15} /><input aria-label="Search plot numbers" placeholder="Search plot no. or facing" value={query} onChange={(event) => setQuery(event.target.value)} />{query && <button type="button" aria-label="Clear plot search" onClick={() => setQuery('')}><X size={14} /></button>}</div><div className="pm-list-heading"><span>{filter === 'ALL' ? 'ALL PLOTS & SHOPS' : PLOT_STATUSES[filter].label.toUpperCase()}</span><small>{filtered.length} spaces</small></div><div className="pm-list-scroll">{filtered.map((record) => <button type="button" key={record.number} className={`pm-plot-row ${selectedNumber === record.number ? 'selected' : ''}`} aria-current={selectedNumber === record.number ? 'true' : undefined} onClick={() => choose(record.number)}><i style={{ background: PLOT_STATUSES[record.status].color }} /><span><strong>{record.number.startsWith('S') ? 'Shop' : 'Plot'} {record.number}</strong><small>{record.dimensions || PLOT_STATUSES[record.status].label}</small></span>{record.isPending ? <span className="pm-unsaved-dot" title="Unsaved changes" /> : record.hasOverride ? <Check size={12} /> : <ArrowUpRight size={12} />}</button>)}{filtered.length === 0 && <p className="pm-list-empty">No plot matches this search.</p>}</div></aside>
        <section ref={editorRef} className="pm-editor" aria-labelledby="pm-editor-title">
          <div className="pm-editor-heading"><div><span className="pm-eyebrow">{selectedNumber.startsWith('S') ? 'COMMERCIAL SPACE' : 'PLOT DETAILS'}</span><h2 id="pm-editor-title">{selectedNumber.startsWith('S') ? 'Shop' : 'Plot'} <em>{selectedNumber}</em></h2></div><span className="pm-editor-badge"><i style={{ background: PLOT_STATUSES[draft.status]?.color || PLOT_STATUSES.UNKNOWN.color }} />{PLOT_STATUSES[draft.status]?.label || 'Confirm availability'}</span></div>
          <form onSubmit={save}>
            <fieldset disabled={busy}>
              <legend className="pm-form-legend">Availability</legend><div className="pm-status-options">{Object.entries(PLOT_STATUSES).map(([key, state]) => <label key={key} className={draft.status === key ? 'selected' : ''}><input type="radio" name="plot-status" checked={draft.status === key} onChange={() => change('status', key)} value={key} /><i style={{ background: state.color }} /><span>{state.label}</span></label>)}</div>
              <div className="pm-field-grid"><label>Dimensions<input value={draft.dimensions} placeholder="e.g. 30 × 60 ft" maxLength={120} onChange={(event) => change('dimensions', event.target.value)} /></label><label>Facing<select value={draft.facing} onChange={(event) => change('facing', event.target.value)}><option value="">Not specified</option>{['North', 'South', 'East', 'West', 'North-East', 'North-West', 'South-East', 'South-West'].map((direction) => <option key={direction}>{direction}</option>)}{draft.facing && !['North', 'South', 'East', 'West', 'North-East', 'North-West', 'South-East', 'South-West'].includes(draft.facing) && <option>{draft.facing}</option>}</select></label><label>Area · sq ft<input type="number" min="0" max="1000000000" step="any" value={draft.area_sqft} onChange={(event) => change('area_sqft', event.target.value)} placeholder="Not specified" /></label><label>Area · sq m<input type="number" min="0" max="1000000000" step="any" value={draft.area_sqm} onChange={(event) => change('area_sqm', event.target.value)} placeholder="Not specified" /></label><label>Block<input value={draft.block} maxLength={40} onChange={(event) => change('block', event.target.value)} placeholder="Not specified" /></label><label>Space type<select value={draft.plot_type} onChange={(event) => change('plot_type', event.target.value)}><option value="RESIDENTIAL">Residential plot</option><option value="COMMERCIAL">Commercial / shop</option><option value="">Not specified</option>{draft.plot_type && !['RESIDENTIAL', 'COMMERCIAL'].includes(draft.plot_type) && <option value={draft.plot_type}>{draft.plot_type}</option>}</select></label><label>Total price · ₹ <span>(optional)</span><input type="number" min="0" max="1000000000000" step="any" value={draft.total_price} onChange={(event) => change('total_price', event.target.value)} placeholder="Not listed" /></label><label>Price per sq ft · ₹ <span>(optional)</span><input type="number" min="0" max="1000000000000" step="any" value={draft.price_per_sqft} onChange={(event) => change('price_per_sqft', event.target.value)} placeholder="Not listed" /></label><label className="pm-wide-field">Public notes <span>(visible on the website)</span><textarea value={draft.notes} maxLength={1000} rows={4} onChange={(event) => change('notes', event.target.value)} placeholder="Project information about this space" /><small>{draft.notes.length} / 1000</small></label></div>
            </fieldset>
            {selected?.planLabels?.length > 0 && <div className="pm-plan-labels"><MapPin size={13} /><span>Original plan edge labels: <strong>{selected.planLabels.join(' / ')}</strong></span></div>}
            <div className="pm-editor-actions"><div><button type="button" className="pm-text-button" disabled={busy || store.saving || !selected?.hasOverride} onClick={revert}>Revert to source</button><button type="button" className="pm-text-button" disabled={busy || store.saving || (!selected?.isPending && !formDirty)} onClick={discard}>Discard unsaved</button></div><button type="submit" className="pm-button pm-button-ink" disabled={busy || store.saving}><Save size={15} />{store.saving ? 'Saving…' : 'Save plot'}</button></div>
          </form>
          <div className="pm-server-note"><ShieldCheck size={13} /><span>Saved changes are persistent and shown to all visitors. The original plot geometry stays the same.</span></div>
        </section>
      </div>
      {showMap && <section id="pm-map-preview" className="pm-map-preview"><div><span className="pm-eyebrow">LIVE WEBSITE PREVIEW</span><h2>Your changes, <em>on the map.</em></h2><p>Choose any space on the map to edit it above.</p></div><PlotMap selectedPlotId={selectedNumber} onSelectPlot={(plot) => choose(plot.number)} actionLabel="Edit this plot" onEnquire={(plot) => { choose(plot.number); editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} /></section>}
      <footer className="pm-footer"><span>RIVER GREEN COLONY · SHAMLI</span><span>200 original spaces · {records.filter((record) => record.hasOverride).length} saved updates</span>{store.updatedAt && <span>Last saved {new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(store.updatedAt))}</span>}</footer>
    </div>
  </main>;
}
