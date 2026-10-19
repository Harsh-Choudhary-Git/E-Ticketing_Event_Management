const { ok } = require('../lib/http');
const { getTicket, getEvent, cancelTicket, releaseTicketCapacity } = require('../lib/db');
const { authenticateAdmin } = require('../lib/auth');
const { getJwtSecret } = require('../lib/secrets');

exports.handler = async (event) => {
  try {
    const secret = await getJwtSecret();
    const auth = await authenticateAdmin(event, secret);

    const { ticketId } = event.pathParameters || {};
    if (!ticketId) return ok(400, { message: 'ticketId is required' });

    const ticket = await getTicket(ticketId);
    if (!ticket) return ok(404, { message: 'Ticket not found' });

    // Ticket ownership verification: ticket -> event -> adminId
    const eventRecord = await getEvent(ticket.eventId);
    if (!eventRecord) return ok(404, { message: 'Associated event not found' });

    if (eventRecord.adminId !== auth.adminId) {
      return ok(403, { message: 'Forbidden: You do not own the event for this ticket' });
    }

    try {
      await cancelTicket(ticketId);
      await releaseTicketCapacity(ticket.eventId);
    } catch (conditionErr) {
      return ok(409, { message: 'Ticket is already checked in, cannot cancel' });
    }

    return ok(200, { message: 'Ticket cancelled', ticketId });
  } catch (err) {
    console.error('cancelTicket error', err);
    return ok(err.statusCode || 500, { message: err.message || 'Internal error' });
  }
};

