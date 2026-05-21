'use strict';

const db = require('./database');

module.exports = async function isBanned(remoteJid) {
  const groupData = await db.getGroup(remoteJid);

  return groupData?.isBanned === true;
};
