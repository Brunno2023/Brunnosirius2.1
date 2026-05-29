'use strict';

const path = require('path');
const fs = require('fs');
const chalk = require('chalk');

const config = require('./config');
const db = require('./lib/database');

const {
  getBody,
  detectPrefix
} = require('./lib/utils');

/* ─────────────────────────────
   👤 NORMALIZE
───────────────────────────── */
function normalize(jid = '') {

  return String(jid)
    .replace(/@lid/g, '')
    .replace(/@s\.whatsapp\.net/g, '')
    .replace(/@g\.us/g, '')
    .split(':')[0]
    .replace(/\D/g, '');
}

/* ─────────────────────────────
   🔇 HIDE BAILEYS LOGS
───────────────────────────── */
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

function shouldHideConsole(args = []) {

  const text = args.map(v => {

    try {

      if (typeof v === 'object') {
        return JSON.stringify(v);
      }

      return String(v);

    } catch {

      return String(v);
    }

  }).join(' ');

  const blocked = [

    'Closing session',
    'Closing stale open session',
    'SessionEntry',
    '_chains',
    'Removing old closed session',
    'chainKey',
    'ephemeralKeyPair',
    'rootKey',
    'indexInfo',
    'registrationId',
    'currentRatchet',
    'pendingPreKey',
    'messageKeys',
    'remoteIdentityKey'
  ];

  return blocked.some(
    word => text.includes(word)
  );
}

console.log = (...args) => {

  if (shouldHideConsole(args)) {
    return;
  }

  originalConsoleLog(...args);
};

console.error = (...args) => {

  if (shouldHideConsole(args)) {
    return;
  }

  originalConsoleError(...args);
};

console.warn = (...args) => {

  if (shouldHideConsole(args)) {
    return;
  }

  originalConsoleWarn(...args);
};

/* ─────────────────────────────
   📤 SEND LOGGER
───────────────────────────── */
function attachSendLogger(sock) {

  if (sock._loggerAttached) {
    return;
  }

  sock._loggerAttached = true;

  const originalSend =
    sock.sendMessage.bind(sock);

  sock.sendMessage = async (
    jid,
    content = {},
    options = {}
  ) => {

    try {

      if (config.debug) {

        let type = 'Desconocido';
        let preview = '';

        if (content.text) {

          type = 'Texto';
          preview = content.text;

        } else if (content.image) {

          type = 'Imagen';
          preview =
            content.caption ||
            '[Imagen]';

        } else if (content.video) {

          type = 'Video';
          preview =
            content.caption ||
            '[Video]';

        } else if (content.audio) {

          type =
            content.ptt
              ? 'Nota de voz'
              : 'Audio';

          preview = '[Audio]';

        } else if (content.sticker) {

          type = 'Sticker';
          preview = '[Sticker]';

        } else if (content.document) {

          type = 'Documento';

          preview =
            content.fileName ||
            '[Documento]';
        }

        console.log(
          chalk.green(
            '\n╔════════ BOT ENVÍA ════════'
          )
        );

        console.log(
          chalk.white('║ 📤 A    :'),
          chalk.cyan(jid)
        );

        console.log(
          chalk.white('║ 📦 Tipo :'),
          chalk.yellow(type)
        );

        console.log(
          chalk.white('║ 💬 Msg  :'),
          chalk.green(
            String(preview).slice(0, 300)
          )
        );

        console.log(
          chalk.green(
            '╚═══════════════════════════\n'
          )
        );
      }

      return await originalSend(
        jid,
        content,
        options
      );

    } catch (err) {

      console.log(
        chalk.red(
          '❌ Error enviando mensaje:'
        ),
        err?.stack || err
      );
    }
  };
}

/* ─────────────────────────────
   📦 PLUGINS
───────────────────────────── */
const plugins = new Map();
const messagePlugins = [];

function loadPlugins() {

  const dir = path.join(
    process.cwd(),
    'plugins'
  );

  const files = fs
    .readdirSync(dir)
    .filter(f => f.endsWith('.js'));

  plugins.clear();
  messagePlugins.length = 0;

  for (const file of files) {

    try {

      const filepath = path.join(
        dir,
        file
      );

      delete require.cache[
        require.resolve(filepath)
      ];

      const plugin = require(filepath);

      /* onMessage */
      if (
        typeof plugin.onMessage ===
        'function'
      ) {

        messagePlugins.push({
          ...plugin,
          file
        });
      }

      /* execute */
      if (
        typeof plugin.execute ===
        'function'
      ) {

        const cmds =
          plugin.commands || [];

        for (const cmd of cmds) {

          plugins.set(
            cmd.toLowerCase(),
            {
              ...plugin,
              file
            }
          );
        }
      }

    } catch (e) {

      console.log(
        chalk.red(
          `❌ Plugin error ${file}:`
        ),
        e?.stack || e
      );
    }
  }

  console.log(
    chalk.green(
      `✔ Plugins cargados: ${plugins.size}`
    )
  );
}

global.loadPlugins = loadPlugins;

loadPlugins();

/* ─────────────────────────────
   🚀 MAIN HANDLER
───────────────────────────── */
async function messageHandler(
  sock,
  msg,
  store = {}
) {

  try {

    attachSendLogger(sock);

    if (!msg?.message) return;

    const key =
      msg.key || {};

    const remoteJid =
      key.remoteJid;

    if (
      !remoteJid ||
      remoteJid ===
      'status@broadcast'
    ) return;

    const fromGroup =
      remoteJid.endsWith('@g.us');

    /* ─────────────────────────────
       👤 SENDER
    ───────────────────────────── */

    let sender;

    if (fromGroup) {

      sender =
        key.participantPn ||
        key.participantAlt ||
        key.participant ||
        msg.participant ||
        remoteJid;

    } else {

      sender =
        key.remoteJidAlt ||
        key.remoteJid;
    }

const body =
  getBody(msg);

/* ─────────────────────────────
   📥 MESSAGE LOGGER
───────────────────────────── */

if (config.debug) {

  const pushName =
    msg.pushName ||
    msg.push_name ||
    'Sin nombre';

  const number =
    normalize(sender);

  const isOwner =
    (config.owner || [])
    .map(normalize)
    .includes(number);

  const chatName =
    fromGroup
      ? 'Grupo'
      : 'Privado';

  const chatLabel =
    fromGroup
      ? chalk.magenta('GRUPO')
      : chalk.blue('PRIVADO');

  let displayMsg =
    body || '[Sin texto]';

  const m = msg.message || {};

  if (!body) {

    if (m.imageMessage) {

      displayMsg =
        m.imageMessage.caption ||
        '[Imagen]';

    } else if (m.videoMessage) {

      displayMsg =
        m.videoMessage.caption ||
        '[Video]';

    } else if (m.audioMessage) {

      displayMsg =
        m.audioMessage.ptt
          ? '[Nota de voz]'
          : '[Audio]';

    } else if (m.stickerMessage) {

      displayMsg = '[Sticker]';

    } else if (m.documentMessage) {

      displayMsg = '[Documento]';
    }
  }

  console.log(
    chalk.gray(
      '\n╔══════════════════════════════'
    )
  );

  console.log(
    chalk.white('║ 📍 Tipo   :'),
    chatLabel
  );

  console.log(
    chalk.white('║ 🏷️ Chat   :'),
    chalk.cyan(chatName)
  );

  console.log(
    chalk.white('║ 👤 Nombre :'),
    chalk.green(pushName)
  );

  console.log(
    chalk.white('║ 📞 Número :'),
    chalk.yellow(
      number
        ? `+${number}`
        : 'Desconocido'
    )
  );

  console.log(
    chalk.white('║ 👑 Owner  :'),
    chalk.yellow(
      isOwner
        ? 'Sí'
        : 'No'
    )
  );

  console.log(
    chalk.white('║ 💬 Msg    :'),
    chalk.white(
      String(displayMsg).slice(0, 300)
    )
  );

  console.log(
    chalk.gray(
      '╚══════════════════════════════\n'
    )
  );
}

/* ─────────────────────────────
   👑 OWNER FIX
───────────────────────────── */

const senderNumber =
  normalize(sender);
    const senderNumber =
      normalize(sender);

    const ownerNumbers =
      (config.owner || [])
      .map(normalize);

    const botNumber =
      normalize(sock.user?.id);

    const isOwner =

      key.fromMe ||

      ownerNumbers.includes(
        senderNumber
      ) ||

      senderNumber === botNumber;

    /* ─────────────────────────────
       🧩 ON MESSAGE
    ───────────────────────────── */

    for (const plugin of messagePlugins) {

      try {

        await plugin.onMessage?.({

          sock,
          msg,

          sender:
            senderNumber,

          remoteJid,

          body,

          fromGroup,

          db,

          isAdmin: false,

          isOwner,

          pushName:
            msg.pushName ||
            msg.push_name ||
            'Usuario',

          reply: (t) =>
            sock.sendMessage(
              remoteJid,
              {
                text: String(t)
              },
              {
                quoted: msg
              }
            )
        });

      } catch (e) {

        console.log(
          chalk.red(
            `❌ Error onMessage ${plugin.file}:`
          ),
          e?.stack || e
        );
      }
    }

    if (!body) return;

    /* ─────────────────────────────
       ⚡ PREFIX
    ───────────────────────────── */

    const parsed =
      detectPrefix(
        body,
        config.prefix
      );

    if (!parsed) return;

    const args =
      parsed.body
      .trim()
      .split(/\s+/);

    const command =
      args.shift()
      ?.toLowerCase();

    const plugin =
      plugins.get(command);

    if (!plugin) return;

    /* ─────────────────────────────
       🚫 BAN CHECK
    ───────────────────────────── */

    if (!isOwner) {

      const banned =
        await db.isBanned(
          senderNumber
        );

      if (banned) {

        return sock.sendMessage(
          remoteJid,
          {
            text:
              '🚫 Estás baneado del bot'
          },
          {
            quoted: msg
          }
        );
      }
    }

    /* ─────────────────────────────
       🚀 EXECUTE
    ───────────────────────────── */

    try {

      await plugin.execute?.({

        sock,
        msg,

        sender:
          senderNumber,

        remoteJid,

        body,

        args,

        command,

        fromGroup,

        db,

        isAdmin: false,

        isOwner,

        pushName:
          msg.pushName ||
          msg.push_name ||
          'Usuario',

        reply: (t) =>
          sock.sendMessage(
            remoteJid,
            {
              text: String(t)
            },
            {
              quoted: msg
            }
          )
      });

    } catch (e) {

      console.log(
        chalk.red(
          `❌ Error comando ${command}:`
        ),
        e?.stack || e
      );
    }

  } catch (err) {

    console.log(
      chalk.red(
        '❌ Handler error:'
      ),
      err?.stack || err
    );
  }
}

module.exports = {
  messageHandler,
  loadPlugins,
  plugins,
  messagePlugins
};
