# Proxy de IA (Cloudflare Worker)

Micro-backend gratis que guarda la API key de Groq del lado servidor para que el
asistente de Gastos Diarios funcione para cualquier visitante **sin exponer la key**.

```
navegador (GitHub Pages)  ->  este Worker  ->  Groq
                              (inyecta la key)
```

## Desplegar (una sola vez, ~5 min)

1. Crea una cuenta gratis en https://dash.cloudflare.com y instala Wrangler:
   ```bash
   npm install -g wrangler
   wrangler login
   ```

2. Desde esta carpeta (`proxy/`), guarda tu key de Groq como **secret** (no se
   escribe en ningún archivo; queda encriptada en Cloudflare):
   ```bash
   wrangler secret put GROQ_KEY
   # pega tu key gsk_... cuando lo pida
   ```

3. Publica:
   ```bash
   wrangler deploy
   ```
   Al final imprime la URL, p.ej. `https://gastos-ai.TU-SUBDOMINIO.workers.dev`.

4. En `../src/app.js`, pon esa URL **+ `/openai/v1`** en la constante `AI_PROXY_URL`:
   ```js
   const AI_PROXY_URL = 'https://gastos-ai.TU-SUBDOMINIO.workers.dev/openai/v1';
   ```

5. (Recomendado) En `wrangler.toml` cambia `ALLOWED_ORIGIN = "*"` por tu dominio de
   GitHub Pages (p.ej. `"https://rubenvasq.github.io"`) y vuelve a `wrangler deploy`.
   Así solo tu sitio puede usar el proxy.

6. Sube el cambio de `app.js` a GitHub y recarga el sitio. El asistente ya responde
   sin pedir key.

## Rotar la key
```bash
wrangler secret put GROQ_KEY   # pega la nueva; redespliega solo si cambiaste código
```

## Notas
- El rate-limit del Worker es best-effort (por isolate). Para límites estrictos por
  IP, añade un namespace **KV** o **Durable Objects** y cuenta ahí las peticiones.
- El Worker solo acepta `POST /openai/v1/chat/completions`; cualquier otra ruta da 404.
