import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const raiz = fileURLToPath(new URL('../', import.meta.url));
const destino = new URL('../dist-cambios/', import.meta.url);
await mkdir(new URL('assets/funcecaind/', destino), { recursive:true });
// Lista cerrada: nunca publicar la raiz, que contiene credenciales locales.
for (const archivo of ['assets/app.js','assets/supabase-config.js','assets/cambios.css','assets/cambios.js','assets/favicon.svg','assets/funcecaind/logo-funcecaind.png']) {
  await copyFile(raiz + archivo, new URL(archivo,destino));
}
await copyFile(raiz+'cambios.html',new URL('index.html',destino));
await writeFile(new URL('robots.txt',destino),'User-agent: *\nDisallow: /\n');
await writeFile(new URL('_headers',destino),`/*
  X-Robots-Tag: noindex, nofollow
  X-Content-Type-Options: nosniff
  Referrer-Policy: same-origin
  X-Frame-Options: DENY
  Cache-Control: no-store
  Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://nfptkjlxcmoegphhvnam.supabase.co wss://nfptkjlxcmoegphhvnam.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
`);
console.log('Panel preparado con recursos publicos y sin secretos.');
