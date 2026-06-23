'use strict';

const axios = require('axios');
const cheerio = require('cheerio');

module.exports = {
  commands: ['google', 'buscar'],

  async execute({ sock, remoteJid, args, msg }) {
    try {
      if (!args.length) {
        return sock.sendMessage(remoteJid, {
          text: '❌ Escribe algo para buscar.'
        }, { quoted: msg });
      }

      const query = args.join(' ');

      await sock.sendMessage(remoteJid, {
        text: '🔍 Buscando...'
      }, { quoted: msg });

      const url =
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

      const { data } = await axios.get(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        },
        timeout: 15000
      });

      const $ = cheerio.load(data);

      const results = [];

      $('.result').each((i, el) => {
        if (i >= 8) return false;

        const title = $(el)
          .find('.result__title')
          .text()
          .trim();

        const snippet = $(el)
          .find('.result__snippet')
          .text()
          .trim();

        const link = $(el)
          .find('a.result__a')
          .attr('href');

        if (title) {
          results.push({
            title,
            snippet,
            link
          });
        }
      });

      if (!results.length) {
        return sock.sendMessage(remoteJid, {
          text: '❌ No encontré resultados.'
        }, { quoted: msg });
      }

      const rawResults = results
        .map((r, i) =>
          `${i + 1}. ${r.title}\n${r.snippet}\n${r.link || ''}`
        )
        .join('\n\n');

      if (!process.env.GROQ_API_KEY) {
        return sock.sendMessage(remoteJid, {
          text:
`🔎 *${query}*

${rawResults}`
        }, { quoted: msg });
      }

      const response = await fetch(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`
          },
          body: JSON.stringify({
            model:
              process.env.GROQ_MODEL ||
              'llama-3.3-70b-versatile',
            temperature: 0.2,
            max_tokens: 600,
            messages: [
              {
                role: 'system',
                content:
`Eres Eres un buscador web.

Responde de forma breve y directa.

Reglas:
- No expliques cómo obtuviste la información.
- No digas "según los resultados encontrados".
- No digas "es importante destacar".
- No agregues advertencias.
- No menciones fuentes.
- No digas que eres una ia
- No pongas dialogo innecesario
- No hagas introducciones.
- Responde únicamente la pregunta del usuario.
- Máximo 3 líneas.
- Si no encuentras la respuesta exacta, responde: "No encontré información suficiente."`
              },
              {
                role: 'user',
                content:
`Consulta:
${query}

Resultados encontrados:

${rawResults}`
              }
            ]
          })
        }
      );

      const json = await response.json();

      const answer =
        json?.choices?.[0]?.message?.content ||
        rawResults;

      return sock.sendMessage(remoteJid, {
        text:
`🔎 *${query}*

${answer}`
      }, { quoted: msg });

    } catch (err) {
      console.log('Google error:', err);

      return sock.sendMessage(remoteJid, {
        text: '❌ Error al buscar.'
      }, { quoted: msg });
    }
  }
};
