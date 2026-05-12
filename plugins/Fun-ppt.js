'use strict';

// ─── PIEDRA, PAPEL O TIJERA ───────────────────────────────────────────────────
// Comandos: ppt, suit, pvp
// Modo vs Bot: .ppt piedra | .ppt papel | .ppt tijera
// Modo PVP:   .pvp @usuario  → desafía a otro jugador
//             El retado escribe: aceptar / rechazar
//             Luego ambos envían su elección en privado o en el grupo

const pvpRooms = new Map(); // id → room
const TIMEOUT_MS = 60_000;

const CHOICES = ['piedra', 'papel', 'tijera'];

const BEATS = {
  piedra: 'tijera',
  papel:  'piedra',
  tijera: 'papel'
};

const EMOJI = {
  piedra: '🪨',
  papel:  '📄',
  tijera: '✂️'
};

function mention(jid = '') {
  return '@' + jid.split('@')[0];
}

function getWinner(a, b) {
  if (a === b) return 'empate';
  return BEATS[a] === b ? 'a' : 'b';
}

// ─── VS BOT ──────────────────────────────────────────────────────────────────
function playVsBot(choice) {
  const bot = CHOICES[Math.floor(Math.random() * CHOICES.length)];
  const result = getWinner(choice, bot);
  return { bot, result };
}

function vsBotText(name, choice, bot, result) {
  const header =
    result === 'empate' ? '🤝 ¡EMPATE!'
    : result === 'a'    ? '🎉 ¡GANASTE!'
    :                     '😔 ¡PERDISTE!';

  return `${header}

👤 Tú:  ${EMOJI[choice]} ${choice}
🤖 Bot: ${EMOJI[bot]} ${bot}`;
}

// ─── PVP ─────────────────────────────────────────────────────────────────────
function createRoom(challenger, challenged, chatJid) {
  const id = `pvp_${Date.now()}`;
  const room = {
    id,
    chatJid,
    challenger,
    challenged,
    choices: {},
    status: 'waiting', // waiting → accepted → playing → done
    timer: null
  };
  pvpRooms.set(id, room);
  return room;
}

function getRoomByPlayer(jid) {
  for (const room of pvpRooms.values()) {
    if (room.challenger === jid || room.challenged === jid) return room;
  }
  return null;
}

function deleteRoom(id) {
  const room = pvpRooms.get(id);
  if (room?.timer) clearTimeout(room.timer);
  pvpRooms.delete(id);
}

async function resolveMatch(sock, room) {
  const { chatJid, challenger, challenged, choices } = room;
  const cA = choices[challenger];
  const cB = choices[challenged];

  const result = getWinner(cA, cB);

  let text;
  const mentions = [challenger, challenged];

  if (result === 'empate') {
    text =
`🤝 *¡EMPATE!*

${mention(challenger)}: ${EMOJI[cA]} ${cA}
${mention(challenged)}: ${EMOJI[cB]} ${cB}`;
  } else {
    const winner = result === 'a' ? challenger : challenged;
    const loser  = result === 'a' ? challenged : challenger;
    const wChoice = result === 'a' ? cA : cB;
    const lChoice = result === 'a' ? cB : cA;

    text =
`🏆 *¡TENEMOS GANADOR!*

🥇 ${mention(winner)}: ${EMOJI[wChoice]} ${wChoice}
💀 ${mention(loser)}:  ${EMOJI[lChoice]} ${lChoice}`;
  }

  deleteRoom(room.id);
  await sock.sendMessage(chatJid, { text, mentions });
}

// ─── EXPORT ──────────────────────────────────────────────────────────────────
module.exports = {
  commands: ['ppt', 'suit', 'pvp', 'suitpvp'],

  async execute(ctx) {
    const { sock, msg, remoteJid, args, command, sender } = ctx;

    // ── Modo PVP: desafiar a alguien ─────────────────────────────────────────
    if (command === 'pvp' || command === 'suitpvp') {
      if (!remoteJid.endsWith('@g.us')) {
        return sock.sendMessage(remoteJid, {
          text: '❌ El modo PVP solo funciona en grupos.'
        }, { quoted: msg });
      }

      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

      if (!mentioned) {
        return sock.sendMessage(remoteJid, {
          text: `⚠️ Menciona a alguien para desafiar.\nEjemplo: *.pvp @usuario*`
        }, { quoted: msg });
      }

      if (mentioned === sender) {
        return sock.sendMessage(remoteJid, {
          text: '❌ No puedes desafiarte a ti mismo.'
        }, { quoted: msg });
      }

      if (getRoomByPlayer(sender)) {
        return sock.sendMessage(remoteJid, {
          text: '⚠️ Ya tienes una partida activa. Termínala primero.'
        }, { quoted: msg });
      }

      if (getRoomByPlayer(mentioned)) {
        return sock.sendMessage(remoteJid, {
          text: `⚠️ ${mention(mentioned)} ya está en una partida.`,
          mentions: [mentioned]
        }, { quoted: msg });
      }

      const room = createRoom(sender, mentioned, remoteJid);

      room.timer = setTimeout(async () => {
        if (!pvpRooms.has(room.id)) return;
        deleteRoom(room.id);
        await sock.sendMessage(remoteJid, {
          text: `⏰ El reto de ${mention(sender)} a ${mention(mentioned)} expiró por falta de respuesta.`,
          mentions: [sender, mentioned]
        });
      }, TIMEOUT_MS);

      return sock.sendMessage(remoteJid, {
        text:
`🎮 *PIEDRA, PAPEL O TIJERA — PVP*

${mention(sender)} desafía a ${mention(mentioned)}

✅ Escribe *aceptar* para unirte
❌ Escribe *rechazar* para declinar`,
        mentions: [sender, mentioned]
      }, { quoted: msg });
    }

    // ── Modo vs Bot ───────────────────────────────────────────────────────────
    const choice = args[0]?.toLowerCase();

    if (!CHOICES.includes(choice)) {
      return sock.sendMessage(remoteJid, {
        text:
`🪨📄✂️ *PIEDRA, PAPEL O TIJERA*

Elige tu jugada:
• *.ppt piedra*
• *.ppt papel*
• *.ppt tijera*

O desafía a alguien:
• *.pvp @usuario*`
      }, { quoted: msg });
    }

    const { bot, result } = playVsBot(choice);
    const name = mention(sender);

    return sock.sendMessage(remoteJid, {
      text: vsBotText(name, choice, bot, result),
      mentions: [sender]
    }, { quoted: msg });
  },

  async onMessage(ctx) {
    const { sock, remoteJid, body, sender, msg } = ctx;

    const room = getRoomByPlayer(sender);
    if (!room || room.chatJid !== remoteJid) return;

    const text = body.trim().toLowerCase();

    // ── Aceptar / rechazar desafío ────────────────────────────────────────────
    if (room.status === 'waiting' && sender === room.challenged) {
      if (text === 'rechazar') {
        deleteRoom(room.id);
        return sock.sendMessage(remoteJid, {
          text: `❌ ${mention(room.challenged)} rechazó el reto.`,
          mentions: [room.challenger, room.challenged]
        });
      }

      if (text === 'aceptar') {
        room.status = 'playing';
        return sock.sendMessage(remoteJid, {
          text:
`✅ *¡Reto aceptado!*

${mention(room.challenger)} y ${mention(room.challenged)}, cada uno envíe su jugada aquí:
• *piedra*  🪨
• *papel*   📄
• *tijera*  ✂️`,
          mentions: [room.challenger, room.challenged]
        });
      }
    }

    // ── Enviar jugada ─────────────────────────────────────────────────────────
    if (room.status === 'playing' && CHOICES.includes(text)) {
      if (room.choices[sender]) {
        return sock.sendMessage(remoteJid, {
          text: `⚠️ ${mention(sender)}, ya enviaste tu jugada. Esperando al otro jugador...`,
          mentions: [sender]
        }, { quoted: msg });
      }

      room.choices[sender] = text;

      await sock.sendMessage(remoteJid, {
        text: `✅ ${mention(sender)} eligió su jugada. ⏳`,
        mentions: [sender]
      });

      // Ambos jugaron → resolver
      if (room.choices[room.challenger] && room.choices[room.challenged]) {
        await resolveMatch(sock, room);
      }
    }
  }
};
