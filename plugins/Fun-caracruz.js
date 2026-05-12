'use strict';

// ─── CARA O CRUZ ─────────────────────────────────────────────────────────────
// Comandos: lanzar, caracruz, moneda
// Uso: .lanzar cara | .lanzar cruz
// Cooldown: 40 segundos por usuario

const cooldowns = new Map(); // sender → timestamp
const COOLDOWN_MS = 40_000;

const CHOICES = ['cara', 'cruz'];

const EMOJI = {
  cara: '😎',
  cruz: '✝️'
};

function mention(jid = '') {
  return '@' + jid.split('@')[0];
}

function msToSeconds(ms) {
  return Math.ceil(ms / 1000);
}

function flipCoin() {
  return Math.random() < 0.5 ? 'cara' : 'cruz';
}

module.exports = {
  commands: ['lanzar', 'caracruz', 'moneda'],

  async execute(ctx) {
    const { sock, msg, remoteJid, args, sender } = ctx;

    const choice = args[0]?.toLowerCase();

    // Sin argumento → mostrar ayuda
    if (!choice) {
      return sock.sendMessage(remoteJid, {
        text:
`🪙 *CARA O CRUZ*

Elige tu lado y lanza la moneda:
• *.lanzar cara*
• *.lanzar cruz*

⏱️ Cooldown: *${COOLDOWN_MS / 1000}s* entre tiradas.`
      }, { quoted: msg });
    }

    // Validar elección
    if (!CHOICES.includes(choice)) {
      return sock.sendMessage(remoteJid, {
        text: `❌ Opción inválida. Elige *cara* o *cruz*.\nEjemplo: *.lanzar cara*`
      }, { quoted: msg });
    }

    // Cooldown
    const lastUsed = cooldowns.get(sender) || 0;
    const elapsed  = Date.now() - lastUsed;

    if (elapsed < COOLDOWN_MS) {
      const remaining = msToSeconds(COOLDOWN_MS - elapsed);
      return sock.sendMessage(remoteJid, {
        text: `⏳ ${mention(sender)}, espera *${remaining}s* antes de volver a lanzar.`,
        mentions: [sender]
      }, { quoted: msg });
    }

    // Actualizar cooldown
    cooldowns.set(sender, Date.now());

    // Lanzar moneda
    const result = flipCoin();
    const won    = result === choice;

    const text = won
      ? `🎉 *¡GANASTE!*

${mention(sender)} eligió: ${EMOJI[choice]} *${choice}*
🪙 Resultado: ${EMOJI[result]} *${result}*

✅ ¡Acertaste!`
      : `😔 *¡PERDISTE!*

${mention(sender)} eligió: ${EMOJI[choice]} *${choice}*
🪙 Resultado: ${EMOJI[result]} *${result}*

❌ Mala suerte, intenta de nuevo.`;

    return sock.sendMessage(remoteJid, {
      text,
      mentions: [sender]
    }, { quoted: msg });
  }
};
