/**
 * Proxy serverless para el asistente de IA de Gastos Diarios.
 *
 * Problema que resuelve: la app es 100% estática (GitHub Pages), así que no hay
 * dónde esconder la API key de Groq — cualquier cosa que llegue al navegador es
 * pública. Este Worker guarda la key del lado servidor (como "secret") y hace de
 * puente: el navegador llama al Worker, y el Worker llama a Groq inyectando la key.
 * Así el asistente funciona para cualquier visitante sin exponer la credencial.
 *
 * El front (src/app.js, AI_PROXY_URL) apunta baseURL del SDK a este Worker + '/openai/v1'.
 * El SDK de OpenAI hace POST a '{baseURL}/chat/completions', que aquí se reescribe a
 * 'https://api.groq.com/openai/v1/chat/completions'.
 *
 * Secret requerido:  GROQ_KEY          (wrangler secret put GROQ_KEY)
 * Variable opcional: ALLOWED_ORIGIN    (origen del sitio; '*' si se omite)
 */

const GROQ_BASE = 'https://api.groq.com/openai/v1';

// Defensa básica contra abuso: solo se permite el endpoint que usa el agente y
// un puñado de modelos/tamaños razonables. Para límites fuertes por IP usar KV o
// Durable Objects (ver README); este Map es best-effort por isolate.
const ALLOWED_PATHS = ['/openai/v1/chat/completions'];
const MAX_BODY_BYTES = 256 * 1024; // 256 KB por request
const RATE = { windowMs: 60_000, max: 20 }; // 20 req/min por IP (aprox, por isolate)
const hits = new Map();

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function rateLimited(ip) {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now - rec.start > RATE.windowMs) {
    hits.set(ip, { start: now, count: 1 });
    return false;
  }
  rec.count += 1;
  return rec.count > RATE.max;
}

export default {
  async fetch(request, env) {
    const allowed = env.ALLOWED_ORIGIN || '*';
    const cors = corsHeaders(allowed);

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method !== 'POST') {
      return json({ error: 'Método no permitido' }, 405, cors);
    }

    const url = new URL(request.url);
    if (!ALLOWED_PATHS.includes(url.pathname)) {
      return json({ error: 'Ruta no permitida' }, 404, cors);
    }

    if (!env.GROQ_KEY) {
      return json({ error: 'El proxy no tiene GROQ_KEY configurada' }, 500, cors);
    }

    const ip = request.headers.get('cf-connecting-ip') || 'anon';
    if (rateLimited(ip)) {
      return json({ error: 'Demasiadas solicitudes, intenta en un momento.' }, 429, cors);
    }

    const body = await request.text();
    if (body.length > MAX_BODY_BYTES) {
      return json({ error: 'Cuerpo demasiado grande' }, 413, cors);
    }

    // Reenvío a Groq con la key real inyectada del lado servidor.
    const groqRes = await fetch(`${GROQ_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.GROQ_KEY}`,
      },
      body,
    });

    // Devolvemos la respuesta de Groq tal cual, agregando CORS.
    const headers = new Headers(cors);
    headers.set('Content-Type', groqRes.headers.get('Content-Type') || 'application/json');
    return new Response(groqRes.body, { status: groqRes.status, headers });
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
