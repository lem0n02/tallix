// Cloudflare Worker API & D1 Backend for Tallix Offline-First Architecture
// Supports edge-deployed idempotent sync, soft deletes, and conflict resolution

export interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<{ success: boolean; meta: any }>;
  all<T = unknown>(): Promise<{ results: T[]; success: boolean; meta: any }>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<{ results: T[]; success: boolean }[]>;
  exec(query: string): Promise<{ count: number; duration: number }>;
}

export interface Env {
  DB: D1Database;
  GEMINI_API_KEY?: string;
  ENVIRONMENT?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Device-Id',
};

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    try {
      // 1. Health check
      if (url.pathname === '/api/health') {
        let dbOk = false;
        try {
          if (env.DB) {
            await env.DB.prepare('SELECT 1').first();
            dbOk = true;
          }
        } catch {
          dbOk = false;
        }

        return jsonResponse({
          status: 'operational',
          engine: 'Cloudflare Workers + D1',
          environment: env.ENVIRONMENT || 'production',
          timestamp: new Date().toISOString(),
          databaseConnected: dbOk,
        });
      }

      // 2. Sync Push (Client -> Server) with strict idempotency
      if (url.pathname === '/api/sync/push' && request.method === 'POST') {
        const body = (await request.json()) as {
          clientDeviceId: string;
          userId: string;
          mutations: any[];
        };

        if (!body || !Array.isArray(body.mutations)) {
          return jsonResponse({ success: false, error: 'Invalid payload' }, 400);
        }

        const now = new Date().toISOString();
        const processedMutationIds: string[] = [];
        const failedMutations: { mutationId: string; error: string }[] = [];

        for (const mut of body.mutations) {
          try {
            // Check if already processed (Idempotency)
            const existing = await env.DB.prepare(
              'SELECT mutation_id FROM processed_mutations WHERE mutation_id = ?'
            )
              .bind(mut.mutationId)
              .first();

            if (existing) {
              processedMutationIds.push(mut.mutationId);
              continue;
            }

            // Process based on entity type & operation
            if (mut.entityType === 'expense') {
              const exp = mut.payload;
              if (mut.operation === 'CREATE' || mut.operation === 'UPDATE') {
                const amount = Math.round(Number(exp.amount) * 100) / 100;
                const paisa = Math.round(amount * 100);

                await env.DB.prepare(`
                  INSERT INTO expenses (
                    id, group_id, group_name, is_shared, title, merchant,
                    amount, amount_paisa, currency, category, payment_method,
                    date, status, paid_by_user_id, paid_by_name, created_by,
                    created_by_email, splits_json, receipt_url, notes,
                    version, created_at, updated_at, deleted_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
                  ON CONFLICT(id) DO UPDATE SET
                    group_id = excluded.group_id,
                    group_name = excluded.group_name,
                    is_shared = excluded.is_shared,
                    title = excluded.title,
                    merchant = excluded.merchant,
                    amount = excluded.amount,
                    amount_paisa = excluded.amount_paisa,
                    currency = excluded.currency,
                    category = excluded.category,
                    payment_method = excluded.payment_method,
                    date = excluded.date,
                    status = excluded.status,
                    paid_by_user_id = excluded.paid_by_user_id,
                    paid_by_name = excluded.paid_by_name,
                    splits_json = excluded.splits_json,
                    notes = excluded.notes,
                    version = version + 1,
                    updated_at = excluded.updated_at,
                    deleted_at = NULL
                `)
                  .bind(
                    exp.id,
                    exp.groupId || null,
                    exp.groupName || null,
                    exp.isShared ? 1 : 0,
                    exp.title || 'Expense',
                    exp.merchant || null,
                    amount,
                    paisa,
                    exp.currency || 'BDT',
                    exp.category || 'General',
                    exp.paymentMethod || 'Cash',
                    exp.date || now.split('T')[0],
                    exp.status || 'Completed',
                    exp.paidByUserId,
                    exp.paidByName || null,
                    exp.createdBy || null,
                    exp.createdByEmail || null,
                    exp.splits ? JSON.stringify(exp.splits) : null,
                    exp.receiptUrl || null,
                    exp.notes || null,
                    exp.version || 1,
                    exp.createdAt || now,
                    now
                  )
                  .run();
              } else if (mut.operation === 'DELETE') {
                await env.DB.prepare('UPDATE expenses SET deleted_at = ?, updated_at = ? WHERE id = ?')
                  .bind(now, now, mut.entityId)
                  .run();
              }
            } else if (mut.entityType === 'group') {
              const grp = mut.payload;
              if (mut.operation === 'CREATE' || mut.operation === 'UPDATE') {
                await env.DB.prepare(`
                  INSERT INTO groups (
                    id, name, description, category, currency, invite_code,
                    image_url, created_by, members_json, total_spent,
                    unsettled_amount, version, created_at, updated_at, deleted_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
                  ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    description = excluded.description,
                    category = excluded.category,
                    currency = excluded.currency,
                    image_url = excluded.image_url,
                    members_json = excluded.members_json,
                    total_spent = excluded.total_spent,
                    unsettled_amount = excluded.unsettled_amount,
                    version = version + 1,
                    updated_at = excluded.updated_at,
                    deleted_at = NULL
                `)
                  .bind(
                    grp.id,
                    grp.name,
                    grp.description || '',
                    grp.category || 'General',
                    grp.currency || 'BDT',
                    grp.inviteCode || null,
                    grp.imageUrl || null,
                    grp.createdBy || null,
                    JSON.stringify(grp.members || []),
                    grp.totalSpent || 0,
                    grp.unsettledAmount || 0,
                    grp.version || 1,
                    grp.createdAt || now,
                    now
                  )
                  .run();
              } else if (mut.operation === 'DELETE') {
                await env.DB.prepare('UPDATE groups SET deleted_at = ?, updated_at = ? WHERE id = ?')
                  .bind(now, now, mut.entityId)
                  .run();
              }
            } else if (mut.entityType === 'settlement') {
              const stl = mut.payload;
              if (mut.operation === 'CREATE' || mut.operation === 'UPDATE') {
                const amount = Math.round(Number(stl.amount) * 100) / 100;
                const paisa = Math.round(amount * 100);

                await env.DB.prepare(`
                  INSERT INTO settlements (
                    id, group_id, group_name, from_user_id, from_user_name,
                    to_user_id, to_user_name, amount, amount_paisa, currency,
                    payment_method, status, proof_url, note, version,
                    created_at, updated_at, deleted_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
                  ON CONFLICT(id) DO UPDATE SET
                    group_id = excluded.group_id,
                    group_name = excluded.group_name,
                    from_user_id = excluded.from_user_id,
                    from_user_name = excluded.from_user_name,
                    to_user_id = excluded.to_user_id,
                    to_user_name = excluded.to_user_name,
                    amount = excluded.amount,
                    amount_paisa = excluded.amount_paisa,
                    currency = excluded.currency,
                    payment_method = excluded.payment_method,
                    status = excluded.status,
                    proof_url = excluded.proof_url,
                    note = excluded.note,
                    version = version + 1,
                    updated_at = excluded.updated_at,
                    deleted_at = NULL
                `)
                  .bind(
                    stl.id,
                    stl.groupId || null,
                    stl.groupName || null,
                    stl.fromUserId,
                    stl.fromUserName || null,
                    stl.toUserId,
                    stl.toUserName || null,
                    amount,
                    paisa,
                    stl.currency || 'BDT',
                    stl.paymentMethod || 'bKash',
                    stl.status || 'Pending',
                    stl.proofUrl || null,
                    stl.note || null,
                    stl.version || 1,
                    stl.createdAt || now,
                    now
                  )
                  .run();
              } else if (mut.operation === 'DELETE') {
                await env.DB.prepare('UPDATE settlements SET deleted_at = ?, updated_at = ? WHERE id = ?')
                  .bind(now, now, mut.entityId)
                  .run();
              }
            } else if (mut.entityType === 'registeredUser') {
              const usr = mut.payload;
              if (mut.operation === 'CREATE' || mut.operation === 'UPDATE') {
                await env.DB.prepare(`
                  INSERT INTO users (
                    id, name, email, password_hash, system_role, role,
                    title, department, avatar_gradient, created_at, updated_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    email = excluded.email,
                    system_role = excluded.system_role,
                    role = excluded.role,
                    title = excluded.title,
                    department = excluded.department,
                    avatar_gradient = excluded.avatar_gradient,
                    updated_at = excluded.updated_at
                `)
                  .bind(
                    usr.id,
                    usr.name || 'User',
                    usr.email,
                    usr.passwordHash || null,
                    usr.systemRole || 'User',
                    usr.role || null,
                    usr.title || null,
                    usr.department || null,
                    usr.avatarGradient || null,
                    usr.createdAt || now,
                    now
                  )
                  .run();
              } else if (mut.operation === 'DELETE') {
                await env.DB.prepare('DELETE FROM users WHERE id = ?')
                  .bind(mut.entityId)
                  .run();
              }
            }

            // Record mutation in idempotency table
            await env.DB.prepare(`
              INSERT INTO processed_mutations (
                mutation_id, client_device_id, user_id, entity_type,
                entity_id, operation, processed_at, result_json
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `)
              .bind(
                mut.mutationId,
                body.clientDeviceId,
                body.userId,
                mut.entityType,
                mut.entityId,
                mut.operation,
                now,
                JSON.stringify({ success: true })
              )
              .run();

            processedMutationIds.push(mut.mutationId);
          } catch (err: any) {
            console.error('[Worker Sync Push Error]', err);
            failedMutations.push({
              mutationId: mut.mutationId,
              error: err?.message || 'Failed to process mutation',
            });
          }
        }

        return jsonResponse({
          success: true,
          processedMutationIds,
          failedMutations,
          serverTimestamp: now,
        });
      }

      // 3. Sync Pull (Server -> Client)
      if (url.pathname === '/api/sync/pull' && request.method === 'GET') {
        const since = url.searchParams.get('since');
        const now = new Date().toISOString();

        const expensesStmt = since
          ? env.DB.prepare('SELECT * FROM expenses WHERE updated_at > ?').bind(since)
          : env.DB.prepare('SELECT * FROM expenses');

        const groupsStmt = since
          ? env.DB.prepare('SELECT * FROM groups WHERE updated_at > ?').bind(since)
          : env.DB.prepare('SELECT * FROM groups');

        const settlementsStmt = since
          ? env.DB.prepare('SELECT * FROM settlements WHERE updated_at > ?').bind(since)
          : env.DB.prepare('SELECT * FROM settlements');

        const usersStmt = since
          ? env.DB.prepare('SELECT * FROM users WHERE updated_at > ?').bind(since)
          : env.DB.prepare('SELECT * FROM users');

        const [expensesRes, groupsRes, settlementsRes, usersRes] = await Promise.all([
          expensesStmt.all(),
          groupsStmt.all(),
          settlementsStmt.all(),
          usersStmt.all(),
        ]);

        const activeExpenses: any[] = [];
        const deletedExpenseIds: string[] = [];
        (expensesRes.results || []).forEach((row: any) => {
          if (row.deleted_at) {
            deletedExpenseIds.push(row.id);
          } else {
            activeExpenses.push({
              ...row,
              isShared: Boolean(row.is_shared),
              splits: row.splits_json ? JSON.parse(row.splits_json) : undefined,
              paidByUserId: row.paid_by_user_id,
              paidByName: row.paid_by_name,
              groupId: row.group_id,
              groupName: row.group_name,
            });
          }
        });

        const activeGroups: any[] = [];
        const deletedGroupIds: string[] = [];
        (groupsRes.results || []).forEach((row: any) => {
          if (row.deleted_at) {
            deletedGroupIds.push(row.id);
          } else {
            activeGroups.push({
              ...row,
              members: row.members_json ? JSON.parse(row.members_json) : [],
              inviteCode: row.invite_code,
              imageUrl: row.image_url,
              totalSpent: row.total_spent,
              unsettledAmount: row.unsettled_amount,
            });
          }
        });

        const activeSettlements: any[] = [];
        const deletedSettlementIds: string[] = [];
        (settlementsRes.results || []).forEach((row: any) => {
          if (row.deleted_at) {
            deletedSettlementIds.push(row.id);
          } else {
            activeSettlements.push({
              ...row,
              groupId: row.group_id,
              groupName: row.group_name,
              fromUserId: row.from_user_id,
              fromUserName: row.from_user_name,
              toUserId: row.to_user_id,
              toUserName: row.to_user_name,
              paymentMethod: row.payment_method,
            });
          }
        });

        const activeUsers: any[] = (usersRes.results || []).map((row: any) => ({
          id: row.id,
          name: row.name,
          email: row.email,
          systemRole: row.system_role,
          role: row.role,
          title: row.title,
          department: row.department,
          avatarGradient: row.avatar_gradient,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }));

        return jsonResponse({
          success: true,
          serverTimestamp: now,
          expenses: activeExpenses,
          groups: activeGroups,
          settlements: activeSettlements,
          registeredUsers: activeUsers,
          deletedExpenseIds,
          deletedGroupIds,
          deletedSettlementIds,
        });
      }

      return jsonResponse({ error: 'Endpoint not found' }, 404);
    } catch (err: any) {
      console.error('[Worker Fatal Error]', err);
      return jsonResponse({ error: err.message || 'Internal server error' }, 500);
    }
  },
};
