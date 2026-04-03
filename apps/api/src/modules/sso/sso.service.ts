import { db } from '../../infra/db/client.js';
import { generateId } from '../../infra/id.js';
import { NotFoundError, ConflictError } from '../../infra/errors.js';
import type { CreateSsoConfigInput, UpdateSsoConfigInput } from '@meridian/shared';

export const ssoService = {
  async create(orgId: string, input: CreateSsoConfigInput) {
    const id = generateId('sso');

    // Check for existing config with same provider
    const existing = await db.query(
      `SELECT id FROM sso_configs WHERE org_id = $1 AND provider = $2`,
      [orgId, input.provider],
    );
    if (existing.rows.length > 0) {
      throw new ConflictError(`SSO configuration for ${input.provider} already exists`);
    }

    const entityId = `urn:meridian:${orgId}`;
    const acsUrl = `/api/v1/sso/${input.provider}/callback`;

    const result = await db.query(
      `INSERT INTO sso_configs (id, org_id, provider, display_name, config, metadata_url, entity_id, acs_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [id, orgId, input.provider, input.display_name, JSON.stringify(input.config), input.metadata_url || null, entityId, acsUrl],
    );
    return result.rows[0];
  },

  async list(orgId: string) {
    const result = await db.query(
      `SELECT * FROM sso_configs WHERE org_id = $1 ORDER BY created_at`,
      [orgId],
    );
    return result.rows;
  },

  async getById(orgId: string, ssoId: string) {
    const result = await db.query(
      `SELECT * FROM sso_configs WHERE id = $1 AND org_id = $2`,
      [ssoId, orgId],
    );
    if (result.rows.length === 0) throw new NotFoundError('SsoConfig', ssoId);
    return result.rows[0];
  },

  async update(orgId: string, ssoId: string, input: UpdateSsoConfigInput) {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (input.display_name !== undefined) { sets.push(`display_name = $${idx++}`); values.push(input.display_name); }
    if (input.config !== undefined) { sets.push(`config = $${idx++}`); values.push(JSON.stringify(input.config)); }
    if (input.metadata_url !== undefined) { sets.push(`metadata_url = $${idx++}`); values.push(input.metadata_url); }
    if (input.enabled !== undefined) { sets.push(`enabled = $${idx++}`); values.push(input.enabled); }
    sets.push('updated_at = now()');
    values.push(ssoId, orgId);

    const result = await db.query(
      `UPDATE sso_configs SET ${sets.join(', ')} WHERE id = $${idx++} AND org_id = $${idx} RETURNING *`,
      values,
    );
    if (result.rows.length === 0) throw new NotFoundError('SsoConfig', ssoId);
    return result.rows[0];
  },

  async remove(orgId: string, ssoId: string) {
    await db.query('DELETE FROM sso_configs WHERE id = $1 AND org_id = $2', [ssoId, orgId]);
  },

  async getByProvider(orgId: string, provider: string) {
    const result = await db.query(
      `SELECT * FROM sso_configs WHERE org_id = $1 AND provider = $2 AND enabled = true`,
      [orgId, provider],
    );
    if (result.rows.length === 0) return null;
    return result.rows[0];
  },

  async getServiceProviderMetadata(orgId: string, provider: string) {
    const config = await this.getByProvider(orgId, provider);
    if (!config) throw new NotFoundError('SsoConfig', provider);

    if (provider === 'saml') {
      return {
        entity_id: config.entity_id,
        acs_url: config.acs_url,
        name_id_format: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
      };
    }

    return {
      client_id: (config.config as Record<string, unknown>).client_id,
      redirect_uri: config.acs_url,
    };
  },
};
