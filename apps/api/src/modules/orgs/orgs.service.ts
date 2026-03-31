import { db } from '../../infra/db/client.js';
import { generateId } from '../../infra/id.js';
import { NotFoundError } from '../../infra/errors.js';
import type { OrgRole } from '@meridian/shared';

export const orgService = {
  async getCurrent(orgId: string) {
    const result = await db.query('SELECT * FROM orgs WHERE id = $1', [orgId]);
    if (result.rows.length === 0) throw new NotFoundError('Org', orgId);
    return result.rows[0];
  },

  async update(orgId: string, input: { name?: string; settings?: Record<string, unknown> }) {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (input.name !== undefined) { sets.push(`name = $${idx++}`); values.push(input.name); }
    if (input.settings !== undefined) { sets.push(`settings = settings || $${idx++}::jsonb`); values.push(JSON.stringify(input.settings)); }
    sets.push(`updated_at = now()`);
    values.push(orgId);

    const result = await db.query(
      `UPDATE orgs SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );
    return result.rows[0];
  },

  async listMembers(orgId: string) {
    const result = await db.query(
      `SELECT om.id, om.user_id, om.role, om.joined_at,
              u.email, u.name, u.avatar_url
       FROM org_members om JOIN users u ON u.id = om.user_id
       WHERE om.org_id = $1 ORDER BY om.joined_at`,
      [orgId],
    );
    return result.rows;
  },

  async inviteMember(orgId: string, input: { email: string; role: OrgRole }) {
    const userResult = await db.query('SELECT id FROM users WHERE email = $1', [input.email]);
    if (userResult.rows.length === 0) {
      throw new NotFoundError('User with email', input.email);
    }
    const userId = userResult.rows[0].id;
    const id = generateId('mem');
    await db.query(
      'INSERT INTO org_members (id, org_id, user_id, role) VALUES ($1, $2, $3, $4) ON CONFLICT (org_id, user_id) DO UPDATE SET role = $4',
      [id, orgId, userId, input.role],
    );
    return { id, org_id: orgId, user_id: userId, role: input.role };
  },

  async updateMemberRole(orgId: string, userId: string, role: OrgRole) {
    const result = await db.query(
      'UPDATE org_members SET role = $1 WHERE org_id = $2 AND user_id = $3 RETURNING *',
      [role, orgId, userId],
    );
    if (result.rows.length === 0) throw new NotFoundError('Member');
    return result.rows[0];
  },

  async removeMember(orgId: string, userId: string) {
    await db.query('DELETE FROM org_members WHERE org_id = $1 AND user_id = $2', [orgId, userId]);
  },
};
