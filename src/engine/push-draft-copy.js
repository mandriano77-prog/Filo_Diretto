/**
 * HR immediate push — AI draft copy within strip limits (human reviews before send).
 */
const { callAI, extractJSON } = require('./ai-copy');
const {
  PUSH_TITLE_MAX,
  PUSH_MESSAGE_MAX,
  PUSH_MESSAGE_LINE_MAX,
  PUSH_TEXT_AGENT_RULES,
  validatePushText,
} = require('./push-text-limits');
const { normalizePushAnnouncementForStrip, truncateStripOverlayTitle } = require('./passkit');

const PUSH_DRAFT_SYSTEM = `Sei il copywriter push per Filo Diretto (pass dipendenti Apple/Google Wallet).
Il manager descrive la promo in italiano; tu compili i campi di una push IMMEDIATA da rivedere prima dell'invio.

${PUSH_TEXT_AGENT_RULES}

VINCOLI ASSOLUTI (se superati la push viene rifiutata dal server):
- title: massimo ${PUSH_TITLE_MAX} caratteri (maiuscolo sulla strip)
- message: massimo ${PUSH_MESSAGE_MAX} caratteri (2 righe × ${PUSH_MESSAGE_LINE_MAX} sulla strip)
- NON mettere URL nel messaggio: usa pass_link_url + pass_link_label se serve un link
- pass_link_label max 64 caratteri

Rispondi SOLO JSON:
{
  "title": "...",
  "message": "...",
  "include_pass_link": false,
  "pass_link_url": null,
  "pass_link_label": null,
  "notes": ["eventuale nota per il manager"]
}`;

function clampPushDraft(raw = {}) {
  const normalized = normalizePushAnnouncementForStrip({
    title: raw.title,
    message: raw.message,
    ts: Date.now(),
  });
  const title =
    normalized?.title ||
    truncateStripOverlayTitle(String(raw.title || '').trim(), PUSH_TITLE_MAX) ||
    'NOVITÀ';
  let message = normalized?.message || String(raw.message || '').trim();
  if (message.length > PUSH_MESSAGE_MAX) {
    message = `${message.slice(0, PUSH_MESSAGE_MAX - 1)}…`;
  }
  const url = String(raw.pass_link_url || '').trim() || null;
  const includeLink = raw.include_pass_link === true || !!url;
  return {
    title,
    message,
    include_pass_link: includeLink && !!url,
    pass_link_url: url,
    pass_link_label: url
      ? String(raw.pass_link_label || title || 'Scopri di più').trim().slice(0, 64)
      : null,
    notes: Array.isArray(raw.notes) ? raw.notes.map(String).slice(0, 4) : [],
    limits: { title_max: PUSH_TITLE_MAX, message_max: PUSH_MESSAGE_MAX },
    valid: validatePushText(title, message).length === 0,
  };
}

function heuristicPushDraft(brief, brand) {
  const clean = String(brief || '').trim();
  const firstLine = clean.split(/[\n.!?]/)[0].trim();
  const rest = clean.slice(firstLine.length).replace(/^[\s.!?]+/, '').trim();
  return clampPushDraft({
    title: firstLine || 'NOVITÀ',
    message: rest || clean || `Novità da ${brand?.name || 'team'}`,
    notes: ['Bozza rapida senza AI — controlla titolo e messaggio prima di inviare.'],
  });
}

function buildUserPrompt({ brand, brief, recentPushes = [] }) {
  const lines = [
    `Brand: ${brand?.name || 'Brand'}`,
    `Richiesta manager: ${brief}`,
  ];
  if (recentPushes.length) {
    lines.push('Ultime push inviate (stile di riferimento):');
    recentPushes.slice(0, 3).forEach((p, i) => {
      lines.push(`${i + 1}. titolo="${p.title}" messaggio="${p.message}"`);
    });
  }
  lines.push('Genera title e message entro i limiti. Se la richiesta implica un link, compila include_pass_link e pass_link_url.');
  return lines.join('\n');
}

async function draftImmediatePushCopy({ brand, brief, recentPushes = [] }) {
  const text = String(brief || '').trim();
  if (!text) throw new Error('brief richiesto');

  try {
    const raw = extractJSON(
      await callAI(PUSH_DRAFT_SYSTEM, buildUserPrompt({ brand, brief: text, recentPushes }), 512)
    );
    const draft = clampPushDraft(raw);
    if (!draft.message) throw new Error('AI non ha prodotto un messaggio valido');
    return draft;
  } catch (err) {
    console.warn('[push-draft] AI fallback:', err.message);
    return heuristicPushDraft(text, brand);
  }
}

module.exports = {
  draftImmediatePushCopy,
  clampPushDraft,
  heuristicPushDraft,
  PUSH_DRAFT_SYSTEM,
};
