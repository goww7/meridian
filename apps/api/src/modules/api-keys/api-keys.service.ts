import crypto from 'node:crypto';
import { db } from '../../infra/db/client.js';
import { generateId } from '../../infra/id.js';
import { NotFoundError } from '../../infra/errors.js';
import type { CreateApiKeyInput } from '@meridian/shared';

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

function generateApiKey(): string {
  return `mk_${crypto.randomBytes(32).toString('base64url')}`;
}

export const apiKeyService = {
  async create(orgId: string, userId: string, input: CreateApiKeyInput) {
    const id = generateId('akey');
    const rawKey = generateApiKey();
    const keyHash = hashKey(rawKey);
    const keyPrefix = rawKey.slice(0, 10);

    const expiresAt = input.expires_in_days
      ? new Date(Date.now() + input.expires_in_days * 86400000).toISOString()
      : null;

    const result = await db.query(
      `INSERT INTO api_keys (id, org_id, name, key_hash, key_prefix, scopes, expires_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, org_id, name, key_prefix, scopes, expires_at, created_by, created_at`,
      [id, orgId, input.name, keyHash, keyPrefix, input.scopes, expiresAt, userId],
    );

    // Return the raw key only once
    return { ...result.rows[0], key: rawKey };
  },

  async list(orgId: string) {
    const result = await db.query(
      `SELECT id, org_id, name, key_prefix, scopes, expires_at, last_used_at, created_by, created_at, revoked_at
       FROM api_keys WHERE org_id = $1 ORDER BY created_at DESC`,
      [orgId],
    );
    return result.rows;
  },

  async revoke(orgId: string, keyId: string) {
    const result = await db.query(
      `UPDATE api_keys SET revoked_at = now() WHERE id = $1 AND org_id = $2 AND revoked_at IS NULL RETURNING *`,
      [keyId, orgId],
    );
    if (result.rows.length === 0) throw new NotFoundError('ApiKey', keyId);
    return result.rows[0];
  },

  async validate(rawKey: string): Promise<{ org_id: string; scopes: string[] } | null> {
    const keyHash = hashKey(rawKey);
    const result = await db.query(
      `SELECT * FROM api_keys WHERE key_hash = $1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())`,
      [keyHash],
    );
    if (result.rows.length === 0) return null;

    // Update last_used_at
    await db.query(`UPDATE api_keys SET last_used_at = now() WHERE id = $1`, [result.rows[0].id]);

    return { org_id: result.rows[0].org_id, scopes: result.rows[0].scopes };
  },
};
