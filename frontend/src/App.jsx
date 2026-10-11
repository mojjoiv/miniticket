import React, { useCallback, useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const statusLabels = {
  open: 'Open',
  in_progress: 'In progress',
  closed: 'Closed',
};

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

  const load = useCallback(async () => {
    try {
      setError('');
      const query = new URLSearchParams({ page: String(page), limit: '10' });
      if (statusFilter) query.set('status', statusFilter);
      const [list, counts] = await Promise.all([
        api(`/tickets?${query.toString()}`),
        api('/tickets/stats'),
      ]);
      setTickets(list.data);
      setPagination(list.pagination);
      setStats(counts);
    } catch (err) {
      setError(err.message);
    }
  }, [page, statusFilter]);

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
          title: form.title,
          description: form.description || null,
          priority: form.priority,
        }),
      });
      setForm({ title: '', description: '', priority: 'medium' });
      setPage(1);
      setStatusFilter('');
      setNotice('Ticket created successfully.');
      await load();
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
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand-mark">MT</div>
        <div><p className="eyebrow">SUPPORT OPERATIONS</p><h1>Mini Ticket Tracker</h1></div>
        <span className="live-indicator"><span /> Live workspace</span>
      </header>

      <section className="intro">
        <div><p className="eyebrow">OVERVIEW</p><h2>Keep every issue moving.</h2>
          <p className="muted">A simple place to capture requests and track their progress.</p></div>
        <div className="total-card"><span>Total tickets</span><strong>{stats.open + stats.in_progress + stats.closed}</strong></div>
      </section>

      <section className="stats-grid" aria-label="Ticket counts by status">
        {[
          ['open', 'Open', 'blue'],
          ['in_progress', 'In progress', 'amber'],
          ['closed', 'Closed', 'green'],
        ].map(([key, label, color]) => (
          <article className="stat-card" key={key}>
            <div className={`stat-icon ${color}`}>{key === 'open' ? '○' : key === 'in_progress' ? '◷' : '✓'}</div>
            <div><span>{label}</span><strong>{stats[key] ?? 0}</strong></div>
            <span className="stat-caption">tickets</span>
          </article>
        ))}
      </section>

      <div className="content-grid">
        <section className="panel ticket-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">INBOX</p><h2>Tickets <span className="count-pill">{pagination.total}</span></h2></div>
            <label className="filter-label">Status
              <select value={statusFilter} onChange={(event) => { setPage(1); setStatusFilter(event.target.value); }}>
                <option value="">All statuses</option>
                {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>

          {error && <div className="alert error" role="alert">{error}</div>}
          {notice && <div className="alert success" role="status">{notice}</div>}

          <div className="ticket-list">
            {tickets.length === 0 && <div className="empty-state"><div className="empty-icon">✓</div><h3>No tickets here yet</h3><p>Create a ticket or choose another status filter.</p></div>}
            {tickets.map((ticket) => (
              <article className="ticket-row" key={ticket.id}>
                <div className="ticket-main">
                  <div className="ticket-title-line"><h3>{ticket.title}</h3><span className={`priority priority-${ticket.priority}`}>{ticket.priority}</span></div>
                  {ticket.description && <p className="ticket-description">{ticket.description}</p>}
                  <div className="ticket-meta"><span>#{ticket.id}</span><span>{new Date(ticket.created_at).toLocaleDateString()}</span></div>
                </div>
                <label className="status-control"><span className={`status-dot dot-${ticket.status}`} /> <select aria-label={`Status for ${ticket.title}`} value={ticket.status} onChange={(event) => updateTicket(ticket.id, { status: event.target.value })}>
                  {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select></label>
              </article>
            ))}
          </div>

          <div className="pagination">
            <span>Showing {tickets.length ? (page - 1) * pagination.limit + 1 : 0}–{Math.min(page * pagination.limit, pagination.total)} of {pagination.total}</span>
            <div><button className="secondary-button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
              <span className="page-number">{page} / {Math.max(pagination.totalPages, 1)}</span>
              <button className="secondary-button" disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)}>Next</button></div>
          </div>
        </section>

        <aside className="panel create-panel">
          <p className="eyebrow">NEW REQUEST</p><h2>Create a ticket</h2>
          <p className="muted form-intro">Add the details below to get an issue into the queue.</p>
          <form onSubmit={createTicket}>
            <label>Ticket title <span className="required">*</span>
              <input required maxLength="200" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Unable to reset password" />
            </label>
            <label>Description <span className="optional">(optional)</span>
              <textarea rows="4" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Share any details that will help resolve this issue..." />
            </label>
            <label>Priority
              <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
              </select>
            </label>
            <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Creating…' : '＋  Create ticket'}</button>
          </form>
          <div className="form-footnote"><span>ⓘ</span> New tickets start with an open status.</div>
        </aside>
      </div>
    </main>
  );
}
