'use strict';

function userID(jid = '') {
  return String(jid)
    .replace(/@s\.whatsapp\.net/g, '')
    .replace(/@g\.us/g, '')
    .split(':')[0]
    .replace(/\D/g, '');
}

module.exports = userID;
