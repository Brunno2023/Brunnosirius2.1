'use strict';

const axios = require('axios');
const yts = require('yt-search');

function cleanText(text = '') {
  return String(text)
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/official video/ig, '')
    .replace(/official audio/ig, '')
    .replace(/video oficial/ig, '')
    .replace(/audio oficial/ig, '')
    .replace(/lyrics/ig, '')
    .replace(/letra/ig, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitArtistTitle(title = '') {
  const clean = cleanText(title);

  if (clean.includes(' - ')) {
    const [artist, ...rest] = clean.split(' - ');
    return {
      artist: artist.trim(),
      title: rest.join(' - ').trim()
    };
  }

  if (clean.includes(' – ')) {
    const [artist, ...rest] = clean.split(' – ');
    return {
      artist: artist.trim(),
      title: rest.join(' – ').trim()
    };
  }

  return {
    artist: '',
    title: clean
  };
}

function cutLyrics(text = '', max = 3500) {
  const lyrics = String(text || '').trim();

  if (lyrics.length <= max) return lyrics;

  return lyrics.slice(0, max) +
    '\n\n⚠️ Letra muy larga, se envió recortada.';
}

async function searchYouTube(query) {
  const res = await yts(query);

  if (!res.videos?.length) return null;

  return (
    res.videos.find(v =>
      !/mix|playlist/i.test(v.title)
    ) || res.videos[0]
  );
}

async function getLyrics(title, artist = '') {
  const attempts = [
    {
      track_name: title,
      artist_name: artist
    },
    {
      track_name: cleanText(title),
      artist_name: artist
    },
    {
      track_name: cleanText(title),
      artist_name: ''
    }
  ];

  for (const params of attempts) {
    try {
      const { data } = await axios.get(
        'https://lrclib.net/api/search',
        {
          params,
          timeout: 15000
        }
      );

      if (Array.isArray(data) && data.length) {
        const song = data[0];

        return (
          song.plainLyrics ||
          song.syncedLyrics ||
          ''
        );
      }
    } catch {}
  }

  return '';
}

module.exports = {
  commands: ['letra', 'lyrics'],

  async execute({
    sock,
    remoteJid,
    args,
    msg,
    reply
  }) {
    try {
      if (!args.length) {
        return reply(
`❌ Escribe una canción.

Ejemplos:
.letra bad bunny dakiti
.letra shakira hips dont lie
.lyrics adele hello`
        );
      }

      const query = args.join(' ').trim();

      await sock.sendMessage(remoteJid, {
        text: '🔍 Buscando letra...'
      }, { quoted: msg });

      const video = await searchYouTube(query);

      if (!video) {
        return reply('❌ No encontré esa canción.');
      }

      let { artist, title } = splitArtistTitle(video.title);

      if (!artist || !title) {
        artist = video.author?.name || '';
        title = cleanText(video.title);
      }

      let lyrics = await getLyrics(title, artist);

      if (!lyrics) {
        lyrics = await getLyrics(query);
      }

      if (!lyrics) {
        return reply(
`❌ No encontré la letra.

Prueba escribir:

.letra artista - canción

Ejemplo:
.letra bad bunny - dakiti`
        );
      }

      lyrics = cutLyrics(lyrics);

      return sock.sendMessage(remoteJid, {
        text:
`🎵 *${title}*
👤 *${artist || 'Desconocido'}*

${lyrics}`
      }, { quoted: msg });

    } catch (err) {
      console.log(
        '❌ Error letra:',
        err?.message || err
      );

      return reply(
        '❌ Error buscando la letra de la canción.'
      );
    }
  }
};
