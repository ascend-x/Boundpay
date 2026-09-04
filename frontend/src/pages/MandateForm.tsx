import { useState, useEffect } from 'react';
import { getMandates, createMandate, revokeMandate } from '../api';

const CATEGORIES = ['sports', 'fitness', 'electronics', 'nutrition'];

export default function MandateForm() {
  const [mandates, setMandates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: string; message: string } | null>(null);

  // Form state
  const [buyerId, setBuyerId] = useState('buyer_priya');
  const [maxSpend, setMaxSpend] = useState('5000');
  const [maxTx, setMaxTx] = useState('3');
  const [selectedCats, setSelectedCats] = useState<string[]>(['sports', 'fitness']);
  const [expiryHours, setExpiryHours] = useState('24');

  const fetchMandates = async () => {
    try {
      const res = await getMandates();
      setMandates(res.data);
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMandates();
  }, []);

  const showToast = (type: string, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const toggleCategory = (cat: string) => {
    setSelectedCats((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCats.length === 0) {
      showToast('error', 'Select at least one category');
      return;
    }

    setSubmitting(true);
    try {
      const expires = new Date();
      expires.setHours(expires.getHours() + parseInt(expiryHours));

      await createMandate({
        buyerId,
        maxSpendInr: Math.round(parseFloat(maxSpend) * 100), // Convert ₹ to paise
        allowedCategories: selectedCats,
        maxTransactions: parseInt(maxTx),
        expiresAt: expires.toISOString(),
      });

      showToast('success', 'Mandate created successfully');
      fetchMandates();
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await revokeMandate(id);
      showToast('success', 'Mandate revoked');
      fetchMandates();
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getMandateStatus = (mandate: any) => {
    if (mandate.status === 'revoked') return 'revoked';
    if (new Date(mandate.expiresAt) < new Date()) return 'expired';
    return 'active';
  };

  return (
    <>
      <div className="section-header">
        <div className="section-label">02 / Mandate Authority</div>
        <h2>Create & Manage Mandates</h2>
        <p className="subtext" style={{ fontSize: '1.1rem', color: 'var(--text-muted)' }}>
          Set strict financial bounds modeled after the <strong>Google AP2 Agentic Payment Protocol</strong>. 
          The Gateway enforces these limits independently of the AI Agent, mirroring Razorpay's NPCI in-app pilots.
        </p>
      </div>

      <div className="bendo-grid">
        {/* Create Form */}
        <div className="bendo-tile tile-small">
          <span className="tile-tag">Authorization</span>
          <h3>Issue Mandate</h3>

          <form onSubmit={handleSubmit} style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div className="form-group">
              <label>Buyer ID</label>
              <input
                type="text"
                className="form-input"
                value={buyerId}
                onChange={(e) => setBuyerId(e.target.value)}
                placeholder="e.g. buyer_priya"
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>Max Spend (₹)</label>
                <input
                  type="number"
                  className="form-input"
                  value={maxSpend}
                  onChange={(e) => setMaxSpend(e.target.value)}
                  min="1"
                  step="0.01"
                  required
                />
              </div>
              <div className="form-group">
                <label>Max Txns</label>
                <input
                  type="number"
                  className="form-input"
                  value={maxTx}
                  onChange={(e) => setMaxTx(e.target.value)}
                  min="1"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Allowed Categories</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {CATEGORIES.map((cat) => (
                  <button
                    type="button"
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={`badge ${selectedCats.includes(cat) ? 'badge-saffron' : ''}`}
                    style={{ cursor: 'pointer', opacity: selectedCats.includes(cat) ? 1 : 0.6 }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Expires In (hours)</label>
              <input
                type="number"
                className="form-input"
                value={expiryHours}
                onChange={(e) => setExpiryHours(e.target.value)}
                min="1"
                max="720"
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{ width: '100%', marginTop: 'auto' }}
            >
              {submitting ? 'Creating...' : '🔏 Create Mandate'}
            </button>
          </form>
        </div>

        {/* Mandates List */}
        <div className="bendo-tile tile-large">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span className="tile-tag">Active State</span>
              <h3>Current Mandates</h3>
            </div>
            <button className="btn btn-outline" style={{ padding: '0.5rem 1rem' }} onClick={fetchMandates}>
              ↻ Refresh
            </button>
          </div>

          <div className="brutal-table-wrap" style={{ marginTop: '1.5rem', flex: 1 }}>
            <table className="brutal-table">
              <thead>
                <tr>
                  <th>ID / Buyer</th>
                  <th>Spend / Used</th>
                  <th>Categories</th>
                  <th>Txns</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {mandates.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>No mandates found.</td>
                  </tr>
                ) : (
                  mandates.map((m) => {
                    const status = getMandateStatus(m);
                    return (
                      <tr key={m.id}>
                        <td>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 'bold' }}>{m.id}</div>
                          <div style={{ fontSize: '0.85rem' }}>{m.buyerId}</div>
                        </td>
                        <td>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>₹{(m.maxSpendInr / 100).toFixed(2)}</div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>₹{(m.amountSpent / 100).toFixed(2)} used</div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {(m.allowedCategories as string[]).map((c: string) => (
                              <span key={c} className="badge" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>{c}</span>
                            ))}
                          </div>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                          {m.transactionsUsed}/{m.maxTransactions}
                        </td>
                        <td>
                          <span className={`badge ${status === 'active' ? 'badge-green' : 'badge-red'}`}>
                            {status.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          {status === 'active' && (
                            <button
                              className="btn btn-outline"
                              style={{ padding: '0.3rem 0.8rem', fontSize: '0.7rem', color: 'var(--accent-red)', borderColor: 'var(--accent-red)' }}
                              onClick={() => handleRevoke(m.id)}
                            >
                              Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
