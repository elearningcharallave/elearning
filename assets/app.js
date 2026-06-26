/* ============================================================================
   FUNCECAIND — núcleo de autenticación y datos (Firebase compat)
   Requiere cargar antes:  firebase-app/auth/firestore-compat.js + firebase-config.js
   Expone el objeto global  FV  con todo lo que usan las páginas.
   ============================================================================ */
(function () {
  "use strict";

  // ¿La config sigue con los placeholders?  → la app avisa y no rompe.
  function configOk() {
    var c = window.FIREBASE_CONFIG || {};
    return c.apiKey && c.apiKey.indexOf("TU_") !== 0 && c.projectId && c.projectId.indexOf("TU_") !== 0;
  }

  var auth, db;
  if (configOk()) {
    if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
    auth = firebase.auth();
    db = firebase.firestore();
  }

  function panelDe(rol) {
    return rol === "admin" ? "admin.html" : rol === "profesor" ? "profesor.html" : "alumno.html";
  }

  // Crea el doc del usuario si no existe. El correo ADMIN_EMAIL → rol admin.
  async function ensureUserDoc(user) {
    var ref = db.collection("usuarios").doc(user.uid);
    var snap = await ref.get();
    if (snap.exists) return snap.data();
    var esAdmin = (user.email || "").toLowerCase() === (window.ADMIN_EMAIL || "").toLowerCase();
    var data = {
      nombre: user.displayName || (user.email || "").split("@")[0],
      email: user.email,
      rol: esAdmin ? "admin" : "alumno",
      creadoEn: firebase.firestore.FieldValue.serverTimestamp()
    };
    await ref.set(data);
    return data;
  }

  // Guard de página: exige sesión + rol permitido. Si no, redirige.
  function requireRole(roles, cb) {
    if (!configOk()) { mostrarFaltaConfig(); return; }
    roles = Array.isArray(roles) ? roles : [roles];
    auth.onAuthStateChanged(async function (user) {
      if (!user) { location.href = "login.html"; return; }
      try {
        var doc = await ensureUserDoc(user);
        if (roles.indexOf(doc.rol) === -1) { location.href = panelDe(doc.rol); return; }
        cb(user, doc);
      } catch (e) { console.error(e); alert("Error cargando tu perfil: " + e.message); }
    });
  }

  async function login(email, pass) {
    var cred = await auth.signInWithEmailAndPassword(email, pass);
    return await ensureUserDoc(cred.user);
  }

  async function registrarAlumno(nombre, email, pass) {
    var cred = await auth.createUserWithEmailAndPassword(email, pass);
    await cred.user.updateProfile({ displayName: nombre });
    var esAdmin = (email || "").toLowerCase() === (window.ADMIN_EMAIL || "").toLowerCase();
    await db.collection("usuarios").doc(cred.user.uid).set({
      nombre: nombre, email: email, rol: esAdmin ? "admin" : "alumno",
      creadoEn: firebase.firestore.FieldValue.serverTimestamp()
    });
    return esAdmin ? "admin" : "alumno";
  }

  // El ADMIN crea una cuenta de PROFESOR sin perder su propia sesión.
  // Truco: usar una app Firebase secundaria para el createUser.
  async function crearProfesor(nombre, email, pass) {
    var sec = firebase.apps.find(function (a) { return a.name === "secundaria"; })
      || firebase.initializeApp(window.FIREBASE_CONFIG, "secundaria");
    try {
      var cred = await sec.auth().createUserWithEmailAndPassword(email, pass);
      await db.collection("usuarios").doc(cred.user.uid).set({
        nombre: nombre, email: email, rol: "profesor",
        creadoEn: firebase.firestore.FieldValue.serverTimestamp()
      });
      await sec.auth().signOut();
      return cred.user.uid;
    } catch (e) { try { await sec.auth().signOut(); } catch (_) {} throw e; }
  }

  function logout() { if (auth) auth.signOut().finally(function () { location.href = "login.html"; }); }

  // --- Datos ---
  async function listarUsuarios() {
    var qs = await db.collection("usuarios").orderBy("creadoEn", "desc").get();
    return qs.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
  }
  function salaCodigo(titulo) {
    var base = (titulo || "clase").toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "").slice(0, 18);
    return "funcecaind-" + (base || "clase") + "-" + Math.random().toString(36).slice(2, 7);
  }
  async function crearClase(data) {
    var ref = await db.collection("clases").add(Object.assign({
      creadoEn: firebase.firestore.FieldValue.serverTimestamp()
    }, data));
    return ref.id;
  }
  async function clasesDeProfesor(uid) {
    var qs = await db.collection("clases").where("profesorId", "==", uid).get();
    return qs.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); })
      .sort(function (a, b) { return (b.creadoEn && b.creadoEn.seconds || 0) - (a.creadoEn && a.creadoEn.seconds || 0); });
  }
  async function todasLasClases() {
    var qs = await db.collection("clases").get();
    return qs.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); })
      .sort(function (a, b) { return (b.creadoEn && b.creadoEn.seconds || 0) - (a.creadoEn && a.creadoEn.seconds || 0); });
  }
  async function eliminarClase(id) { await db.collection("clases").doc(id).delete(); }

  // Aviso amable si falta configurar Firebase.
  function mostrarFaltaConfig() {
    document.addEventListener("DOMContentLoaded", function () {
      var d = document.createElement("div");
      d.style.cssText = "max-width:560px;margin:12vh auto;padding:28px;font-family:'DM Sans',sans-serif;background:#fff;border:1px solid #f3c9c9;border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,.08);color:#062820";
      d.innerHTML = "<h2 style='color:#d93838;margin-bottom:10px'>⚠️ Falta configurar Firebase</h2>" +
        "<p style='line-height:1.6;color:#2a5248'>Edita <code>assets/firebase-config.js</code> con los datos de tu proyecto Firebase para que el inicio de sesión y los paneles funcionen. Los pasos están en el <b>README.md</b>.</p>" +
        "<p style='margin-top:14px'><a href='index.html' style='color:#0f6e56'>← Volver al inicio</a></p>";
      document.body.innerHTML = ""; document.body.appendChild(d);
    });
  }

  window.FV = {
    configOk: configOk, panelDe: panelDe, requireRole: requireRole,
    login: login, registrarAlumno: registrarAlumno, crearProfesor: crearProfesor, logout: logout,
    listarUsuarios: listarUsuarios, crearClase: crearClase, salaCodigo: salaCodigo,
    clasesDeProfesor: clasesDeProfesor, todasLasClases: todasLasClases, eliminarClase: eliminarClase,
    get auth() { return auth; }, get db() { return db; }
  };
})();
