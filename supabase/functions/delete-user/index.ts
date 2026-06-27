// ============================================================================
// FUNCECAIND — Edge Function: el ADMIN elimina un usuario por completo.
// Verifica que quien llama sea admin (en Supabase) y borra el usuario de Auth
// (en cascada se borran su perfil, clases, asistencia, resultados, materiales...).
// ============================================================================
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "No autenticado" }, 401);

    // ¿Quién llama?
    const ur = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: `Bearer ${jwt}`, apikey: SERVICE_KEY } });
    if (!ur.ok) return json({ error: "Sesión inválida" }, 401);
    const caller = await ur.json();

    // ¿Es admin?
    const pr = await fetch(`${SUPABASE_URL}/rest/v1/perfiles?id=eq.${caller.id}&select=rol`, {
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
    });
    const rows = await pr.json();
    if (!rows[0] || rows[0].rol !== "admin") return json({ error: "Solo el administrador puede eliminar usuarios" }, 403);

    const { userId } = await req.json().catch(() => ({} as any));
    if (!userId) return json({ error: "Falta userId" }, 400);
    if (userId === caller.id) return json({ error: "No puedes eliminarte a ti mismo" }, 400);

    // Borrar de Auth (cascada borra perfil + datos relacionados por FK)
    const del = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
    });
    if (!del.ok) return json({ error: "No se pudo eliminar: " + (await del.text()).slice(0, 200) }, 500);

    return json({ ok: true });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
