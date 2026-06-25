/**
 * HR push copy limits — single source of truth (strip overlay + API + dashboard).
 * Titolo: 1 riga sulla strip. Messaggio: max 2 righe da 26 caratteri.
 */

const PUSH_TITLE_MAX = 22;
const PUSH_MESSAGE_MAX = 52;
const PUSH_MESSAGE_LINE_MAX = 26;
const PUSH_MESSAGE_LINES = 2;

function validatePushText(title, message) {
  const t = String(title ?? '').trim();
  const m = String(message ?? '').trim();
  const errors = [];

  if (!t) {
    errors.push({ field: 'pushTitle', message: 'Inserisci un titolo per la notifica' });
  } else if (t.length > PUSH_TITLE_MAX) {
    errors.push({
      field: 'pushTitle',
      message: `Titolo max ${PUSH_TITLE_MAX} caratteri (compare in maiuscolo sulla strip)`,
    });
  }

  if (!m) {
    errors.push({ field: 'pushMessage', message: 'Inserisci il testo del messaggio' });
  } else if (m.length > PUSH_MESSAGE_MAX) {
    errors.push({
      field: 'pushMessage',
      message: `Messaggio max ${PUSH_MESSAGE_MAX} caratteri (${PUSH_MESSAGE_LINES} righe da ${PUSH_MESSAGE_LINE_MAX} sulla strip)`,
    });
  }

  return errors;
}

function firstPushTextError(title, message) {
  const errors = validatePushText(title, message);
  return errors[0] || null;
}

/** Markdown block for AGENTS.md / agent prompts */
const PUSH_TEXT_AGENT_RULES = `
## Push HR — limiti testo (obbligatori)

Le push **non partono** se superi questi limiti (validazione API \`POST /push/send\`).

| Campo | Max caratteri | Note |
|-------|---------------|------|
| **Titolo** | **22** | Maiuscolo sulla strip + etichetta notifica Wallet |
| **Messaggio** | **52** | 2 righe × 26 caratteri sulla strip |

Regole per copy / agent:
- Scrivi frasi **corte**; conta emoji e punteggiatura come 1 carattere.
- Titolo: hook breve (es. \`2x1 OCCHIALI 😎\` — verifica ≤22).
- Messaggio: max 2 righe leggibili; se serve URL usa **Includi link nel pass**, non nel messaggio.
- Anteprima strip nel back office (\`fd-push\`) usa gli stessi limiti.
- Costanti codice: \`src/engine/push-text-limits.js\` (\`PUSH_TITLE_MAX\`, \`PUSH_MESSAGE_MAX\`).
`.trim();

module.exports = {
  PUSH_TITLE_MAX,
  PUSH_MESSAGE_MAX,
  PUSH_MESSAGE_LINE_MAX,
  PUSH_MESSAGE_LINES,
  validatePushText,
  firstPushTextError,
  PUSH_TEXT_AGENT_RULES,
};
