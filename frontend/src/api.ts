const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error?.message || `HTTP ${res.status}`);
  }

  return data;
}

// ─── Catalog ─────────────────────────────────────────────────────────

export async function getProducts(category?: string) {
  const params = category ? `?category=${category}` : '';
  return request<{ data: any[]; count: number }>(`/catalog/products${params}`);
}

// ─── Mandates ────────────────────────────────────────────────────────

export async function getMandates(buyerId?: string) {
  const params = buyerId ? `?buyer_id=${buyerId}` : '';
  return request<{ data: any[]; count: number }>(`/mandates${params}`);
}

export async function getMandate(id: string) {
  return request<{ data: any }>(`/mandates/${id}`);
}

export async function createMandate(body: {
  buyerId: string;
  maxSpendInr: number;
  allowedCategories: string[];
  maxTransactions: number;
  expiresAt: string;
}) {
  return request<{ data: any }>('/mandates', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function revokeMandate(id: string) {
  return request<{ data: any }>(`/mandates/${id}/revoke`, {
    method: 'POST',
    body: '{}',
  });
}

// ─── Audit ───────────────────────────────────────────────────────────

export async function getAuditLogs(filters?: {
  buyer_id?: string;
  mandate_id?: string;
  decision?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.buyer_id) params.set('buyer_id', filters.buyer_id);
  if (filters?.mandate_id) params.set('mandate_id', filters.mandate_id);
  if (filters?.decision) params.set('decision', filters.decision);
  const qs = params.toString();
  return request<{ data: any[]; count: number }>(`/audit${qs ? `?${qs}` : ''}`);
}

export async function getAuditStats() {
  return request<{ data: { total: number; approved: number; rejected: number; failed: number; totalRevenuePaise: number; upsellRevenuePaise: number } }>(
    '/audit/stats'
  );
}

// ─── Agent ───────────────────────────────────────────────────────────

export async function executeGoal(body: {
  buyer_id: string;
  mandate_id: string;
  goal: string;
}) {
  return request<{ data: any }>('/agent/execute-goal', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
