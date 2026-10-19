import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { QRCodeSVG } from "qrcode.react";
import { listEvents } from "./api/events";
import {
  requestBookingCode,
  verifyAndBook,
  getTicket,
  requestCancellationCode,
  verifyCancellationCode,
} from "./api/tickets";
import "./styles.css";

const apiDate = (value) =>
  value ? new Date(value).toLocaleString() : "Date to be announced";

const Status = ({ value }) => (
  <span className={`status status-${String(value || "").toLowerCase()}`}>
    {value || "UNKNOWN"}
  </span>
);

const Notice = ({ children, success = false }) =>
  children ? (
    <div className={`notice ${success ? "success" : ""}`}>{children}</div>
  ) : null;

function App() {
  const query = new URLSearchParams(window.location.search);

  return window.location.pathname === "/ticket/manage" ? (
    <ManageTicket initialId={query.get("ticketId") || ""} />
  ) : (
    <Home />
  );
}

function Home() {
  const [events, setEvents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    listEvents()
      .then(setEvents)
      .catch((error) => setError(error.message));
  }, []);

  return (
    <div className="site">
      <header className="hero">
        <nav>
          <strong>EventPass</strong>
          <a href="#events">Events</a>
          <a href="/ticket/manage">Manage ticket</a>
        </nav>

        <div className="hero-copy">
          <p className="eyebrow">EVENT TICKETING, SIMPLIFIED</p>

          <h1>Make your next event memorable.</h1>

          <p>
            Browse active events, verify your email, and keep your digital
            ticket ready for entry.
          </p>
        </div>
      </header>

      <main className="container" id="events">
        <div className="heading">
          <div>
            <p className="eyebrow">UPCOMING EVENTS</p>
            <h2>Choose an event</h2>
          </div>

          <span>
            {events.length} active event
            {events.length === 1 ? "" : "s"}
          </span>
        </div>

        <Notice>{error}</Notice>

        {!error && !events.length && (
          <div className="empty">
            No active events are available right now.
          </div>
        )}

        <div className="event-grid">
          {events.map((event) => (
            <button
              className="event-card"
              key={event.eventId}
              onClick={() => setSelected(event)}
            >
              <span>{apiDate(event.date)}</span>

              <h3>{event.name}</h3>

              <p>{event.venue || "Venue TBA"}</p>

              <div>
                <small>
                  {event.capacity
                    ? `${Math.max(
                        0,
                        event.capacity - (event.ticketsIssued || 0)
                      )} spots remaining`
                    : "Open capacity"}
                </small>

                <b>Book ticket →</b>
              </div>
            </button>
          ))}
        </div>
      </main>

      <footer>
        Need to cancel a reservation?{" "}
        <a href="/ticket/manage">Manage your ticket</a>
      </footer>

      {selected && (
        <Booking
          event={selected}
          close={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function Booking({ event, close }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    code: "",
  });

  const [challengeId, setChallengeId] = useState("");
  const [ticket, setTicket] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();

    setBusy(true);
    setMessage("");

    try {
      if (!challengeId) {
        const response = await requestBookingCode({
          eventId: event.eventId,
          attendeeName: form.name,
          attendeeEmail: form.email,
        });

        setChallengeId(response.challengeId);
        setMessage("Verification code sent to your email.");
      } else {
        const result = await verifyAndBook({
          challengeId,
          code: form.code,
        });

        setTicket(result);
        setMessage("Ticket created successfully.");
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="backdrop">
      <section className="modal">
        <div className="heading">
          <div>
            <p className="eyebrow">BOOK TICKET</p>

            <h2>{event.name}</h2>

            <p>
              {event.venue || "Venue TBA"} · {apiDate(event.date)}
            </p>
          </div>

          <button className="close" onClick={close}>
            ×
          </button>
        </div>

        {ticket ? (
          <TicketCard
            ticket={ticket}
            event={event}
          />
        ) : (
          <form onSubmit={submit}>
            <label>
              Name

              <input
                required
                disabled={Boolean(challengeId)}
                value={form.name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    name: e.target.value,
                  })
                }
              />
            </label>

            <label>
              Email

              <input
                required
                type="email"
                disabled={Boolean(challengeId)}
                value={form.email}
                onChange={(e) =>
                  setForm({
                    ...form,
                    email: e.target.value,
                  })
                }
              />
            </label>

            {challengeId && (
              <label>
                Email OTP

                <input
                  required
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength="6"
                  value={form.code}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      code: e.target.value,
                    })
                  }
                />
              </label>
            )}

            <Notice success={message.startsWith("Ticket")}>
              {message}
            </Notice>

            <button disabled={busy}>
              {busy
                ? "Please wait…"
                : challengeId
                ? "Complete booking"
                : "Request email OTP"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}

function TicketCard({ ticket, event }) {
  return (
    <article className="ticket">
      <div className="success">
        Ticket created ·{" "}
        {ticket.emailSent
          ? "Email sent"
          : "Keep this ticket ID"}
      </div>

      <div className="ticket-grid">
        <div>
          <p className="eyebrow">YOUR TICKET</p>

          <h2>{event.name}</h2>

          <dl>
            <dt>Attendee</dt>
            <dd>{ticket.attendeeName}</dd>

            <dt>Venue</dt>
            <dd>{event.venue || "Venue TBA"}</dd>

            <dt>Date</dt>
            <dd>{apiDate(event.date)}</dd>

            <dt>Ticket ID</dt>
            <dd className="mono">{ticket.ticketId}</dd>

            <dt>Status</dt>
            <dd>
              <Status value={ticket.status} />
            </dd>
          </dl>
        </div>

        <div className="display-qr">
          <QRCodeSVG
            value={ticket.ticketId}
            size={150}
          />

          <small>
            The signed entry QR is included in the ticket email.
          </small>
        </div>
      </div>
    </article>
  );
}

function ManageTicket({ initialId }) {
  const [id, setId] = useState(initialId);
  const [ticket, setTicket] = useState(null);
  const [code, setCode] = useState("");
  const [requested, setRequested] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load(e) {
    e.preventDefault();

    setBusy(true);
    setMessage("");

    try {
      const result = await getTicket(id);

      setTicket(result);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function requestCode() {
    setBusy(true);
    setMessage("");

    try {
      await requestCancellationCode(id);

      setRequested(true);

      setMessage(
        "Cancellation code sent to the registered email."
      );
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function cancel(e) {
    e.preventDefault();

    setBusy(true);
    setMessage("");

    try {
      const result = await verifyCancellationCode(
        id,
        code
      );

      setTicket((current) => ({
        ...current,
        ...result,
        status: "CANCELLED",
      }));

      setMessage(result.message);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  const cancellable =
    ticket &&
    !["CANCELLED", "CHECKED_IN"].includes(
      ticket.status
    );

  return (
    <div className="site">
      <header className="simple-header">
        <a href="/">← EventPass</a>
      </header>

      <main className="container manage">
        <p className="eyebrow">TICKET MANAGEMENT</p>

        <h1>Manage your ticket</h1>

        <p>
          Enter the ticket ID from your email to view its
          status or cancel the reservation.
        </p>

        <form
          className="lookup"
          onSubmit={load}
        >
          <input
            required
            placeholder="Ticket ID"
            value={id}
            onChange={(e) =>
              setId(e.target.value)
            }
          />

          <button disabled={busy}>
            View ticket
          </button>
        </form>

        <Notice
          success={message.includes("successfully")}
        >
          {message}
        </Notice>

        {ticket && (
          <article className="ticket">
            <div className="heading">
              <div>
                <p className="eyebrow">
                  TICKET DETAILS
                </p>

                <h2>
                  {ticket.eventName || "Event"}
                </h2>
              </div>

              <Status value={ticket.status} />
            </div>

            <dl>
              <dt>Attendee</dt>
              <dd>{ticket.attendeeName}</dd>

              <dt>Venue</dt>
              <dd>
                {ticket.venue || "Venue TBA"}
              </dd>

              <dt>Date</dt>
              <dd>
                {apiDate(ticket.eventDate)}
              </dd>

              <dt>Ticket ID</dt>
              <dd className="mono">
                {ticket.ticketId}
              </dd>
            </dl>

            {cancellable && (
              <div className="cancel">
                <h3>Cancel this ticket</h3>

                <p>
                  We will send a one-time code to the
                  registered email address.
                </p>

                {requested ? (
                  <form onSubmit={cancel}>
                    <label>
                      Cancellation OTP

                      <input
                        required
                        inputMode="numeric"
                        pattern="[0-9]{6}"
                        maxLength="6"
                        value={code}
                        onChange={(e) =>
                          setCode(e.target.value)
                        }
                      />
                    </label>

                    <button disabled={busy}>
                      Confirm cancellation
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={requestCode}
                    disabled={busy}
                  >
                    Request cancellation OTP
                  </button>
                )}
              </div>
            )}
          </article>
        )}
      </main>
    </div>
  );
}

createRoot(
  document.getElementById("root")
).render(<App />);