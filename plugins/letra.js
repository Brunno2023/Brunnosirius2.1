'use strict';

const axios = require('axios');
const yts = require('yt-search');

function cleanText(text = '') {
  return String(text)
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/official video/ig, '')
    .replace(/official audio/ig, '')
    .replace(/lyrics/ig, '')
    .replace(/letra/ig, '')
    .replace(/video oficial/ig, '')
    .replace(/audio oficial/ig, '')
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

  return {
    artist: '',
    title: clean
  };
}

function cutLyrics(text = '', max = 3500) {
  text = String(text || '').trim();

  if (text.length <= max) return text;

  return text.slice(0, max) + '\n\n⚠️ Letra recortada.';
}

async function searchYouTube(query) {
  const res = await yts(query);

  if (!res.videos?.length) return null;

  return res.videos[0];
}

async function getLyricsOVH(artist, title) {
  try {
    const url =
      `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;

    const { data } = await axios.get(url, {
      timeout: 15000
    });

    return data?.lyrics || '';
  } catch {
    return '';
  }
}

async function getLyricsLRCLIB(artist, title) {
  try {
    const { data } = await axios.get(
      'https://lrclib.net/api/search',
      {
        params: {
          artist_name: artist,
          track_name: title
        },
        timeout: 15000
      }
    );

    if (!Array.isArray(data) || !data.length) {
      return '';
    }

    const song = data[0];

    return (
      song.plainLyrics ||
      song.syncedLyrics ||
      ''
    );
  } catch {
    return '';
  }
}

module.exports = {
  commands: ['letra', 'lyrics'],

  async execute({ sock, remoteJid, args, msg }) {
    try {
      if (!args.length) {
        return sock.sendMessage(
          remoteJid,
          {
            text:
`❌ Escribe una canción.

Ejemplos:
.letra bad bunny dakiti
.letra shakira hips dont lie
.lyrics adele hello`
          },
          { quoted: msg }
        );
      }

      const query = args.join(' ');

      await sock.sendMessage(
        remoteJid,
        {
          text: '🔍 Buscando canción y letra...'
        },
        { quoted: msg }
      );

      const video = await searchYouTube(query);

      if (!video) {
        return sock.sendMessage(
          remoteJid,
          {
            text: '❌ No encontré esa canción.'
          },
          { quoted: msg }
        );
      }

      let { artist, title } = splitArtistTitle(video.title);

      if (!artist) {
        artist = video.author?.name || '';
      }

      if (!title) {
        title = cleanText(video.title);
      }

      let lyrics = '';

      lyrics = await getLyricsOVH(artist, title);

      if (!lyrics) {
        lyrics = await getLyricsLRCLIB(artist, title);
      }

      if (!lyrics) {
        return sock.sendMessage(
          remoteJid,
          {
            text:
`❌ No encontré la letra.

🎵 Canción detectada:
${video.title}

Prueba escribiendo:
.letra artista - canción`
          },
          { quoted: msg }
        );
      }

      lyrics = cutLyrics(lyrics);

      return sock.sendMessage(
        remoteJid,
        {
          text:
`🎵 *${title}*
👤 *${artist}*

${lyrics}`
        },
        { quoted: msg }
      );

    } catch (err) {
      console.log('❌ Error letra:', err?.message || err);

      return sock.sendMessage(
        remoteJid,
        {
          text: '❌ Error buscando la letra.'
        },
        { quoted: msg }
      );
    }
  }
};
