import { request } from './client';
const auth = (token) => ({ Authorization: `Bearer ${token}` });
export const login = (email, password) => request('/auth/admin/login', { method: 'POST', body: JSON.stringify({ email, password }) });
export const listEvents = (token) => request('/admin/events', { headers: auth(token) });
export const createEvent = (token, body) => request('/admin/events', { method: 'POST', headers: auth(token), body: JSON.stringify(body) });
export const getEvent = (token, id) => request(`/admin/events/${id}`, { headers: auth(token) });
export const getStats = (token, id) => request(`/admin/events/${id}/stats`, { headers: auth(token) });
export const listTickets = (token, id) => request(`/admin/events/${id}/tickets`, { headers: auth(token) });
export const cancelTicket = (token, id) => request(`/admin/tickets/${id}/cancel`, { method: 'POST', headers: auth(token) });
export const resendTicket = (token, id) => request(`/admin/tickets/${id}/resend`, { method: 'POST', headers: auth(token) });

