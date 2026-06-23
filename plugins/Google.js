'use strict';

const axios = require('axios');
const cheerio = require('cheerio');

module.exports = {
  commands: ['google', 'buscar'],

  async execute({ sock, remoteJid, args, msg }) {
    try {
      if (!args.length) {
        return sock.sendMessage(remoteJid, {
          text: '❌ Escribe algo para buscar.\n\nEjemplo:\n.google resultado del mundial'
        }, { quoted: msg });
      }

      const query = args.join(' ');

      await sock.sendMessage(remoteJid, {
        text: '🔍 Buscando en Internet...'
      }, { quoted: msg });

      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

      const { data } = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0'
        },
        timeout: 15000
      });

      const $ = cheerio.load(data);

      const results = [];

      $('.result').each((i, el) => {
        if (i >= 5) return false;

        const title = $(el).find('.result__title').text().trim();
        const snippet = $(el).find('.result__snippet').text().trim();

        if (title) {
          results.push(`• ${title}\n${snippet}`);
        }
      });

      if (!results.length) {
        return sock.sendMessage(remoteJid, {
          text: '❌ No encontré resultados.'
        }, { quoted: msg });
      }

      const searchText = results.join('\n\n');

      if (!process.env.GROQ_API_KEY) {
        return sock.sendMessage(remoteJid, {
          text:
`🔎 *${query}*

${searchText}`
        }, { quoted: msg });
      }

      const groq = await fetch(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`
          },
          body: JSON.stringify({
            model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
            temperature: 0.3,
            max_tokens: 500,
            messages: [
              {
                role: 'system',
                content:
                  'Resume los resultados de búsqueda de forma clara y útil.'
              },
              {
                role: 'user',
                content:
                  `Consulta: ${query}\n\nResultados:\n${searchText}`
              }
            ]
          })
        }
      );

      const json = await groq.json();

      const answer =
        json?.choices?.[0]?.message?.content ||
        searchText;

      return sock.sendMessage(remoteJid, {
        text:
`🔎 *${query}*

${answer}`
      }, { quoted: msg });

    } catch (e) {
      console.log('Google error:', e);

      return sock.sendMessage(remoteJid, {
        text: '❌ Error al buscar.'
      }, { quoted: msg });
    }
  }
};
