# FUNCECAIND — Aula Virtual / Teleformación

Plataforma web de **FUNCECAIND** (Fundación para la Planificación y Desarrollo de Centros
de Capacitación Industrial · Charallave, Miranda) para **dictar clases en línea** y formar
en ofimática y áreas técnicas: Word, Excel, Seguridad Industrial, Electricidad, Informática.

Sitio **estático** (HTML/CSS/JS) + **Supabase** (Postgres + Auth + RLS, plan gratis) para las
cuentas y los roles, y **Jitsi Meet** para la videollamada de cada clase. Se publica en
GitHub Pages, Netlify o Cloudflare Pages sin servidor propio.

## ¿Qué hace?

Tres roles, todos entran por `login.html`:

| Rol | Qué puede hacer | Cómo se crea |
|---|---|---|
| 👑 **Administrador** | Crear cuentas de **profesores**, ver todos los usuarios y clases | El correo `ADMIN_EMAIL` se vuelve admin al registrarse |
| 👩‍🏫 **Profesor** | Crear sus clases y **dictarlas en vivo** (entra como moderador), compartir el enlace de alumno | Lo crea el **administrador** |
| 🎓 **Alumno** | Registrarse solo, ver las clases y **entrar a la clase en vivo**, hacer las pruebas | Se **registra él mismo** en `login.html` |

La clase en vivo (`aula.html`) usa **Jitsi**: video, audio, **compartir pantalla**, chat,
levantar la mano, lista de asistentes, y para el profesor: **silenciar a todos**, expulsar,
contraseña de sala y grabación.

## Estructura

```
Elearning/
├── index.html              Landing (catálogo + pruebas + nosotros + contacto)
├── login.html              Iniciar sesión / registro de alumno
├── admin.html              Panel admin: crear profesores + usuarios
├── profesor.html           Panel profesor: crear clases + dictar en vivo
├── alumno.html             Panel alumno: clases disponibles + pruebas
├── aula.html               Sala de clase en vivo (Jitsi)
├── assets/
│   ├── styles.css          Estilos compartidos
│   ├── supabase-config.js  ⚙️ TU URL + anon key de Supabase (a completar)
│   └── app.js              Núcleo: login, roles, crear profesores, clases
├── supabase-setup.sql      Tablas + RLS + trigger (ejecutar una vez en Supabase)
├── pruebas/                Pruebas de acceso (alumno/docente) + tests Word/Excel
├── docs/                   Diagrama de la plataforma
└── README.md
```

---

# 🔧 Puesta en marcha (paso a paso)

> Proyecto Supabase **propio y nuevo**. Todo lo de abajo es gratis (plan Free de Supabase).

## PASO 1 — Crear el proyecto Supabase

1. Entra a **https://supabase.com/dashboard** e inicia sesión.
2. **New project** → nombre (ej. `funcecaind-aula`), pon una **contraseña de base de datos**
   (guárdala) y elige la región más cercana → **Create new project**. Espera ~2 min.

## PASO 2 — Copiar URL + anon key

1. En el proyecto → **Settings (⚙️) → API**.
2. Copia **Project URL** y la key **`anon` `public`** y pégalas en **`assets/supabase-config.js`**:

```js
window.SUPABASE_URL      = "https://abcdxyz.supabase.co";
window.SUPABASE_ANON_KEY = "eyJhbGciOi...";          // anon / public (es pública, va en el front)
window.ADMIN_EMAIL       = "tucorreo-admin@gmail.com"; // 👈 tu correo de administrador
```

> La key `anon` es **pública** por diseño (la protege RLS). **Nunca** pongas aquí la
> `service_role` ni la contraseña de la base de datos.

## PASO 3 — Crear tablas, trigger y políticas (SQL)

1. Menú → **SQL Editor → New query**.
2. Pega **todo** el contenido de `supabase-setup.sql` y, antes de correr, cambia el correo de
   la función `handle_new_user()` por **el mismo** de `ADMIN_EMAIL`. → **Run**.

## PASO 4 — Auth: permitir entrar sin confirmar correo

Para que las cuentas funcionen al instante (y que el admin pueda crear profesores):

1. Menú → **Authentication → Sign In / Providers → Email**.
2. **Desactiva** “Confirm email” (Confirmar correo) → Save.
   *(Si lo dejas activado, cada usuario tendría que confirmar por correo antes de entrar.)*

## PASO 5 — Crear el administrador y los profesores

1. Abre la plataforma (ver “Probar localmente” o ya publicada).
2. En `login.html` → pestaña **“Soy alumno nuevo”** → regístrate con **el correo admin**.
   Como ese correo es el `ADMIN_EMAIL`, el trigger te asigna el rol **administrador**.
3. En el panel admin → **Crear cuenta de profesor** (nombre, correo, contraseña).
4. El **profesor** inicia sesión, crea una clase y pulsa **▶ Dictar**.
5. Los **alumnos** se registran solos y pulsan **Entrar**, o usan el **🔗 Link alumno** del profesor.

---

## Probar localmente

Sirve la carpeta por HTTP (no abras con `file://`):

```bash
python -m http.server 8080      # o:  npx serve .
```

Abre **http://localhost:8080**. Supabase acepta peticiones desde cualquier origen con la
anon key, así que `localhost` funciona sin configuración extra.

---

# 🚀 Subir el proyecto a GitHub (paso a paso)

> Requiere [Git](https://git-scm.com) instalado y una cuenta de GitHub.

### Si el repositorio aún NO existe

```bash
cd Elearning
git init -b main
git add .
git commit -m "FUNCECAIND: aula virtual con roles y clases en vivo"
git remote add origin https://github.com/TU_USUARIO/funcecaind-aula.git
git push -u origin main
```

GitHub pedirá tu usuario y un **token** (Settings → Developer settings → Personal access
tokens → *Generate new token (classic)* con permiso `repo`). Úsalo como contraseña.

### Si el repositorio YA existe (solo subir cambios)

```bash
cd Elearning
git add .
git commit -m "Actualizo aula virtual"
git push
```

### Publicar gratis con GitHub Pages

1. Repo en GitHub → **Settings → Pages**.
2. **Source:** *Deploy from a branch* → rama **`main`**, carpeta **`/ (root)`** → Save.
3. Queda en `https://TU_USUARIO.github.io/funcecaind-aula/`.
   *(Pages sobre repo privado requiere plan de pago; si el repo es privado, usa Cloudflare Pages o Netlify, que sí publican repos privados gratis.)*

---

## Pruebas de acceso y EmailJS (opcional)

Las pruebas de **alumno** y **docente** (`pruebas/`) pueden enviar el resultado por correo
con [EmailJS](https://www.emailjs.com) (gratis). Configura tus claves dentro de cada archivo:

```js
const EMAILJS_PUBLIC_KEY  = 'TU_PUBLIC_KEY';
const EMAILJS_SERVICE_ID  = 'TU_SERVICE_ID';
const EMAILJS_TEMPLATE_ID = 'TU_TEMPLATE_ID';
```

Plantilla con variables `{{from_name}}`, `{{message}}`, `{{reply_to}}`. Los tests de **Word**
y **Excel** se evalúan en el navegador (no necesitan correo).

## Notas y límites honestos

- **Seguridad:** la anon key es pública (va en el navegador); la protección real está en las
  **políticas RLS** (`supabase-setup.sql`). Nadie puede crear profesores ni promoverse a admin
  salvo el correo administrador.
- **Clases en vivo (servidor gratis `meet.jit.si`):** el profesor es moderador **si entra
  primero** a la sala. Para moderación 100% garantizada haría falta un Jitsi propio (con
  servidor). Recomendado hasta ~50 participantes.
- Las cifras del catálogo del landing son ilustrativas; los datos de contacto de FUNCECAIND
  (dirección, teléfonos, horario, redes) son reales.
