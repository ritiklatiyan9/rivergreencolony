import test from 'node:test';
import assert from 'node:assert/strict';
import { bookingAvailabilityRecord } from './bookingAvailability.js';
test('only the requested accounting statuses receive public map colours', () => {
  for (const [input, expected] of [['COMPANY','AVAILABLE'],['BOOKED','RESERVED'],['REGISTRY','SOLD'],['RESALE','UNKNOWN'],['UNDER CANCELLATION','UNKNOWN']]) {
    assert.equal(bookingAvailabilityRecord({number:'A-1',status:input},true).status,expected);
  }
});
test('hidden status removes booking and held information, with correct area units', () => {
  const record=bookingAvailabilityRecord({number:'S1',status:'COMPANY',bookable:true,held:true,area_sqyd:100},false);
  assert.equal(record.status,'UNKNOWN'); assert.equal(record.accounting_status,'UNKNOWN'); assert.equal(record.bookable,false); assert.equal(record.held,false); assert.equal(record.area_sqft,900);
});
