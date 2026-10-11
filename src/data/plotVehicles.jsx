import { useEffect, useRef } from 'react';

// The official map's decorative vehicle routes and SVG drawings. They are
// illustrations on the road overlay and never change the underlying plan.
const vehicles = [
  { id: 'car1', type: 'car', color: '#D32F2F', from: 60, to: 640, y: 333, speed: 55, delay: -3 },
  { id: 'car2', type: 'car', color: '#1565C0', from: 700, to: 1100, y: 735, speed: 40, delay: -9 },
  { id: 'car3', type: 'car', color: '#2E7D32', from: 700, to: 1050, y: 935, speed: 48, delay: -5 },
  { id: 'bike1', type: 'bike', color: '#FF6F00', from: 60, to: 640, y: 143, speed: 70, delay: -11 },
];

function Car({ color }) {
  return <svg width="28" height="14" viewBox="0 0 28 14" style={{ display: 'block', marginLeft: -14, marginTop: -7, filter: 'drop-shadow(1px 1px 2px rgba(0,0,0,0.4))' }}>
    <rect x="1" y="1" width="26" height="12" rx="3" fill={color} stroke="#222" strokeWidth="0.7" />
    <rect x="16" y="2.5" width="6" height="3.5" rx="1.5" fill="rgba(180,220,255,0.6)" />
    <rect x="16" y="8" width="6" height="3.5" rx="1.5" fill="rgba(180,220,255,0.6)" />
    <rect x="5" y="3" width="4" height="3" rx="1" fill="rgba(180,220,255,0.4)" />
    <rect x="5" y="8" width="4" height="3" rx="1" fill="rgba(180,220,255,0.4)" />
    {[['6', '0.8'], ['6', '13.2'], ['22', '0.8'], ['22', '13.2']].map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.5" fill="#222" />)}
  </svg>;
}

function Bike({ color }) {
  return <svg width="18" height="10" viewBox="0 0 18 10" style={{ display: 'block', marginLeft: -9, marginTop: -5, filter: 'drop-shadow(1px 1px 1px rgba(0,0,0,0.3))' }}>
    <circle cx="3" cy="5" r="2.5" fill="none" stroke="#333" strokeWidth="1.2" /><circle cx="15" cy="5" r="2.5" fill="none" stroke="#333" strokeWidth="1.2" />
    <path d="M3 5 L7 2.5 L11 2.5 L15 5" stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" /><circle cx="9" cy="2" r="1.8" fill={color} stroke="#222" strokeWidth="0.4" />
  </svg>;
}

export default function PlotVehicles() {
  const ref = useRef(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let visible = false;
    const sync = () => { element.dataset.visible = String(visible && !document.hidden); };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    observer.observe(element);
    document.addEventListener('visibilitychange', sync);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', sync); };
  }, []);
  return <div ref={ref} aria-hidden="true" className="plot-map-vehicles">
    {vehicles.map((vehicle) => <div key={vehicle.id} className="plot-map-vehicle" style={{ '--vehicle-from': `${vehicle.from}px`, '--vehicle-to': `${vehicle.to}px`, '--vehicle-y': `${vehicle.y}px`, animationDuration: `${2 * (vehicle.to - vehicle.from) / vehicle.speed}s`, animationDelay: `${vehicle.delay}s` }}>
      {vehicle.type === 'car' ? <Car color={vehicle.color} /> : <Bike color={vehicle.color} />}
    </div>)}
  </div>;
}
