/**
 * Employee portal — database layer (pass holder = pass_instances.id)
 */
const { v4: uuidv4 } = require('uuid');

const PORTAL_CONSENT_TYPES = Object.freeze([
  'birthday',
  'welfare_geo',
  'gamification',
  'climate_survey',
  'partner_offers'
]);

function getPool() {
  const { pool } = require('./index');
  if (!pool) throw new Error('Database pool not initialized — call getDb() first');
  return pool;
}

function isValidConsentType(type) {
  return PORTAL_CONSENT_TYPES.includes(String(type || '').trim());
}

function defaultConsentRows() {
  return PORTAL_CONSENT_TYPES.map((consent_type) => ({
    consent_type,
    granted: false,
    granted_at: null,
    revoked_at: null,
    privacy_policy_version: null
  }));
}

async function getPassForPortal(passId) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT p.*,
      b.id AS brand_id,
      b.name AS brand_name,
      b.slug AS brand_slug,
      b.config AS brand_config,
      t.id AS template_id,
      t.name AS template_name,
      t.pass_type,
      t.style AS template_style,
      COALESCE(
        p.google_installed_at,
        p.samsung_installed_at,
        (SELECT MIN(dr.created_at) FROM device_registrations dr WHERE dr.serial_number = p.serial_number)
      ) AS install_date
     FROM pass_instances p
     JOIN brands b ON b.id = p.brand_id
     JOIN pass_templates t ON t.id = p.template_id
     WHERE p.id = $1`,
    [passId]
  );
  return result.rows[0] || null;
}

async function listPassConsents(passId) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT consent_type, granted, granted_at, revoked_at, privacy_policy_version, updated_at
     FROM pass_consents WHERE pass_id = $1`,
    [passId]
  );
  const byType = new Map(result.rows.map((r) => [r.consent_type, r]));
  return PORTAL_CONSENT_TYPES.map((consent_type) => {
    const row = byType.get(consent_type);
    if (!row) {
      return { consent_type, granted: false, granted_at: null, revoked_at: null, privacy_policy_version: null };
    }
    return row;
  });
}

async function upsertPassConsent(passId, consentType, granted, meta = {}) {
  if (!isValidConsentType(consentType)) {
    throw new Error(`Invalid consent_type: ${consentType}`);
  }
  const pool = getPool();
  const now = new Date();
  const action = granted ? 'granted' : 'revoked';
  const {
    ip_address = null,
    user_agent = null,
    privacy_policy_version = null
  } = meta;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const upsert = await client.query(
      `INSERT INTO pass_consents (
        pass_id, consent_type, granted, granted_at, revoked_at,
        ip_address, user_agent, privacy_policy_version, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (pass_id, consent_type) DO UPDATE SET
        granted = EXCLUDED.granted,
        granted_at = EXCLUDED.granted_at,
        revoked_at = EXCLUDED.revoked_at,
        ip_address = EXCLUDED.ip_address,
        user_agent = EXCLUDED.user_agent,
        privacy_policy_version = EXCLUDED.privacy_policy_version,
        updated_at = NOW()
      RETURNING *`,
      [
        passId,
        consentType,
        !!granted,
        granted ? now : null,
        granted ? null : now,
        ip_address,
        user_agent,
        privacy_policy_version
      ]
    );
    await client.query(
      `INSERT INTO consent_log (
        pass_id, consent_type, action, ip_address, user_agent, privacy_policy_version
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [passId, consentType, action, ip_address, user_agent, privacy_policy_version]
    );
    await client.query('COMMIT');
    return upsert.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function listConsentLogForPass(passId, limit = 100) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT consent_type, action, timestamp, ip_address, privacy_policy_version
     FROM consent_log
     WHERE pass_id = $1
     ORDER BY timestamp DESC
     LIMIT $2`,
    [passId, limit]
  );
  return result.rows;
}

async function insertPortalToken(passId, tokenHash, expiresAt) {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO portal_tokens (pass_id, token_hash, expires_at)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [passId, tokenHash, expiresAt]
  );
  return result.rows[0];
}

async function getPortalTokenByHash(tokenHash) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM portal_tokens WHERE token_hash = $1`,
    [tokenHash]
  );
  return result.rows[0] || null;
}

async function isPortalTokenActive(tokenHash) {
  const row = await getPortalTokenByHash(tokenHash);
  if (!row) return false;
  if (row.revoked_at) return false;
  if (new Date(row.expires_at) < new Date()) return false;
  return true;
}

/** Revoke all portal tokens for a pass (optional: keep one hash active). */
async function revokePortalTokensForPass(passId, exceptTokenHash = null) {
  const pool = getPool();
  if (exceptTokenHash) {
    await pool.query(
      `UPDATE portal_tokens SET revoked_at = NOW()
       WHERE pass_id = $1 AND token_hash <> $2 AND revoked_at IS NULL`,
      [passId, exceptTokenHash]
    );
  } else {
    await pool.query(
      `UPDATE portal_tokens SET revoked_at = NOW()
       WHERE pass_id = $1 AND revoked_at IS NULL`,
      [passId]
    );
  }
}

async function markPortalTokenUsed(tokenHash) {
  const pool = getPool();
  await pool.query(
    `UPDATE portal_tokens SET used_at = COALESCE(used_at, NOW()) WHERE token_hash = $1`,
    [tokenHash]
  );
}

async function createGdprRequest(data) {
  const pool = getPool();
  const id = data.id || uuidv4();
  const {
    pass_id,
    brand_id,
    request_type,
    details = null,
    status = 'pending'
  } = data;
  const result = await pool.query(
    `INSERT INTO gdpr_requests (id, pass_id, brand_id, request_type, status, details)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [id, pass_id, brand_id, request_type, status, details]
  );
  return result.rows[0];
}

async function getGdprRequest(id) {
  const pool = getPool();
  const result = await pool.query(`SELECT * FROM gdpr_requests WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

async function listGdprRequestsForPass(passId, limit = 20) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM gdpr_requests WHERE pass_id = $1 ORDER BY requested_at DESC LIMIT $2`,
    [passId, limit]
  );
  return result.rows;
}

/** Merge allowlisted keys into pass_instances.field_values. */
async function mergePassFieldValues(passId, patch) {
  const pool = getPool();
  const row = await pool.query('SELECT field_values FROM pass_instances WHERE id = $1', [passId]);
  if (!row.rows[0]) return null;
  let current = row.rows[0].field_values;
  if (typeof current === 'string') {
    try { current = JSON.parse(current); } catch { current = {}; }
  }
  if (!current || typeof current !== 'object') current = {};
  const next = { ...current, ...patch };
  const result = await pool.query(
    `UPDATE pass_instances SET field_values = $1, last_updated = NOW() WHERE id = $2 RETURNING field_values`,
    [JSON.stringify(next), passId]
  );
  return result.rows[0]?.field_values || next;
}

async function getPortalPushHistory(passId, brandId, limit = 40) {
  const pool = getPool();
  const passRes = await pool.query(
    `SELECT last_push_at, last_push_status, push_count, serial_number, device_source
     FROM pass_instances WHERE id = $1`,
    [passId]
  );
  const logRes = await pool.query(
    `SELECT id, title, message, channel, sent_count, campaign_id, created_at
     FROM push_log
     WHERE brand_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [brandId, limit]
  );
  return {
    pass_summary: passRes.rows[0] || null,
    brand_broadcasts: logRes.rows
  };
}

async function updateGdprRequest(id, data) {
  const pool = getPool();
  const fields = [];
  const values = [];
  let idx = 1;
  for (const key of ['status', 'resolved_at', 'resolved_by', 'resolution_notes']) {
    if (data[key] !== undefined) {
      fields.push(`${key} = $${idx++}`);
      values.push(data[key]);
    }
  }
  if (!fields.length) return getGdprRequest(id);
  values.push(id);
  const result = await pool.query(
    `UPDATE gdpr_requests SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

module.exports = {
  PORTAL_CONSENT_TYPES,
  isValidConsentType,
  defaultConsentRows,
  getPassForPortal,
  listPassConsents,
  upsertPassConsent,
  listConsentLogForPass,
  insertPortalToken,
  getPortalTokenByHash,
  isPortalTokenActive,
  revokePortalTokensForPass,
  markPortalTokenUsed,
  createGdprRequest,
  getGdprRequest,
  listGdprRequestsForPass,
  updateGdprRequest,
  mergePassFieldValues,
  getPortalPushHistory
};
