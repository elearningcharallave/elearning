/* ============================================================================
   FUNCECAIND — Motor de pruebas reutilizable
   Uso:
     TestEngine.run({ clave:'word', titulo:'...', icono:'📝', acento:'#1a7fc4',
                      preguntas:[ {tipo:'vf'|'mc', enunciado, opciones?, correcta, fb?} ] })
   Acepta TAMBIÉN el formato viejo (t/type:'tf'|'mc', q/text, a/correct, ops/options).
   Renderiza dentro de #app, da feedback inmediato y guarda el resultado en
   Supabase (tabla resultados) si hay sesión iniciada.
   ============================================================================ */
window.TestEngine = (function () {
  "use strict";
  var T, P, cur = 0, resp = [], nombre = "", ses = null, guardado = false, app;

  function esc(s) { return (s == null ? "" : "" + s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  // Normaliza ambos formatos de pregunta a {tipo, enun, ops, cor, fb}
  function norm(q) {
    var tipo = q.tipo || ((q.t === "tf" || q.type === "tf") ? "vf" : "mc");
    var enun = q.enunciado || q.q || q.text || "";
    var fb = q.fb || "";
    var ops, cor;
    if (tipo === "vf") {
      ops = ["Verdadero", "Falso"];
      cor = (typeof q.correcta === "number") ? q.correcta
          : (typeof q.a === "number") ? q.a
          : (q.correct === true ? 0 : 1);
    } else {
      ops = q.opciones || q.ops || q.options || [];
      cor = (typeof q.correcta === "number") ? q.correcta
          : (typeof q.a === "number") ? q.a : q.correct;
    }
    return { tipo: tipo, enun: enun, ops: ops, cor: cor, fb: fb };
  }

  function injectCSS() {
    if (document.getElementById("te-css")) return;
    var s = document.createElement("style"); s.id = "te-css";
    s.textContent =
      ".te-wrap{max-width:680px;margin:0 auto;padding:28px 20px 60px}" +
      ".te-prog{height:6px;background:var(--teal-50);border-radius:100px;overflow:hidden;margin-bottom:18px}" +
      ".te-prog>i{display:block;height:100%;background:var(--acento,#1a7fc4);border-radius:100px;transition:width .35s}" +
      ".te-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:18px}" +
      ".te-stat{background:#fff;border:1px solid var(--border);border-radius:12px;padding:10px 6px;text-align:center}" +
      ".te-stat b{display:block;font-family:'Fraunces',serif;font-size:1.3rem}" +
      ".te-stat span{font-size:.72rem;color:var(--text-light)}" +
      ".te-badge{display:inline-block;font-size:.72rem;font-weight:600;padding:3px 10px;border-radius:100px;margin-bottom:12px}" +
      ".te-q{font-size:1.05rem;line-height:1.6;color:var(--text-dark);margin-bottom:16px;font-weight:500}" +
      ".te-opt{display:block;width:100%;text-align:left;padding:12px 16px;margin-bottom:9px;border:1.5px solid var(--border);border-radius:12px;background:#fff;font:inherit;font-size:.95rem;color:var(--text-dark);cursor:pointer;transition:.15s}" +
      ".te-opt:hover:not(:disabled){border-color:var(--teal-300);background:var(--teal-50)}" +
      ".te-opt:disabled{cursor:default}" +
      ".te-opt.ok{background:#eaf6ef;border-color:var(--teal-500);color:var(--teal-700);font-weight:600}" +
      ".te-opt.no{background:#fdecec;border-color:var(--red);color:var(--red)}" +
      ".te-fb{font-size:.86rem;line-height:1.5;padding:10px 14px;border-radius:10px;margin-top:10px}" +
      ".te-fb.ok{background:#eaf6ef;color:var(--teal-700)}" +
      ".te-fb.no{background:#fdecec;color:var(--red)}" +
      ".te-nav{display:flex;gap:10px;align-items:center;margin-top:16px}" +
      ".te-score{font-family:'Fraunces',serif;font-size:3.4rem;line-height:1;color:var(--acento,#1a7fc4)}";
    document.head.appendChild(s);
  }

  async function run(cfg) {
    T = cfg; P = (cfg.preguntas || []).map(norm); resp = new Array(P.length).fill(null);
    cur = 0; guardado = false;
    document.documentElement.style.setProperty("--acento", cfg.acento || "#1a7fc4");
    injectCSS();
    app = document.getElementById("app");
    try { ses = (window.FV && FV.configOk()) ? await FV.sesion() : null; } catch (e) { ses = null; }
    inicio();
  }

  function inicio() {
    var log = ses && ses.perfil;
    app.innerHTML =
      '<div class="card" style="text-align:center;max-width:440px;margin:6vh auto">' +
      '<div style="font-size:2.6rem">' + (T.icono || "📝") + "</div>" +
      '<h1 style="font-family:Fraunces,serif;font-size:1.5rem;margin:8px 0 4px">' + esc(T.titulo) + "</h1>" +
      '<p style="color:var(--text-light);font-size:.9rem;margin-bottom:18px">' + P.length + " preguntas · una por pantalla · resultado al instante</p>" +
      (log
        ? '<div class="msg ok" style="display:block">Hola, ' + esc(ses.perfil.nombre) + ". Tu resultado se guardará en tu perfil.</div>"
        : '<div class="field" style="text-align:left"><label>Tu nombre</label><input id="te-name" placeholder="Escribe tu nombre"></div>' +
          '<p style="font-size:.78rem;color:var(--text-light);margin-bottom:8px">💡 <a href="../login.html">Inicia sesión</a> para guardar tu resultado.</p>') +
      '<button class="btn btn-block" onclick="TestEngine._start()">Comenzar →</button>' +
      "</div>";
  }

  function _start() {
    if (!(ses && ses.perfil)) {
      var n = (document.getElementById("te-name").value || "").trim();
      if (!n) { document.getElementById("te-name").focus(); return; }
      nombre = n;
    } else nombre = ses.perfil.nombre;
    cur = 0; pregunta();
  }

  function stats() { var ok = 0, n = 0; resp.forEach(function (a, i) { if (a !== null) { n++; if (a === P[i].cor) ok++; } }); return { ok: ok, n: n, mal: n - ok }; }

  function pregunta() {
    var q = P[cur], ans = resp[cur], st = stats(), last = cur === P.length - 1;
    var badge = q.tipo === "vf"
      ? '<span class="te-badge" style="background:var(--blue-50);color:var(--blue-700)">Verdadero / Falso</span>'
      : '<span class="te-badge" style="background:var(--teal-50);color:var(--teal-700)">Selección múltiple</span>';
    var opts = q.ops.map(function (o, i) {
      var cls = "te-opt";
      if (ans !== null) { if (i === q.cor) cls += " ok"; else if (i === ans) cls += " no"; }
      return '<button class="' + cls + '" ' + (ans !== null ? "disabled" : "") + ' onclick="TestEngine._pick(' + i + ')">' +
        (q.tipo === "mc" ? "<b>" + "ABCDE"[i] + ".</b> " : "") + esc(o) + "</button>";
    }).join("");
    var fb = "";
    if (ans !== null) { var good = ans === q.cor; fb = '<div class="te-fb ' + (good ? "ok" : "no") + '">' + (good ? "✓ Correcto" : "✗ Incorrecto") + (q.fb ? (" — " + esc(q.fb)) : "") + "</div>"; }
    app.innerHTML =
      '<div class="te-wrap">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b style="font-family:Fraunces,serif">' + esc(T.titulo) + '</b><span style="font-size:.82rem;color:var(--text-light)">' + (cur + 1) + " / " + P.length + "</span></div>" +
      '<div class="te-prog"><i style="width:' + Math.round((cur + 1) / P.length * 100) + '%"></i></div>' +
      '<div class="te-stats">' +
        '<div class="te-stat"><b>' + st.n + "</b><span>respondidas</span></div>" +
        '<div class="te-stat"><b style="color:var(--teal-700)">' + st.ok + "</b><span>correctas</span></div>" +
        '<div class="te-stat"><b style="color:var(--red)">' + st.mal + "</b><span>incorrectas</span></div>" +
        '<div class="te-stat"><b>' + (st.n ? Math.round(st.ok / st.n * 100) : 0) + "%</b><span>acierto</span></div>" +
      "</div>" +
      '<div class="card">' + badge + '<div class="te-q">' + esc(q.enun) + "</div>" + opts + fb + "</div>" +
      '<div class="te-nav">' +
        (cur > 0 ? '<button class="btn btn-ghost btn-sm" onclick="TestEngine._go(-1)">← Anterior</button>' : "") +
        '<div style="flex:1"></div>' +
        (last ? '<button class="btn" onclick="TestEngine._fin()">Ver resultado →</button>' : '<button class="btn" onclick="TestEngine._go(1)">Siguiente →</button>') +
      "</div></div>";
  }

  function _pick(i) { if (resp[cur] !== null) return; resp[cur] = i; pregunta(); }
  function _go(d) { cur = Math.max(0, Math.min(P.length - 1, cur + d)); pregunta(); }
  function _fin() {
    var sinR = resp.filter(function (a) { return a === null; }).length;
    if (sinR > 0 && !confirm("Tienes " + sinR + " sin responder. ¿Ver el resultado igual?")) return;
    resultado();
  }

  async function resultado() {
    var st = stats(), total = P.length, ok = st.ok, pct = Math.round(ok / total * 100), sinR = total - st.n;
    var nivel = pct >= 90 ? "Excelente" : pct >= 70 ? "Muy bien" : pct >= 50 ? "Aprobado" : "A reforzar";
    var review = P.map(function (q, i) {
      var ua = resp[i], good = ua === q.cor;
      var ops = q.ops.map(function (o, j) {
        var c = "te-opt"; if (j === q.cor) c += " ok"; else if (j === ua && !good) c += " no";
        return '<button class="' + c + '" disabled style="padding:8px 12px;font-size:.85rem;margin-bottom:5px">' + esc(o) + "</button>";
      }).join("");
      return '<div class="card" style="margin-bottom:8px;border-color:' + (good ? "var(--teal-300)" : "#f3c9c9") + '">' +
        '<div style="font-size:.78rem;color:var(--text-light);margin-bottom:6px">' + (good ? "✓" : "✗") + " Pregunta " + (i + 1) + "</div>" +
        '<div style="font-size:.9rem;margin-bottom:8px">' + esc(q.enun) + "</div>" + ops + "</div>";
    }).join("");
    var box = (ses && ses.perfil)
      ? '<div class="msg ok" id="te-save" style="display:block">Guardando resultado…</div>'
      : '<div class="msg" style="display:block;background:var(--blue-50);color:var(--blue-700);border:1px solid var(--blue-500)">💡 <a href="../login.html">Inicia sesión</a> para guardar tu resultado en tu perfil.</div>';
    app.innerHTML =
      '<div class="te-wrap"><div class="card" style="text-align:center">' +
        '<div style="font-size:.85rem;color:var(--text-light)">Resultado de ' + esc(nombre) + "</div>" +
        '<div class="te-score">' + pct + "%</div>" +
        '<div style="font-weight:600;color:var(--text-dark);margin:4px 0 14px">' + nivel + "</div>" +
        '<div class="te-stats" style="grid-template-columns:repeat(3,1fr)">' +
          '<div class="te-stat"><b style="color:var(--teal-700)">' + ok + "</b><span>correctas</span></div>" +
          '<div class="te-stat"><b style="color:var(--red)">' + (st.n - ok) + "</b><span>incorrectas</span></div>" +
          '<div class="te-stat"><b>' + sinR + "</b><span>sin responder</span></div>" +
        "</div>" + box +
        '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:6px">' +
          (ses && ses.perfil ? '<a class="btn btn-sm" href="../alumno.html">Volver a mi panel</a>' : "") +
          '<button class="btn btn-ghost btn-sm" onclick="TestEngine._restart()">Repetir</button>' +
        "</div></div>" +
      '<h3 style="font-family:Fraunces,serif;margin:22px 0 12px">Revisión de respuestas</h3>' + review + "</div>";
    if (ses && ses.perfil && !guardado) {
      guardado = true;
      try {
        await FV.guardarResultado({ prueba: T.clave, puntaje: ok, total: total, porcentaje: pct });
        var b = document.getElementById("te-save"); if (b) b.textContent = "✓ Resultado guardado en tu perfil";
      } catch (e) {
        guardado = false;
        var b2 = document.getElementById("te-save");
        if (b2) { b2.className = "msg err"; b2.style.display = "block"; b2.textContent = "No se pudo guardar: " + (e.message || e); }
      }
    }
  }

  function _restart() { resp = new Array(P.length).fill(null); cur = 0; guardado = false; if (ses && ses.perfil) pregunta(); else inicio(); }

  return { run: run, _start: _start, _pick: _pick, _go: _go, _fin: _fin, _restart: _restart };
})();
