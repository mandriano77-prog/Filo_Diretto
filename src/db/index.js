const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

// Use DATABASE_URL from Railway (or local dev)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway')
    ? { rejectUnauthorized: false }
    : false
});

// SQL schema definitions (PostgreSQL syntax)
const SCHEMA = `
CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pass_templates (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id),
  name TEXT NOT NULL,
  pass_type TEXT NOT NULL DEFAULT 'generic',
  style JSONB NOT NULL DEFAULT '{}',
  fields JSONB NOT NULL DEFAULT '[]',
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pass_instances (
  id TEXT PRIMARY KEY,
  serial_number TEXT UNIQUE NOT NULL,
  template_id TEXT NOT NULL REFERENCES pass_templates(id),
  brand_id TEXT NOT NULL REFERENCES brands(id),
  customer_data JSONB DEFAULT '{}',
  field_values JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active',
  device_token TEXT,
  auth_token TEXT NOT NULL,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  pass_id TEXT REFERENCES pass_instances(id),
  brand_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  device_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS device_registrations (
  id SERIAL PRIMARY KEY,
  device_library_id TEXT NOT NULL,
  push_token TEXT NOT NULL,
  serial_number TEXT NOT NULL REFERENCES pass_instances(serial_number),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(device_library_id, serial_number)
);
`;

/**
 * Initialize database - create tables if they don't exist
 */
async function getDb() {
  try {
    await pool.query(SCHEMA);
    console.log('â Database schema initialized (PostgreSQL)');
  } catch (error) {
    console.error('Error initializing schema:', error);
    throw error;
  }
  return pool;
}

/**
 * saveDb - no-op for PostgreSQL (data is persisted automatically)
 */
function saveDb() {
  // No-op: PostgreSQL persists automatically
}

/**
 * Create a new brand
 */
async function createBrand(data) {
  const id = data.id || uuidv4();
  const { name, slug, config = {} } = data;

  if (!name || !slug) {
    throw new Error('Brand name and slug are required');
  }

  const configObj = typeof config === 'string' ? JSON.parse(config) : config;

  try {
    await pool.query(
      `INSERT INTO brands (id, name, slug, config) VALUES ($1, $2, $3, $4)`,
      [id, name, slug, JSON.stringify(configObj)]
    );
    return { id, name, slug, config: configObj };
  } catch (error) {
    throw new Error(`Failed to create brand: ${error.message}`);
  }
}

/**
 * Create a new pass template
 */
async function createTemplate(data) {
  const id = data.id || uuidv4();
  const { brand_id, name, pass_type = 'generic', style = {}, fields = [], config = {} } = data;

  if (!brand_id || !name) {
    throw new Error('Brand ID and template name are required');
  }

  const styleObj = typeof style === 'string' ? JSON.parse(style) : style;
  const fieldsObj = typeof fields === 'string' ? JSON.parse(fields) : fields;
  const configObj = typeof config === 'string' ? JSON.parse(config) : config;

  try {
    await pool.query(
      `INSERT INTO pass_templates (id, brand_id, name, pass_type, style, fields, config) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, brand_id, name, pass_type, JSON.stringify(styleObj), JSON.stringify(fieldsObj), JSON.stringify(configObj)]
    );
    return {
      id, brand_id, name, pass_type,
      style: styleObj,
      fields: fieldsObj,
      config: configObj
    };
  } catch (error) {
    throw new Error(`Failed to create template: ${error.message}`);
  }
}

/**
 * Create a new pass instance
 */
async function createPassInstance(data) {
  const id = data.id || uuidv4();
  const serial_number = data.serial_number || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const { template_id, brand_id, customer_data = {}, field_values = {}, device_token = null } = data;
  const auth_token = data.auth_token || uuidv4();

  if (!template_id || !brand_id) {
    throw new Error('Template ID and Brand ID are required');
  }

  const customerObj = typeof customer_data === 'string' ? JSON.parse(customer_data) : customer_data;
  const fieldObj = typeof field_values === 'string' ? JSON.parse(field_values) : field_values;

  try {
    await pool.query(
      `INSERT INTO pass_instances (id, serial_number, template_id, brand_id, customer_data, field_values, device_token, auth_token)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, serial_number, template_id, brand_id, JSON.stringify(customerObj), JSON.stringify(fieldObj), device_token, auth_token]
    );
    return {
      id, serial_number, template_id, brand_id,
      customer_data: customerObj,
      field_values: fieldObj,
      device_token, auth_token,
      status: 'active'
    };
  } catch (error) {
    throw new Error(`Failed to create pass instance: ${error.message}`);
  }
}

/**
 * Get a pass instance by ID
 */
async function getPassInstance(id) {
  try {
    const result = await pool.query(
      `SELECT * FROM pass_instances WHERE id = $1`, [id]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      serial_number: row.serial_number,
      template_id: row.template_id,
      brand_id: row.brand_id,
      customer_data: row.customer_data,
      field_values: row.field_values,
      status: row.status,
      device_token: row.device_token,
      auth_token: row.auth_token,
      last_updated: row.last_updated,
      created_at: row.created_at
    };
  } catch (error) {
    throw new Error(`Failed to get pass instance: ${error.message}`);
  }
}

/**
 * Get a pass instance by serial number
 */
async function getPassBySerial(serial) {
  try {
    const result = await pool.query(
      `SELECT * FROM pass_instances WHERE serial_number = $1`, [serial]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      serial_number: row.serial_number,
      template_id: row.template_id,
      brand_id: row.brand_id,
      customer_data: row.customer_data,
      field_values: row.field_values,
      status: row.status,
      device_token: row.device_token,
      auth_token: row.auth_token,
      last_updated: row.last_updated,
      created_at: row.created_at
    };
  } catch (error) {
    throw new Error(`Failed to get pass by serial: ${error.message}`);
  }
}

/**
 * Update a pass instance
 */
async function updatePassInstance(id, data) {
  const updates = [];
  const values = [];
  let paramCount = 0;

  if (data.status) {
    paramCount++;
    updates.push(`status = $${paramCount}`);
    values.push(data.status);
  }
  if (data.device_token !== undefined) {
    paramCount++;
    updates.push(`device_token = $${paramCount}`);
    values.push(data.device_token);
  }
  if (data.customer_data) {
    paramCount++;
    const customerObj = typeof data.customer_data === 'string' ? data.customer_data : JSON.stringify(data.customer_data);
    updates.push(`customer_data = $${paramCount}`);
    values.push(customerObj);
  }
  if (data.field_values) {
    paramCount++;
    const fieldObj = typeof data.field_values === 'string' ? data.field_values : JSON.stringify(data.field_values);
    updates.push(`field_values = $${paramCount}`);
    values.push(fieldObj);
  }

  if (updates.length === 0) return getPassInstance(id);

  updates.push('last_updated = NOW()');
  paramCount++;
  values.push(id);

  try {
    await pool.query(
      `UPDATE pass_instances SET ${updates.join(', ')} WHERE id = $${paramCount}`,
      values
    );
    return getPassInstance(id);
  } catch (error) {
    throw new Error(`Failed to update pass instance: ${error.message}`);
  }
}

/**
 * Log an event
 */
async function logEvent(data) {
  const { pass_id, brand_id, event_type, device_id = null, metadata = {} } = data;

  if (!brand_id || !event_type) {
    throw new Error('Brand ID and event type are required');
  }

  const metadataObj = typeof metadata === 'string' ? metadata : JSON.stringify(metadata);

  try {
    await pool.query(
      `INSERT INTO events (pass_id, brand_id, event_type, device_id, metadata) VALUES ($1, $2, $3, $4, $5)`,
      [pass_id || null, brand_id, event_type, device_id, metadataObj]
    );
    return { success: true };
  } catch (error) {
    throw new Error(`Failed to log event: ${error.message}`);
  }
}

/**
 * Get analytics for a brand
 */
async function getAnalytics(brandId) {
  try {
    // Total passes
    const passResult = await pool.query(
      `SELECT COUNT(*) as count FROM pass_instances WHERE brand_id = $1`, [brandId]
    );
    const totalPasses = parseInt(passResult.rows[0].count) || 0;

    // Passes by status
    const statusResult = await pool.query(
      `SELECT status, COUNT(*) as count FROM pass_instances WHERE brand_id = $1 GROUP BY status`, [brandId]
    );
    const byStatus = {};
    statusResult.rows.forEach(row => {
      byStatus[row.status] = parseInt(row.count);
    });

    // Event counts by type
    const eventResult = await pool.query(
      `SELECT event_type, COUNT(*) as count FROM events WHERE brand_id = $1 GROUP BY event_type`, [brandId]
    );
    const events = {};
    eventResult.rows.forEach(row => {
      events[row.event_type] = parseInt(row.count);
    });

    return { totalPasses, byStatus, events };
  } catch (error) {
    throw new Error(`Failed to get analytics: ${error.message}`);
  }
}

/**
 * Register a device for push notifications
 */
async function registerDevice(data) {
  const { device_library_id, push_token, serial_number } = data;

  if (!device_library_id || !push_token || !serial_number) {
    throw new Error('Device library ID, push token, and serial number are required');
  }

  try {
    await pool.query(
      `INSERT INTO device_registrations (device_library_id, push_token, serial_number)
       VALUES ($1, $2, $3)
       ON CONFLICT (device_library_id, serial_number) DO NOTHING`,
      [device_library_id, push_token, serial_number]
    );
    return { success: true };
  } catch (error) {
    throw new Error(`Failed to register device: ${error.message}`);
  }
}

/**
 * Get all devices registered for a pass
 */
async function getDevicesForPass(serial) {
  try {
    const result = await pool.query(
      `SELECT device_library_id, push_token FROM device_registrations WHERE serial_number = $1`,
      [serial]
    );
    return result.rows;
  } catch (error) {
    throw new Error(`Failed to get devices for pass: ${error.message}`);
  }
}

/**
 * Get a brand by ID
 */
async function getBrand(id) {
  try {
    const result = await pool.query(
      `SELECT * FROM brands WHERE id = $1`, [id]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      config: row.config,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  } catch (error) {
    throw new Error(`Failed to get brand: ${error.message}`);
  }
}

/**
 * Get a template by ID
 */
async function getTemplate(id) {
  try {
    const result = await pool.query(
      `SELECT * FROM pass_templates WHERE id = $1`, [id]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      brand_id: row.brand_id,
      name: row.name,
      pass_type: row.pass_type,
      style: row.style,
      fields: row.fields,
      config: row.config,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  } catch (error) {
    throw new Error(`Failed to get template: ${error.message}`);
  }
}

// ============================================================================
// LIST FUNCTIONS (previously done via db.exec() in routes.js)
// ============================================================================

/**
 * List all brands
 */
async function listBrands() {
  const result = await pool.query('SELECT * FROM brands ORDER BY created_at DESC');
  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    config: row.config,
    created_at: row.created_at,
    updated_at: row.updated_at
  }));
}

/**
 * List templates (optionally filtered by brand_id)
 */
async function listTemplates(brandId) {
  let query = 'SELECT * FROM pass_templates';
  const params = [];
  if (brandId) {
    query += ' WHERE brand_id = $1';
    params.push(brandId);
  }
  query += ' ORDER BY created_at DESC';
  const result = await pool.query(query, params);
  return result.rows.map(row => ({
    id: row.id,
    brand_id: row.brand_id,
    name: row.name,
    pass_type: row.pass_type,
    style: row.style,
    fields: row.fields,
    config: row.config,
    created_at: row.created_at,
    updated_at: row.updated_at
  }));
}

/**
 * List passes (optionally filtered by brand_id and/or status)
 */
async function listPasses(brandId, status) {
  let query = 'SELECT * FROM pass_instances';
  const conditions = [];
  const params = [];
  let paramCount = 0;

  if (brandId) {
    paramCount++;
    conditions.push(`brand_id = $${paramCount}`);
    params.push(brandId);
  }
  if (status) {
    paramCount++;
    conditions.push(`status = $${paramCount}`);
    params.push(status);
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  }
  query += ' ORDER BY created_at DESC';

  const result = await pool.query(query, params);
  return result.rows.map(row => ({
    id: row.id,
    serial_number: row.serial_number,
    template_id: row.template_id,
    brand_id: row.brand_id,
    customer_data: row.customer_data,
    field_values: row.field_values,
    status: row.status,
    device_token: row.device_token,
    auth_token: row.auth_token,
    last_updated: row.last_updated,
    created_at: row.created_at
  }));
}

/**
 * List events for a brand
 */
async function listEvents(brandId, limit = 50) {
  const result = await pool.query(
    'SELECT * FROM events WHERE brand_id = $1 ORDER BY created_at DESC LIMIT $2',
    [brandId, parseInt(limit)]
  );
  return result.rows.map(row => ({
    id: row.id,
    pass_id: row.pass_id,
    brand_id: row.brand_id,
    event_type: row.event_type,
    device_id: row.device_id,
    metadata: row.metadata,
    created_at: row.created_at
  }));
}

/**
 * Delete device registration
 */
async function unregisterDevice(deviceLibraryId, serialNumber) {
  await pool.query(
    'DELETE FROM device_registrations WHERE device_library_id = $1 AND serial_number = $2',
    [deviceLibraryId, serialNumber]
  );
}

/**
 * Get serial numbers for a device
 */
async function getSerialsForDevice(deviceLibraryId) {
  const result = await pool.query(
    'SELECT serial_number FROM device_registrations WHERE device_library_id = $1',
    [deviceLibraryId]
  );
  return result.rows.map(row => row.serial_number);
}

module.exports = {
  getDb,
  saveDb,
  createBrand,
  createTemplate,
  createPassInstance,
  getPassInstance,
  getPassBySerial,
  updatePassInstance,
  logEvent,
  getAnalytics,
  registerDevice,
  getDevicesForPass,
  getBrand,
  getTemplate,
  // New list functions
  listBrands,
  listTemplates,
  listPasses,
  listEvents,
  unregisterDevice,
  getSerialsForDevice,
  pool
};
