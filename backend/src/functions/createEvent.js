const { randomUUID } = require('crypto');
const { ok, parseBody } = require('../lib/http');
const { putEvent } = require('../lib/db');
const { authenticateAdmin } = require('../lib/auth');
const { getJwtSecret } = require('../lib/secrets');

exports.handler = async (event) => {
  try {
    const secret = await getJwtSecret();
    const auth = await authenticateAdmin(event, secret);

    const { name, venue, date, capacity } = parseBody(event);

    if (!name || typeof name !== 'string' || !name.trim()) {
      return ok(400, { message: 'name is required' });
    }
    if (!date || typeof date !== 'string') {
      return ok(400, { message: 'date is required' });
    }

    let parsedCapacity = null;
    if (capacity !== undefined && capacity !== null && capacity !== '') {
      parsedCapacity = parseInt(capacity, 10);
      if (isNaN(parsedCapacity) || parsedCapacity <= 0) {
        return ok(400, { message: 'capacity must be a positive integer if provided' });
      }
    }

    const newEvent = {
      eventId: randomUUID(),
      adminId: auth.adminId, // derived strictly from authenticated admin token
      name: name.trim(),
      venue: venue ? venue.trim() : null,
      date, // ISO 8601 string
      capacity: parsedCapacity,
      ticketsIssued: 0,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };

    await putEvent(newEvent);
    return ok(201, newEvent);
  } catch (err) {
    console.error('createEvent error', err);
    return ok(err.statusCode || 500, { message: err.message || 'Internal error' });
  }
};

