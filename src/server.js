// Wallet Ads MVP v1.0
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const { getDb } = require('./db');
const apiRoutes = require('./api/routes');
const debugSignRoutes = require('./api/debug-sign');
const { startScheduler } = require('./engine/scheduler');
const { runStripPromoCheck } = require('./engine/strip-promo');

// Load certificates: prefer FILE-BASED certs (from repo), fallback to env vars
function loadCerts() {
  const certDir = path.join(__dirname, '..', 'certs');
  if (!fs.existsSync(certDir)) fs.mkdirSync(certDir, { recursive: true });

  const certFile = path.join(certDir, 'signerCert.pem');
  const keyFile = path.join(certDir, 'signerKey.pem');
  const wwdrFile = path.join(certDir, 'wwdr.pem');

  if (fs.existsSync(certFile) && fs.existsSync(keyFile)) {
    console.log('✓ Certificates loaded from files (repo)');
  } else if (process.env.SIGNER_CERT_BASE64) {
    fs.writeFileSync(certFile, Buffer.from(process.env.SIGNER_CERT_BASE64, 'base64'));
    fs.writeFileSync(keyFile, Buffer.from(process.env.SIGNER_KEY_BASE64, 'base64'));
    if (process.env.WWDR_CERT_BASE64) {
      fs.writeFileSync(wwdrFile, Buffer.from(process.env.WWDR_CERT_BASE64, 'base64'));
    }
    console.log('✓ Certificates loaded from environment variables');
  } else {
    console.warn('⚠️ No certificates found — mock signing mode');
  }
}

loadCerts();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Trust reverse proxy (Railway, Heroku, etc.) for correct req.protocol
app.set('trust proxy', true);

// Force HTTPS in production
app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] === 'http' && process.env.NODE_ENV !== 'development') {
    return res.redirect(301, 'https://' + req.headers.host + req.url);
  }
  next();
});

// Middleware
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Apple Wallet debug (public, no auth) — must be before debug router
app.get('/debug/wallet-check', async (req, res) => {
  try {
    const { pool } = require('./db');
    const deviceCount = await pool.query('SELECT COUNT(*) as count FROM device_registrations');
    const passCount = await pool.query('SELECT COUNT(*) as count FROM pass_instances');
    const recentEvents = await pool.query("SELECT event_type, metadata, created_at FROM events WHERE event_type IN ('pass_installed','pass_removed','pass_created') ORDER BY created_at DESC LIMIT 20");
    const devices = await pool.query('SELECT device_library_id, push_token, serial_number FROM device_registrations LIMIT 10');
    res.json({
      status: 'ok',
      webServiceURL_in_pass: `https://${process.env.CUSTOM_DOMAIN || 'localhost:3000'}/api`,
      apple_calls: `https://${process.env.CUSTOM_DOMAIN || 'localhost:3000'}/api/v1/devices/{did}/registrations/{ptid}/{sn}`,
      registered_devices: parseInt(deviceCount.rows[0].count),
      total_passes: parseInt(passCount.rows[0].count),
      devices: devices.rows.map(d => ({ device: d.device_library_id?.substring(0,12)+'...', token: d.push_token?.substring(0,12)+'...', serial: d.serial_number?.substring(0,12)+'...' })),
      recent_events: recentEvents.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API routes
app.use('/api/v1', apiRoutes);
app.use('/debug', debugSignRoutes);

// Static pages
app.use('/landing', express.static(path.join(__dirname, 'landing')));
app.use('/dashboard', express.static(path.join(__dirname, 'dashboard')));

// Health check + wallet debug
const BUILD_VERSION = '3.0.0-' + Date.now();
app.get('/health', async (req, res) => {
  const base = { status: 'ok', product: 'wallet-ads', version: BUILD_VERSION, timestamp: new Date().toISOString() };
  if (req.query.wallet) {
    try {
      const { pool } = require('./db');
      const dc = await pool.query('SELECT COUNT(*) as count FROM device_registrations');
      const pc = await pool.query('SELECT COUNT(*) as count FROM pass_instances');
      const ev = await pool.query("SELECT event_type, metadata, created_at FROM events WHERE event_type IN ('pass_installed','pass_removed','pass_created') ORDER BY created_at DESC LIMIT 15");
      const dv = await pool.query('SELECT device_library_id, push_token, serial_number FROM device_registrations LIMIT 10');
      base.wallet = {
        webServiceURL: `https://${process.env.CUSTOM_DOMAIN || 'localhost:3000'}/api`,
        registered_devices: parseInt(dc.rows[0].count),
        total_passes: parseInt(pc.rows[0].count),
        devices: dv.rows.map(d => ({ device: d.device_library_id?.substring(0,12), token: d.push_token?.substring(0,12), serial: d.serial_number?.substring(0,12) })),
        recent_events: ev.rows
      };
    } catch (e) { base.wallet_error = e.message; }
  }
  res.json(base);
});

// Root redirect
app.get('/', (req, res) => {
  res.redirect('/dashboard/');
});

// Privacy policy
app.get('/privacy/:slugOrId', (req, res) => {
  res.sendFile(path.join(__dirname, 'privacy', 'index.html'));
});

// ─── Direct Save — skip landing, serve .pkpass immediately ──────────────
// URL: /save/{slug}/{campaignId}?utm_source=instagram&utm_medium=story&...
// For social/digital ads: ad CTA → this URL → iOS opens pass preview → done
const {
  getBrandBySlug, getCampaign, getTemplate, listTemplates,
  createPassInstance, logEvent, incrementCampaignDownloads
} = require('./db');
const { createPkpass } = require('./engine/passkit');

app.get('/save/:slug/:campaignId?', async (req, res) => {
  try {
    const { slug, campaignId } = req.params;
    const brand = await getBrandBySlug(slug);
    if (!brand) return res.status(404).send('Brand non trovato');

    // Find template (campaign-specific or first available)
    let template = null;
    if (campaignId) {
      const campaign = await getCampaign(campaignId);
      if (campaign && campaign.template_id) {
        template = await getTemplate(campaign.template_id);
      }
    }
    if (!template) {
      const templates = await listTemplates(brand.id);
      template = templates[0];
    }
    if (!template) return res.status(400).send('Nessun template configurato');

    // Build UTM from query params
    const utm = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(k => {
      if (req.query[k]) utm[k.replace('utm_', '')] = req.query[k];
    });

    // Create anonymous pass with browser metadata
    const passInstance = await createPassInstance({
      template_id: template.id,
      brand_id: brand.id,
      campaign_id: campaignId || null,
      field_values: {},
      utm,
      user_agent: req.headers['user-agent'] || null,
      referrer_url: req.headers['referer'] || null
    });

    await logEvent({ pass_id: passInstance.id, brand_id: brand.id, event_type: 'pass_created', metadata: { source: 'direct_save', campaign_id: campaignId, utm } });
    if (campaignId) await incrementCampaignDownloads(campaignId);

    // Generate and serve .pkpass
    const baseUrl = process.env.CUSTOM_DOMAIN
      ? `https://${process.env.CUSTOM_DOMAIN}`
      : `${req.protocol}://${req.get('host')}`;

    const pkpassBuffer = await createPkpass(template, passInstance, brand, {
      baseUrl,
      passTypeIdentifier: process.env.PASS_TYPE_IDENTIFIER || 'pass.com.nudj',
      teamIdentifier: process.env.TEAM_IDENTIFIER || 'YOUR_TEAM_ID'
    });

    res.set({
      'Content-Type': 'application/vnd.apple.pkpass',
      'Content-Disposition': `attachment; filename="${slug}.pkpass"`,
      'Content-Length': pkpassBuffer.length
    });
    res.send(pkpassBuffer);

  } catch (err) {
    console.error('Direct save error:', err);
    res.status(500).send('Errore generazione pass');
  }
});

// Short URL: /:slug serves the landing page for that brand
app.get('/:slug', (req, res, next) => {
  const slug = req.params.slug;
  if (slug.includes('.') || ['api', 'dashboard', 'landing', 'debug', 'health', 'privacy'].includes(slug)) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'landing', 'index.html'));
});

// Initialize database and start server
getDb().then(db => {
  app.locals.db = db;
  app.listen(PORT, () => {
    console.log('\n🚀 Wallet Ads server running on port ' + PORT);
    console.log('  Health: http://localhost:' + PORT + '/health');
    console.log('  API:    http://localhost:' + PORT + '/api/v1');

    // Start push notification scheduler
    const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : `http://localhost:${PORT}`;
    startScheduler(baseUrl);

    // Strip Promo cron — check every hour
    console.log('🎨 Strip Promo scheduler started (every 60 min)');
    setInterval(() => runStripPromoCheck(), 60 * 60 * 1000);
    setTimeout(() => runStripPromoCheck(), 30 * 1000);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
