import React, { useCallback, useEffect, useRef, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const statusLabels = {
  open: 'Open',
  in_progress: 'In progress',
  closed: 'Closed',
};

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Something went wrong. Please try again.');
  return body;
}

export default function App() {
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState({ open: 0, in_progress: 0, closed: 0 });
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0, limit: 10 });
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshVersion, setRefreshVersion] = useState(0);
  const latestRequest = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++latestRequest.current;
    try {
      setError('');
      const query = new URLSearchParams({ page: String(page), limit: '10' });
      if (statusFilter) query.set('status', statusFilter);
      const [list, counts] = await Promise.all([
        api(`/tickets?${query.toString()}`),
        api('/tickets/stats'),
      ]);
      // Ignore stale responses when filters, pages, or mutations trigger a newer load.
      if (requestId !== latestRequest.current) return;
      setTickets(list.data);
      setPagination(list.pagination);
      setStats(counts);
    } catch (err) {
      if (requestId === latestRequest.current) setError(err.message);
    }
  }, [page, statusFilter, refreshVersion]);

  useEffect(() => { load(); }, [load]);

  async function createTicket(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api('/tickets', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || null,
          priority: form.priority,
        }),
      });
      setForm({ title: '', description: '', priority: 'medium' });
      setPage(1);
      setStatusFilter('');
      setNotice('Ticket created.');
      setRefreshVersion((version) => version + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function updateTicket(id, patch) {
    setError('');
    setNotice('');
    try {
      await api(`/tickets/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
      setNotice('Ticket updated.');
      setRefreshVersion((version) => version + 1);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true">MT</div>
        <h1>Mini Ticket Tracker</h1>
      </header>

      <section className="intro">
        <div>
          <h2>Tickets</h2>
          <p className="muted">Create requests, check their status, and keep the queue up to date.</p>
        </div>
      </section>

      <section className="stats-grid" aria-label="Ticket counts by status">
        {[
          ['open', 'Open'],
          ['in_progress', 'In progress'],
          ['closed', 'Closed'],
        ].map(([key, label]) => (
          <article className={`stat-card stat-${key}`} key={key}>
            <span>{label}</span>
            <strong>{stats[key] ?? 0}</strong>
          </article>
        ))}
      </section>

      <div className="content-grid">
        <section className="panel ticket-panel" aria-labelledby="tickets-heading">
          <div className="panel-heading">
            <div>
              <h2 id="tickets-heading">Ticket list <span className="count-pill">{pagination.total}</span></h2>
            </div>
            <label className="filter-label" htmlFor="status-filter">
              Status
              <select id="status-filter" value={statusFilter} onChange={(event) => { setPage(1); setStatusFilter(event.target.value); }}>
                <option value="">All statuses</option>
                {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>

          {error && <div className="alert error" role="alert">{error}</div>}
          {notice && <div className="alert success" role="status">{notice}</div>}

          <div className="ticket-list" aria-live="polite">
            {tickets.length === 0 && (
              <div className="empty-state">
                <h3>{statusFilter ? `No ${statusLabels[statusFilter].toLowerCase()} tickets` : 'No tickets yet'}</h3>
                <p>{statusFilter ? 'Choose another status to see more tickets.' : 'Use the form to add the first ticket.'}</p>
              </div>
            )}
            {tickets.map((ticket) => (
              <article className="ticket-row" key={ticket.id}>
                <div className="ticket-main">
                  <div className="ticket-title-line">
                    <h3>{ticket.title}</h3>
                    <span className={`priority priority-${ticket.priority}`}>{ticket.priority}</span>
                  </div>
                  {ticket.description && <p className="ticket-description">{ticket.description}</p>}
                  <div className="ticket-meta">
                    <span>Ticket #{ticket.id}</span>
                    <time dateTime={ticket.created_at}>{dateFormatter.format(new Date(ticket.created_at))}</time>
                  </div>
                </div>
                <label className="status-control">
                  <span className={`status-dot dot-${ticket.status}`} aria-hidden="true" />
                  <span className="sr-only">Status for {ticket.title}</span>
                  <select aria-label={`Status for ${ticket.title}`} value={ticket.status} onChange={(event) => updateTicket(ticket.id, { status: event.target.value })}>
                    {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
              </article>
            ))}
          </div>

          <div className="pagination">
            <span>Showing {tickets.length ? (page - 1) * pagination.limit + 1 : 0}–{Math.min(page * pagination.limit, pagination.total)} of {pagination.total}</span>
            <div>
              <button className="secondary-button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
              <span className="page-number">{page} / {Math.max(pagination.totalPages, 1)}</span>
              <button className="secondary-button" disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)}>Next</button>
            </div>
          </div>
        </section>

        <aside className="panel create-panel" aria-labelledby="new-ticket-heading">
          <h2 id="new-ticket-heading">New ticket</h2>
          <form onSubmit={createTicket}>
            <label htmlFor="ticket-title">Ticket title <span className="required" aria-hidden="true">*</span>
              <input id="ticket-title" name="title" required maxLength="200" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Unable to reset password" />
            </label>
            <label htmlFor="ticket-description">Description <span className="optional">(optional)</span>
              <textarea id="ticket-description" name="description" rows="4" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Add details that may help resolve the issue." />
            </label>
            <label htmlFor="ticket-priority">Priority
              <select id="ticket-priority" name="priority" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
              </select>
            </label>
            <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create ticket'}</button>
          </form>
          <p className="form-footnote">New tickets are added with Open status.</p>
        </aside>
      </div>
    </main>
  );
}
