import { request } from './client';
export const requestBookingCode = body => request('/public/tickets/request-verification', { method: 'POST', body: JSON.stringify(body) });
export const verifyAndBook = body => request('/public/tickets/verify-and-book', { method: 'POST', body: JSON.stringify(body) });
export const getTicket = ticketId => request(`/tickets/${encodeURIComponent(ticketId)}`);
export const requestCancellationCode = ticketId => request(`/public/tickets/${encodeURIComponent(ticketId)}/cancel/request-code`, { method: 'POST' });
export const verifyCancellationCode = (ticketId, code) => request(`/public/tickets/${encodeURIComponent(ticketId)}/cancel/verify-code`, { method: 'POST', body: JSON.stringify({ code }) });
