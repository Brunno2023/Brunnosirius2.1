'use strict';

const path = require('path');
const fs = require('fs');
const chalk = require('chalk');

const config = require('./config');
const db = require('./lib/database');

const {
  getBody,
  normalizeJid,
  detectPrefix,
  getGroupAdmins
} = require('./lib/utils');

/* ─────────────────────────────
   💥 GLOBAL ERRORS
───────────────────────────── */
process.on('uncaughtException', err => {

  console.log(
    chalk.red('💥 Uncaught Exception:'),
    err?.stack || err
  );
});

process.on('unhandledRejection', err => {

  console.log(
    chalk.red('💥 Unhandled Rejection:'),
    err?.stack || err
  );
});

/* ─────────────────────────────
   🧠 MEMORY
───────────────────────────── */
const processedMessages = new Set();

setInterval(() => {

  processedMessages.clear();

}, 60 * 1000);

let lastErrorTime = 0;

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
   📂 PLUGIN DIR
───────────────────────────── */
function getPluginsDir() {

  const plugin =
    path.join(
      process.cwd(),
      'plugin'
    );

  const plugins =
    path.join(
      process.cwd(),
      'plugins'
    );

  if (
    fs.existsSync(plugin)
  ) return plugin;

  if (
    fs.existsSync(plugins)
  ) return plugins;

  fs.mkdirSync(plugin, {
    recursive: true
  });

  return plugin;
}

const PLUGINS_DIR =
  getPluginsDir();

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

        return JSON.stringify(v)
          .slice(0, 2000);
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

    if (!jid) return;
    if (!content) return;

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

      if (
        Date.now() - lastErrorTime >
        3000
      ) {

        lastErrorTime =
          Date.now();

        console.log(
          chalk.red(
            '❌ Error enviando mensaje:'
          ),
          err?.stack || err
        );
      }
    }
  };
}

/* ─────────────────────────────
   📦 PLUGINS
───────────────────────────── */
const plugins = new Map();
const messagePlugins = [];

function loadPlugins() {

  const dir = PLUGINS_DIR;

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

      const plugin =
        require(filepath);

      if (!plugin) {

        console.log(
          chalk.yellow(
            `⚠️ Plugin ignorado ${file}: vacío`
          )
        );

        continue;
      }

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
          Array.isArray(
            plugin.commands
          )
            ? plugin.commands
            : [];

        if (!cmds.length) {

          console.log(
            chalk.yellow(
              `⚠️ Plugin comando ignorado ${file}: no tiene commands`
            )
          );

        } else {

          for (const cmd of cmds) {

            plugins.set(
              String(cmd)
                .toLowerCase(),
              {
                ...plugin,
                file
              }
            );
          }
        }
      }

      if (
        typeof plugin.execute !==
          'function' &&
        typeof plugin.onMessage !==
          'function'
      ) {

        console.log(
          chalk.yellow(
            `⚠️ Plugin ignorado ${file}: falta execute() u onMessage()`
          )
        );
      }

    } catch (e) {

      if (
        Date.now() - lastErrorTime >
        3000
      ) {

        lastErrorTime =
          Date.now();

        console.log(
          chalk.red(
            `❌ Plugin error ${file}:`
          ),
          e?.stack || e
        );
      }
    }
  }

  console.log(
    chalk.green(
      `✔ Plugins cargados: ${plugins.size}`
    )
  );
}

global.loadPlugins =
  loadPlugins;

loadPlugins();

/* ─────────────────────────────
   ♻ HOT RELOAD
───────────────────────────── */
fs.watch(
  PLUGINS_DIR,
  () => {

    console.log(
      chalk.yellow(
        '♻ Recargando plugins...'
      )
    );

    loadPlugins();
  }
);

/* ─────────────────────────────
   📖 READABLE MESSAGE
───────────────────────────── */
function getReadableMessage(
  msg
) {

  const body =
    getBody(msg);

  if (body) return body;

  const m =
    msg.message || {};

  if (m.imageMessage)
    return '[Imagen]';

  if (m.videoMessage)
    return '[Video]';

  if (m.stickerMessage)
    return '[Sticker]';

  if (m.audioMessage)
    return m.audioMessage.ptt
      ? '[Nota de voz]'
      : '[Audio]';

  if (m.documentMessage)
    return '[Documento]';

  if (m.locationMessage)
    return '[Ubicación]';

  if (m.contactMessage)
    return '[Contacto]';

  if (m.contactsArrayMessage)
    return '[Contactos]';

  if (m.reactionMessage)
    return '[Reacción]';

  return '[Sin texto]';
}

/* ─────────────────────────────
   👥 SAFE GROUP METADATA
───────────────────────────── */
async function safeGroupMetadata(
  sock,
  jid
) {

  try {

    return await sock.groupMetadata(
      jid
    );

  } catch {

    return null;
  }
}

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

    if (!sock?.sendMessage)
      return;

    if (!msg) return;

    if (
      typeof msg !== 'object'
    ) return;

    if (!msg.key)
      return;

    if (!msg?.message)
      return;

    if (
      msg.key?.remoteJid ===
      'status@broadcast'
    ) return;

    if (
      msg.key?.id?.startsWith(
        'BAE5'
      )
    ) return;

    const key =
      msg.key || {};

    const messageId =
      key.id;

    if (
      processedMessages.has(
        messageId
      )
    ) {

      return;
    }

    processedMessages.add(
      messageId
    );

    const remoteJid =
      key.remoteJid;

    if (!remoteJid)
      return;

    if (
      typeof remoteJid !==
      'string'
    ) return;

    if (
      remoteJid.length > 100
    ) return;

    if (
      remoteJid ===
      'status@broadcast'
    ) return;

    const fromGroup =
      remoteJid.endsWith(
        '@g.us'
      );

    const fromMe =
      !!key.fromMe;

    /* ─────────────────────────────
       👤 SENDER
    ───────────────────────────── */

    let sender =
      fromGroup
        ? (
            key.participantPn ||
            key.participantAlt ||
            key.participant ||
            msg.participant
          )
        : (
            key.remoteJidAlt ||
            remoteJid
          );

    sender =
      normalizeJid(
        sender || remoteJid
      );

    const botJid =
      normalizeJid(
        sock.user?.id || ''
      );

    /* ─────────────────────────────
       📦 REAL MESSAGE
    ───────────────────────────── */

    const realMessage =
      msg.message
        ?.ephemeralMessage
        ?.message ||

      msg.message
        ?.viewOnceMessage
        ?.message ||

      msg.message
        ?.viewOnceMessageV2
        ?.message ||

      msg.message;

    msg.message =
      realMessage;

    const body =
      getBody(msg);

    /* ─────────────────────────────
       👑 OWNER FIX
    ───────────────────────────── */

    const ownerNumbers =
      Array.isArray(
        config.owner
      )
        ? config.owner.map(v =>
            String(v)
              .replace(/\D/g, '')
          )
        : [];

    const senderNumber =
      normalize(sender);
    msg.senderNumber = senderNumber;

    const remoteNumber =
      normalize(remoteJid);

    const participantNumber =
      normalize(
        key.participant || ''
      );

    const realNumber =
      normalize(
        msg.realNumber || ''
      );

    const isOwner =

      fromMe ||

      ownerNumbers.includes(
        senderNumber
      ) ||

      ownerNumbers.includes(
        remoteNumber
      ) ||

      ownerNumbers.includes(
        participantNumber
      ) ||

      ownerNumbers.includes(
        realNumber
      );

    /* ─────────────────────────────
       👥 GROUP DATA
    ───────────────────────────── */

    let groupMetadata =
      null;

    let groupAdmins = [];

    let isAdmin = false;

    let isBotAdmin =
      false;

    if (fromGroup) {

      groupMetadata =
        await safeGroupMetadata(
          sock,
          remoteJid
        );

      try {

        groupAdmins =
          await getGroupAdmins(
            sock,
            remoteJid
          );

        isAdmin =
          groupAdmins.includes(
            sender
          );

        isBotAdmin =
          groupAdmins.includes(
            botJid
          );

      } catch {}
    }

    /* ─────────────────────────────
       📥 MESSAGE LOGGER
    ───────────────────────────── */

    if (config.debug) {

      const pushName =
        msg.pushName ||
        msg.push_name ||

        store.contacts?.[
          sender
        ]?.name ||

        store.contacts?.[
          sender
        ]?.notify ||

        'Sin nombre';

      const number =
        normalize(sender);

      const chatName =
        fromGroup
          ? (
              groupMetadata
                ?.subject ||
              'Grupo'
            )
          : 'Privado';

      const chatLabel =
        fromGroup
          ? chalk.magenta(
              'GRUPO'
            )
          : chalk.blue(
              'PRIVADO'
            );

      let displayMsg =
        getReadableMessage(
          msg
        );

      console.log(
        chalk.gray(
          '\n╔══════════════════════════════'
        )
      );

      console.log(
        chalk.white(
          '║ 📍 Tipo   :'
        ),
        chatLabel
      );

      console.log(
        chalk.white(
          '║ 🏷️ Chat   :'
        ),
        chalk.cyan(
          chatName
        )
      );

      console.log(
        chalk.white(
          '║ 👤 Nombre :'
        ),
        chalk.green(
          pushName
        )
      );

      console.log(
        chalk.white(
          '║ 📞 Número :'
        ),
        chalk.yellow(

          number
            ? `+${number}`
            : 'Desconocido'
        )
      );

      console.log(
        chalk.white(
          '║ 👑 Owner  :'
        ),
        chalk.yellow(
          isOwner
            ? 'Sí'
            : 'No'
        )
      );

      console.log(
        chalk.white(
          '║ 💬 Msg    :'
        ),
        chalk.white(
          String(displayMsg)
            .slice(0, 300)
        )
      );

      console.log(
        chalk.gray(
          '╚══════════════════════════════\n'
        )
      );
    }

    /* ─────────────────────────────
       🧩 ON MESSAGE
    ───────────────────────────── */

    for (const plugin of messagePlugins) {

      if (!plugin)
        continue;

      try {

        await Promise.race([

          plugin.onMessage?.({

            sock,
            msg,
            key,

            sender:
              senderNumber,

            remoteJid,

            body,

            fromGroup,

            db,

            isAdmin,

            isOwner,

            isBotAdmin,

            botJid,

            store,

            config,

            groupMetadata,

            groupAdmins,

            fromMe,

            pushName:
              msg.pushName ||

              msg.push_name ||

              'Usuario',

            reply: (t) =>
              sock.sendMessage(
                remoteJid,
                {
                  text:
                    String(t)
                },
                {
                  quoted: msg
                }
              )
          }),

          new Promise(
            (_, reject) =>

              setTimeout(
                () =>

                  reject(
                    new Error(
                      'Plugin timeout'
                    )
                  ),

                30000
              )
          )
        ]);

      } catch (e) {

        if (
          Date.now() -
            lastErrorTime >
          3000
        ) {

          lastErrorTime =
            Date.now();

          console.log(
            chalk.red(
              `❌ Error onMessage ${plugin.file}:`
            ),
            e?.stack || e
          );
        }
      }
    }

    if (!body) return;

    /* ─────────────────────────────
       ⚡ PREFIX
    ───────────────────────────── */

    let parsed;

    try {

      parsed =
        detectPrefix(
          body,
          config.prefix
        );

    } catch {

      return;
    }

    if (!parsed)
      return;

    const args =
      parsed.body
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    const command =
      args.shift()
        ?.toLowerCase();

    if (!command)
      return;

    const plugin =
      plugins.get(command);

    if (
      !plugin ||
      typeof plugin !==
        'object'
    ) return;

    /* ─────────────────────────────
       🚫 BOT DISABLED
    ───────────────────────────── */

    if (!isOwner) {

      try {

        if (fromGroup) {

          const groupData =
            await db.getGroup(
              remoteJid
            );

          if (
            groupData?.bot ===
              false &&

            ![
              'enable',
              'menu',
              'help'
            ].includes(command)
          ) {

            return;
          }

        } else {

          const userData =
            await db.getUser(
              sender
            );

          if (
            userData?.bot ===
              false &&

            ![
              'enable',
              'menu',
              'help'
            ].includes(command)
          ) {

            return;
          }
        }

      } catch {}
    }

    /* ─────────────────────────────
       🚫 BAN CHECK
    ───────────────────────────── */

    if (!isOwner) {

      let banned = false;

      try {

        banned =
          await db.isBanned(
            senderNumber
          );

      } catch {}

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

      await Promise.race([

  plugin.execute?.({

    sock,
    msg,
    key,

    sender:
      senderNumber,

    remoteJid,

    body,

    args,

    command,

    fromGroup,

    db,

    config,

    store,

    isAdmin,

    isOwner,

    isBotAdmin,

    botJid,

    groupMetadata,

    groupAdmins,

    fromMe,

    pushName:
      msg.pushName ||

      msg.push_name ||

      'Usuario',

    prefix:
      parsed.prefix,

    reply: (t) =>
      sock.sendMessage(
        remoteJid,
        {
          text:
            String(t)
        },
        {
          quoted: msg
        }
      )
  }),

        new Promise(
          (_, reject) =>

            setTimeout(
              () =>

                reject(
                  new Error(
                    'Plugin timeout'
                  )
                ),

              30000
            )
        )
      ]);

      try {

  const xp =
    Math.floor(
      Math.random() * 16
    ) + 5;

  await db.addXP(
    senderNumber,
    xp
  );

} catch (e) {

  console.log(
    chalk.yellow(
      '⚠️ No se pudo guardar XP:'
    ),
    e?.message || e
  );
}
    } catch (e) {

      if (
        Date.now() -
          lastErrorTime >
        3000
      ) {

        lastErrorTime =
          Date.now();

        console.log(
          chalk.red(
            `❌ Error comando ${command}:`
          ),
          e?.stack || e
        );
      }

      try {

        await sock.sendMessage(
          remoteJid,
          {
            text:
              '❌ Ocurrió un error ejecutando este comando.'
          },
          {
            quoted: msg
          }
        );

      } catch {}
    }

  } catch (err) {

    if (
      Date.now() -
        lastErrorTime >
      3000
    ) {

      lastErrorTime =
        Date.now();

      console.log(
        chalk.red(
          '❌ Handler error:'
          ),
        err?.stack || err
      );
    }
  }
}

module.exports = {
  messageHandler,
  loadPlugins,
  plugins,
  messagePlugins
};
       
