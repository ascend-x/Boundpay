import { db } from '../../db/index.js';
import { auditLogs, NewAuditLog, AuditLog } from '../../db/schema.js';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';
import { logger } from '../../utils/logger.js';

/**
 * Write an audit log entry. Append-only — never update or delete.
 */
export async function writeAuditLog(entry: Omit<NewAuditLog, 'id' | 'timestamp'>): Promise<AuditLog> {
  const [log] = await db
    .insert(auditLogs)
    .values(entry)
    .returning();

  logger.info(
    {
      auditLogId: log.id,
      action: log.action,
      decision: log.decision,
      mandateId: log.mandateId,
      productId: log.productId,
    },
    `Audit: ${log.decision} — ${log.reason}`
  );

  return log;
}

/**
 * Query audit logs with optional filters.
 */
export async function queryAuditLogs(filters: {
  buyerId?: string;
  mandateId?: string;
  decision?: 'approved' | 'rejected' | 'failed';
  from?: string;
  to?: string;
  limit?: number;
}): Promise<AuditLog[]> {
  const conditions: ReturnType<typeof eq>[] = [];

  if (filters.buyerId) {
    conditions.push(eq(auditLogs.actor, filters.buyerId));
  }
  if (filters.mandateId) {
    conditions.push(eq(auditLogs.mandateId, filters.mandateId));
  }
  if (filters.decision) {
    conditions.push(eq(auditLogs.decision, filters.decision));
  }
  if (filters.from) {
    conditions.push(gte(auditLogs.timestamp, new Date(filters.from)));
  }
  if (filters.to) {
    conditions.push(lte(auditLogs.timestamp, new Date(filters.to)));
  }

  const query = db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.timestamp))
    .limit(filters.limit ?? 100);

  if (conditions.length > 0) {
    return query.where(and(...conditions));
  }

  return query;
}

/**
 * Get audit log stats.
 */
export async function getAuditStats(): Promise<{
  total: number;
  approved: number;
  rejected: number;
  failed: number;
  totalRevenuePaise: number;
  upsellRevenuePaise: number;
}> {
  const [stats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      approved: sql<number>`count(*) filter (where decision = 'approved')::int`,
      rejected: sql<number>`count(*) filter (where decision = 'rejected')::int`,
      failed: sql<number>`count(*) filter (where decision = 'failed')::int`,
      totalRevenuePaise: sql<number>`COALESCE(sum(requested_amount) filter (where decision = 'approved'), 0)::int`,
      upsellRevenuePaise: sql<number>`COALESCE(sum(requested_amount) filter (where decision = 'approved' and agent_reasoning like '%[UPSELL]%'), 0)::int`,
    })
    .from(auditLogs);

  return stats;
}
