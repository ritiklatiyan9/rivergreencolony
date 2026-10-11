import { useSyncExternalStore } from 'react';
import manifest from './plotIds.json';
import planGeometry from './threePlotGeometry.json';
import { bookingAvailabilityRecord } from './bookingAvailability';

export const PLOT_STATUSES = {
  AVAILABLE: { label: 'Company', color: '#0b9d58' },
  RESERVED: { label: 'Booked', color: '#f5c518' },
  SOLD: { label: 'Registry', color: '#d33a2f' },
  UNKNOWN: { label: 'Confirm availability', color: '#788f77' },
};
export const PLOT_FIELDS = ['status', 'dimensions', 'area_sqft', 'area_sqm', 'facing', 'block', 'plot_type', 'total_price', 'price_per_sqft', 'notes'];
export const normalizePlotNumber = (value = '') => String(value).replace(/[()\s.\-]/g, '').toUpperCase();
const numbers = new Map(manifest.plotIds.map((number) => [normalizePlotNumber(number), number]));
const publicFields = [...PLOT_FIELDS.filter((field) => field !== 'notes'), 'bookable', 'held', 'accounting_status', 'area_sqyd'];
const numericFields = ['area_sqft', 'area_sqm', 'total_price', 'price_per_sqft'];
const fieldLimits = { dimensions: 120, facing: 80, block: 40, plot_type: 80, notes: 1000 };
const listeners = new Set();
const saves = new Map();
let source = [];
let overrides = {};
let pending = {};
let records = [];
let loadPromise;
let refreshTimer;
let broadcast;
let state = { revision: 0, source: 'booking', serverConnected: false, updatedAt: null, pendingCount: 0, saving: false, error: '', bookingConfig: null, statusDisplayEnabled: false };

const safeSourceRecord = (plot) => Object.fromEntries(['plot_number', ...publicFields].filter((key) => plot[key] != null).map((key) => [key, plot[key]]));
const canonicalNumber = (value) => numbers.get(normalizePlotNumber(value));
const newerTimestamp = (next, previous) => !previous || (next && new Date(next).getTime() >= new Date(previous).getTime()) ? next : previous;

function sanitizeDetails(value, requireNumber = false) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Each plot record must be an object.');
  const number = canonicalNumber(value.plot_number || value.number || value.id);
  if (requireNumber && !number) throw new Error('A plot number does not match the official 200-plot layout.');
  const result = number ? { plot_number: number } : {};
  for (const field of PLOT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(value, field)) continue;
    if (field === 'status') {
      const status = String(value.status).toUpperCase();
      if (!PLOT_STATUSES[status]) throw new Error('Status must be available, reserved, sold or confirm availability.');
      result.status = status;
      continue;
    }
    const text = value[field] == null ? '' : String(value[field]).trim();
    if (numericFields.includes(field) && text && (!Number.isFinite(Number(text)) || Number(text) < 0)) throw new Error('Areas and prices must be nonnegative numbers.');
    if (numericFields.includes(field) && text && Number(text) > (field.startsWith('area_') ? 1e9 : 1e12)) throw new Error('An area or price exceeds the permitted maximum.');
    if (text.length > (fieldLimits[field] || 120)) throw new Error(`${field === 'notes' ? 'Public notes' : 'A plot detail'} is too long.`);
    result[field] = text;
  }
  return result;
}

function indexOverrides(items) {
  return Object.fromEntries((items || []).filter((plot) => canonicalNumber(plot.plot_number)).map((plot) => {
    const clean = sanitizeDetails(plot, true);
    if (plot.updated_at) clean.updated_at = plot.updated_at;
    return [clean.plot_number, clean];
  }));
}

function rebuild(changes = {}) {
  const publicIndex = Object.fromEntries(source.filter((plot) => canonicalNumber(plot.plot_number)).map((plot) => [canonicalNumber(plot.plot_number), safeSourceRecord(plot)]));
  records = PLOT_METADATA.map((metadata) => {
    const number = metadata.number;
    const record = { ...metadata, plot_number: number, status: 'UNKNOWN', bookable: false, held: false, dimensions: '', area_sqft: '', area_sqm: '', facing: '', block: '', plot_type: number.startsWith('S') ? 'COMMERCIAL' : 'RESIDENTIAL', total_price: '', price_per_sqft: '', notes: '', ...publicIndex[number] };
    if (!PLOT_STATUSES[record.status]) record.status = 'UNKNOWN';
    return { ...record, id: number, number, hasOverride: Boolean(overrides[number]), isPending: Boolean(pending[number]) };
  });
  state = { ...state, ...changes, revision: state.revision + 1, pendingCount: Object.keys(pending).length };
  listeners.forEach((callback) => callback());
}

async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(22000), ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    const error = new Error(data.message || data.error || 'The project server is unavailable.');
    error.status = response.status;
    throw error;
  }
  return data;
}

function announceSave() {
  try {
    broadcast?.postMessage({ type: 'plots-updated' });
    localStorage.setItem('river-green-plots-updated', String(Date.now()));
  } catch { /* The server remains authoritative when browser storage is disabled. */ }
}

export async function refreshPlotRecords({ refreshSource = false } = {}) {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const [config, data] = await Promise.all([api('/api/booking/config'), api('/api/booking/plots')]);
      if (!Array.isArray(data.plots)) throw new Error('Plot availability could not be loaded.');
      source = data.plots.map(plot => safeSourceRecord(bookingAvailabilityRecord(plot, Boolean(config.status_display_enabled && data.status_display_enabled))));
      overrides = {}; pending = {};
      rebuild({ serverConnected: true, updatedAt: data.updated_at || new Date().toISOString(), bookingConfig: config, statusDisplayEnabled: Boolean(config.status_display_enabled), error: '' });
    } catch (error) {
      source = []; overrides = {}; pending = {};
      rebuild({ serverConnected: false, bookingConfig: null, statusDisplayEnabled: false, error: error.message || 'The booking service is unavailable.' });
    }
    return records;
  })().finally(() => { loadPromise = null; });
  return loadPromise;
}

function startRefresh() {
  if (typeof window === 'undefined') return;
  refreshPlotRecords();
  if (!refreshTimer) refreshTimer = setInterval(() => { if (!document.hidden) refreshPlotRecords(); }, 5000);
  if (!broadcast && 'BroadcastChannel' in window) {
    broadcast = new BroadcastChannel('river-green-plot-records');
    broadcast.onmessage = () => refreshPlotRecords();
  }
}

export function subscribePlotRecords(callback) {
  listeners.add(callback);
  startRefresh();
  return () => {
    listeners.delete(callback);
    if (!listeners.size) {
      if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
      if (broadcast) { broadcast.close(); broadcast = null; }
    }
  };
}

export const getPlotRecords = () => records;
export const getPlotStoreState = () => state;
export function usePlotRecords() { return useSyncExternalStore(subscribePlotRecords, getPlotRecords, getPlotRecords); }
export function usePlotStoreState() { return useSyncExternalStore(subscribePlotRecords, getPlotStoreState, getPlotStoreState); }

export function stagePlotUpdate(number, patch) {
  const canonical = canonicalNumber(number);
  if (!canonical) throw new Error('Choose a plot from the official layout.');
  const clean = sanitizeDetails(patch);
  delete clean.plot_number;
  pending = { ...pending, [canonical]: { ...pending[canonical], ...clean, plot_number: canonical } };
  rebuild({ error: '' });
}

export function discardPlotUpdate(number) {
  const canonical = canonicalNumber(number);
  const next = { ...pending };
  delete next[canonical];
  pending = next;
  rebuild({ error: '' });
}

export function discardAllPlotUpdates() { pending = {}; rebuild({ error: '' }); }

export async function savePlotRecord(number) {
  const canonical = canonicalNumber(number);
  if (!canonical) throw new Error('Choose a plot from the official layout.');
  if (saves.has(canonical)) {
    await saves.get(canonical);
    return pending[canonical] ? savePlotRecord(canonical) : records.find((plot) => plot.number === canonical);
  }
  if (!pending[canonical]) return records.find((plot) => plot.number === canonical);
  const captured = pending[canonical];
  rebuild({ saving: true, error: '' });
  const request = api(`/api/admin/plots/${encodeURIComponent(canonical)}`, { method: 'PUT', body: JSON.stringify(captured) })
    .then((data) => {
      overrides = { ...overrides, [canonical]: sanitizeDetails(data.plot || captured, true) };
      if (data.plot?.updated_at) overrides[canonical].updated_at = data.plot.updated_at;
      if (pending[canonical] === captured) { const next = { ...pending }; delete next[canonical]; pending = next; }
      rebuild({ serverConnected: true, updatedAt: newerTimestamp(data.updatedAt || data.plot?.updated_at || new Date().toISOString(), state.updatedAt), error: '' });
      announceSave();
      return records.find((plot) => plot.number === canonical);
    })
    .catch((error) => { rebuild({ error: error.message }); throw error; })
    .finally(() => { saves.delete(canonical); rebuild({ saving: saves.size > 0 }); });
  saves.set(canonical, request);
  const saved = await request;
  return pending[canonical] ? savePlotRecord(canonical) : saved;
}

export async function saveAllPlotUpdates() {
  for (const number of Object.keys(pending)) await savePlotRecord(number);
}

export async function resetPlotRecord(number) {
  const canonical = canonicalNumber(number);
  if (!canonical) throw new Error('Choose a plot from the official layout.');
  if (saves.has(canonical)) await saves.get(canonical);
  const data = await api(`/api/admin/plots/${encodeURIComponent(canonical)}`, { method: 'DELETE' });
  overrides = data.overrides ? indexOverrides(data.overrides) : Object.fromEntries(Object.entries(overrides).filter(([id]) => id !== canonical));
  const next = { ...pending }; delete next[canonical]; pending = next;
  rebuild({ serverConnected: true, updatedAt: data.updatedAt || null, error: '' });
  announceSave();
}

export function exportPlotOverrides() {
  const changedNumbers = [...new Set([...Object.keys(overrides), ...Object.keys(pending)])];
  return { schemaVersion: 1, project: 'River Green Colony, Shamli', exportedAt: new Date().toISOString(), overrides: changedNumbers.map((number) => sanitizeDetails({ ...overrides[number], ...pending[number], plot_number: number }, true)) };
}

export async function importPlotOverrides(input) {
  const items = Array.isArray(input) ? input : input?.overrides;
  if (!Array.isArray(items) || items.length > 200) throw new Error('Import a River Green JSON export with at most 200 plot records.');
  const clean = items.map((plot) => sanitizeDetails(plot, true));
  if (new Set(clean.map((plot) => plot.plot_number)).size !== clean.length) throw new Error('The import contains duplicate plot numbers.');
  if (saves.size) await Promise.all([...saves.values()]);
  const data = await api('/api/admin/plots', { method: 'PUT', body: JSON.stringify({ overrides: clean }) });
  overrides = indexOverrides(data.overrides || Object.values({ ...overrides, ...indexOverrides(clean) }));
  const next = { ...pending }; clean.forEach((plot) => { delete next[plot.plot_number]; }); pending = next;
  rebuild({ serverConnected: true, updatedAt: data.updatedAt || new Date().toISOString(), error: '' });
  announceSave();
  return clean.length;
}

export const getAdminSession = () => api('/api/admin/session');
export const setupPlotManager = (password) => api('/api/admin/setup', { method: 'POST', body: JSON.stringify({ password }) });
export const loginPlotManager = (password) => api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password }) });
export const logoutPlotManager = () => api('/api/admin/logout', { method: 'POST', body: '{}' });

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => { if (event.key === 'river-green-plots-updated') refreshPlotRecords(); });
  window.addEventListener('focus', () => { if (listeners.size) refreshPlotRecords(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && listeners.size) refreshPlotRecords(); });
}

// Generated from the original plan's direct plot-label spans, preserving its
// exact 200 identifiers and dimension labels instead of inventing ranges.
export const PLOT_METADATA = planGeometry.plots.map((plot) => ({ ...plot, id: plot.number }));

rebuild();
