import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import * as api from "./api/admin";
import "./styles.css";

const formatDate = (value) => (value ? new Date(value).toLocaleString() : "—");
function Status({ value }) {
  return (
    <span className={`status status-${String(value).toLowerCase()}`}>
      {value}
    </span>
  );
}

function Login({ onLogin }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      onLogin(await api.login(form.email, form.password));
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <main className="login">
      <div className="login-card">
        <p className="eyebrow">EVENT CONTROL</p>
        <h1>Admin sign in</h1>
        <p className="muted">
          Manage owned events, tickets, and check-in activity.
        </p>
        <form onSubmit={submit}>
          <label>
            Email
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </label>
          {error && <div className="error">{error}</div>}
          <button>Sign in</button>
        </form>
      </div>
    </main>
  );
}

function Dashboard({ session, logout }) {
  const [events, setEvents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [stats, setStats] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const token = session.token;
  async function load() {
    try {
      setEvents(await api.listEvents(token));
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function selectEvent(event) {
    setSelected(event);
    try {
      const [s, t] = await Promise.all([
        api.getStats(token, event.eventId),
        api.listTickets(token, event.eventId),
      ]);
      setStats(s);
      setTickets(t);
    } catch (e) {
      setError(e.message);
    }
  }
  async function action(fn, id) {
    try {
      await fn(token, id);
      if (selected) await selectEvent(selected);
    } catch (e) {
      setError(e.message);
    }
  }
  const filtered = useMemo(
    () =>
      tickets.filter((t) =>
        `${t.attendeeName} ${t.attendeeEmail} ${t.ticketId} ${t.status}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [tickets, search],
  );
  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">EVENT CONTROL</p>
          <h1>Operations dashboard</h1>
        </div>
        <div className="top-actions">
          <span className="muted">
            {session.admin?.name || session.admin?.email}
          </span>
          <button className="ghost" onClick={logout}>
            Log out
          </button>
        </div>
      </header>
      <main className="content">
        {error && <div className="error">{error}</div>}
        <div className="toolbar">
          <div>
            <h2>Events</h2>
            <p className="muted">
              Only events owned by your administrator account are shown.
            </p>
          </div>
          <button onClick={() => setShowCreate(true)}>+ Create event</button>
        </div>
        <section className="event-grid">
          {events.map((event) => (
            <button
              className={`event-card ${selected?.eventId === event.eventId ? "selected" : ""}`}
              key={event.eventId}
              onClick={() => selectEvent(event)}
            >
              <span className="event-date">{formatDate(event.date)}</span>
              <h3>{event.name}</h3>
              <p>{event.venue || "Venue not specified"}</p>
              <div className="event-footer">
                <Status value={event.status} />
                <span>
                  {event.ticketsIssued} / {event.capacity ?? "∞"} issued
                </span>
              </div>
            </button>
          ))}
        </section>
        {selected && (
          <section className="detail">
            <div className="toolbar">
              <div>
                <p className="eyebrow">EVENT DETAIL</p>
                <h2>{selected.name}</h2>
              </div>
              <Status value={selected.status} />
            </div>
            {stats && (
              <div className="stats">
                {[
                  ["Active tickets", stats.activeValidTickets],
                  ["Checked in", stats.breakdown.checkedIn],
                  ["Cancelled", stats.breakdown.cancelled],
                  ["Remaining", stats.remainingCapacity ?? "∞"],
                ].map(([label, value]) => (
                  <div className="stat" key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
            )}
            <div className="ticket-toolbar">
              <h3>Tickets</h3>
              <input
                placeholder="Search name, email, ID, status"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Attendee</th>
                    <th>Ticket ID</th>
                    <th>Status</th>
                    <th>Issued</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((ticket) => (
                    <tr key={ticket.ticketId}>
                      <td>
                        <strong>{ticket.attendeeName}</strong>
                        <small>{ticket.attendeeEmail}</small>
                      </td>
                      <td className="mono">{ticket.ticketId}</td>
                      <td>
                        <Status value={ticket.status} />
                      </td>
                      <td>{formatDate(ticket.createdAt)}</td>
                      <td>
                        <button
                          className="small"
                          disabled={
                            ticket.status === "CANCELLED" ||
                            ticket.status === "CHECKED_IN"
                          }
                          onClick={() =>
                            action(api.cancelTicket, ticket.ticketId)
                          }
                        >
                          Cancel
                        </button>
                        <button
                          className="small ghost"
                          disabled={ticket.status === "CANCELLED"}
                          onClick={() =>
                            action(api.resendTicket, ticket.ticketId)
                          }
                        >
                          Resend
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
      {showCreate && (
        <CreateModal
          token={token}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function CreateModal({ token, onClose, onCreated }) {
  const [form, setForm] = useState({
    name: "",
    venue: "",
    date: "",
    capacity: "",
  });
  const [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    try {
      await api.createEvent(token, {
        ...form,
        capacity: form.capacity || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <div className="modal-backdrop">
      <form className="modal" onSubmit={submit}>
        <div className="toolbar">
          <h2>Create event</h2>
          <button type="button" className="ghost" onClick={onClose}>
            Close
          </button>
        </div>
        {["name", "venue", "date", "capacity"].map((key) => (
          <label key={key}>
            {key === "date"
              ? "Date and time"
              : key[0].toUpperCase() + key.slice(1)}
            <input
              required={key === "name" || key === "date"}
              type={
                key === "date"
                  ? "datetime-local"
                  : key === "capacity"
                    ? "number"
                    : "text"
              }
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
          </label>
        ))}
        {error && <div className="error">{error}</div>}
        <button>Create event</button>
      </form>
    </div>
  );
}
function App() {
  const [session, setSession] = useState(() =>
    JSON.parse(localStorage.getItem("adminSession") || "null"),
  );
  function login(value) {
    localStorage.setItem("adminSession", JSON.stringify(value));
    setSession(value);
  }
  function logout() {
    localStorage.removeItem("adminSession");
    setSession(null);
  }
  return session?.token ? (
    <Dashboard session={session} logout={logout} />
  ) : (
    <Login onLogin={login} />
  );
}
createRoot(document.getElementById("root")).render(<App />);
