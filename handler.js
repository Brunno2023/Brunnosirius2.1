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

const userID = require('./lib/userID');

/* ─────────────────────────────
   💥 GLOBAL ERRORS
───────────────────────────── */
process.on('uncaughtException', err => {
  console.log(chalk.red('💥 Uncaught Exception:'), err?.stack || err);
});

process.on('unhandledRejection', err => {
  console.log(chalk.red('💥 Unhandled Rejection:'), err?.stack || err);
});

/* ─────────────────────────────
   🧠 DEDUP (Map con TTL)
───────────────────────────── */
const processedMessages = new Map();

function isProcessed(id) {
  const now = Date.now();
  const ts = processedMessages.get(id);

  if (ts !== undefined && now - ts < 60_000) return true;

  processedMessages.set(id, now);
  return false;
}

setInterval(() => {
  const cutoff = Date.now() - 60_000;
  for (const [id, ts] of processedMessages) {
    if (ts < cutoff) processedMessages.delete(id);
  }
}, 60_000);

/* ─────────────────────────────
   🔇 HIDE BAILEYS LOGS
───────────────────────────── */
const BLOCKED_TERMS = new Set([
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
]);

function shouldHideConsole(args) {
  const text = args.map(v => {
    try { return typeof v === 'object' ? JSON.stringify(v).slice(0, 2000) : String(v); }
    catch { return String(v); }
  }).join(' ');

  for (const term of BLOCKED_TERMS) {
    if (text.includes(term)) return true;
  }
  return false;
}

const _log   = console.log.bind(console);
const _error = console.error.bind(console);
const _warn  = console.warn.bind(console);

console.log   = (...a) => { if (!shouldHideConsole(a)) _log(...a);   };
console.error = (...a) => { if (!shouldHideConsole(a)) _error(...a); };
console.warn  = (...a) => { if (!shouldHideConsole(a)) _warn(...a);  };

/* ─────────────────────────────
   📂 PLUGINS DIR
───────────────────────────── */
function getPluginsDir() {
  const plugin  = path.join(process.cwd(), 'plugin');
  const plugins = path.join(process.cwd(), 'plugins');

  if (fs.existsSync(plugin))  return plugin;
  if (fs.existsSync(plugins)) return plugins;

  fs.mkdirSync(plugin, { recursive: true });
  return plugin;
}

const PLUGINS_DIR = getPluginsDir();

/* ─────────────────────────────
   📦 PLUGINS
───────────────────────────── */
const plugins        = new Map();
const messagePlugins = [];

function loadPlugins() {
  plugins.clear();
  messagePlugins.length = 0;

  const files = fs.readdirSync(PLUGINS_DIR).filter(f => f.endsWith('.js'));

  for (const file of files) {
    try {
      const filepath = path.join(PLUGINS_DIR, file);
      delete require.cache[require.resolve(filepath)];

      const plugin = require(filepath);
      if (!plugin) { console.log(chalk.yellow(`⚠️ Plugin ignorado ${file}: vacío`)); continue; }

      let registered = false;

      if (typeof plugin.onMessage === 'function') {
        messagePlugins.push({ ...plugin, file });
        registered = true;
      }

      if (typeof plugin.execute === 'function') {
        const cmds = Array.isArray(plugin.commands) ? plugin.commands : [];

        if (!cmds.length) {
          console.log(chalk.yellow(`⚠️ Plugin comando ignorado ${file}: no tiene commands`));
        } else {
          for (const cmd of cmds) {
            plugins.set(String(cmd).toLowerCase(), { ...plugin, file });
          }
          registered = true;
        }
      }

      if (!registered) {
        console.log(chalk.yellow(`⚠️ Plugin ignorado ${file}: falta execute() u onMessage()`));
      }

    } catch (e) {
      console.log(chalk.red(`❌ Plugin error ${file}:`), e?.stack || e);
    }
  }

  console.log(chalk.green(`✔ Plugins cargados: ${plugins.size}`));
}

global.loadPlugins = loadPlugins;
loadPlugins();

/* ♻ HOT RELOAD */
fs.watch(PLUGINS_DIR, () => {
  console.log(chalk.yellow('♻ Recargando plugins...'));
  loadPlugins();
});

/* ─────────────────────────────
   📤 SEND LOGGER
───────────────────────────── */
function attachSendLogger(sock) {
  if (sock._loggerAttached) return;
  sock._loggerAttached = true;

  const originalSend = sock.sendMessage.bind(sock);

  sock.sendMessage = async (jid, content = {}, options = {}) => {
    if (!jid || !content) return;

    try {
      if (config.debug) {
        let type = 'Desconocido', preview = '';

        if      (content.text)     { type = 'Texto';        preview = content.text; }
        else if (content.image)    { type = 'Imagen';       preview = content.caption || '[Imagen]'; }
        else if (content.video)    { type = 'Video';        preview = content.caption || '[Video]'; }
        else if (content.audio)    { type = content.ptt ? 'Nota de voz' : 'Audio'; preview = '[Audio]'; }
        else if (content.sticker)  { type = 'Sticker';      preview = '[Sticker]'; }
        else if (content.document) { type = 'Documento';    preview = content.fileName || '[Documento]'; }

        _log(chalk.green('\n╔════════ BOT ENVÍA ════════'));
        _log(chalk.white('║ 📤 A    :'), chalk.cyan(jid));
        _log(chalk.white('║ 📦 Tipo :'), chalk.yellow(type));
        _log(chalk.white('║ 💬 Msg  :'), chalk.green(String(preview).slice(0, 300)));
        _log(chalk.green('╚═══════════════════════════\n'));
      }

      return await originalSend(jid, content, options);

    } catch (err) {
      console.log(chalk.red('❌ Error enviando mensaje:'), err?.stack || err);
    }
  };
}

/* ─────────────────────────────
   📖 READABLE MESSAGE
───────────────────────────── */
function getReadableMessage(msg) {
  const body = getBody(msg);
  if (body) return body;

  const m = msg.message || {};
  if (m.imageMessage)        return '[Imagen]';
  if (m.videoMessage)        return '[Video]';
  if (m.stickerMessage)      return '[Sticker]';
  if (m.audioMessage)        return m.audioMessage.ptt ? '[Nota de voz]' : '[Audio]';
  if (m.documentMessage)     return '[Documento]';
  if (m.locationMessage)     return '[Ubicación]';
  if (m.contactMessage)      return '[Contacto]';
  if (m.contactsArrayMessage) return '[Contactos]';
  if (m.reactionMessage)     return '[Reacción]';
  return '[Sin texto]';
}

/* ─────────────────────────────
   🛡 GUARDS — fast-path rejections
───────────────────────────── */
function isInvalidMessage(msg) {
  if (!msg || typeof msg !== 'object') return true;
  if (!msg.key || !msg.message)        return true;

  const jid = msg.key.remoteJid;
  if (!jid || typeof jid !== 'string') return true;
  if (jid.length > 100)                return true;
  if (jid === 'status@broadcast')      return true;
  if (msg.key.id?.startsWith('BAE5'))  return true;

  return false;
}

/* ─────────────────────────────
   ⏱ TIMEOUT HELPER
───────────────────────────── */
const PLUGIN_TIMEOUT = global.PLUGIN_TIMEOUT || 300000;

function withTimeout(promise) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Plugin timeout')), PLUGIN_TIMEOUT)
    )
  ]);
}

/* ─────────────────────────────
   👥 SAFE GROUP METADATA
───────────────────────────── */
async function safeGroupMetadata(sock, jid) {
  try { return await sock.groupMetadata(jid); }
  catch { return null; }
}

/* ─────────────────────────────
   🚀 MAIN HANDLER
───────────────────────────── */
async function messageHandler(sock, msg, store = {}) {
  try {
    /* ── 0. Setup ── */
    attachSendLogger(sock);
    if (!sock?.sendMessage) return;

    /* ── 1. Fast-path guards ── */
    if (isInvalidMessage(msg)) return;

    const key       = msg.key;
    const messageId = key.id;
    if (!messageId || isProcessed(messageId)) return;

    const remoteJid = key.remoteJid;
    const fromGroup = remoteJid.endsWith('@g.us');
    const fromMe    = !!key.fromMe;

    /* ── 2. Unwrap ephemeral / view-once ── */
    msg.message =
      msg.message?.ephemeralMessage?.message  ||
      msg.message?.viewOnceMessage?.message   ||
      msg.message?.viewOnceMessageV2?.message ||
      msg.message;

    const body = getBody(msg);

    /* ── 3. Sender resolution ── */
    const rawSender = fromGroup
      ? (key.participantPn || key.participantAlt || key.participant || msg.participant)
      : (key.remoteJidAlt  || remoteJid);

    const sender         = normalizeJid(rawSender || remoteJid);
    const botJid         = normalizeJid(sock.user?.id || '');
    const senderNumber   = userID(sender);
    const remoteNumber   = userID(remoteJid);
    const participantNumber = userID(
      key.participantPn || key.participantAlt || key.participant || msg.participant || ''
    );
    const realNumber = userID(msg.realNumber || '');

    msg.senderNumber = senderNumber;

    /* ── 4. Owner check ── */
    const ownerNumbers = Array.isArray(config.owner)
      ? config.owner.map(v => userID(String(v)))
      : [];

    const isOwner =
      fromMe ||
      ownerNumbers.includes(senderNumber)      ||
      ownerNumbers.includes(remoteNumber)      ||
      ownerNumbers.includes(participantNumber) ||
      ownerNumbers.includes(realNumber);

    /* ── 5. Group data (parallel with nothing to block it) ── */
    let groupMetadata = null;
    let groupAdmins   = [];
    let isAdmin       = false;
    let isBotAdmin    = false;

    if (fromGroup) {
      // Fetch metadata + admins in parallel
      const [meta, admins] = await Promise.allSettled([
        safeGroupMetadata(sock, remoteJid),
        getGroupAdmins(sock, remoteJid).catch(() => [])
      ]);

      groupMetadata = meta.status === 'fulfilled' ? meta.value : null;
      groupAdmins   = admins.status === 'fulfilled' ? admins.value : [];
      isAdmin       = groupAdmins.includes(sender);
      isBotAdmin    = groupAdmins.includes(botJid);
    }

    /* ── 6. Debug logger ── */
    if (config.debug) {
      const pushName =
        msg.pushName || msg.push_name ||
        store.contacts?.[sender]?.name ||
        store.contacts?.[sender]?.notify ||
        'Sin nombre';

      const chatLabel = fromGroup ? chalk.magenta('GRUPO') : chalk.blue('PRIVADO');
      const chatName  = fromGroup ? (groupMetadata?.subject || 'Grupo') : 'Privado';

      _log(chalk.gray('\n╔══════════════════════════════'));
      _log(chalk.white('║ 📍 Tipo   :'), chatLabel);
      _log(chalk.white('║ 🏷️ Chat   :'), chalk.cyan(chatName));
      _log(chalk.white('║ 👤 Nombre :'), chalk.green(pushName));
      _log(chalk.white('║ 📞 Número :'), chalk.yellow(senderNumber ? `+${senderNumber}` : 'Desconocido'));
      _log(chalk.white('║ 👑 Owner  :'), chalk.yellow(isOwner ? 'Sí' : 'No'));
      _log(chalk.white('║ 💬 Msg    :'), chalk.white(String(getReadableMessage(msg)).slice(0, 300)));
      _log(chalk.gray('╚══════════════════════════════\n'));
    }

    /* ── 7. Context object (built once, reused everywhere) ── */
    const ctx = {
      sock,
      msg,
      key,
      sender:        senderNumber,
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
      pushName:      msg.pushName || msg.push_name || 'Usuario',
      reply: (t) => sock.sendMessage(remoteJid, { text: String(t) }, { quoted: msg })
    };

    /* ── 8. onMessage plugins ── */
    for (const plugin of messagePlugins) {
      if (!plugin) continue;
      try {
        await withTimeout(plugin.onMessage(ctx));
      } catch (e) {
        console.log(chalk.red(`❌ Error onMessage ${plugin.file}:`), e?.stack || e);
      }
    }

    /* ── 9. Command routing ── */
    if (!body || typeof body !== 'string') return;

    let parsed;
    try { parsed = detectPrefix(body, config.prefix); }
    catch { return; }
    if (!parsed) return;

    const args    = parsed.body.trim().split(/\s+/).filter(Boolean);
    const command = args.shift()?.toLowerCase();
    if (!command) return;

    const plugin = plugins.get(command);
    if (!plugin || typeof plugin !== 'object') return;

    /* ── 10. Bot-disabled check (skip if owner) ── */
    if (!isOwner) {
      try {
        const ALWAYS_ALLOWED = ['enable', 'menu', 'help'];

        if (fromGroup) {
          const groupData = await db.getGroup(remoteJid);
          if (groupData?.bot === false && !ALWAYS_ALLOWED.includes(command)) return;
        } else {
          const userData = await db.getUser(sender);
          if (userData?.bot === false && !ALWAYS_ALLOWED.includes(command)) return;
        }
      } catch {}

      /* ── 11. Ban check ── */
      let banned = false;
      try { banned = await db.isBanned(senderNumber); } catch {}
      if (banned) {
        return sock.sendMessage(remoteJid, { text: '🚫 Estás baneado del bot' }, { quoted: msg });
      }
    }

    /* ── 12. Execute ── */
    try {
      await withTimeout(
        plugin.execute({ ...ctx, args, command, prefix: parsed.prefix })
      );

      /* XP — fire-and-forget, never blocks the handler */
      db.addXP(senderNumber, Math.floor(Math.random() * 16) + 5)
        .catch(e => console.log(chalk.yellow('⚠️ No se pudo guardar XP:'), e?.message || e));

    } catch (e) {
      console.log(chalk.red(`❌ Error comando ${command}:`), e?.stack || e);

      try {
        await sock.sendMessage(remoteJid, { text: '❌ Ocurrió un error al ejecutar el comando.' }, { quoted: msg });
      } catch {}
    }

  } catch (err) {
    console.log(chalk.red('💥 Handler general error:'), err?.stack || err);
  }
}

module.exports = { messageHandler };
