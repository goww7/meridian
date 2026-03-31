import { db } from '../../infra/db/client.js';
import { generateId } from '../../infra/id.js';
import { NotFoundError } from '../../infra/errors.js';

export const teamService = {
  async create(orgId: string, input: { name: string; slug: string }) {
    const id = generateId('team');
    const result = await db.query(
      'INSERT INTO teams (id, org_id, name, slug) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, orgId, input.name, input.slug],
    );
    return result.rows[0];
  },

  async list(orgId: string) {
    const result = await db.query('SELECT * FROM teams WHERE org_id = $1 AND deleted_at IS NULL ORDER BY name', [orgId]);
    return result.rows;
  },

  async getById(orgId: string, teamId: string) {
    const result = await db.query('SELECT * FROM teams WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL', [teamId, orgId]);
    if (result.rows.length === 0) throw new NotFoundError('Team', teamId);
    return result.rows[0];
  },

  async update(orgId: string, teamId: string, input: { name?: string; slug?: string }) {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (input.name) { sets.push(`name = $${idx++}`); values.push(input.name); }
    if (input.slug) { sets.push(`slug = $${idx++}`); values.push(input.slug); }
    sets.push('updated_at = now()');
    values.push(teamId, orgId);
    const result = await db.query(
      `UPDATE teams SET ${sets.join(', ')} WHERE id = $${idx++} AND org_id = $${idx} AND deleted_at IS NULL RETURNING *`,
      values,
    );
    if (result.rows.length === 0) throw new NotFoundError('Team', teamId);
    return result.rows[0];
  },

  async remove(orgId: string, teamId: string) {
    await db.query('UPDATE teams SET deleted_at = now() WHERE id = $1 AND org_id = $2', [teamId, orgId]);
  },

  async addMember(orgId: string, teamId: string, input: { user_id: string; role: string }) {
    const id = generateId('tmem');
    await db.query(
      'INSERT INTO team_members (id, team_id, user_id, role) VALUES ($1, $2, $3, $4) ON CONFLICT (team_id, user_id) DO UPDATE SET role = $4',
      [id, teamId, input.user_id, input.role],
    );
    return { id, team_id: teamId, user_id: input.user_id, role: input.role };
  },

  async removeMember(_orgId: string, teamId: string, userId: string) {
    await db.query('DELETE FROM team_members WHERE team_id = $1 AND user_id = $2', [teamId, userId]);
  },
};
