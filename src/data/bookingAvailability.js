export function bookingAvailabilityRecord(plot, displayEnabled) {
  const statuses = { COMPANY: 'AVAILABLE', BOOKED: 'RESERVED', REGISTRY: 'SOLD' };
  const area = Number(plot.area_sqyd);
  return { ...plot, plot_number: plot.number, accounting_status: displayEnabled ? plot.status : 'UNKNOWN',
    status: displayEnabled ? statuses[plot.status] || 'UNKNOWN' : 'UNKNOWN',
    bookable: Boolean(displayEnabled && plot.bookable), held: Boolean(displayEnabled && plot.held),
    total_price: plot.sale_price || '', area_sqyd: area > 0 ? area : '', area_sqft: area > 0 ? area * 9 : '',
  };
}
