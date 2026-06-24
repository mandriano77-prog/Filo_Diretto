const { escHtml } = require('./brand-privacy-document');

const POLICY_VERSION = '2.0';
const POLICY_DATE = '24 giugno 2026';
const PLATFORM_NAME = 'FiloDiretto';

function contactLine(label, value, hrefPrefix) {
  const v = String(value || '').trim();
  if (!v) return '';
  const safe = escHtml(v);
  if (hrefPrefix === 'mailto:') {
    return `<strong>${escHtml(label)}:</strong> <a href="mailto:${safe}">${safe}</a>`;
  }
  return `<strong>${escHtml(label)}:</strong> ${safe}`;
}

function buildDefaultPrivacyExportHtml(brand, options = {}) {
  const platform = String(options.platformName || PLATFORM_NAME).trim() || PLATFORM_NAME;
  const name = String(brand?.name || '').trim() || 'Programma HR';
  const cfg = brand?.config && typeof brand.config === 'object' ? brand.config : {};
  const dpo = String(brand?.dpo_email || cfg.dpo_email || cfg.dpoEmail || '').trim();
  const hrEmail = String(brand?.hr_email || cfg.hr_email || cfg.support?.email || '').trim();

  let titolare =
    `Il Titolare del trattamento dei dati personali è <strong>${escHtml(name)}</strong> ` +
    '(di seguito «Titolare»), in qualità di datore di lavoro. ';
  if (dpo) {
    titolare += 'Per le richieste relative alla privacy puoi contattare il Responsabile della protezione dei dati (DPO).';
  } else if (hrEmail) {
    titolare += 'Per le richieste relative alla privacy puoi contattare il Titolare ai recapiti HR indicati di seguito.';
  } else {
    titolare += 'Per le richieste relative alla privacy puoi contattare il Titolare ai recapiti aziendali.';
  }

  const contacts = [];
  if (dpo) contacts.push(contactLine('DPO', dpo, 'mailto:'));
  if (hrEmail && hrEmail !== dpo) contacts.push(contactLine('Email HR / supporto', hrEmail, 'mailto:'));
  const dpoBlock = contacts.length
    ? `<p>${contacts.join('<br>')}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>Informativa privacy — ${escHtml(name)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #334155; line-height: 1.7; padding: 40px 24px; max-width: 720px; margin: 0 auto; }
    h1 { color: #0f172a; font-size: 28px; margin-bottom: 8px; }
    .brand-name { color: #7c3aed; font-weight: 600; margin-bottom: 8px; }
    .intro { color: #64748b; font-size: 14px; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 1px solid #e2e8f0; }
    h2 { color: #0f172a; font-size: 18px; margin-top: 28px; margin-bottom: 10px; }
    p, li { font-size: 14px; }
    ul { margin: 0 0 14px 20px; }
    .date { font-size: 12px; color: #64748b; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
    .platform { font-size: 12px; color: #64748b; margin-top: 16px; }
    a { color: #7c3aed; }
  </style>
</head>
<body>
  <h1>Informativa privacy</h1>
  <div class="brand-name">${escHtml(name)}</div>
  <p class="intro">Programma HR digitale di ${escHtml(name)} — pass dipendente su Apple Wallet / Google Wallet e Area Privata.</p>

  <h2>1. Titolare del trattamento</h2>
  <p>${titolare}</p>
  ${dpoBlock}

  <h2>2. Responsabile del trattamento (fornitore tecnologico)</h2>
  <p>La piattaforma tecnologica che eroga il servizio di pass HR, notifiche, portale dipendente e gestione consensi è fornita da <strong>${escHtml(platform)}</strong>, in qualità di Responsabile del trattamento ex art. 28 GDPR, per conto del Titolare e secondo le istruzioni da questi impartite.</p>

  <h2>3. Dati personali trattati</h2>
  <p>In relazione al programma HR digitale possono essere trattati, in base al rapporto di lavoro e alle funzioni attivate:</p>
  <ul>
    <li>Dati anagrafici e identificativi (nome, cognome, email aziendale, matricola)</li>
    <li>Dati organizzativi (reparto, sede di lavoro, data di assunzione, ruolo)</li>
    <li>Dati tecnici del dispositivo e del pass Wallet (identificativo pass, token push, data installazione)</li>
    <li>Preferenze di consenso e log delle scelte privacy</li>
    <li>Dati relativi a iniziative HR facoltative (es. COIN, challenge, sondaggi), se attivate e consensualmente abilitate</li>
  </ul>

  <h2>4. Finalità del trattamento</h2>
  <p>I dati sono trattati per:</p>
  <ul>
    <li>Emissione e gestione del pass dipendente digitale (Apple Wallet / Google Wallet)</li>
    <li>Accesso all’Area Privata e ai servizi HR collegati (hub, comunicazioni, aggiornamenti pass)</li>
    <li>Invio di notifiche push relative al programma HR e alle comunicazioni aziendali autorizzate</li>
    <li>Gestione dei consensi privacy e tracciamento delle preferenze espresse</li>
    <li>Adempimento di obblighi legali, fiscali e di sicurezza sul lavoro connessi al rapporto di lavoro</li>
  </ul>

  <h2>5. Base giuridica</h2>
  <ul>
    <li>Esecuzione del rapporto di lavoro (art. 6, par. 1, lett. b GDPR)</li>
    <li>Obbligo di legge (art. 6, par. 1, lett. c GDPR), ove applicabile</li>
    <li>Consenso esplicito (art. 6, par. 1, lett. a GDPR) per le finalità facoltative — revocabile in qualsiasi momento</li>
  </ul>

  <h2>6. Diritti dell’interessato</h2>
  <p>Ai sensi degli artt. 15–22 GDPR, hai diritto di accesso, rettifica, cancellazione, limitazione, opposizione, portabilità e revoca del consenso.</p>

  <h2>7. Reclami</h2>
  <p>Hai diritto di proporre reclamo al Garante per la protezione dei dati personali (<a href="https://www.garanteprivacy.it">www.garanteprivacy.it</a>).</p>

  <p class="date">Versione ${POLICY_VERSION} — ultimo aggiornamento: ${POLICY_DATE}</p>
  <p class="platform">Documento fornito da ${escHtml(platform)} — piattaforma HR digital workplace.</p>
</body>
</html>`;
}

module.exports = {
  POLICY_VERSION,
  POLICY_DATE,
  buildDefaultPrivacyExportHtml
};
