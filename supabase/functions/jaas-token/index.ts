// ============================================================================
// FUNCECAIND — Edge Function: firma tokens JWT para JaaS (8x8) con RS256.
// El PROFESOR/ADMIN (verificado contra Supabase) recibe moderator=true.
// Estudiantes/invitados: token sin moderador (o entran sin token).
// Secretos requeridos: JAAS_APP_ID, JAAS_KID, JAAS_PRIVATE_KEY
// (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase).
// ============================================================================
const APP_ID = Deno.env.get("JAAS_APP_ID")!;
const KID = Deno.env.get("JAAS_KID")!;
const PEM = Deno.env.get("JAAS_PRIVATE_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function pemToDer(pem: string): Uint8Array {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const bin = atob(b64);
  const der = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) der[i] = bin.charCodeAt(i);
  return der;
}
function b64urlStr(s: string): string {
  return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlBytes(bytes: Uint8Array): string {
  let bin = ""; for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

let keyP: Promise<CryptoKey> | null = null;
function getKey() {
  if (!keyP) {
    keyP = crypto.subtle.importKey(
      "pkcs8", pemToDer(PEM),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"],
    );
  }
  return keyP;
}
async function sign(header: unknown, payload: unknown): Promise<string> {
  const k = await getKey();
  const data = b64urlStr(JSON.stringify(header)) + "." + b64urlStr(JSON.stringify(payload));
  const sig = await crypto.subtle.sign({ name: "RSASSA-PKCS1-v1_5" }, k, new TextEncoder().encode(data));
  return data + "." + b64urlBytes(new Uint8Array(sig));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({} as any));
    const room = body.room || "*";
    let name = body.name || "Invitado";
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");

    let moderator = false, email = "", uid = "";
    if (jwt && jwt !== SERVICE_KEY) {
      const ur = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${jwt}`, apikey: SERVICE_KEY },
      });
      if (ur.ok) {
        const u = await ur.json();
        uid = u.id || ""; email = u.email || "";
        const pr = await fetch(`${SUPABASE_URL}/rest/v1/perfiles?id=eq.${uid}&select=rol,nombre`, {
          headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
        });
        const rows = await pr.json();
        if (rows && rows[0]) {
          if (rows[0].nombre) name = rows[0].nombre;
          moderator = rows[0].rol === "profesor" || rows[0].rol === "admin";
        }
      }
    }

    const now = Math.floor(Date.now() / 1000);
    const header = { alg: "RS256", kid: KID, typ: "JWT" };
    const payload = {
      aud: "jitsi", iss: "chat", sub: APP_ID, room,
      iat: now, nbf: now - 10, exp: now + 3 * 3600,
      context: {
        user: { id: uid, name, email, moderator: moderator ? "true" : "false", "hidden-from-recorder": "false" },
        features: { livestreaming: "false", recording: moderator ? "true" : "false", transcription: "false", "outbound-call": "false" },
      },
    };
    const token = await sign(header, payload);
    return new Response(JSON.stringify({ jwt: token, moderator }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
