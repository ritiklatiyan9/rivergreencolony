import test from 'node:test';
import assert from 'node:assert/strict';
import { createBookingCheckout } from './websiteBooking.js';

function fixture(onVerify=()=>{}) {
  const messages=[],dismissals=[];
  class Razorpay {
    constructor(options){this.options=options;this.events={};}
    on(name,callback){this.events[name]=callback;}
  }
  const checkout=createBookingCheckout({Razorpay,number:'A-1',created:{key_id:'rzp_test_fixture',order:{id:'order_Test',amount:10100,currency:'INR'}},
    buyer:{buyer_name:'Test Buyer',buyer_phone:'9876543210'},onVerify,onFailure:message=>messages.push(message),onDismiss:message=>dismissals.push(message)});
  return {checkout,messages,dismissals};
}

test('checkout uses server order and ₹101, and sends only the three callback fields',async()=>{
  const verified=[];
  let resolve;
  const pending=new Promise(done=>{resolve=done;});
  const f=fixture(result=>{verified.push(result);return pending;});
  assert.equal(f.checkout.options.amount,10100);
  assert.equal(f.checkout.options.name,'OM ASSOCIATES');
  assert.equal(f.checkout.options.order_id,'order_Test');
  const result={razorpay_order_id:'order_Test',razorpay_payment_id:'pay_Test',razorpay_signature:'signature'};
  f.checkout.options.handler({...result,request_token:'untrusted_extra'});
  f.checkout.options.handler(result);
  f.checkout.options.modal.ondismiss();
  f.checkout.events['payment.failed']({});
  assert.deepEqual(verified,[result]);
  assert.deepEqual(f.dismissals,[]);
  assert.deepEqual(f.messages,[]);
  resolve();await pending;
});

test('checkout cancellation and payment failure show actionable messages',()=>{
  const cancelled=fixture();
  cancelled.checkout.options.modal.ondismiss();
  assert.match(cancelled.dismissals[0],/cancelled/);
  const failed=fixture();
  failed.checkout.events['payment.failed']({error:{description:'Your bank declined this payment.'}});
  assert.match(failed.messages[0],/bank declined/);
  failed.checkout.options.modal.ondismiss();
  assert.match(failed.dismissals[0],/Check request status/);
});
