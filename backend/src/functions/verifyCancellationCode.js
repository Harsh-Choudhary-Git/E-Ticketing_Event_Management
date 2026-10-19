const { ok, parseBody } = require('../lib/http');
const {
  getTicket,
  getEvent,
  queryCancellationChallenge,
  markChallengeUsed,
  incrementChallengeAttempts,
  cancelTicket,
  releaseTicketCapacity,
} = require('../lib/db');
const { getJwtSecret } = require('../lib/secrets');
const { verifyOtp, MAX_ATTEMPTS } = require('../lib/otp');

exports.handler = async (event) => {
  try {
    const { ticketId } = event.pathParameters || {};
    if (!ticketId) return ok(400, { message: 'ticketId is required' });

    const { code } = parseBody(event);
    if (!code || typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) {
      return ok(400, { message: 'A 6-digit verification code is required' });
    }

    // --- Load ticket ---
    const ticket = await getTicket(ticketId);
    if (!ticket) {
      return ok(404, { message: 'Ticket not found' });
    }
    if (ticket.status === 'CANCELLED') {
      return ok(409, { message: 'Ticket is already cancelled' });
    }
    if (ticket.status === 'CHECKED_IN') {
      return ok(409, { message: 'Checked-in tickets cannot be cancelled' });
    }

    // --- Find active CANCELLATION challenge for this ticket ---
    const challenge = await queryCancellationChallenge(ticketId);
    if (!challenge) {
      return ok(400, { message: 'No active cancellation code found. Please request a new code.' });
    }

    // --- Expiry check (application-level; DynamoDB TTL is eventual) ---
    const nowEpoch = Math.floor(Date.now() / 1000);
    if (challenge.expiresAt <= nowEpoch) {
      return ok(400, { message: 'Cancellation code has expired. Please request a new code.' });
    }

    // --- Attempt limit ---
    if (challenge.attempts >= MAX_ATTEMPTS) {
      return ok(400, {
        message: 'Maximum verification attempts exceeded. Please request a new code.',
      });
    }

    // --- Constant-time OTP comparison ---
    const secret = await getJwtSecret();
    const isValid = verifyOtp(code.trim(), challenge.codeHash, secret);

    if (!isValid) {
      try {
        await incrementChallengeAttempts(challenge.challengeId, challenge.attempts);
      } catch (incErr) {
        console.warn('incrementChallengeAttempts race', incErr.name);
      }
      const remaining = MAX_ATTEMPTS - (challenge.attempts + 1);
      return ok(400, {
        message:
          remaining > 0
            ? `Incorrect cancellation code. ${remaining} attempt(s) remaining.`
            : 'Incorrect cancellation code. No attempts remaining. Please request a new code.',
      });
    }

    // --- Atomically mark challenge as used (prevents replay) ---
    try {
      await markChallengeUsed(challenge.challengeId);
    } catch (condErr) {
      if (condErr.name === 'ConditionalCheckFailedException') {
        return ok(409, { message: 'This cancellation code was already used' });
      }
      throw condErr;
    }

    // --- Cancel the ticket atomically ---
    // cancelTicket uses a conditional update: status must NOT be CHECKED_IN.
    // If status is already CANCELLED this also throws ConditionalCheckFailedException.
    let eventId;
    try {
      // Re-read ticket inside the atomic sequence to get eventId safely
      const freshTicket = await getTicket(ticketId);
      if (!freshTicket) return ok(404, { message: 'Ticket not found' });
      if (freshTicket.status === 'CANCELLED') {
        return ok(409, { message: 'Ticket is already cancelled' });
      }
      if (freshTicket.status === 'CHECKED_IN') {
        return ok(409, { message: 'Checked-in tickets cannot be cancelled' });
      }
      eventId = freshTicket.eventId;
      await cancelTicket(ticketId);
    } catch (cancelErr) {
      if (cancelErr.name === 'ConditionalCheckFailedException') {
        return ok(409, { message: 'Ticket could not be cancelled (may already be checked in or cancelled)' });
      }
      throw cancelErr;
    }

    // --- Release capacity (safe: uses its own conditional guard) ---
    await releaseTicketCapacity(eventId);

    return ok(200, {
      message: 'Ticket cancelled successfully',
      ticketId,
      status: 'CANCELLED',
    });
  } catch (err) {
    console.error('verifyCancellationCode error', err);
    return ok(err.statusCode || 500, { message: err.message || 'Internal error' });
  }
};
