'use strict';

// ─── PIEDRA, PAPEL O TIJERA ───────────────────────────────────────────────────
// Comandos: ppt, suit, pvp, suitpvp
//
// Modo vs Bot:  .ppt piedra | .ppt papel | .ppt tijera  (en cualquier chat)
//
// Modo PVP (solo grupos):
//   1. .pvp @usuario         → desafía a otro jugador
//   2. El retado escribe:    aceptar / rechazar  (en el grupo)
//   3. Cuando se acepta, el bot le escribe a CADA jugador por privado
//      pidiéndole su jugada en secreto.
//   4. Cada jugador responde al bot en privado con: piedra / papel / tijera
//   5. El bot anuncia el resultado EN EL GRUPO.

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

// JID de chat privado: "número@s.whatsapp.net"
function privatJid(jid = '') {
  return jid.split('@')[0] + '@s.whatsapp.net';
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

function vsBotText(choice, bot, result) {
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
    status: 'waiting', // waiting → playing → done
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
  const mentions = [challenger, challenged];
  let text;

  if (result === 'empate') {
    text =
`🤝 *¡EMPATE!*

${mention(challenger)}: ${EMOJI[cA]} ${cA}
${mention(challenged)}: ${EMOJI[cB]} ${cB}`;
  } else {
    const winner  = result === 'a' ? challenger : challenged;
    const loser   = result === 'a' ? challenged : challenger;
    const wChoice = result === 'a' ? cA : cB;
    const lChoice = result === 'a' ? cB : cA;

    text =
`🏆 *¡TENEMOS GANADOR!*

🥇 ${mention(winner)}: ${EMOJI[wChoice]} ${wChoice}
💀 ${mention(loser)}: ${EMOJI[lChoice]} ${lChoice}`;
  }

  deleteRoom(room.id);

  // Anunciar resultado en el GRUPO
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
          text: '⚠️ Menciona a alguien para desafiar.\nEjemplo: *.pvp @usuario*'
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
          text: `⏰ El reto de ${mention(sender)} a ${mention(mentioned)} expiró sin respuesta.`,
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

O desafía a alguien en el grupo:
• *.pvp @usuario*`
      }, { quoted: msg });
    }

    const { bot, result } = playVsBot(choice);

    return sock.sendMessage(remoteJid, {
      text: vsBotText(choice, bot, result),
      mentions: [sender]
    }, { quoted: msg });
  },

  async onMessage(ctx) {
    const { sock, remoteJid, body, sender, msg } = ctx;

    const text = body.trim().toLowerCase();
    const room = getRoomByPlayer(sender);
    if (!room) return;

    const isPrivate = !remoteJid.endsWith('@g.us');
    const isGroup   = remoteJid === room.chatJid;

    // ── Aceptar / rechazar (en el grupo) ─────────────────────────────────────
    if (room.status === 'waiting' && sender === room.challenged && isGroup) {
      if (text === 'rechazar') {
        deleteRoom(room.id);
        return sock.sendMessage(room.chatJid, {
          text: `❌ ${mention(room.challenged)} rechazó el reto.`,
          mentions: [room.challenger, room.challenged]
        });
      }

      if (text === 'aceptar') {
        room.status = 'playing';

        // Avisar en el grupo
        await sock.sendMessage(room.chatJid, {
          text:
`✅ *¡Reto aceptado!*

${mention(room.challenger)} y ${mention(room.challenged)}, les envié un mensaje privado.
📩 *Envíen su jugada al bot en privado* para que el rival no la vea.`,
          mentions: [room.challenger, room.challenged]
        });

        // Escribir a cada jugador en PRIVADO
        const instrucciones =
`🎮 *PIEDRA, PAPEL O TIJERA — PVP*

Envía tu jugada aquí en privado:
• *piedra* 🪨
• *papel*  📄
• *tijera* ✂️

⚠️ El resultado se anunciará en el grupo cuando ambos elijan.`;

        await sock.sendMessage(privatJid(room.challenger), { text: instrucciones });
        await sock.sendMessage(privatJid(room.challenged), { text: instrucciones });

        return;
      }
    }

    // ── Recibir jugada (en PRIVADO) ───────────────────────────────────────────
    if (room.status === 'playing' && isPrivate && CHOICES.includes(text)) {
      if (room.choices[sender]) {
        return sock.sendMessage(privatJid(sender), {
          text: `⚠️ Ya enviaste tu jugada (${EMOJI[room.choices[sender]]} ${room.choices[sender]}). Esperando al otro jugador...`
        });
      }

      room.choices[sender] = text;

      // Confirmar al jugador en privado
      await sock.sendMessage(privatJid(sender), {
        text: `✅ Jugada registrada: ${EMOJI[text]} *${text}*\nEsperando al otro jugador...`
      });

      // Avisar en el grupo que alguien ya eligió (sin revelar qué)
      const other = sender === room.challenger ? room.challenged : room.challenger;
      await sock.sendMessage(room.chatJid, {
        text: `🔒 ${mention(sender)} ya envió su jugada. Esperando a ${mention(other)}...`,
        mentions: [sender, other]
      });

      // Ambos eligieron → resolver en el grupo
      if (room.choices[room.challenger] && room.choices[room.challenged]) {
        await resolveMatch(sock, room);
      }
    }
  }
};
        
