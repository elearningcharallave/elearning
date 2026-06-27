/* ============================================================================
   FUNCECAIND — núcleo de autenticación y datos (Supabase)
   Requiere cargar antes:  @supabase/supabase-js (UMD) + supabase-config.js
   Expone el objeto global  FV  con lo que usan las páginas.
   ============================================================================ */
(function () {
  "use strict";

  function configOk() {
    var u = window.SUPABASE_URL, k = window.SUPABASE_ANON_KEY;
    return !!(u && u.indexOf("TU-") < 0 && u.indexOf("TU_") < 0 && k && k.indexOf("TU_") < 0);
  }

  var sb = null;
  if (configOk() && window.supabase && window.supabase.createClient) {
    sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  }

  function panelDe(rol) {
    return rol === "admin" ? "admin.html" : rol === "profesor" ? "profesor.html" : "alumno.html";
  }
  // Escapa texto para insertarlo con innerHTML sin riesgo de XSS.
  function esc(s) {
    return (s == null ? "" : "" + s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function wrapUser(u) { return u ? { uid: u.id, id: u.id, email: u.email } : null; }
  function claseMap(r) {
    return !r ? r : {
      id: r.id, titulo: r.titulo, descripcion: r.descripcion, horario: r.horario,
      sala: r.sala, profesorId: r.profesor_id, profesorNombre: r.profesor_nombre, creadoEn: r.creado_en
    };
  }

  async function perfilDe(id) {
    var r = await sb.from("perfiles").select("*").eq("id", id).maybeSingle();
    if (r.error) throw r.error;
    return r.data;
  }

  // Guard de página: exige sesión + rol permitido. Si no, redirige.
  function requireRole(roles, cb) {
    if (!configOk()) { mostrarFaltaConfig(); return; }
    roles = Array.isArray(roles) ? roles : [roles];
    sb.auth.getSession().then(async function (res) {
      var session = res.data && res.data.session;
      if (!session) { location.href = "login.html"; return; }
      try {
        var perfil = await perfilDe(session.user.id);
        if (!perfil) { await sb.auth.signOut(); location.href = "login.html"; return; }
        if (roles.indexOf(perfil.rol) === -1) { location.href = panelDe(perfil.rol); return; }
        cb(wrapUser(session.user), perfil);
      } catch (e) { console.error(e); alert("Error cargando tu perfil: " + (e.message || e)); }
    });
  }

  // login.html: si ya hay sesión, mandar al panel correspondiente
  function redirigirSiSesion() {
    if (!sb) return;
    sb.auth.getSession().then(async function (res) {
      var s = res.data && res.data.session; if (!s) return;
      try { var p = await perfilDe(s.user.id); location.href = panelDe(p ? p.rol : "alumno"); } catch (e) {}
    });
  }

  async function login(email, pass) {
    var r = await sb.auth.signInWithPassword({ email: email, password: pass });
    if (r.error) throw r.error;
    var p = await perfilDe(r.data.user.id);
    return p || { rol: "alumno" };
  }

  async function registrarAlumno(nombre, email, pass) {
    var r = await sb.auth.signUp({ email: email, password: pass, options: { data: { nombre: nombre } } });
    if (r.error) throw r.error;
    if (!r.data.session) { throw new Error("Revisa tu correo para confirmar la cuenta antes de entrar."); }
    var p = await perfilDe(r.data.user.id);
    return p ? p.rol : "alumno";
  }

  // El ADMIN crea una cuenta de PROFESOR sin perder su propia sesión.
  // Truco: un cliente Supabase secundario (sin persistir sesión) hace el signUp;
  // luego el admin (cliente principal) sube ese perfil a rol 'profesor'.
  async function crearProfesor(nombre, email, pass) {
    var sec = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false, storageKey: "sb-funcecaind-sec" } });
    var r = await sec.auth.signUp({ email: email, password: pass, options: { data: { nombre: nombre } } });
    if (r.error) throw r.error;
    var newId = r.data.user && r.data.user.id;
    if (!newId) throw new Error("No se pudo crear el usuario.");
    var up = await sb.from("perfiles").upsert({ id: newId, nombre: nombre, email: email, rol: "profesor" }, { onConflict: "id" });
    try { await sec.auth.signOut(); } catch (e) {}
    if (up.error) throw up.error;
    return newId;
  }

  function logout() {
    if (sb) sb.auth.signOut().then(function () { location.href = "login.html"; });
    else location.href = "login.html";
  }

  // --- Datos ---
  async function listarUsuarios() {
    var r = await sb.from("perfiles").select("*").order("creado_en", { ascending: false });
    if (r.error) throw r.error; return r.data;
  }
  function salaCodigo(titulo) {
    var base = (titulo || "clase").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "").slice(0, 18);
    return "funcecaind-" + (base || "clase") + "-" + Math.random().toString(36).slice(2, 7);
  }
  async function crearClase(d) {
    var row = {
      titulo: d.titulo, descripcion: d.descripcion, horario: d.horario, sala: d.sala,
      profesor_id: d.profesorId, profesor_nombre: d.profesorNombre
    };
    var r = await sb.from("clases").insert(row).select("id").single();
    if (r.error) throw r.error; return r.data.id;
  }
  async function clasesDeProfesor(uid) {
    var r = await sb.from("clases").select("*").eq("profesor_id", uid).order("creado_en", { ascending: false });
    if (r.error) throw r.error; return r.data.map(claseMap);
  }
  async function todasLasClases() {
    var r = await sb.from("clases").select("*").order("creado_en", { ascending: false });
    if (r.error) throw r.error; return r.data.map(claseMap);
  }
  async function eliminarClase(id) { var r = await sb.from("clases").delete().eq("id", id); if (r.error) throw r.error; }

  // Sesión actual + perfil (para pruebas y vistas que no son guard de página)
  async function sesion() {
    if (!sb) return null;
    var res = await sb.auth.getSession();
    var s = res.data && res.data.session; if (!s) return null;
    var p = null; try { p = await perfilDe(s.user.id); } catch (e) {}
    return { user: wrapUser(s.user), perfil: p };
  }
  async function guardarResultado(d) {
    var ses = await sesion(); if (!ses) throw new Error("Sin sesión");
    var row = {
      alumno_id: ses.user.uid,
      alumno_nombre: (ses.perfil && ses.perfil.nombre) || ses.user.email,
      prueba: d.prueba, puntaje: d.puntaje, total: d.total, porcentaje: d.porcentaje
    };
    var r = await sb.from("resultados").insert(row).select("id").single();
    if (r.error) throw r.error; return r.data.id;
  }
  async function todosResultados() {
    var r = await sb.from("resultados").select("*").order("creado_en", { ascending: false });
    if (r.error) throw r.error; return r.data;
  }
  async function misResultados() {
    var ses = await sesion(); if (!ses) return [];
    var r = await sb.from("resultados").select("*").eq("alumno_id", ses.user.uid).order("creado_en", { ascending: false });
    if (r.error) throw r.error; return r.data;
  }

  async function resetPassword(email) {
    var redirectTo = new URL("reset.html", location.href).href;
    var r = await sb.auth.resetPasswordForEmail(email, { redirectTo: redirectTo });
    if (r.error) throw r.error;
  }
  async function actualizarPassword(nueva) {
    var r = await sb.auth.updateUser({ password: nueva });
    if (r.error) throw r.error;
  }

  // --- Asistencia automática (se llama desde el aula) ---
  async function registrarEntrada(sala, rol) {
    var ses = await sesion(); if (!ses) return null; // solo usuarios con sesión
    var r = await sb.from("asistencia").insert({
      sala: sala, alumno_id: ses.user.uid,
      alumno_nombre: (ses.perfil && ses.perfil.nombre) || ses.user.email, rol: rol
    }).select("id").single();
    if (r.error) { console.error(r.error); return null; }
    return r.data.id;
  }
  async function latido(id) { if (!id || !sb) return; try { await sb.from("asistencia").update({ visto_at: new Date().toISOString() }).eq("id", id); } catch (e) {} }
  async function registrarSalida(id) { if (!id || !sb) return; try { await sb.from("asistencia").update({ salio_at: new Date().toISOString() }).eq("id", id); } catch (e) {} }
  async function asistenciaDeSala(sala) {
    var r = await sb.from("asistencia").select("*").eq("sala", sala).order("entro_at", { ascending: true });
    if (r.error) throw r.error; return r.data;
  }

  // --- Materiales de clase (Supabase Storage) ---
  async function subirMaterial(claseId, file, titulo) {
    var ses = await sesion(); if (!ses) throw new Error("Sin sesión");
    var safe = (file.name || "archivo").replace(/[^a-zA-Z0-9._-]/g, "_");
    var path = claseId + "/" + Date.now() + "-" + safe;
    var up = await sb.storage.from("materiales").upload(path, file, { upsert: false });
    if (up.error) throw up.error;
    var url = sb.storage.from("materiales").getPublicUrl(path).data.publicUrl;
    var r = await sb.from("materiales").insert({
      clase_id: claseId, titulo: titulo || file.name, archivo_path: path, url: url, profesor_id: ses.user.uid
    }).select("id").single();
    if (r.error) throw r.error; return r.data.id;
  }
  async function materialesDeClase(claseId) {
    var r = await sb.from("materiales").select("*").eq("clase_id", claseId).order("creado_en", { ascending: false });
    if (r.error) throw r.error; return r.data;
  }
  async function eliminarMaterial(id, path) {
    if (path) { try { await sb.storage.from("materiales").remove([path]); } catch (e) {} }
    var r = await sb.from("materiales").delete().eq("id", id);
    if (r.error) throw r.error;
  }

  // --- Foro (claseId null = foro general; o foro de una clase) ---
  async function foroMensajes(claseId) {
    var q = sb.from("foro_mensajes").select("*").order("creado_en", { ascending: true });
    q = claseId ? q.eq("clase_id", claseId) : q.is("clase_id", null);
    var r = await q; if (r.error) throw r.error; return r.data;
  }
  async function publicarForo(claseId, mensaje) {
    var ses = await sesion(); if (!ses) throw new Error("Sin sesión");
    var r = await sb.from("foro_mensajes").insert({
      clase_id: claseId || null, autor_id: ses.user.uid,
      autor_nombre: (ses.perfil && ses.perfil.nombre) || ses.user.email,
      autor_rol: (ses.perfil && ses.perfil.rol) || "alumno", mensaje: mensaje
    }).select("id").single();
    if (r.error) throw r.error; return r.data.id;
  }
  async function eliminarForoMsg(id) { var r = await sb.from("foro_mensajes").delete().eq("id", id); if (r.error) throw r.error; }

  // --- Admin: eliminar un usuario completo (auth + datos) vía Edge Function ---
  async function eliminarUsuario(userId) {
    var s = await sb.auth.getSession();
    var tok = s.data && s.data.session && s.data.session.access_token;
    var r = await fetch(window.SUPABASE_URL + "/functions/v1/delete-user", {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": window.SUPABASE_ANON_KEY, "Authorization": "Bearer " + tok },
      body: JSON.stringify({ userId: userId })
    });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok || j.error) throw new Error(j.error || "No se pudo eliminar el usuario");
    return true;
  }

  // ===== LMS Fase 1: cursos / modulos / lecciones / matriculas / eventos =====
  async function crearCurso(d) {
    var ses = await sesion(); if (!ses) throw new Error("Sin sesión");
    var r = await sb.from("cursos").insert({
      titulo: d.titulo, descripcion: d.descripcion || null,
      profesor_id: ses.user.uid, profesor_nombre: (ses.perfil && ses.perfil.nombre) || ses.user.email,
      publicado: !!d.publicado
    }).select("id").single();
    if (r.error) throw r.error; return r.data.id;
  }
  async function actualizarCurso(id, d) { var r = await sb.from("cursos").update(d).eq("id", id); if (r.error) throw r.error; }
  async function eliminarCurso(id) { var r = await sb.from("cursos").delete().eq("id", id); if (r.error) throw r.error; }
  async function todosCursos() { var r = await sb.from("cursos").select("*").order("creado_en", { ascending: false }); if (r.error) throw r.error; return r.data; }
  async function cursosDeProfesor(uid) { var r = await sb.from("cursos").select("*").eq("profesor_id", uid).order("creado_en", { ascending: false }); if (r.error) throw r.error; return r.data; }
  async function cursosMatriculado() {
    var r = await sb.from("matriculas").select("id, curso:cursos(*)").order("creado_en", { ascending: false });
    if (r.error) throw r.error; return r.data.map(function (x) { return x.curso; }).filter(Boolean);
  }

  async function modulosDeCurso(cursoId) { var r = await sb.from("modulos").select("*").eq("curso_id", cursoId).order("orden", { ascending: true }); if (r.error) throw r.error; return r.data; }
  async function crearModulo(cursoId, titulo, orden) { var r = await sb.from("modulos").insert({ curso_id: cursoId, titulo: titulo, orden: orden || 0 }).select("id").single(); if (r.error) throw r.error; return r.data.id; }
  async function eliminarModulo(id) { var r = await sb.from("modulos").delete().eq("id", id); if (r.error) throw r.error; }

  async function leccionesDeModulo(moduloId) { var r = await sb.from("lecciones").select("*").eq("modulo_id", moduloId).order("orden", { ascending: true }); if (r.error) throw r.error; return r.data; }
  async function crearLeccion(moduloId, d) { var r = await sb.from("lecciones").insert({ modulo_id: moduloId, titulo: d.titulo, tipo: d.tipo || "texto", contenido: d.contenido || null, orden: d.orden || 0 }).select("id").single(); if (r.error) throw r.error; return r.data.id; }
  async function eliminarLeccion(id) { var r = await sb.from("lecciones").delete().eq("id", id); if (r.error) throw r.error; }

  async function matricular(cursoId, alumnoId, alumnoNombre) { var r = await sb.from("matriculas").insert({ curso_id: cursoId, alumno_id: alumnoId, alumno_nombre: alumnoNombre }).select("id").single(); if (r.error) throw r.error; return r.data.id; }
  async function desmatricular(id) { var r = await sb.from("matriculas").delete().eq("id", id); if (r.error) throw r.error; }
  async function matriculasDeCurso(cursoId) { var r = await sb.from("matriculas").select("*").eq("curso_id", cursoId).order("creado_en", { ascending: true }); if (r.error) throw r.error; return r.data; }

  async function registrarEvento(ev) {
    var ses = await sesion(); if (!ses) return null;
    var r = await sb.from("learning_events").insert({
      actor_id: ses.user.uid, actor_nombre: (ses.perfil && ses.perfil.nombre) || ses.user.email,
      verb: ev.verb, object_type: ev.object_type, object_id: ev.object_id || null, context: ev.context || {}
    });
    if (r.error) { console.error(r.error); return null; } return true;
  }

  // ===== LMS Fase 2: evaluaciones / preguntas / intentos / gradebook =====
  async function crearEvaluacion(d) {
    var ses = await sesion();
    var r = await sb.from("evaluaciones").insert({
      curso_id: d.curso_id, titulo: d.titulo, descripcion: d.descripcion || null,
      nota_minima: d.nota_minima || 60, duracion_min: d.duracion_min || 0, intentos_max: d.intentos_max || 0,
      aleatorizar: d.aleatorizar !== false, profesor_id: ses ? ses.user.uid : null
    }).select("id").single();
    if (r.error) throw r.error; return r.data.id;
  }
  async function evaluacionesDeCurso(cursoId) { var r = await sb.from("evaluaciones").select("*").eq("curso_id", cursoId).order("creado_en", { ascending: true }); if (r.error) throw r.error; return r.data; }
  async function eliminarEvaluacion(id) { var r = await sb.from("evaluaciones").delete().eq("id", id); if (r.error) throw r.error; }
  async function preguntasDeEval(evalId) { var r = await sb.from("preguntas").select("*").eq("evaluacion_id", evalId).order("orden", { ascending: true }); if (r.error) throw r.error; return r.data; }
  async function crearPregunta(evalId, d) { var r = await sb.from("preguntas").insert({ evaluacion_id: evalId, enunciado: d.enunciado, tipo: d.tipo || "vf", opciones: d.opciones || null, correcta: d.correcta || 0, puntos: d.puntos || 1, orden: d.orden || 0 }).select("id").single(); if (r.error) throw r.error; return r.data.id; }
  async function eliminarPregunta(id) { var r = await sb.from("preguntas").delete().eq("id", id); if (r.error) throw r.error; }
  async function intentosDeEval(evalId) { var r = await sb.from("intentos").select("*").eq("evaluacion_id", evalId).not("enviado_en", "is", null).order("enviado_en", { ascending: false }); if (r.error) throw r.error; return r.data; }
  async function llamarEval(payload) {
    var s = await sb.auth.getSession(); var tok = s.data && s.data.session && s.data.session.access_token;
    var r = await fetch(window.SUPABASE_URL + "/functions/v1/evaluacion", { method: "POST", headers: { "Content-Type": "application/json", "apikey": window.SUPABASE_ANON_KEY, "Authorization": "Bearer " + tok }, body: JSON.stringify(payload) });
    var j = await r.json().catch(function () { return {}; }); if (!r.ok || j.error) throw new Error(j.error || "Error en la evaluación"); return j;
  }
  async function iniciarEvaluacion(evalId) { return llamarEval({ action: "start", evaluacion_id: evalId }); }
  async function enviarEvaluacion(intentoId, respuestas) { return llamarEval({ action: "submit", intento_id: intentoId, respuestas: respuestas }); }

  // ===== LMS Fase 3: certificados =====
  async function llamarCert(payload) {
    var s = await sb.auth.getSession(); var tok = s.data && s.data.session && s.data.session.access_token;
    var r = await fetch(window.SUPABASE_URL + "/functions/v1/certificado", { method: "POST", headers: { "Content-Type": "application/json", "apikey": window.SUPABASE_ANON_KEY, "Authorization": "Bearer " + tok }, body: JSON.stringify(payload) });
    var j = await r.json().catch(function () { return {}; }); if (!r.ok || j.error) throw new Error(j.error || "Error en el certificado"); return j;
  }
  async function estadoCertificado(cursoId) { return llamarCert({ action: "estado", curso_id: cursoId }); }
  async function emitirCertificado(cursoId) { return llamarCert({ action: "emitir", curso_id: cursoId }); }
  async function misCertificados() { var r = await sb.from("certificados").select("*").order("emitido_en", { ascending: false }); if (r.error) throw r.error; return r.data; }
  async function verificarCertificado(codigo) { var r = await sb.rpc("verificar_certificado", { cod: codigo }); if (r.error) throw r.error; return r.data; }

  // ===== LMS Fase 4: tareas / entregas / similitud =====
  async function crearTarea(d) { var ses = await sesion(); var r = await sb.from("tareas").insert({ curso_id: d.curso_id, titulo: d.titulo, descripcion: d.descripcion || null, fecha_limite: d.fecha_limite || null, profesor_id: ses ? ses.user.uid : null }).select("id").single(); if (r.error) throw r.error; return r.data.id; }
  async function tareasDeCurso(cursoId) { var r = await sb.from("tareas").select("*").eq("curso_id", cursoId).order("creado_en", { ascending: true }); if (r.error) throw r.error; return r.data; }
  async function tareaPorId(id) { var r = await sb.from("tareas").select("*").eq("id", id).maybeSingle(); if (r.error) throw r.error; return r.data; }
  async function eliminarTarea(id) { var r = await sb.from("tareas").delete().eq("id", id); if (r.error) throw r.error; }
  async function miEntrega(tareaId) { var ses = await sesion(); if (!ses) return null; var r = await sb.from("entregas").select("*").eq("tarea_id", tareaId).eq("alumno_id", ses.user.uid).maybeSingle(); if (r.error) throw r.error; return r.data; }
  async function entregarTarea(tareaId, d) {
    var ses = await sesion(); if (!ses) throw new Error("Sin sesión");
    var r = await sb.from("entregas").upsert({
      tarea_id: tareaId, alumno_id: ses.user.uid, alumno_nombre: (ses.perfil && ses.perfil.nombre) || ses.user.email,
      texto: d.texto || null, archivo_url: d.archivo_url || null, char_count: (d.texto || "").length,
      paste_events: d.paste_events || 0, pasted_ratio: d.pasted_ratio || 0
    }, { onConflict: "tarea_id,alumno_id" }).select("id").single();
    if (r.error) throw r.error; return r.data.id;
  }
  async function entregasDeTarea(tareaId) { var r = await sb.from("entregas").select("*").eq("tarea_id", tareaId).order("creado_en", { ascending: true }); if (r.error) throw r.error; return r.data; }
  async function calificarEntrega(id, nota, comentario) { var r = await sb.from("entregas").update({ nota: nota, comentario: comentario || null, calificado_en: new Date().toISOString() }).eq("id", id); if (r.error) throw r.error; }
  async function similitudTarea(tareaId) { var r = await sb.rpc("similitud_entregas", { t: tareaId }); if (r.error) throw r.error; return r.data; }

  // ===== LMS Fase 5: analitica =====
  async function resumenCurso(cid) { var r = await sb.rpc("resumen_curso", { cid: cid }); if (r.error) throw r.error; return r.data && r.data[0]; }
  async function progresoCurso(cid) { var r = await sb.rpc("progreso_curso", { cid: cid }); if (r.error) throw r.error; return r.data; }

  function mostrarFaltaConfig() {
    document.addEventListener("DOMContentLoaded", function () {
      var d = document.createElement("div");
      d.style.cssText = "max-width:560px;margin:12vh auto;padding:28px;font-family:'DM Sans',sans-serif;background:#fff;border:1px solid #f3c9c9;border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,.08);color:#062820";
      d.innerHTML = "<h2 style='color:#d93838;margin-bottom:10px'>⚠️ Falta configurar Supabase</h2>" +
        "<p style='line-height:1.6;color:#2a5248'>Edita <code>assets/supabase-config.js</code> con la URL y la anon key de tu proyecto Supabase. Los pasos están en el <b>README.md</b>.</p>" +
        "<p style='margin-top:14px'><a href='index.html' style='color:#0f6e56'>← Volver al inicio</a></p>";
      document.body.innerHTML = ""; document.body.appendChild(d);
    });
  }

  window.FV = {
    configOk: configOk, panelDe: panelDe, esc: esc, requireRole: requireRole, redirigirSiSesion: redirigirSiSesion,
    login: login, registrarAlumno: registrarAlumno, crearProfesor: crearProfesor, logout: logout,
    listarUsuarios: listarUsuarios, crearClase: crearClase, salaCodigo: salaCodigo,
    clasesDeProfesor: clasesDeProfesor, todasLasClases: todasLasClases, eliminarClase: eliminarClase,
    sesion: sesion, guardarResultado: guardarResultado, todosResultados: todosResultados, misResultados: misResultados,
    resetPassword: resetPassword, actualizarPassword: actualizarPassword,
    registrarEntrada: registrarEntrada, latido: latido, registrarSalida: registrarSalida, asistenciaDeSala: asistenciaDeSala,
    subirMaterial: subirMaterial, materialesDeClase: materialesDeClase, eliminarMaterial: eliminarMaterial,
    foroMensajes: foroMensajes, publicarForo: publicarForo, eliminarForoMsg: eliminarForoMsg, eliminarUsuario: eliminarUsuario,
    crearCurso: crearCurso, actualizarCurso: actualizarCurso, eliminarCurso: eliminarCurso, todosCursos: todosCursos,
    cursosDeProfesor: cursosDeProfesor, cursosMatriculado: cursosMatriculado,
    modulosDeCurso: modulosDeCurso, crearModulo: crearModulo, eliminarModulo: eliminarModulo,
    leccionesDeModulo: leccionesDeModulo, crearLeccion: crearLeccion, eliminarLeccion: eliminarLeccion,
    matricular: matricular, desmatricular: desmatricular, matriculasDeCurso: matriculasDeCurso, registrarEvento: registrarEvento,
    crearEvaluacion: crearEvaluacion, evaluacionesDeCurso: evaluacionesDeCurso, eliminarEvaluacion: eliminarEvaluacion,
    preguntasDeEval: preguntasDeEval, crearPregunta: crearPregunta, eliminarPregunta: eliminarPregunta,
    intentosDeEval: intentosDeEval, iniciarEvaluacion: iniciarEvaluacion, enviarEvaluacion: enviarEvaluacion,
    estadoCertificado: estadoCertificado, emitirCertificado: emitirCertificado, misCertificados: misCertificados, verificarCertificado: verificarCertificado,
    crearTarea: crearTarea, tareasDeCurso: tareasDeCurso, tareaPorId: tareaPorId, eliminarTarea: eliminarTarea,
    miEntrega: miEntrega, entregarTarea: entregarTarea, entregasDeTarea: entregasDeTarea, calificarEntrega: calificarEntrega, similitudTarea: similitudTarea,
    resumenCurso: resumenCurso, progresoCurso: progresoCurso,
    get sb() { return sb; }
  };
})();
