'use strict';

function userId(jid = '') {
  return String(jid)
    .replace(/@s\.whatsapp\.net/g, '')
    .replace(/@g\.us/g, '')
    .split(':')[0]
    .replace(/\D/g, '');
}

module.exports = {
  userId
};
