import { readFile } from 'node:fs/promises';
const token = (await readFile(new URL('../.supabase-token',import.meta.url),'utf8')).trim();
const query = await readFile(new URL('verificar-cambios.sql',import.meta.url),'utf8');
const res = await fetch('https://api.supabase.com/v1/projects/nfptkjlxcmoegphhvnam/database/query', {
  method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query})
});
const datos = await res.json();
if(!res.ok) { console.error('Verificacion fallida:',datos.message || res.status); process.exit(1); }
console.log(datos.filter((fila)=>fila.resultado).map((fila)=>fila.resultado).join('\n') || 'Verificacion completada.');
