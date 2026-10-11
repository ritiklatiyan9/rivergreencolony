import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ShieldCheck, ArrowRight, CheckCircle2 } from 'lucide-react';
import { PLOT_STATUSES, refreshPlotRecords, usePlotRecords, usePlotStoreState } from '../data/plotStore';
import { bookingApi, bookingMoney, bookingSessionKey, loadRazorpay } from '../data/websiteBooking';
import './PlotBookingModal.css';

export default function PlotBookingModal({ number, onClose }) {
  const records = usePlotRecords(), store = usePlotStoreState();
  const plot = records.find(record => record.number === number);
  const config = store.bookingConfig;
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [request, setRequest] = useState(null), [order, setOrder] = useState(null);
  const dialog = useRef(null), busyRef = useRef(false), checkoutRef = useRef(null), tokenRef = useRef(null), mounted = useRef(true);
  const requestRef = useRef(null);
  const acceptRequest = value => {
    const old = requestRef.current;
    if (old?.updated_at && value.updated_at && new Date(old.updated_at).getTime() > new Date(value.updated_at).getTime()) return;
    requestRef.current = value;
    setRequest(value);
    setOrder(value.order && value.key_id ? { ...value, request_token: tokenRef.current } : null);
  };
  const idempotency = useRef(null);
  if (!idempotency.current) { try { idempotency.current = sessionStorage.getItem(`${bookingSessionKey(number)}-key`) || crypto.randomUUID(); sessionStorage.setItem(`${bookingSessionKey(number)}-key`, idempotency.current); } catch { idempotency.current = crypto.randomUUID(); } }
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const safeClose = () => { if (!busyRef.current) closeRef.current(); };
  useEffect(() => {
    mounted.current = true;
    const previous = document.activeElement, overflow = document.body.style.overflow, shell = document.getElementById('page-shell');
    document.body.style.overflow = 'hidden'; if (shell) shell.inert = true;
    dialog.current?.querySelector('button')?.focus();
    const keyboard = event => {
      if (checkoutRef.current) return;
      if (event.key === 'Escape') safeClose();
      if (event.key !== 'Tab') return;
      const elements = [...dialog.current.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),a[href]')];
      if (event.shiftKey && document.activeElement === elements[0]) { event.preventDefault(); elements.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === elements.at(-1)) { event.preventDefault(); elements[0]?.focus(); }
    };
    document.addEventListener('keydown', keyboard);
    refreshPlotRecords();
    return () => { mounted.current = false; document.removeEventListener('keydown', keyboard); document.body.style.overflow = overflow; if (shell) shell.inert = false; previous?.focus?.(); };
  }, []);
  useEffect(() => {
    let active = true;
    try { tokenRef.current = sessionStorage.getItem(bookingSessionKey(number)); } catch { /* Session recovery is optional. */ }
    const recover = async () => {
      if (!tokenRef.current || document.hidden) return;
      const token = tokenRef.current;
      try { const value = await bookingApi(`/requests/${encodeURIComponent(token)}`); if (active && tokenRef.current === token) acceptRequest(value); } catch { /* A saved token never authorizes a fresh payment. */ }
    };
    recover(); const timer = setInterval(recover, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [number]);
  const setWorking = value => { busyRef.current = value; if (mounted.current) setBusy(value); };
  const paid = Boolean(request?.payment_verified);
  const reviewed = ['PAYMENT_REVIEW', 'PAYMENT_CONFLICT', 'APPROVED', 'REJECTED', 'CANCELLED'].includes(request?.status);
  const tokenAmount = order?.order ? Number(order.order.amount) / 100 : request?.amount ?? config?.booking_amount;
  const bookable = Boolean(config?.booking_enabled && config?.payment_ready && Number(config?.booking_amount) > 0 && store.serverConnected && plot?.bookable);
  async function verify(result, created) {
    setWorking(true);
    try {
      const status = await bookingApi('/payments/verify', { request_token: created.request_token, ...result });
      if (mounted.current) { acceptRequest(status); setError(''); }
      await refreshPlotRecords();
    } catch (failure) {
      if (mounted.current) setError(`${failure.message} Your payment reference is saved. Please check its status below before paying again.`);
    } finally { checkoutRef.current = null; setWorking(false); }
  }
  function openCheckout(Razorpay, created, buyer = {}) {
    const checkout = new Razorpay({
      key: created.key_id, order_id: created.order.id, amount: created.order.amount, currency: created.order.currency,
      name: 'River Green · Defence Garden', description: `Booking request for ${number}`,
      prefill: { name: buyer.buyer_name, contact: buyer.buyer_phone, email: buyer.buyer_email }, theme: { color: '#183c2b' },
      handler: result => { void verify(result, created); },
      modal: { ondismiss: () => { checkoutRef.current = null; setWorking(false); if (mounted.current) setError('Checkout closed. Use Check request status if you paid, or continue your saved payment.'); } },
    });
    checkout.on('payment.failed', () => { if (mounted.current) setError('Payment did not complete. Retry in checkout or close it to return.'); });
    checkoutRef.current = checkout; checkout.open();
  }
  async function resumePayment() {
    if (busyRef.current || !order?.order || !tokenRef.current) return;
    setWorking(true); setError('');
    try {
      // Recover a captured payment before reopening checkout. Never create an
      // extra order merely because the browser missed its success callback.
      const value = await bookingApi(`/requests/${encodeURIComponent(tokenRef.current)}/reconcile`, {});
      acceptRequest(value);
      if (!value.order || value.payment_verified) { setOrder(null); setWorking(false); await refreshPlotRecords(); return; }
      const created = { ...value, request_token: tokenRef.current };
      setOrder(created); openCheckout(await loadRazorpay(), created);
    } catch (failure) { setError(failure.message); setWorking(false); }
  }
  async function submit(event) {
    event.preventDefault(); if (busyRef.current) return;
    setWorking(true); setError('');
    const form = new FormData(event.currentTarget);
    const buyer = { buyer_name: String(form.get('name') || '').trim(), buyer_phone: String(form.get('phone') || '').replace(/\D/g, ''), buyer_email: String(form.get('email') || '').trim(), buyer_address: String(form.get('address') || '').trim(), terms_accepted: form.get('terms') === 'on' };
    if (buyer.buyer_phone.length === 12 && buyer.buyer_phone.startsWith('91')) buyer.buyer_phone = buyer.buyer_phone.slice(2);
    if (!buyer.buyer_name || !/^[6-9]\d{9}$/.test(buyer.buyer_phone) || !buyer.terms_accepted) { setError('Enter your name, a valid Indian mobile number and accept the booking terms.'); setWorking(false); return; }
    try {
      // Load checkout before acquiring a time-limited plot hold.
      const Razorpay = await loadRazorpay();
      const created = await bookingApi('/orders', { ...buyer, plot_number: number, idempotency_key: idempotency.current });
      setOrder(created); tokenRef.current = created.request_token;
      try { sessionStorage.setItem(bookingSessionKey(number), created.request_token); } catch { /* The current request still works. */ }
      openCheckout(Razorpay, created, buyer);
    } catch (failure) { setError(failure.message); setWorking(false); }
  }
  async function checkStatus() {
    if (!tokenRef.current || busyRef.current) return;
    setWorking(true);
    try { const value = await bookingApi(`/requests/${encodeURIComponent(tokenRef.current)}/reconcile`, {}); acceptRequest(value); setError(''); await refreshPlotRecords(); }
    catch (failure) { setError(failure.message); }
    finally { setWorking(false); }
  }
  async function startNewRequest() {
    if (busyRef.current || !tokenRef.current) return;
    setWorking(true);
    try {
      const value = await bookingApi(`/requests/${encodeURIComponent(tokenRef.current)}/reconcile`, {});
      acceptRequest(value);
      if (value.payment_verified || !['EXPIRED','PAYMENT_FAILED'].includes(value.status)) { setError('This request still needs a payment or staff review. Please check its status.'); return; }
      tokenRef.current = null; idempotency.current = crypto.randomUUID(); requestRef.current = null; setOrder(null); setRequest(null); setError('');
      try { sessionStorage.removeItem(bookingSessionKey(number)); sessionStorage.setItem(`${bookingSessionKey(number)}-key`, idempotency.current); } catch { /* Current request remains usable. */ }
      await refreshPlotRecords();
    } catch (failure) { setError(failure.message); }
    finally { setWorking(false); }
  }
  const unavailable = !store.serverConnected ? 'Live availability is temporarily unavailable. Please contact the team.' : !config?.booking_enabled ? 'Online booking is currently paused. Contact the team to book this plot.' : !config?.payment_ready ? 'Online payments are being prepared. Contact the team to book.' : plot?.held ? 'This plot has a payment request in progress. Please check again shortly.' : 'This plot is currently unavailable for online booking.';
  return createPortal(<div className="plot-booking-overlay" data-lenis-prevent onMouseDown={event => { if (event.target === event.currentTarget) safeClose(); }}>
    <div ref={dialog} className="plot-booking" role="dialog" aria-modal="true" aria-labelledby="plot-booking-title">
      <button className="plot-booking-close" type="button" disabled={busy} onClick={safeClose} aria-label="Close plot booking"><X size={22} /></button>
      <small>RIVER GREEN · {number?.startsWith('S') ? 'COMMERCIAL SHOP' : 'RESIDENTIAL PLOT'}</small>
      <h2 id="plot-booking-title">Your space. <em>{number}.</em></h2>
      <div className="plot-booking-details"><span><i style={{ background: PLOT_STATUSES[plot?.status || 'UNKNOWN'].color }} />{PLOT_STATUSES[plot?.status || 'UNKNOWN'].label}</span>{plot?.area_sqyd && <span>{plot.area_sqyd} sq yd</span>}{Number(plot?.total_price) > 0 && <span>{bookingMoney(plot.total_price)} plot price</span>}</div>
      {paid || reviewed ? <div className="plot-booking-result" role="status"><CheckCircle2 size={32} /><h3>{request.status === 'APPROVED' ? 'Booking approved' : request.status === 'CANCELLED' ? 'Booking cancelled' : request.status === 'REJECTED' ? 'Request reviewed' : 'Payment received for review'}</h3><p>{request.status === 'APPROVED' ? `Your booking ${request.booking_no || ''} is approved. The team will contact you for the next steps.` : request.status === 'CANCELLED' ? 'Your booking has been cancelled. Contact the team for the payment resolution.' : request.status === 'REJECTED' ? 'The team has declined this request. Contact them using your reference for the next steps.' : 'Your payment will be checked by the booking team. This plot booking is confirmed only after their approval.'}</p>{request.refund_required && <p>Payment resolution is pending with the team.</p>}<dl><dt>Reference</dt><dd>{request.reference || order?.request_id || request.request_id || number}</dd>{paid && <><dt>Token paid</dt><dd>{bookingMoney(request.amount ?? tokenAmount)}</dd></>}</dl></div> : order?.order && new Date(order.expires_at).getTime() > Date.now() ? <div className="plot-booking-result"><h3>Continue your booking request</h3><p>Your saved payment order is for <strong>{bookingMoney(tokenAmount)}</strong>. It uses the customer details and terms from your original request.</p><button type="button" className="plot-booking-pay" disabled={busy} onClick={resumePayment}>{busy ? 'Checking payment…' : `Continue saved payment · ${bookingMoney(tokenAmount)}`}<ArrowRight size={18} /></button></div> : <>
        {bookable && !tokenRef.current ? <form onSubmit={submit} className="plot-booking-form">
          <p>Pay a token of <strong>{bookingMoney(tokenAmount)}</strong> to request this plot. Staff will verify payment and approve your booking.</p>
          <label>Full name<input name="name" autoComplete="name" minLength={2} maxLength={120} required disabled={busy} /></label>
          <div className="plot-booking-fields"><label>Mobile number<input name="phone" autoComplete="tel" inputMode="tel" maxLength={16} required disabled={busy} placeholder="10-digit mobile number" /></label><label>Email<input name="email" type="email" autoComplete="email" maxLength={160} required disabled={busy} /></label></div>
          <label>Address<textarea name="address" autoComplete="street-address" minLength={5} maxLength={500} rows={2} required disabled={busy} /></label>
          <div className="plot-booking-terms">{config?.terms || 'Payment submits a booking request, subject to staff verification and approval. Contact the team for cancellation and payment resolution.'}</div>
          <label className="plot-booking-consent"><input name="terms" type="checkbox" required disabled={busy} /><span>I accept these terms and agree to be contacted about my booking.</span></label>
          <button className="plot-booking-pay" disabled={busy} type="submit">{busy ? 'Preparing / verifying payment…' : `Request booking · ${bookingMoney(tokenAmount)}`}<ArrowRight size={18} /></button>
          {config?.razorpay_key_id?.startsWith('rzp_test_') && <p className="plot-booking-test">Test mode · No real money is charged.</p>}
        </form> : <p className="plot-booking-unavailable" role="status">{unavailable}</p>}
      </>}
      {error && <p className="plot-booking-error" role="alert">{error}</p>}
      {tokenRef.current && <button className="plot-booking-status" type="button" disabled={busy} onClick={checkStatus}>Check request status</button>}
      {!paid && ['EXPIRED','PAYMENT_FAILED'].includes(request?.status) && <button className="plot-booking-status" type="button" disabled={busy} onClick={startNewRequest}>Start a new request</button>}
      <div className="plot-booking-footer"><span><ShieldCheck size={16} /> Secure checkout by Razorpay</span><a href="tel:+919760302690">Speak to the booking team ↗</a></div>
    </div>
  </div>, document.body);
}
