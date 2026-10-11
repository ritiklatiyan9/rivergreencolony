import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { normalizePlotNumber, PLOT_STATUSES, refreshPlotRecords, usePlotRecords, usePlotStoreState } from '../data/plotStore';
import './PlotManager.css';

export default function PlotManager() {
  const records = usePlotRecords(), store = usePlotStoreState();
  const [query, setQuery] = useState('');
  useEffect(() => {
    const title = document.title; document.title = 'River Green — Connected plot inventory';
    return () => { document.title = title; };
  }, []);
  return <main className="plot-manager" style={{ padding: '40px max(20px,5vw)', minHeight: '100vh', background: '#f6f4ed', color: '#183c2b' }}>
    <h1>Connected plot inventory</h1>
    <p>Plot status comes from the OM ASSOCIATES ledger. Manage website settings and approve payment requests in the Booking Software’s Website Management module.</p>
    <p role="status">{store.serverConnected ? 'Booking software connected. Availability refreshes automatically.' : store.error || 'Connecting to booking software…'}</p>
    <p><a href="/#experience">Return to the colony map ↗</a></p>
    <label>Find a plot <input value={query} onChange={event => setQuery(event.target.value)} placeholder="A-1 or S1" /></label>
    <button type="button" onClick={() => refreshPlotRecords()} style={{ marginLeft: 12 }}><RefreshCw size={14} /> Refresh</button>
    <div style={{ overflowX: 'auto', marginTop: 24 }}><table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}><thead><tr><th>Plot / shop</th><th>Status</th><th>Area (sq yd)</th></tr></thead><tbody>{records.filter(record => normalizePlotNumber(record.number).includes(normalizePlotNumber(query))).map(record => <tr key={record.number}><td style={{ padding: '10px 0' }}>{record.number}</td><td>{PLOT_STATUSES[record.status].label}</td><td>{record.area_sqyd || '—'}</td></tr>)}</tbody></table></div>
  </main>;
}
