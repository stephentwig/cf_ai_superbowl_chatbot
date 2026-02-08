const HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Super Bowl Chat</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <div class="wrap">
      <h1>Super Bowl Chat </h1>
      <div id="log"></div>
      <form id="form">
        <input id="input" placeholder="Ask about the Super Bowl..." autocomplete="off" />
        <button id="send" type="submit">Send</button>
      </form>
      
      <br>
      <div class="muted">Built by Stephen Sarpong-Sei</div>
    </div>
    <script>
      const log = document.getElementById('log');
      const form = document.getElementById('form');
      const input = document.getElementById('input');
      const send = document.getElementById('send');

      function add(role, content) {
        const div = document.createElement('div');
        div.className = 'msg ' + role;
        div.innerHTML = '<span class="role">' + role + ':</span> ' + content;
        log.appendChild(div);
        log.scrollTop = log.scrollHeight;
      }

      async function loadHistory() {
        const res = await fetch('/api/history');
        if (!res.ok) return;
        const data = await res.json();
        (data.messages || []).forEach(m => add(m.role, m.content));
      }

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        input.value = '';
        add('user', text);
        send.disabled = true;
        try {
          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ message: text })
          });
          const data = await res.json();
          add('assistant', data.reply || '');
        } catch (err) {
          add('assistant', 'Error: ' + err.message);
        } finally {
          send.disabled = false;
        }
      });

      loadHistory();
    </script>
  </body>
</html>`;

const SYSTEM_PROMPT =
  'You are a concise Super Bowl helper. Answer questions about the Super Bowl, teams, rules, history, and game-day logistics. Keep replies short and helpful.If the response is '
  + 'not super bowl related say "Sorry bro, I do not know about that"';

function getCookie(request, name) {
  const cookie = request.headers.get('Cookie') || '';
  const parts = cookie.split(';').map(p => p.trim());
  for (const part of parts) {
    if (part.startsWith(name + '=')) return part.slice(name.length + 1);
  }
  return null;
}

async function getMessages(stub) {
  const res = await stub.fetch('https://memory/get');
  if (!res.ok) return [];
  const data = await res.json();
  return data.messages || [];
}

async function addMessage(stub, message) {
  await stub.fetch('https://memory/add', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(message)
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/') {
      return new Response(HTML, { headers: { 'content-type': 'text/html;charset=utf-8' } });
    }

    let sid = getCookie(request, 'sid');
    if (!sid) sid = crypto.randomUUID();
    const id = env.CHAT_MEMORY.idFromName(sid);
    const stub = env.CHAT_MEMORY.get(id);

    if (url.pathname === '/api/history') {
      const messages = await getMessages(stub);
      const res = new Response(JSON.stringify({ messages }), {
        headers: { 'content-type': 'application/json' }
      });
      if (!getCookie(request, 'sid')) {
        res.headers.append('Set-Cookie', `sid=${sid}; Path=/; HttpOnly; SameSite=Lax`);
      }
      return res;
    }

    if (url.pathname === '/api/chat' && request.method === 'POST') {
      const body = await request.json();
      const userMessage = String(body.message || '').trim();
      if (!userMessage) return new Response('Missing message', { status: 400 });

      const history = await getMessages(stub);
      const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history,
        { role: 'user', content: userMessage }
      ];

      const aiResult = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', { messages });
      const reply = aiResult?.response || aiResult?.result || aiResult?.output || '';

      await addMessage(stub, { role: 'user', content: userMessage });
      await addMessage(stub, { role: 'assistant', content: reply });

      const res = new Response(JSON.stringify({ reply }), {
        headers: { 'content-type': 'application/json' }
      });
      if (!getCookie(request, 'sid')) {
        res.headers.append('Set-Cookie', `sid=${sid}; Path=/; HttpOnly; SameSite=Lax`);
      }
      return res;
    }

    return new Response('Not found', { status: 404 });
  }
};

export class ChatMemory {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/get') {
      const messages = (await this.state.storage.get('messages')) || [];
      return new Response(JSON.stringify({ messages }), {
        headers: { 'content-type': 'application/json' }
      });
    }

    if (url.pathname === '/add' && request.method === 'POST') {
      const msg = await request.json();
      const messages = (await this.state.storage.get('messages')) || [];
      messages.push({ role: msg.role, content: msg.content });
      const trimmed = messages.slice(-12);
      await this.state.storage.put('messages', trimmed);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'content-type': 'application/json' }
      });
    }

    if (url.pathname === '/clear') {
      await this.state.storage.put('messages', []);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'content-type': 'application/json' }
      });
    }

    return new Response('Not found', { status: 404 });
  }
}
