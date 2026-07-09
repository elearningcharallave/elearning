// ============================================================================
// FUNCECAIND - Edge Function: asistente IA del curso.
// Requiere secreto OPENAI_API_KEY en Supabase. Opcional: OPENAI_MODEL.
// Verifica sesion y acceso al curso antes de enviar contexto al modelo.
// ============================================================================
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-5.6-luna";

const ALLOWED = ["https://elearningcharallave.github.io", "http://localhost:8080", "http://localhost:3000"];

function corsFor(req: Request) {
  const origin = req.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED.indexOf(origin) >= 0 ? origin : ALLOWED[0],
    "Access-Control-Allow-Headers": "authorization, content-type, apikey",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function svc(path: string, opts: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "apikey": SERVICE_KEY,
      "Content-Type": "application/json",
    },
  });
}

async function rows(path: string) {
  const r = await svc(path);
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0, 180)}`);
  return await r.json();
}

function trimText(value: unknown, max = 1400) {
  const s = String(value || "").replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max) + "..." : s;
}

function outputText(data: any) {
  if (data?.output_text) return String(data.output_text).trim();
  const parts: string[] = [];
  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && content?.text) parts.push(content.text);
      else if (typeof content?.text === "string") parts.push(content.text);
    }
  }
  return parts.join("\n").trim();
}

Deno.serve(async (req) => {
  const cors = corsFor(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Metodo no permitido" }, 405);

  try {
    if (!OPENAI_API_KEY) return json({ error: "La IA no esta configurada. Falta OPENAI_API_KEY en Supabase." }, 503);

    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "No autenticado" }, 401);

    const ur = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { "Authorization": `Bearer ${jwt}`, "apikey": SERVICE_KEY },
    });
    if (!ur.ok) return json({ error: "Sesion invalida" }, 401);
    const user = await ur.json();

    const profile = (await rows(`perfiles?id=eq.${user.id}&select=rol,nombre,email`))[0];
    if (!profile) return json({ error: "Perfil no encontrado" }, 403);

    const body = await req.json().catch(() => ({}));
    const cursoId = String(body.curso_id || "").trim();
    const pregunta = trimText(body.pregunta, 1200);
    if (!cursoId) return json({ error: "Falta curso_id" }, 400);
    if (!pregunta) return json({ error: "Escribe una pregunta." }, 400);

    const curso = (await rows(`cursos?id=eq.${cursoId}&select=id,titulo,descripcion,profesor_id,profesor_nombre`))[0];
    if (!curso) return json({ error: "Curso no existe" }, 404);

    const isAdmin = profile.rol === "admin";
    const isOwner = profile.rol === "profesor" && curso.profesor_id === user.id;
    let isEnrolled = false;
    if (!isAdmin && !isOwner) {
      const m = await rows(`matriculas?curso_id=eq.${cursoId}&alumno_id=eq.${user.id}&select=id&limit=1`);
      isEnrolled = m.length > 0;
    }
    if (!isAdmin && !isOwner && !isEnrolled) return json({ error: "No tienes acceso a este curso" }, 403);

    const modules = await rows(`modulos?curso_id=eq.${cursoId}&select=id,titulo,orden&order=orden.asc`);
    const lessonBlocks: string[] = [];
    for (const m of modules.slice(0, 12)) {
      lessonBlocks.push(`Modulo: ${trimText(m.titulo, 160)}`);
      const lessons = await rows(`lecciones?modulo_id=eq.${m.id}&select=titulo,tipo,contenido,orden&order=orden.asc`);
      for (const l of lessons.slice(0, 18)) {
        const content = l.tipo === "texto" ? ` - contenido: ${trimText(l.contenido, 900)}` : "";
        lessonBlocks.push(`- ${trimText(l.titulo, 160)} [${l.tipo}]${content}`);
      }
    }

    const evals = await rows(`evaluaciones?curso_id=eq.${cursoId}&select=titulo,descripcion,nota_minima&order=creado_en.asc`);
    const tareas = await rows(`tareas?curso_id=eq.${cursoId}&select=titulo,descripcion,fecha_limite&order=creado_en.asc`);

    const context = [
      `Curso: ${trimText(curso.titulo, 180)}`,
      curso.descripcion ? `Descripcion: ${trimText(curso.descripcion, 800)}` : "",
      lessonBlocks.join("\n"),
      evals.length ? `Evaluaciones: ${evals.map((e: any) => trimText(e.titulo, 120)).join("; ")}` : "",
      tareas.length ? `Tareas: ${tareas.map((t: any) => trimText(t.titulo, 120)).join("; ")}` : "",
      "Datos legales publicos: RIF J002321385; razon social FUNDACION PARA LA PLANIFICACION Y DESARROLLO DE CENTROS DE CAPACITACION INDUSTRIAL.",
    ].filter(Boolean).join("\n\n");

    const ai = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        reasoning: { effort: "low" },
        store: false,
        max_output_tokens: 900,
        input: [
          {
            role: "developer",
            content: "Eres el asistente academico de FUNCECAIND. Responde en espanol claro y breve. Usa solo el contexto del curso y datos institucionales publicos incluidos. Si falta informacion, dilo sin inventar. No reveles respuestas correctas de evaluaciones activas ni sustituyas al profesor; ayuda con explicaciones, ejemplos, ejercicios de practica y orientacion de estudio.",
          },
          {
            role: "user",
            content: `Contexto disponible:\n${context}\n\nPregunta del usuario:\n${pregunta}`,
          },
        ],
      }),
    });

    const data = await ai.json().catch(() => ({}));
    if (!ai.ok) return json({ error: data?.error?.message || "Error consultando IA" }, 502);

    const respuesta = outputText(data);
    return json({ respuesta: respuesta || "No se pudo generar una respuesta.", model: OPENAI_MODEL });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
