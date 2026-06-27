// ============================================================================
// FUNCECAIND — Edge Function: certificados.
//  action 'estado' -> dice si el alumno es ELEGIBLE (aprobó todas las
//                     evaluaciones del curso) y si ya tiene certificado.
//  action 'emitir' -> revalida elegibilidad SERVER-SIDE y emite el certificado
//                     con un código único (no se puede falsificar desde el cliente).
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
    ...opts, headers: { ...(opts.headers || {}), Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" },
  });
}

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
    const pf = await (await svc(`perfiles?id=eq.${user.id}&select=nombre`)).json();
    const nombre = pf[0]?.nombre || user.email;

    const body = await req.json().catch(() => ({} as any));
    const cursoId = body.curso_id;
    if (!cursoId) return json({ error: "Falta curso_id" }, 400);

    const curso = (await (await svc(`cursos?id=eq.${cursoId}&select=titulo`)).json())[0];
    if (!curso) return json({ error: "Curso no existe" }, 404);

    // ¿aprobó todas las evaluaciones del curso?
    const evs = await (await svc(`evaluaciones?curso_id=eq.${cursoId}&select=id`)).json();
    let aprobadas = 0;
    for (const ev of evs) {
      const ap = await (await svc(`intentos?evaluacion_id=eq.${ev.id}&alumno_id=eq.${user.id}&aprobado=eq.true&select=id&limit=1`)).json();
      if (ap.length > 0) aprobadas++;
    }
    const elegible = evs.length > 0 && aprobadas === evs.length;
    const existente = (await (await svc(`certificados?curso_id=eq.${cursoId}&alumno_id=eq.${user.id}&select=*`)).json())[0] || null;

    if (body.action === "estado") {
      return json({ elegible, total_evaluaciones: evs.length, aprobadas, certificado: existente });
    }
    if (body.action === "emitir") {
      if (existente) return json({ certificado: existente, ya: true });
      if (!elegible) return json({ error: "Aún no cumples los requisitos: aprueba todas las evaluaciones del curso." }, 403);
      const codigo = "FUNCE-" + crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
      const cert = (await (await svc(`certificados`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ curso_id: cursoId, curso_titulo: curso.titulo, alumno_id: user.id, alumno_nombre: nombre, codigo }) })).json())[0];
      await svc(`learning_events`, { method: "POST", body: JSON.stringify({ actor_id: user.id, actor_nombre: nombre, verb: "completed", object_type: "curso", object_id: cursoId, completion: true, context: { certificado: codigo } }) });
      return json({ certificado: cert });
    }
    return json({ error: "Acción no válida" }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
