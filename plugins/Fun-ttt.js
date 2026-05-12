'use strict';

// ─── TRES EN RAYA / TIC TAC TOE ──────────────────────────────────────────────
// Comandos: ttt, tictactoe, xo
//   Crear sala:  .ttt <nombre>
//   Unirse:      .ttt <nombre>   (el segundo jugador)
//   Eliminar:    .delttt
//   Mover:       Responde con un número del 1 al 9

const games = new Map(); // roomId → game
const TIMEOUT_WAIT_MS = 120_000; // 2 min para que alguien se una

const CELL = {
  X: '❎',
  O: '⭕',
  1: '1️⃣', 2: '2️⃣', 3: '3️⃣',
  4: '4️⃣', 5: '5️⃣', 6: '6️⃣',
  7: '7️⃣', 8: '8️⃣', 9: '9️⃣'
};

const WINS = [
  [0,1,2],[3,4,5],[6,7,8], // filas
  [0,3,6],[1,4,7],[2,5,8], // columnas
  [0,4,8],[2,4,6]          // diagonales
];

function mention(jid = '') {
  return '@' + jid.split('@')[0];
}

function emptyBoard() {
  return [1,2,3,4,5,6,7,8,9];
}

function renderBoard(board) {
  const r = board.map(v => CELL[v] ?? CELL[v]);
  return (
    `${r[0]}${r[1]}${r[2]}\n` +
    `${r[3]}${r[4]}${r[5]}\n` +
    `${r[6]}${r[7]}${r[8]}`
  );
}

function checkWinner(board, mark) {
  return WINS.some(combo => combo.every(i => board[i] === mark));
}

function isDraw(board) {
  return board.every(v => v === 'X' || v === 'O');
}

function getGameByPlayer(jid) {
  for (const game of games.values()) {
    if (game.playerX === jid || game.playerO === jid) return game;
  }
  return null;
}

function deleteGame(id) {
  const game = games.get(id);
  if (game?.waitTimer) clearTimeout(game.waitTimer);
  games.delete(id);
}

function boardText(game) {
  const current = game.turn === 'X' ? game.playerX : game.playerO;
  return (
`❌⭕ *TRES EN RAYA*

${mention(game.playerX)} ❎  vs  ⭕ ${mention(game.playerO)}

${renderBoard(game.board)}

🎯 Turno de: ${mention(current)}
_Responde con un número del 1 al 9_`
  );
}

module.exports = {
  commands: ['ttt', 'tictactoe', 'xo', 'delttt', 'delxo', 'deltictactoe'],

  async execute(ctx) {
    const { sock, msg, remoteJid, args, command, sender } = ctx;

    // ── Solo en grupos ────────────────────────────────────────────────────────
    if (!remoteJid.endsWith('@g.us')) {
      return sock.sendMessage(remoteJid, {
        text: '❌ Tres en raya solo funciona en grupos.'
      }, { quoted: msg });
    }

    // ── Eliminar sala ─────────────────────────────────────────────────────────
    if (['delttt','delxo','deltictactoe'].includes(command)) {
      const game = getGameByPlayer(sender);
      if (!game) {
        return sock.sendMessage(remoteJid, {
          text: '⚠️ No estás en ninguna partida de Tres en Raya.'
        }, { quoted: msg });
      }
      deleteGame(game.id);
      return sock.sendMessage(remoteJid, {
        text: '🗑️ Sala de Tres en Raya eliminada.',
        mentions: [game.playerX, game.playerO].filter(Boolean)
      }, { quoted: msg });
    }

    // ── Crear o unirse a sala ─────────────────────────────────────────────────
    const roomName = args.join(' ').trim();

    if (!roomName) {
      return sock.sendMessage(remoteJid, {
        text:
`❌⭕ *TRES EN RAYA*

Crea una sala con un nombre:
*.ttt <nombre>*

El segundo jugador usa el mismo comando para unirse.
Para eliminar la sala: *.delttt*`
      }, { quoted: msg });
    }

    // ¿El jugador ya está en una partida?
    if (getGameByPlayer(sender)) {
      return sock.sendMessage(remoteJid, {
        text: `⚠️ Ya estás en una partida. Usa *.delttt* para salir.`
      }, { quoted: msg });
    }

    // Buscar sala con ese nombre esperando jugador
    const existing = [...games.values()].find(
      g => g.name === roomName && g.chatJid === remoteJid && !g.playerO
    );

    if (existing) {
      // Unirse como jugador O
      if (existing.playerX === sender) {
        return sock.sendMessage(remoteJid, {
          text: '⚠️ Tú mismo creaste esa sala. Espera a otro jugador.'
        }, { quoted: msg });
      }

      clearTimeout(existing.waitTimer);
      existing.playerO  = sender;
      existing.waitTimer = null;

      const mentions = [existing.playerX, sender];
      await sock.sendMessage(remoteJid, {
        text:
`✅ *¡${mention(sender)} se unió a la sala "${roomName}"!*

❎ ${mention(existing.playerX)}  vs  ⭕ ${mention(sender)}

${renderBoard(existing.board)}

🎯 Empieza: ${mention(existing.playerX)}
_Responde con un número del 1 al 9_`,
        mentions
      }, { quoted: msg });

      return;
    }

    // Crear nueva sala
    const id = `ttt_${Date.now()}`;
    const game = {
      id,
      name: roomName,
      chatJid: remoteJid,
      playerX: sender,
      playerO: null,
      board: emptyBoard(),
      turn: 'X',
      waitTimer: null
    };

    game.waitTimer = setTimeout(async () => {
      if (!games.has(id)) return;
      deleteGame(id);
      await sock.sendMessage(remoteJid, {
        text: `⏰ La sala *"${roomName}"* expiró por falta de jugadores.`,
        mentions: [sender]
      });
    }, TIMEOUT_WAIT_MS);

    games.set(id, game);

    return sock.sendMessage(remoteJid, {
      text:
`❌⭕ *TRES EN RAYA — Sala creada*

📌 Nombre: *${roomName}*
👤 ${mention(sender)} espera rival ⏳

Otro jugador puede unirse con:
*.ttt ${roomName}*

Para cancelar: *.delttt*`,
      mentions: [sender]
    }, { quoted: msg });
  },

  async onMessage(ctx) {
    const { sock, remoteJid, body, sender, msg } = ctx;

    const game = getGameByPlayer(sender);
    if (!game || game.chatJid !== remoteJid || !game.playerO) return;

    const num = parseInt(body.trim(), 10);
    if (isNaN(num) || num < 1 || num > 9) return;

    // ¿Es el turno de este jugador?
    const mark      = game.playerX === sender ? 'X' : 'O';
    const otherMark = mark === 'X' ? 'O' : 'X';
    const other     = mark === 'X' ? game.playerO : game.playerX;

    if (game.turn !== mark) {
      return sock.sendMessage(remoteJid, {
        text: `⚠️ ${mention(sender)}, no es tu turno.`,
        mentions: [sender]
      }, { quoted: msg });
    }

    // ¿La celda está libre?
    const idx = num - 1;
    if (game.board[idx] === 'X' || game.board[idx] === 'O') {
      return sock.sendMessage(remoteJid, {
        text: `❌ Esa celda ya está ocupada. Elige otra.`
      }, { quoted: msg });
    }

    // Aplicar movimiento
    game.board[idx] = mark;

    const mentions = [game.playerX, game.playerO];

    // ¿Hay ganador?
    if (checkWinner(game.board, mark)) {
      const text =
`🏆 *¡${mention(sender)} GANÓ!*

${mention(game.playerX)} ❎  vs  ⭕ ${mention(game.playerO)}

${renderBoard(game.board)}`;
      deleteGame(game.id);
      return sock.sendMessage(remoteJid, { text, mentions }, { quoted: msg });
    }

    // ¿Empate?
    if (isDraw(game.board)) {
      const text =
`🤝 *¡EMPATE!*

${mention(game.playerX)} ❎  vs  ⭕ ${mention(game.playerO)}

${renderBoard(game.board)}`;
      deleteGame(game.id);
      return sock.sendMessage(remoteJid, { text, mentions }, { quoted: msg });
    }

    // Siguiente turno
    game.turn = otherMark;

    return sock.sendMessage(remoteJid, {
      text: boardText(game),
      mentions
    }, { quoted: msg });
  }
};
