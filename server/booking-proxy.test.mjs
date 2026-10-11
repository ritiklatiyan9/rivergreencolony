import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createBookingProxy } from './booking-proxy.mjs';
async function call(proxy, url, method='GET', body, origin='http://localhost:5173') {
  const req=Readable.from(body ? [JSON.stringify(body)] : []); Object.assign(req,{url,method,headers:{host:'localhost:5173',origin,'content-type':'application/json',authorization:'Bearer private-admin-token',cookie:'private-cookie'},socket:{remoteAddress:'127.0.0.1'}});
  const result={}; const res={writeHead:(code,headers)=>Object.assign(result,{code,headers}),end:value=>{result.body=JSON.parse(value);}};
  await proxy(req,res,()=>{result.next=true;}); return result;
}
test('forwards only public endpoint and body, excluding browser auth and query selectors',async()=>{
  let target,options; const proxy=createBookingProxy({upstream:'http://localhost:8001',fetchImpl:async(url,opts)=>{target=url;options=opts;return {status:201,json:async()=>({order:{id:'order_test'}})};}});
  const result=await call(proxy,'/api/booking/orders?site_id=2','POST',{plot_number:'A-1'});
  assert.equal(result.code,201);assert.equal(target.href,'http://localhost:8001/public/website/orders');assert.equal(options.headers.Authorization,undefined);assert.equal(options.headers.cookie,undefined);assert.deepEqual(JSON.parse(options.body),{plot_number:'A-1'});assert.equal(options.redirect,'error');
});
test('blocks staff paths, traversal, method mismatch and cross-origin writes',async()=>{
  let calls=0;const proxy=createBookingProxy({upstream:'http://localhost:8001',fetchImpl:async()=>{calls++;throw new Error('must not forward');}});
  for (const path of ['/api/booking/website-management/settings','/api/booking/requests/short','/api/booking/%2fadmin']) assert.equal((await call(proxy,path,'POST',{})).code,404);
  assert.equal((await call(proxy,'/api/booking/orders','POST',{},'https://other.example')).code,403);assert.equal(calls,0);
});
test('supports opaque-token payment recovery and fails closed when backend unavailable',async()=>{
  const token='a'.repeat(64);let target;const proxy=createBookingProxy({upstream:'https://booking.example',fetchImpl:async url=>{target=url;return {status:200,json:async()=>({status:'PAYMENT_REVIEW'})};}});
  assert.equal((await call(proxy,`/api/booking/requests/${token}/reconcile`,'POST',{})).body.status,'PAYMENT_REVIEW');assert.equal(target.pathname,`/public/website/requests/${token}/reconcile`);
  assert.equal((await call(createBookingProxy({upstream:''}),'/api/booking/config')).code,503);
});
test('serverless parsed bodies follow the same origin and size checks', async()=>{
  let body;const proxy=createBookingProxy({upstream:'https://booking.example',appOrigin:'https://colony.example',fetchImpl:async(url,options)=>{body=options.body;return {status:201,json:async()=>({request_id:1})};}});
  const req=Readable.from([]);Object.assign(req,{url:'/api/booking/orders',method:'POST',body:{plot_number:'S1'},headers:{host:'colony.example',origin:'https://colony.example','content-type':'application/json'},socket:{remoteAddress:'127.0.0.1'}});let code;
  await proxy(req,{writeHead:status=>{code=status;},end:()=>{}},()=>{});assert.equal(code,201);assert.deepEqual(JSON.parse(body),{plot_number:'S1'});
});
test('concurrent public reads share a short cache; request status stays uncached', async()=>{
  let calls=0;const proxy=createBookingProxy({upstream:'https://booking.example',fetchImpl:async()=>{calls++;return {status:200,json:async()=>({status:'AWAITING_PAYMENT'})};}});
  await Promise.all([call(proxy,'/api/booking/plots'),call(proxy,'/api/booking/plots')]);await call(proxy,'/api/booking/plots');assert.equal(calls,1);
  const path='/api/booking/requests/'+'a'.repeat(64);await call(proxy,path);await call(proxy,path);assert.equal(calls,3);
});
