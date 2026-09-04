import { useState, useEffect } from 'react';
import { executeGoal, getMandates } from '../api';

export default function AgentDemo() {
  const [mandates, setMandates] = useState<any[]>([]);
  const [selectedMandate, setSelectedMandate] = useState('');
  const [goal, setGoal] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [toast, setToast] = useState<{ type: string; message: string } | null>(null);

  useEffect(() => {
    getMandates().then((res) => {
      const active = res.data.filter(
        (m: any) => m.status === 'active' && new Date(m.expiresAt) > new Date()
      );
      setMandates(active);
      if (active.length > 0) setSelectedMandate(active[0].id);
    });
  }, []);

  const showToast = (type: string, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const handleRun = async () => {
    if (!goal.trim() || !selectedMandate) {
      showToast('error', 'Please enter a goal and select a mandate');
      return;
    }

    setRunning(true);
    setResult(null);

    try {
      const mandate = mandates.find((m: any) => m.id === selectedMandate);
      const res = await executeGoal({
        buyer_id: mandate?.buyerId || 'buyer_priya',
        mandate_id: selectedMandate,
        goal: goal.trim(),
      });
      setResult(res.data);
    } catch (err: any) {
      // Even on error status codes, we may have structured data
      try {
        const parsed = JSON.parse(err.message);
        setResult(parsed);
      } catch {
        showToast('error', err.message);
      }
    } finally {
      setRunning(false);
    }
  };

  const EXAMPLE_GOALS = [
    'Buy the best running shoes under ₹3000',
    'Find me a fitness product under ₹1000',
    'I need a cricket bat, budget ₹4000',
    'Get me wireless earbuds for working out',
  ];

  return (
    <>
      <div className="section-header">
        <div className="section-label">01 / Agentic Automation</div>
        <h2>Execute Autonomous Goals</h2>
        <p className="subtext" style={{ fontSize: '1.1rem', color: 'var(--text-muted)' }}>
          Give the AI buyer agent a natural language goal. Watch it parse limits, reason over a catalog, and attempt a test purchase.
        </p>
      </div>

      <div className="bendo-grid">
        {/* Input Panel */}
        <div className="bendo-tile tile-half">
          <span className="tile-tag">Control Panel</span>
          <h3>Input Parameters</h3>
          
          <div className="form-group" style={{ marginTop: '1.5rem' }}>
            <label>1. Select Authorized Mandate</label>
            {mandates.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--accent-red)', fontWeight: 'bold' }}>
                ⚠️ No active mandates. Create one first.
              </p>
            ) : (
              <select
                className="form-input"
                value={selectedMandate}
                onChange={(e) => setSelectedMandate(e.target.value)}
              >
                {mandates.map((m: any) => (
                  <option key={m.id} value={m.id}>
                    {m.id} — ₹{((m.maxSpendInr - m.amountSpent) / 100).toFixed(0)} rem — [{(m.allowedCategories as string[]).join(', ')}]
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="form-group">
            <label>2. Define Agent Goal</label>
            <input
              type="text"
              className="form-input"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder='e.g. "Buy running shoes under ₹3000"'
              onKeyDown={(e) => e.key === 'Enter' && !running && handleRun()}
            />
          </div>

          <button
            className="btn btn-primary"
            onClick={handleRun}
            disabled={running || mandates.length === 0}
            style={{ width: '100%', marginTop: 'auto' }}
          >
            {running ? 'Executing...' : '▶ Execute Goal'}
          </button>
        </div>

        {/* Quick Goals */}
        <div className="bendo-tile tile-half tile-dark">
          <span className="tile-tag" style={{ color: 'var(--accent-saffron)' }}>Presets</span>
          <h3>Quick Tests</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.5rem' }}>
            {EXAMPLE_GOALS.map((g) => (
              <button
                key={g}
                className="btn btn-outline"
                style={{ justifyContent: 'flex-start', textAlign: 'left', background: 'var(--bg-base)', border: 'none', color: 'var(--text-dark)' }}
                onClick={() => setGoal(g)}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Output Terminal */}
        {(running || result) && (
          <div className="bendo-tile tile-full">
            <span className="tile-tag">Execution Output</span>
            <h3>Live Agent Trace</h3>
            
            <div className="terminal" style={{ marginTop: '1.5rem' }}>
              <div className="terminal-bar">
                <div className="terminal-dots">
                  <span className="term-dot red"></span>
                  <span className="term-dot yellow"></span>
                  <span className="term-dot green"></span>
                </div>
                <div className="terminal-title">Agentic Orchestrator Terminal</div>
              </div>
              <div className="terminal-body">
                {running && (
                  <div style={{ color: 'var(--accent-saffron)' }}>&gt; Agent reasoning in progress...</div>
                )}
                {result && result.steps && result.steps.map((step: any, idx: number) => {
                  const isFailed = step.action.includes('failed') || step.action.includes('error');
                  const isSuccess = step.action === 'gateway_response' && step.detail?.includes('approved');
                  return (
                    <div key={idx} style={{ marginBottom: '0.5rem', color: isFailed ? '#FF5F56' : isSuccess ? '#27C93F' : undefined }}>
                      <span className="log-time">[{new Date(step.timestamp).toLocaleTimeString()}]</span>
                      <span className="log-action" style={isFailed ? { color: '#FF5F56' } : undefined}>[{step.action.toUpperCase()}]</span>{' '}
                      <span className="log-detail">{step.detail}</span>
                    </div>
                  );
                })}
                {result && (
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed #30363D' }}>
                    <div style={{ color: result.finalStatus === 'success' ? '#27C93F' : '#FF5F56', fontWeight: 'bold' }}>
                      &gt; Final Result: {result.finalStatus.toUpperCase()}
                    </div>
                    <div style={{ color: '#C9D1D9', marginTop: '0.25rem' }}>
                      {result.summary}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sub-cards for Details if success/rejected */}
            {result && result.selection && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
                <div style={{ padding: '1.5rem', background: 'var(--bg-base)', border: '1px solid var(--border-hard)' }}>
                  <div className="tile-tag">Reasoning Details</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                    <strong>Confidence:</strong> {(result.selection.confidence * 100).toFixed(0)}%<br/><br/>
                    {result.selection.reason}
                    {result.selection.upsellProductId && (
                      <div style={{ marginTop: '0.5rem', color: 'var(--accent-green)' }}>
                        <strong>Upsell Recommended:</strong> {result.selection.upsellProductId}
                      </div>
                    )}
                  </div>
                </div>
                
                {result.purchaseResults && result.purchaseResults.length > 0 && (
                  <div style={{ padding: '1.5rem', background: 'var(--bg-base)', border: '1px solid var(--border-hard)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="tile-tag">Gateway Transactions</div>
                    {result.purchaseResults.map((pr: any, idx: number) => (
                      <div key={idx} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', paddingBottom: '0.5rem', borderBottom: idx < result.purchaseResults.length - 1 ? '1px dashed #ccc' : 'none' }}>
                        {pr.orderId && (
                          <><strong>Order ID:</strong> {pr.orderId}<br/></>
                        )}
                        <strong>Status:</strong>{' '}
                        <span style={{ color: pr.status === 'approved' ? 'var(--accent-green)' : pr.status === 'rejected' ? 'var(--accent-red)' : 'var(--accent-orange)' }}>
                          {pr.status.toUpperCase()}
                        </span><br/>
                        <strong>Reason:</strong> {pr.reason}
                        {pr.product && (
                          <div style={{ marginTop: '0.35rem', color: 'var(--text-muted)' }}>
                            {pr.product.name} — ₹{(pr.product.priceInr / 100).toFixed(2)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Failure Diagnosis Panel */}
            {result && result.finalStatus === 'failed' && !result.selection && (
              <div style={{ marginTop: '1.5rem', padding: '1.5rem 2rem', background: '#FFF5F5', border: '2px solid var(--accent-red)', borderRadius: '0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>🚨</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold', fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--accent-red)' }}>
                    Failure Diagnosis
                  </span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', lineHeight: '1.6' }}>
                  <strong>What happened:</strong> {result.summary}
                </div>
                <div style={{ marginTop: '1rem', padding: '1rem', background: '#FFF', border: '1px dashed var(--border-hard)' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--accent-orange)', marginBottom: '0.5rem' }}>
                    Suggested Actions
                  </div>
                  <ul style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', paddingLeft: '1.25rem', margin: 0 }}>
                    {result.summary?.includes('budget') || result.summary?.includes('No products') ? (
                      <>
                        <li>Create a new mandate with a higher budget (🔏 Mandates tab)</li>
                        <li>Broaden the allowed categories on the mandate</li>
                      </>
                    ) : result.summary?.includes('reasoning') || result.summary?.includes('Groq') ? (
                      <>
                        <li>The AI model returned an invalid response — try again</li>
                        <li>Check if the Groq API key is valid and has quota remaining</li>
                      </>
                    ) : (
                      <>
                        <li>Check the Audit Log (📋) for detailed rejection reasons</li>
                        <li>Verify the mandate has sufficient budget and valid categories</li>
                      </>
                    )}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
