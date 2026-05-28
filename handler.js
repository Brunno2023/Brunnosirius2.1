'use strict';

const chalk = require('chalk');
const config = require('./config');
const db = require('./lib/database');

const {
  getBody,
  detectPrefix,
  getGroupAdmins
} = require('./lib/utils');

/* ─────────────────────────────
   👤 NORMALIZADOR ÚNICO (CRÍTICO)
───────────────────────────── */
const normalize = (jid = '') =>
  String(jid)
    .split('@')[0]
    .split(':')[0]
    .replace(/\D/g, '');

/* ─────────────────────────────
   👑 ROLE SYSTEM SIMPLE
───────────────────────────── */
function getRole(sender, groupAdmins = [], botJid = '') {
  const id = normalize(sender);

  const owners = (config.owner || []).map(normalize);
  const admins = groupAdmins.map(normalize);

  if (owners.includes(id)) return 'owner';
  if (admins.includes(id)) return 'admin';

  return 'user';
}

/* ─────────────────────────────
   MAIN HANDLER
───────────────────────────── */
async function messageHandler(sock, msg, store = {}) {
  try {
    if (!msg?.message) return;

    const key = msg.key || {};
    const remoteJid = key.remoteJid;
    if (!remoteJid || remoteJid === 'status@broadcast') return;

    const fromGroup = remoteJid.endsWith('@g.us');

    /* ─────────────────────────────
       👤 SENDER UNIFICADO
    ───────────────────────────── */
    let sender = fromGroup
      ? key.participant || remoteJid
      : key.remoteJid;

    sender = normalize(sender);

    const botJid = normalize(sock.user?.id || '');
    const body = getBody(msg);

    /* ─────────────────────────────
       👥 GRUPO ADMINS
    ───────────────────────────── */
    let groupAdmins = [];
    if (fromGroup) {
      try {
        groupAdmins = await getGroupAdmins(sock, remoteJid);
      } catch {}
    }

    const role = getRole(sender, groupAdmins, botJid);

    const isOwner = role === 'owner';
    const isAdmin = role === 'admin';

    /* ─────────────────────────────
       📦 DEBUG
    ───────────────────────────── */
    if (config.debug) {
      console.log(chalk.gray('\n── DEBUG ROLE ──'));
      console.log({
        sender,
        role,
        owners: config.owner
      });
    }

    /* ─────────────────────────────
       🧩 ONMESSAGE (COMPATIBLE)
    ───────────────────────────── */
    if (global.messagePlugins?.length) {
      for (const plugin of global.messagePlugins) {
        try {
          await plugin.onMessage?.({
            sock,
            msg,
            sender,
            remoteJid,
            body,
            isOwner,
            isAdmin,
            role,
            reply: (t) =>
              sock.sendMessage(remoteJid, { text: String(t) }, { quoted: msg })
          });
        } catch (e) {
          console.log(chalk.red('❌ onMessage error:'), e.message);
        }
      }
    }

    if (!body) return;

    /* ─────────────────────────────
       ⚡ COMMAND PARSER
    ───────────────────────────── */
    const parsed = detectPrefix(body, config.prefix);
    if (!parsed) return;

    const args = parsed.body.trim().split(/\s+/);
    const command = args.shift()?.toLowerCase();

    if (!command) return;

    const plugin = global.plugins?.get(command);
    if (!plugin) return;

    /* ─────────────────────────────
       🚫 BAN CHECK (OWNER BYPASS)
    ───────────────────────────── */
    if (!isOwner) {
      const banned = await db.isBanned(sender);
      if (banned) {
        return sock.sendMessage(remoteJid, {
          text: '🚫 Estás baneado del bot'
        }, { quoted: msg });
      }
    }

    /* ─────────────────────────────
       ⚡ EXECUTE PLUGIN (COMPATIBLE)
    ───────────────────────────── */
    await plugin.execute?.({
      sock,
      msg,
      key,
      remoteJid,
      sender,
      body,
      args,
      command,
      role,
      isOwner,
      isAdmin,
      store,
      config,
      db,
      reply: (t) =>
        sock.sendMessage(remoteJid, { text: String(t) }, { quoted: msg })
    });

    if (config.debug) {
      console.log(chalk.green(`✔ ${command} ejecutado | role: ${role}`));
    }

  } catch (err) {
    console.log(chalk.red('❌ Handler error:'), err.message);
  }
}

module.exports = {
  messageHandler
};
