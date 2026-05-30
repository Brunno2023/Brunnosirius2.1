'use strict';
const userID = require('./userID');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const DB_PATH = path.resolve(
  process.cwd(),
  config.dbPath || './lib/database.json'
);

const DEFAULT_DB = {
  users: {},
  groups: {}
};

let dbCache = null;
let saveTimer = null;

/* ───────────────────────────── */

function cloneDefaultDB() {
  return {
    users: {},
    groups: {}
  };
}

function ensureDir() {
  const dir = path.dirname(DB_PATH);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function ensureDB() {
  ensureDir();

  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2));
  }
}

function loadDB() {
  if (dbCache) return dbCache;

  try {
    ensureDB();

    const raw = fs.readFileSync(DB_PATH, 'utf8');
    const parsed = JSON.parse(raw || '{}');

    dbCache = {
      users: parsed.users || {},
      groups: parsed.groups || {}
    };

    return dbCache;
  } catch {
    dbCache = cloneDefaultDB();
    saveDBNow();
    return dbCache;
  }
}

function saveDBNow() {
  ensureDir();

  const tmpPath = DB_PATH + '.tmp';

  fs.writeFileSync(
    tmpPath,
    JSON.stringify(dbCache || DEFAULT_DB, null, 2)
  );

  fs.renameSync(tmpPath, DB_PATH);
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);

  saveTimer = setTimeout(() => {
    try {
      saveDBNow();
    } catch (e) {
      console.log('❌ Error guardando database:', e?.message || e);
    }
  }, 300);
}

function saveDB() {
  scheduleSave();
}

async function init() {
  ensureDB();
  loadDB();
  console.log('📁 Database JSON cargada');
}

/* ───────────────────────────── */
/* DEFAULTS */
/* ───────────────────────────── */

function defaultUser() {
  return {
    banned: false,
    bot: true,
    audios: true,
    premium: false,
    premiumUntil: 0,

    xp: 0,
    level: 1,

    lastDailyXp: 0,
    lastRobXp: 0,

    notifyCount: 0,
    notifyDate: ''
  };
}

function defaultGroup() {
  return {
    welcome: false,
    bot: true,
    audios: true,
    antilink: false,
    antispam: false,
    isBanned: false,
    antidelete: false
  };
}

/* ───────────────────────────── */
/* USERS */
/* ───────────────────────────── */

async function getUser(id) {
  id = userID(id); // ✅ FIX

  if (!id) return defaultUser();

  const db = loadDB();

  if (!db.users[id]) {
    db.users[id] = defaultUser();
    saveDB();
  } else {
    db.users[id] = {
      ...defaultUser(),
      ...db.users[id]
    };
  }

  return db.users[id];
}

async function setUser(id, data = {}) {
  id = userID(id); // ✅ FIX

  if (!id) return null;

  const db = loadDB();

  db.users[id] = {
    ...(await getUser(id)),
    ...data
  };

  saveDB();

  return db.users[id];
}

async function getUserSetting(userId, key) {
  userId = userID(userId); // ✅ FIX

  const user = await getUser(userId);
  return user[key];
}

async function setUserSetting(userId, key, value) {
  userId = userID(userId); // ✅ FIX

  const user = await getUser(userId);
  user[key] = value;

  return await setUser(userId, user);
}

/* ───────────────────────────── */
/* GROUPS (NO TOCAR ID AQUÍ) */
/* ───────────────────────────── */

async function getGroup(id) {
  if (!id) return defaultGroup();

  const db = loadDB();

  if (!db.groups[id]) {
    db.groups[id] = defaultGroup();
    saveDB();
  } else {
    db.groups[id] = {
      ...defaultGroup(),
      ...db.groups[id]
    };
  }

  return db.groups[id];
}

async function setGroup(id, data = {}) {
  if (!id) return null;

  const db = loadDB();

  db.groups[id] = {
    ...(await getGroup(id)),
    ...data
  };

  saveDB();

  return db.groups[id];
}

async function getGroupSetting(groupId, key) {
  const group = await getGroup(groupId);
  return group[key];
}

async function setGroupSetting(groupId, key, value) {
  const group = await getGroup(groupId);
  group[key] = value;

  return await setGroup(groupId, group);
}

/* ───────────────────────────── */
/* BAN SYSTEM */
/* ───────────────────────────── */

async function isBanned(id) {
  id = userID(id); // ✅ FIX

  const user = await getUser(id);
  return user.banned === true;
}

async function banUser(id) {
  id = userID(id); // ✅ FIX

  return await setUser(id, { banned: true });
}

async function unbanUser(id) {
  id = userID(id); // ✅ FIX

  return await setUser(id, { banned: false });
}

/* ───────────────────────────── */
/* XP SYSTEM */
/* ───────────────────────────── */

function calculateLevel(xp = 0) {
  return Math.floor(Number(xp || 0) / 1000) + 1;
}

async function addXP(id, amount = 0) {
  id = userID(id); // ✅ FIX

  const user = await getUser(id);

  const value = Math.max(0, Number(amount) || 0);

  user.xp = Math.max(0, Number(user.xp || 0) + value);
  user.level = calculateLevel(user.xp);

  return await setUser(id, user);
}

async function removeXP(id, amount = 0) {
  id = userID(id); // ✅ FIX

  const user = await getUser(id);

  const value = Math.max(0, Number(amount) || 0);

  user.xp = Math.max(0, Number(user.xp || 0) - value);
  user.level = calculateLevel(user.xp);

  return await setUser(id, user);
}

async function transferXP(from, to, amount = 0) {
  from = userID(from); // ✅ FIX
  to = userID(to);     // ✅ FIX

  const value = Math.max(0, Number(amount) || 0);

  if (!from || !to || value <= 0) return false;

  const sender = await getUser(from);

  if ((sender.xp || 0) < value) return false;

  await removeXP(from, value);
  await addXP(to, value);

  return true;
}

/* ───────────────────────────── */
/* PREMIUM */
/* ───────────────────────────── */

async function addPremium(id, days = 1) {
  id = userID(id); // ✅ FIX

  const user = await getUser(id);
  const now = Date.now();

  const current =
    user.premiumUntil && user.premiumUntil > now
      ? user.premiumUntil
      : now;

  user.premium = true;
  user.premiumUntil = current + Number(days) * 24 * 60 * 60 * 1000;

  return await setUser(id, user);
}

async function removePremium(id) {
  id = userID(id); // ✅ FIX

  return await setUser(id, {
    premium: false,
    premiumUntil: 0
  });
}

async function getPremiumTime(id) {
  id = userID(id); // ✅ FIX

  const user = await getUser(id);
  const left = Number(user.premiumUntil || 0) - Date.now();

  if (left <= 0) {
    if (user.premium || user.premiumUntil) {
      await removePremium(id);
    }
    return 0;
  }

  return left;
}

async function isPremium(id) {
  id = userID(id); // ✅ FIX

  const time = await getPremiumTime(id);
  return time > 0;
}

/* ───────────────────────────── */
/* EXPORT */
/* ───────────────────────────── */

module.exports = {
  init,

  getUser,
  setUser,
  getUserSetting,
  setUserSetting,

  getGroup,
  setGroup,
  getGroupSetting,
  setGroupSetting,

  isBanned,
  banUser,
  unbanUser,

  addXP,
  removeXP,
  transferXP,
  calculateLevel,

  addPremium,
  removePremium,
  getPremiumTime,
  isPremium
};
