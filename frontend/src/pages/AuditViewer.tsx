import { useState, useEffect } from 'react';
import { getAuditLogs, getAuditStats } from '../api';

export default function AuditViewer() {
  const [logs, setLogs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [filterDecision, setFilterDecision] = useState<string>('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [logsRes, statsRes] = await Promise.all([
        getAuditLogs(filterDecision ? { decision: filterDecision } : undefined),
        getAuditStats(),
      ]);
      setLogs(logsRes.data);
      setStats(statsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterDecision]);

  const formatTime = (ts: string) => {
    return new Date(ts).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <>
      <div className="section-header">
        <div className="section-label">03 / Immutable Audit</div>
        <h2>Gateway Decisions Log</h2>
        <p className="subtext" style={{ fontSize: '1.1rem', color: 'var(--text-muted)' }}>
          Every single approval or rejection is recorded chronologically to ensure regulatory compliance and explainability.
        </p>
      </div>

      <div className="bendo-grid">
        {/* Stats Row */}
        {stats && (
          <div className="bendo-tile tile-full" style={{ padding: '1.5rem 2.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1.5rem' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 'bold' }}>{stats.total}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Decisions</div>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 'bold', color: 'var(--accent-green)' }}>{stats.approved}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Approved</div>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 'bold', color: 'var(--accent-red)' }}>{stats.rejected}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Rejected</div>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 'bold', color: 'var(--accent-orange)' }}>{stats.failed}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Failed</div>
              </div>
              {/* Growth Stats */}
              <div style={{ paddingLeft: '1.5rem', borderLeft: '1px solid var(--border-hard)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 'bold' }}>
                  ₹{(stats.totalRevenuePaise / 100).toFixed(0)}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Revenue</div>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 'bold', color: 'var(--accent-green)' }}>
                  +₹{(stats.upsellRevenuePaise / 100).toFixed(0)}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>AI Upsell Revenue</div>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 'bold', color: 'var(--accent-green)' }}>
                  {stats.totalRevenuePaise > stats.upsellRevenuePaise ? 
                    ((stats.upsellRevenuePaise / (stats.totalRevenuePaise - stats.upsellRevenuePaise)) * 100).toFixed(1) 
                    : '0.0'}%
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>AI Growth Lift</div>
              </div>
            </div>
          </div>
        )}

        {/* Filter Bar */}
        <div className="bendo-tile tile-full" style={{ padding: '1rem 2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase' }}>
              Filter By Decision:
            </span>
            {['', 'approved', 'rejected', 'failed'].map((d) => (
              <button
                key={d}
                className="btn btn-outline"
                style={{
                  padding: '0.35rem 1rem',
                  fontSize: '0.75rem',
                  background: filterDecision === d ? 'var(--accent-navy)' : 'var(--bg-surface)',
                  color: filterDecision === d ? '#FFF' : 'var(--text-dark)'
                }}
                onClick={() => setFilterDecision(d)}
              >
                {d || 'ALL LOGS'}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <button className="btn btn-outline" style={{ padding: '0.35rem 1rem', fontSize: '0.75rem' }} onClick={fetchData}>
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* Logs Table */}
        <div className="bendo-tile tile-full">
          <span className="tile-tag">Data Ledger</span>
          <h3>Cryptographic Audit Trail</h3>

          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>Loading...</div>
          ) : logs.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No audit logs yet. Execute an agent goal to generate entries.</div>
          ) : (
            <div className="brutal-table-wrap" style={{ marginTop: '1.5rem' }}>
              <table className="brutal-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Actor / Action</th>
                    <th>Product / Amount</th>
                    <th>Decision</th>
                    <th>Reason</th>
                    <th>Order ID</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <>
                      <tr
                        key={log.id}
                        onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                          {formatTime(log.timestamp)}
                        </td>
                        <td>
                          <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{log.actor}</div>
                          <div className="badge" style={{ marginTop: '0.25rem', fontSize: '0.65rem' }}>{log.action.replace(/_/g, ' ')}</div>
                        </td>
                        <td>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{log.productId || '—'}</div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 'bold' }}>
                            {log.requestedAmount ? `₹${(log.requestedAmount / 100).toFixed(2)}` : '—'}
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${log.decision === 'approved' ? 'badge-green' : 'badge-red'}`}>
                            {log.decision.toUpperCase()}
                          </span>
                          {log.decision === 'approved' && (
                            <div style={{ marginTop: '0.35rem', fontSize: '0.6rem', color: 'var(--accent-orange)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                              <span>⚡</span> WEBHOOK SENT
                            </div>
                          )}
                        </td>
                        <td style={{
                          maxWidth: '250px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: '0.85rem',
                          color: 'var(--text-muted)',
                        }}>
                          {log.reason}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                          {log.razorpayOrderId || '—'}
                        </td>
                      </tr>
                      {expandedRow === log.id && (
                        <tr key={`${log.id}-detail`} style={{ background: '#F8F9FA' }}>
                          <td colSpan={6} style={{ padding: '1.5rem 2rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                              <div>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--accent-orange)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Full Gateway Reason</div>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{log.reason}</div>
                              </div>
                              <div>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--accent-orange)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Agent LLM Reasoning</div>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{log.agentReasoning || 'N/A'}</div>
                              </div>
                              <div>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--accent-orange)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Mandate ID</div>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{log.mandateId || 'N/A'}</div>
                              </div>
                              <div>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--accent-orange)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Idempotency Key (Trace ID)</div>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', wordBreak: 'break-all' }}>
                                  {log.idempotencyKey || 'N/A'}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
