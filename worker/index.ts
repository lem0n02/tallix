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
  ASSETS?: { fetch(request: Request): Promise<Response> };
  GEMINI_API_KEY?: string;
  ENVIRONMENT?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Device-Id, X-Admin-Email, X-User-Id, X-User-Email',
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

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    try {
      // 1. Health check endpoint
      if (url.pathname === '/api/health') {
        let dbOk = false;
        let dbError: string | null = null;
        try {
          if (env.DB) {
            const queryRes = await env.DB.prepare('SELECT 1 as alive').first<{ alive: number }>();
            dbOk = queryRes?.alive === 1;
          }
        } catch (err: any) {
          dbOk = false;
          dbError = err?.message || 'Failed to query D1 database';
        }

        return jsonResponse(
          {
            status: dbOk ? 'operational' : 'degraded',
            engine: 'Cloudflare Workers + D1',
            environment: env.ENVIRONMENT || 'production',
            databaseConnected: dbOk,
            ...(dbError ? { databaseError: dbError } : {}),
            timestamp: new Date().toISOString(),
          },
          dbOk ? 200 : 503
        );
      }

      // 2. Root path / handling
      if (url.pathname === '/' || url.pathname === '') {
        if (env.ASSETS) {
          return await env.ASSETS.fetch(request);
        }
        // Fallback to health JSON if static assets binding is not yet attached
        let dbOk = false;
        try {
          if (env.DB) {
            const queryRes = await env.DB.prepare('SELECT 1 as alive').first<{ alive: number }>();
            dbOk = queryRes?.alive === 1;
          }
        } catch {
          dbOk = false;
        }
        return jsonResponse({
          status: dbOk ? 'operational' : 'degraded',
          engine: 'Cloudflare Workers + D1',
          environment: env.ENVIRONMENT || 'production',
          databaseConnected: dbOk,
          timestamp: new Date().toISOString(),
        });
      }

      // 3. Registration Endpoint: POST /api/auth/register
      // Authoritative user creation in Cloudflare D1 with deduplication, validation, and zero plaintext exposure
      if (url.pathname === '/api/auth/register' && request.method === 'POST') {
        try {
          const body: any = await request.json();
          const { name, email, password, roleTitle, department, avatarGradient, systemRole, status, id } = body || {};

          if (!name || typeof name !== 'string' || !name.trim()) {
            return jsonResponse({ success: false, error: 'Full name is required.' }, 400);
          }

          if (!email || typeof email !== 'string' || !email.trim()) {
            return jsonResponse({ success: false, error: 'Email address is required.' }, 400);
          }

          const cleanEmail = email.trim().toLowerCase();
          if (!/\S+@\S+\.\S+/.test(cleanEmail)) {
            return jsonResponse({ success: false, error: 'A valid email address is required.' }, 400);
          }

          // Verify if email is already registered in Cloudflare D1
          const existingUser = await env.DB.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1')
            .bind(cleanEmail)
            .first<{ id: string }>();

          if (existingUser) {
            return jsonResponse({
              success: false,
              error: 'This email is already registered. Please sign in instead.',
            }, 409);
          }

          const now = new Date().toISOString();
          const userId = id && typeof id === 'string' && id.trim()
            ? id.trim()
            : `usr_reg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

          // Hash password securely - never store plaintext passwords
          const passwordHash = password ? await hashPassword(password) : null;
          const userStatus = status === 'Disabled' ? 'Disabled' : 'Active';
          const userRoleTitle = roleTitle || 'Financial Member';
          const userDept = department || 'Personal Workspace';
          const userGradient = avatarGradient || 'from-blue-600 to-indigo-600';
          const userSystemRole = systemRole === 'Admin' ? 'Admin' : 'User';

          // Insert into D1 users table with forward-compatible columns
          try {
            await env.DB.prepare(`
              INSERT INTO users (
                id, name, email, password_hash, system_role, role,
                title, role_title, department, avatar_gradient, status, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                email = excluded.email,
                system_role = excluded.system_role,
                role = excluded.role,
                title = excluded.title,
                role_title = excluded.role_title,
                department = excluded.department,
                avatar_gradient = excluded.avatar_gradient,
                status = excluded.status,
                updated_at = excluded.updated_at
            `).bind(
              userId,
              name.trim(),
              cleanEmail,
              passwordHash,
              userSystemRole,
              'User Member',
              userRoleTitle,
              userRoleTitle,
              userDept,
              userGradient,
              userStatus,
              now,
              now
            ).run();
          } catch (insertErr: any) {
            // Fallback for earlier schema if status/role_title columns are not yet present in target D1
            console.warn('[D1 Register Fallback]', insertErr?.message);
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
            `).bind(
              userId,
              name.trim(),
              cleanEmail,
              passwordHash,
              userSystemRole,
              'User Member',
              userRoleTitle,
              userDept,
              userGradient,
              now,
              now
            ).run();
          }

          return jsonResponse({
            success: true,
            user: {
              id: userId,
              name: name.trim(),
              email: cleanEmail,
              systemRole: userSystemRole,
              role: 'User Member',
              roleTitle: userRoleTitle,
              title: userRoleTitle,
              department: userDept,
              avatarGradient: userGradient,
              status: userStatus,
              createdAt: now,
              updatedAt: now,
            },
          }, 201);
        } catch (err: any) {
          console.error('[Register API Error]', err);
          return jsonResponse({ success: false, error: err?.message || 'Failed to complete registration.' }, 500);
        }
      }

      // 4. Login Endpoint: POST /api/auth/login
      // Authoritative user authentication against Cloudflare D1 with SHA-256 password hash verification
      if (url.pathname === '/api/auth/login' && request.method === 'POST') {
        try {
          const body: any = await request.json();
          const { email, password } = body || {};

          if (!email || typeof email !== 'string' || !email.trim()) {
            return jsonResponse({ success: false, error: 'Email address is required.' }, 400);
          }

          if (!password || typeof password !== 'string') {
            return jsonResponse({ success: false, error: 'Password is required.' }, 400);
          }

          const cleanEmail = email.trim().toLowerCase();

          // Query user from Cloudflare D1 with avatar_url and monthly_budget
          let user: any = null;
          try {
            user = await env.DB.prepare(`
              SELECT id, name, email, password_hash, system_role, role, title,
                     role_title, department, avatar_gradient, avatar_url, monthly_budget,
                     status, created_at, updated_at
              FROM users
              WHERE LOWER(email) = LOWER(?)
              LIMIT 1
            `).bind(cleanEmail).first<any>();
          } catch (queryErr: any) {
            console.warn('[D1 Login Query Fallback]', queryErr?.message);
            user = await env.DB.prepare(`
              SELECT id, name, email, password_hash, system_role, role, title,
                     department, avatar_gradient, created_at, updated_at
              FROM users
              WHERE LOWER(email) = LOWER(?)
              LIMIT 1
            `).bind(cleanEmail).first<any>();
          }

          if (!user) {
            return jsonResponse({
              success: false,
              error: 'No account found with this email address.',
            }, 404);
          }

          if (user.status === 'Disabled') {
            return jsonResponse({
              success: false,
              error: 'This user account has been disabled. Please contact the administrator.',
            }, 403);
          }

          // Verify password hash with SHA-256
          const submittedHash = await hashPassword(password);
          if (user.password_hash && user.password_hash !== submittedHash) {
            return jsonResponse({
              success: false,
              error: 'Invalid email or password. Please try again.',
            }, 401);
          }

          const userSystemRole = user.system_role === 'Admin' ? 'Admin' : 'User';
          const userRoleTitle = user.role_title || user.title || (userSystemRole === 'Admin' ? 'Super Administrator' : 'Financial Member');
          const userBudget = user.monthly_budget !== null && user.monthly_budget !== undefined ? Number(user.monthly_budget) : 25000;

          // Return sanitized user session profile (NO passwords, NO password hashes)
          return jsonResponse({
            success: true,
            user: {
              id: user.id,
              name: user.name,
              email: user.email,
              systemRole: userSystemRole,
              role: userSystemRole === 'Admin' ? userRoleTitle : 'User Member',
              title: userRoleTitle,
              roleTitle: userRoleTitle,
              department: user.department || (userSystemRole === 'Admin' ? 'Management' : 'Personal Workspace'),
              avatarGradient: user.avatar_gradient || 'from-emerald-500 to-teal-500',
              avatarUrl: user.avatar_url || null,
              status: user.status || 'Active',
              createdAt: user.created_at,
              updatedAt: user.updated_at,
              monthlyBudget: userBudget,
              liquidityLimit: userBudget,
              currentLiquidity: 0,
              monthlyBurnRate: 0,
            },
          }, 200);
        } catch (err: any) {
          console.error('[Login API Error]', err);
          return jsonResponse({ success: false, error: err?.message || 'Authentication failed.' }, 500);
        }
      }

      // 4a. Profile Retrieval Endpoint: GET /api/auth/profile
      // Authoritative profile retrieval from Cloudflare D1
      if (url.pathname === '/api/auth/profile' && request.method === 'GET') {
        try {
          const authHeader = request.headers.get('Authorization') || '';
          const headerUserId = request.headers.get('X-User-Id') || '';
          const headerUserEmail = (request.headers.get('X-User-Email') || '').trim().toLowerCase();
          const queryUserId = url.searchParams.get('userId') || '';
          const queryEmail = (url.searchParams.get('email') || '').trim().toLowerCase();

          let targetUserId = headerUserId || queryUserId;
          let targetEmail = headerUserEmail || queryEmail;
          if (!targetUserId && authHeader.startsWith('Bearer ')) {
            const tokenVal = authHeader.substring(7).trim();
            if (tokenVal.startsWith('usr_')) {
              targetUserId = tokenVal;
            }
          }

          if (!targetUserId && !targetEmail) {
            return jsonResponse({ success: false, error: 'Unauthorized: User identifier required.' }, 401);
          }

          let user: any = null;
          try {
            if (targetUserId) {
              user = await env.DB.prepare(`
                SELECT id, name, email, system_role, role, title, role_title, department,
                       avatar_gradient, avatar_url, monthly_budget, status, created_at, updated_at
                FROM users WHERE id = ? LIMIT 1
              `).bind(targetUserId).first<any>();
            } else {
              user = await env.DB.prepare(`
                SELECT id, name, email, system_role, role, title, role_title, department,
                       avatar_gradient, avatar_url, monthly_budget, status, created_at, updated_at
                FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1
              `).bind(targetEmail).first<any>();
            }
          } catch (queryErr: any) {
            if (targetUserId) {
              user = await env.DB.prepare(`
                SELECT id, name, email, system_role, role, title, department,
                       avatar_gradient, created_at, updated_at
                FROM users WHERE id = ? LIMIT 1
              `).bind(targetUserId).first<any>();
            } else {
              user = await env.DB.prepare(`
                SELECT id, name, email, system_role, role, title, department,
                       avatar_gradient, created_at, updated_at
                FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1
              `).bind(targetEmail).first<any>();
            }
          }

          if (!user) {
            return jsonResponse({ success: false, error: 'User profile not found.' }, 404);
          }

          const userSystemRole = user.system_role === 'Admin' ? 'Admin' : 'User';
          const userRoleTitle = user.role_title || user.title || (userSystemRole === 'Admin' ? 'Super Administrator' : 'Financial Member');
          const budget = user.monthly_budget !== null && user.monthly_budget !== undefined ? Number(user.monthly_budget) : 25000;

          return jsonResponse({
            success: true,
            source: 'Cloudflare D1',
            user: {
              id: user.id,
              name: user.name,
              email: user.email,
              systemRole: userSystemRole,
              role: userSystemRole === 'Admin' ? userRoleTitle : 'User Member',
              title: userRoleTitle,
              roleTitle: userRoleTitle,
              department: user.department || (userSystemRole === 'Admin' ? 'Management' : 'Personal Workspace'),
              avatarGradient: user.avatar_gradient || 'from-emerald-500 to-teal-500',
              avatarUrl: user.avatar_url || null,
              monthlyBudget: budget,
              liquidityLimit: budget,
              status: user.status || 'Active',
              createdAt: user.created_at,
              updatedAt: user.updated_at,
              currentLiquidity: 0,
              monthlyBurnRate: 0,
            },
          });
        } catch (err: any) {
          console.error('[Profile GET API Error]', err);
          return jsonResponse({ success: false, error: err?.message || 'Failed to retrieve profile.' }, 500);
        }
      }

      // 4b. Profile Update Endpoint: PATCH /api/auth/profile
      // Authoritative profile update in Cloudflare D1
      // Strictly restricted to editable fields: avatarUrl (picture) & monthlyBudget
      // Strictly protects identity/role fields: full name, email, role/admin status, password hash
      if (url.pathname === '/api/auth/profile' && request.method === 'PATCH') {
        try {
          const authHeader = request.headers.get('Authorization') || '';
          const headerUserId = request.headers.get('X-User-Id') || '';
          const headerUserEmail = (request.headers.get('X-User-Email') || '').trim().toLowerCase();

          const body: any = await request.json();
          const { userId: bodyUserId, email: bodyEmail, avatarUrl, monthlyBudget, liquidityLimit } = body || {};

          let targetUserId = headerUserId || bodyUserId || '';
          let targetEmail = headerUserEmail || bodyEmail || '';

          if (!targetUserId && authHeader.startsWith('Bearer ')) {
            const tokenVal = authHeader.substring(7).trim();
            if (tokenVal.startsWith('usr_')) {
              targetUserId = tokenVal;
            }
          }

          if (!targetUserId && !targetEmail) {
            return jsonResponse({ success: false, error: 'Unauthorized: User authentication required.' }, 401);
          }

          // Security: Prevent cross-user privilege escalation if both header and body are supplied
          if (headerUserId && bodyUserId && headerUserId !== bodyUserId) {
            return jsonResponse({ success: false, error: 'Forbidden: Cannot modify another user profile.' }, 403);
          }

          let existingUser: any = null;
          try {
            if (targetUserId) {
              existingUser = await env.DB.prepare('SELECT * FROM users WHERE id = ? LIMIT 1').bind(targetUserId).first<any>();
            } else {
              existingUser = await env.DB.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1').bind(targetEmail).first<any>();
            }
          } catch (e: any) {
            console.warn('[D1 Existing User Query Error]', e?.message);
          }

          if (!existingUser) {
            return jsonResponse({ success: false, error: 'User account not found.' }, 404);
          }

          if (existingUser.status === 'Disabled') {
            return jsonResponse({ success: false, error: 'This user account has been disabled.' }, 403);
          }

          const resolvedUserId = existingUser.id;
          const now = new Date().toISOString();

          // Validate and sanitize ONLY editable fields
          // 1. avatarUrl: string or null
          let newAvatarUrl: string | null = existingUser.avatar_url || null;
          if (avatarUrl !== undefined) {
            newAvatarUrl = avatarUrl && typeof avatarUrl === 'string' && avatarUrl.trim() ? avatarUrl.trim() : null;
          }

          // 2. monthlyBudget: numeric value >= 0
          let newMonthlyBudget: number = existingUser.monthly_budget !== null && existingUser.monthly_budget !== undefined
            ? Number(existingUser.monthly_budget)
            : 25000;
          const budgetCandidate = monthlyBudget !== undefined ? monthlyBudget : liquidityLimit;
          if (budgetCandidate !== undefined && budgetCandidate !== null) {
            const parsed = Number(budgetCandidate);
            if (!isNaN(parsed) && parsed >= 0) {
              newMonthlyBudget = Math.round(parsed);
            }
          }

          // Update D1 users table
          try {
            await env.DB.prepare(`
              UPDATE users
              SET avatar_url = ?,
                  monthly_budget = ?,
                  updated_at = ?
              WHERE id = ?
            `).bind(newAvatarUrl, newMonthlyBudget, now, resolvedUserId).run();
          } catch (updateErr: any) {
            console.warn('[D1 Profile Update Fallback]', updateErr?.message);
            try {
              await env.DB.prepare('ALTER TABLE users ADD COLUMN avatar_url TEXT').run();
            } catch {}
            try {
              await env.DB.prepare('ALTER TABLE users ADD COLUMN monthly_budget REAL DEFAULT 25000').run();
            } catch {}

            await env.DB.prepare(`
              UPDATE users
              SET avatar_url = ?,
                  monthly_budget = ?,
                  updated_at = ?
              WHERE id = ?
            `).bind(newAvatarUrl, newMonthlyBudget, now, resolvedUserId).run();
          }

          // Fetch fresh authoritative updated row from Cloudflare D1
          let updatedUser: any = null;
          try {
            updatedUser = await env.DB.prepare(`
              SELECT id, name, email, system_role, role, title, role_title, department,
                     avatar_gradient, avatar_url, monthly_budget, status, created_at, updated_at
              FROM users WHERE id = ? LIMIT 1
            `).bind(resolvedUserId).first<any>();
          } catch {}

          if (!updatedUser) {
            updatedUser = {
              ...existingUser,
              avatar_url: newAvatarUrl,
              monthly_budget: newMonthlyBudget,
              updated_at: now,
            };
          }

          const userSystemRole = updatedUser.system_role === 'Admin' ? 'Admin' : 'User';
          const userRoleTitle = updatedUser.role_title || updatedUser.title || (userSystemRole === 'Admin' ? 'Super Administrator' : 'Financial Member');
          const finalBudget = updatedUser.monthly_budget !== null && updatedUser.monthly_budget !== undefined ? Number(updatedUser.monthly_budget) : newMonthlyBudget;

          return jsonResponse({
            success: true,
            source: 'Cloudflare D1',
            message: 'Profile updated successfully in Cloudflare D1.',
            user: {
              id: updatedUser.id,
              name: updatedUser.name, // Protected: preserved from authoritative record
              email: updatedUser.email, // Protected: preserved from authoritative record
              systemRole: userSystemRole, // Protected: preserved
              role: userSystemRole === 'Admin' ? userRoleTitle : 'User Member',
              title: userRoleTitle,
              roleTitle: userRoleTitle,
              department: updatedUser.department || (userSystemRole === 'Admin' ? 'Management' : 'Personal Workspace'),
              avatarGradient: updatedUser.avatar_gradient || 'from-emerald-500 to-teal-500',
              avatarUrl: updatedUser.avatar_url || newAvatarUrl,
              monthlyBudget: finalBudget,
              liquidityLimit: finalBudget,
              status: updatedUser.status || 'Active',
              createdAt: updatedUser.created_at,
              updatedAt: updatedUser.updated_at,
              currentLiquidity: 0,
              monthlyBurnRate: 0,
            },
          }, 200);
        } catch (err: any) {
          console.error('[Profile PATCH API Error]', err);
          return jsonResponse({ success: false, error: err?.message || 'Failed to update profile.' }, 500);
        }
      }

      // 4. Admin Users Endpoint: GET /api/admin/users
      // Authoritative retrieval of registered users from Cloudflare D1
      // Excludes password, password_hash, and sensitive secrets
      if (url.pathname === '/api/admin/users' && request.method === 'GET') {
        try {
          const authHeader = request.headers.get('Authorization') || '';
          const adminEmail = (request.headers.get('X-Admin-Email') || '').trim().toLowerCase();

          // Verify administrative authorization
          const isFixedAdmin =
            authHeader === 'Bearer Admin@Tallix2026!' ||
            authHeader.includes('Admin@Tallix2026!') ||
            (adminEmail === 'abdulatiflemon@gmail.com' && authHeader.length > 5);

          if (!isFixedAdmin) {
            return jsonResponse({ success: false, error: 'Unauthorized: Administrative credentials required.' }, 401);
          }

          let usersRes: any;
          try {
            usersRes = await env.DB.prepare(`
              SELECT id, name, email, system_role, role, title, role_title, department, avatar_gradient, status, created_at, updated_at
              FROM users
              ORDER BY created_at DESC
            `).all();
          } catch {
            // Fallback if status/role_title are not yet in legacy schema
            usersRes = await env.DB.prepare(`
              SELECT id, name, email, system_role, role, title, department, avatar_gradient, created_at, updated_at
              FROM users
              ORDER BY created_at DESC
            `).all();
          }

          const sanitizedUsers = (usersRes.results || []).map((row: any) => ({
            id: row.id,
            name: row.name,
            email: row.email,
            systemRole: row.system_role || 'User',
            role: row.role || 'User Member',
            roleTitle: row.role_title || row.title || 'Financial Member',
            title: row.title || row.role_title || 'Financial Member',
            department: row.department || 'Personal Workspace',
            avatarGradient: row.avatar_gradient || 'from-blue-600 to-indigo-600',
            avatarUrl: row.avatar_url || undefined,
            monthlyBudget: row.monthly_budget !== null && row.monthly_budget !== undefined ? Number(row.monthly_budget) : 25000,
            liquidityLimit: row.monthly_budget !== null && row.monthly_budget !== undefined ? Number(row.monthly_budget) : 25000,
            status: row.status || 'Active',
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }));

          return jsonResponse({
            success: true,
            source: 'Cloudflare D1',
            count: sanitizedUsers.length,
            users: sanitizedUsers,
          });
        } catch (err: any) {
          console.error('[Admin Users API Error]', err);
          return jsonResponse({ success: false, error: err?.message || 'Failed to retrieve admin users.' }, 500);
        }
      }

      // 5. Admin DB Verification Endpoint: GET /api/admin/db-verify
      if (url.pathname === '/api/admin/db-verify' && request.method === 'GET') {
        try {
          const countRes = await env.DB.prepare('SELECT COUNT(*) as total FROM users').first<{ total: number }>();
          const recentUsers = await env.DB.prepare('SELECT id, name, email, status, created_at FROM users ORDER BY created_at DESC LIMIT 5').all();
          return jsonResponse({
            success: true,
            database: 'Cloudflare D1 (tallix-db)',
            totalUsers: countRes?.total ?? 0,
            recentUsers: recentUsers?.results || [],
            timestamp: new Date().toISOString(),
          });
        } catch (err: any) {
          return jsonResponse({ success: false, error: err?.message }, 500);
        }
      }

      // 6. Sync Push (Client -> Server) with strict idempotency
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
                const orig = exp.originalAmount !== undefined ? exp.originalAmount : exp.amount;
                const paisa = typeof exp.amount_paisa === 'number' && Number.isInteger(exp.amount_paisa)
                  ? exp.amount_paisa
                  : (() => {
                      const s = String(orig || 0).trim();
                      const parts = s.split('.');
                      const whole = parseInt(parts[0].replace(/\D/g, '') || '0', 10);
                      const frac = parseInt((parts[1] ? parts[1].replace(/\D/g, '') + '00' : '00').slice(0, 2), 10);
                      return (s.startsWith('-') ? -1 : 1) * (whole * 100 + frac);
                    })();
                const amount = !isNaN(Number(orig)) ? Number(orig) : (paisa / 100);

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
                const orig = stl.originalAmount !== undefined ? stl.originalAmount : stl.amount;
                const paisa = typeof stl.amount_paisa === 'number' && Number.isInteger(stl.amount_paisa)
                  ? stl.amount_paisa
                  : (() => {
                      const s = String(orig || 0).trim();
                      const parts = s.split('.');
                      const whole = parseInt(parts[0].replace(/\D/g, '') || '0', 10);
                      const frac = parseInt((parts[1] ? parts[1].replace(/\D/g, '') + '00' : '00').slice(0, 2), 10);
                      return (s.startsWith('-') ? -1 : 1) * (whole * 100 + frac);
                    })();
                const amount = !isNaN(Number(orig)) ? Number(orig) : (paisa / 100);

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
                const userStatus = usr.status === 'Disabled' ? 'Disabled' : 'Active';
                const userRoleTitle = usr.roleTitle || usr.title || 'Financial Member';
                const cleanEmail = (usr.email || '').trim().toLowerCase();
                const pwdHash = usr.passwordHash || (usr.password ? await hashPassword(usr.password) : null);
                const avatarVal = usr.avatarUrl !== undefined ? (usr.avatarUrl || null) : (usr.avatar_url !== undefined ? (usr.avatar_url || null) : null);
                const rawBudget = usr.monthlyBudget !== undefined ? usr.monthlyBudget : (usr.liquidityLimit !== undefined ? usr.liquidityLimit : usr.monthly_budget);
                const budgetVal = rawBudget !== undefined && rawBudget !== null ? Number(rawBudget) : 25000;

                try {
                  await env.DB.prepare(`
                    INSERT INTO users (
                      id, name, email, password_hash, system_role, role,
                      title, role_title, department, avatar_gradient, avatar_url, monthly_budget, status, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                      name = excluded.name,
                      email = excluded.email,
                      system_role = excluded.system_role,
                      role = excluded.role,
                      title = excluded.title,
                      role_title = excluded.role_title,
                      department = excluded.department,
                      avatar_gradient = excluded.avatar_gradient,
                      avatar_url = COALESCE(excluded.avatar_url, users.avatar_url),
                      monthly_budget = COALESCE(excluded.monthly_budget, users.monthly_budget),
                      status = excluded.status,
                      updated_at = excluded.updated_at
                  `)
                    .bind(
                      usr.id,
                      usr.name || 'User',
                      cleanEmail,
                      pwdHash,
                      usr.systemRole || 'User',
                      usr.role || 'User Member',
                      userRoleTitle,
                      userRoleTitle,
                      usr.department || 'Personal Workspace',
                      usr.avatarGradient || 'from-blue-600 to-indigo-600',
                      avatarVal,
                      budgetVal,
                      userStatus,
                      usr.createdAt || now,
                      now
                    )
                    .run();
                } catch {
                  try {
                    await env.DB.prepare('ALTER TABLE users ADD COLUMN avatar_url TEXT').run();
                  } catch {}
                  try {
                    await env.DB.prepare('ALTER TABLE users ADD COLUMN monthly_budget REAL DEFAULT 25000').run();
                  } catch {}

                  // Fallback for earlier database schema
                  await env.DB.prepare(`
                    INSERT INTO users (
                      id, name, email, password_hash, system_role, role,
                      title, role_title, department, avatar_gradient, status, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                      name = excluded.name,
                      email = excluded.email,
                      system_role = excluded.system_role,
                      role = excluded.role,
                      title = excluded.title,
                      role_title = excluded.role_title,
                      department = excluded.department,
                      avatar_gradient = excluded.avatar_gradient,
                      status = excluded.status,
                      updated_at = excluded.updated_at
                  `)
                    .bind(
                      usr.id,
                      usr.name || 'User',
                      cleanEmail,
                      pwdHash,
                      usr.systemRole || 'User',
                      usr.role || 'User Member',
                      userRoleTitle,
                      userRoleTitle,
                      usr.department || 'Personal Workspace',
                      usr.avatarGradient || 'from-blue-600 to-indigo-600',
                      userStatus,
                      usr.createdAt || now,
                      now
                    )
                    .run();
                }
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
        const rawSince = url.searchParams.get('since');
        const now = new Date().toISOString();
        // Apply a 10-second safety window on 'since' to eliminate race condition misses at boundary timestamps
        const since = rawSince
          ? new Date(Math.max(0, new Date(rawSince).getTime() - 10000)).toISOString()
          : null;

        const expensesStmt = since
          ? env.DB.prepare('SELECT * FROM expenses WHERE updated_at >= ?').bind(since)
          : env.DB.prepare('SELECT * FROM expenses');

        const groupsStmt = since
          ? env.DB.prepare('SELECT * FROM groups WHERE updated_at >= ?').bind(since)
          : env.DB.prepare('SELECT * FROM groups');

        const settlementsStmt = since
          ? env.DB.prepare('SELECT * FROM settlements WHERE updated_at >= ?').bind(since)
          : env.DB.prepare('SELECT * FROM settlements');

        const usersStmt = since
          ? env.DB.prepare('SELECT * FROM users WHERE updated_at >= ?').bind(since)
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
              id: row.id,
              groupId: row.group_id,
              groupName: row.group_name,
              isShared: Boolean(row.is_shared),
              title: row.title,
              merchant: row.merchant,
              amount: row.amount,
              originalAmount: row.amount,
              amount_paisa: row.amount_paisa,
              currency: row.currency || 'BDT',
              category: row.category,
              paymentMethod: row.payment_method,
              date: row.date,
              status: row.status,
              paidByUserId: row.paid_by_user_id,
              paidByName: row.paid_by_name,
              createdBy: row.created_by,
              createdByEmail: row.created_by_email,
              splits: row.splits_json ? JSON.parse(row.splits_json) : undefined,
              receiptUrl: row.receipt_url,
              notes: row.notes,
              version: row.version,
              createdAt: row.created_at,
              updatedAt: row.updated_at,
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
          systemRole: row.system_role || 'User',
          role: row.role || 'User Member',
          roleTitle: row.role_title || row.title || 'Financial Member',
          title: row.title || row.role_title || 'Financial Member',
          department: row.department || 'Personal Workspace',
          avatarGradient: row.avatar_gradient || 'from-blue-600 to-indigo-600',
          avatarUrl: row.avatar_url || undefined,
          monthlyBudget: row.monthly_budget !== null && row.monthly_budget !== undefined ? Number(row.monthly_budget) : 25000,
          liquidityLimit: row.monthly_budget !== null && row.monthly_budget !== undefined ? Number(row.monthly_budget) : 25000,
          status: row.status || 'Active',
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

      // 4. Audit Logs endpoint
      if (url.pathname === '/api/audit-logs' && request.method === 'GET') {
        try {
          const logsRes = await env.DB.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100').all();
          return jsonResponse({ logs: logsRes.results || [] });
        } catch {
          return jsonResponse({ logs: [] });
        }
      }

      // 5. Static Assets fallback for all non-API paths (SPA routes, CSS, JS, images)
      if (!url.pathname.startsWith('/api/') && env.ASSETS) {
        return await env.ASSETS.fetch(request);
      }

      return jsonResponse({ error: 'Endpoint not found' }, 404);
    } catch (err: any) {
      console.error('[Worker Fatal Error]', err);
      return jsonResponse({ error: err.message || 'Internal server error' }, 500);
    }
  },
};
