// ============================================================================
// FUNCECAIND — Edge Function: evaluaciones (anti-trampa).
//  action 'start'  -> crea un intento y devuelve las preguntas SIN la respuesta correcta.
//  action 'submit' -> califica server-side (compara contra 'correcta' con service_role),
//                     guarda el intento y emite un learning_event passed/failed.
// El navegador del alumno NUNCA ve el indice correcto antes de enviar.
// ============================================================================
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ALLOWED = ["https://elearningcharallave.github.io", "http://localhost:8080", "http://localhost:3000"];
function corsFor(req: Request) {
  const o = req.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED.indexOf(o) >= 0 ? o : ALLOWED[0],
    "Access-Control-Allow-Headers": "authorization, content-type, apikey",
    "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin",
  };
}
function svc(path: string, opts: any = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: { ...(opts.headers || {}), Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" },
  });
}
function shuffle(a: any[]) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; }

Deno.serve(async (req) => {
  const cors = corsFor(req);
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "No autenticado" }, 401);
    const ur = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: `Bearer ${jwt}`, apikey: SERVICE_KEY } });
    if (!ur.ok) return json({ error: "Sesión inválida" }, 401);
    const user = await ur.json();
    const pf = await (await svc(`perfiles?id=eq.${user.id}&select=rol,nombre`)).json();
    const rol = pf[0]?.rol, nombre = pf[0]?.nombre || user.email;
    const staff = rol === "admin" || rol === "profesor";

    const body = await req.json().catch(() => ({} as any));

    if (body.action === "start") {
      const ev = (await (await svc(`evaluaciones?id=eq.${body.evaluacion_id}&select=*`)).json())[0];
      if (!ev) return json({ error: "Evaluación no existe" }, 404);
      if (!staff) {
        const mat = await (await svc(`matriculas?curso_id=eq.${ev.curso_id}&alumno_id=eq.${user.id}&select=id`)).json();
        if (mat.length === 0) return json({ error: "No estás matriculado en este curso" }, 403);
      }
      const usados = (await (await svc(`intentos?evaluacion_id=eq.${ev.id}&alumno_id=eq.${user.id}&enviado_en=not.is.null&select=id`)).json()).length;
      if (ev.intentos_max > 0 && usados >= ev.intentos_max) return json({ error: "No te quedan intentos" }, 403);
      const it = (await (await svc(`intentos`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ evaluacion_id: ev.id, alumno_id: user.id, alumno_nombre: nombre }) })).json())[0];
      let preg = await (await svc(`preguntas?evaluacion_id=eq.${ev.id}&select=id,enunciado,tipo,opciones,puntos,orden&order=orden`)).json();
      preg = preg.map((p: any) => ({ id: p.id, enunciado: p.enunciado, tipo: p.tipo, opciones: p.tipo === "vf" ? ["Verdadero", "Falso"] : (p.opciones || []), puntos: p.puntos }));
      if (ev.aleatorizar) preg = shuffle(preg);
      return json({ intento_id: it.id, titulo: ev.titulo, duracion_min: ev.duracion_min, nota_minima: ev.nota_minima, preguntas: preg });
    }

    if (body.action === "submit") {
      const respuestas = body.respuestas || {};
      const it = (await (await svc(`intentos?id=eq.${body.intento_id}&select=*`)).json())[0];
      if (!it || it.alumno_id !== user.id) return json({ error: "Intento inválido" }, 403);
      if (it.enviado_en) return json({ error: "Ese intento ya fue enviado" }, 400);
      const ev = (await (await svc(`evaluaciones?id=eq.${it.evaluacion_id}&select=*`)).json())[0];
      const preg = await (await svc(`preguntas?evaluacion_id=eq.${it.evaluacion_id}&select=*&order=orden`)).json();
      let puntaje = 0, total = 0; const revision: any[] = [];
      for (const p of preg) {
        total += p.puntos;
        const elegida = respuestas[p.id];
        const ok = elegida !== undefined && elegida !== null && Number(elegida) === Number(p.correcta);
        if (ok) puntaje += p.puntos;
        revision.push({ id: p.id, enunciado: p.enunciado, tu: elegida, correcta: p.correcta, ok: ok, opciones: p.tipo === "vf" ? ["Verdadero", "Falso"] : (p.opciones || []) });
      }
      const porcentaje = total > 0 ? Math.round(puntaje / total * 100) : 0;
      const aprobado = porcentaje >= ev.nota_minima;
      await svc(`intentos?id=eq.${it.id}`, { method: "PATCH", body: JSON.stringify({ enviado_en: new Date().toISOString(), puntaje, total, porcentaje, aprobado, respuestas }) });
      await svc(`learning_events`, { method: "POST", body: JSON.stringify({ actor_id: user.id, actor_nombre: nombre, verb: aprobado ? "passed" : "failed", object_type: "evaluacion", object_id: it.evaluacion_id, score_scaled: porcentaje / 100, success: aprobado, completion: true, context: { curso_id: ev.curso_id } }) });
      return json({ puntaje, total, porcentaje, aprobado, revision });
    }

    return json({ error: "Acción no válida" }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
