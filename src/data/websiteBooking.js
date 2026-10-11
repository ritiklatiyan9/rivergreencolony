export async function bookingApi(path, body) {
  const response = await fetch(`/api/booking${path}`, {
    method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(25000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'The booking service is unavailable. Please try again.');
  return data;
}
let checkoutLoad;
export function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (checkoutLoad) return checkoutLoad;
  checkoutLoad = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'; script.async = true;
    const timeout = setTimeout(() => { script.remove(); checkoutLoad = null; reject(new Error('Payment checkout could not load. Please try again.')); }, 15000);
    script.onload = () => { clearTimeout(timeout); if (window.Razorpay) resolve(window.Razorpay); else { checkoutLoad = null; reject(new Error('Payment checkout is unavailable.')); } };
    script.onerror = () => { clearTimeout(timeout); script.remove(); checkoutLoad = null; reject(new Error('Payment checkout could not load. Check your connection and try again.')); };
    document.head.appendChild(script);
  });
  return checkoutLoad;
}
export const bookingMoney = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value || 0));
export const bookingSessionKey = number => `rivergreen-booking-${number}`;
