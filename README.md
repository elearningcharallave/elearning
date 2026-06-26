# FUNCECAIND — Aula Virtual / Teleformación

Plataforma web de **FUNCECAIND** (Fundación para la Planificación y Desarrollo de Centros
de Capacitación Industrial · Charallave, Miranda) para **dictar clases en línea** y formar
en ofimática y áreas técnicas: Word, Excel, Seguridad Industrial, Electricidad, Informática.

Sitio **estático** (HTML/CSS/JS) + **Firebase** (Auth + Firestore, plan gratis) para las
cuentas y **Jitsi Meet** para la videollamada de cada clase. Se publica en GitHub Pages,
Netlify o Cloudflare Pages sin servidor propio.

## ¿Qué hace?

Tres roles, todos entran por `login.html`:

| Rol | Qué puede hacer | Cómo se crea |
|---|---|---|
| 👑 **Administrador** | Crear cuentas de **profesores**, ver todos los usuarios y clases | El correo `ADMIN_EMAIL` se vuelve admin al iniciar sesión |
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
│   ├── firebase-config.js  ⚙️ TU configuración de Firebase (a completar)
│   └── app.js              Núcleo: login, roles, crear profesores, clases
├── firestore.rules         Reglas de seguridad (pegar en Firebase)
├── pruebas/                Pruebas de acceso (alumno/docente) + tests Word/Excel
├── docs/                   Diagrama de la plataforma
└── README.md
```

---

# 🔧 Puesta en marcha (paso a paso)

> Usa un **correo NUEVO** para este proyecto. **No** uses la cuenta Firebase de otros
> proyectos. Todo lo de abajo es gratis (plan Spark de Firebase).

## PASO 1 — Crear el proyecto Firebase

1. Entra a **https://console.firebase.google.com** e inicia sesión con tu correo nuevo.
2. **Agregar proyecto** → nombre, ej. `funcecaind-aula` → continuar (puedes desactivar Analytics) → **Crear**.

## PASO 2 — Registrar la app web y copiar la config

1. En el proyecto, pulsa el ícono **`</>`** (Web) → ponle un apodo (ej. `aula`) → **Registrar app**.
2. Firebase te muestra un bloque `const firebaseConfig = { ... }`. **Copia esos valores.**
3. Pégalos en **`assets/firebase-config.js`** reemplazando los `TU_...`:

```js
window.FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "funcecaind-aula.firebaseapp.com",
  projectId: "funcecaind-aula",
  storageBucket: "funcecaind-aula.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abc123"
};
window.ADMIN_EMAIL = "tucorreo-admin@gmail.com";  // 👈 tu correo de administrador
```

## PASO 3 — Activar Autenticación (correo y contraseña)

1. Menú izquierdo → **Compilación → Authentication → Comenzar**.
2. Pestaña **Sign-in method** → **Correo electrónico/contraseña** → **Habilitar** → Guardar.

## PASO 4 — Crear la base de datos Firestore + reglas

1. Menú → **Compilación → Firestore Database → Crear base de datos** → modo **producción** → elige región → Habilitar.
2. Pestaña **Reglas** → borra lo que haya y **pega todo el contenido de `firestore.rules`**.
3. En ese mismo texto, cambia el correo de la función `adminEmail()` por **el mismo** que pusiste en `ADMIN_EMAIL`. → **Publicar**.

## PASO 5 — Crear el administrador y los profesores

1. Abre la plataforma (ver “Probar localmente” abajo o ya publicada).
2. En `login.html` → pestaña **“Soy alumno nuevo”** → regístrate con **el correo admin** y una contraseña. Como ese correo es el `ADMIN_EMAIL`, entrarás como **administrador**.
3. En el panel admin → **Crear cuenta de profesor** (nombre, correo, contraseña). Pásale esos datos al profesor.
4. El **profesor** inicia sesión en `login.html`, crea una clase y pulsa **▶ Dictar**.
5. Los **alumnos** se registran solos y pulsan **Entrar** en la clase, o usan el **🔗 Link alumno** que comparte el profesor.

---

## Probar localmente

Firebase Auth **no funciona con `file://`** — hay que servir la carpeta por HTTP:

```bash
python -m http.server 8080      # o:  npx serve .
```

Abre **http://localhost:8080**. `localhost` ya está autorizado por Firebase por defecto.

---

# 🚀 Subir el proyecto a GitHub (paso a paso)

> Requiere [Git](https://git-scn.com) instalado y una cuenta de GitHub.

### Si el repositorio aún NO existe

1. En **https://github.com/new** crea un repo (ej. `funcecaind-aula`), **sin** README.
2. En la carpeta del proyecto:

```bash
cd Elearning
git init -b main
git add .
git commit -m "FUNCECAIND: aula virtual con roles y clases en vivo"
git remote add origin https://github.com/TU_USUARIO/funcecaind-aula.git
git push -u origin main
```

GitHub te pedirá tu usuario y un **token** (Settings → Developer settings → Personal access
tokens → *Generate new token (classic)* con permiso `repo`). Usa el token como contraseña.

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
3. En unos minutos queda en `https://TU_USUARIO.github.io/funcecaind-aula/`.
4. (Opcional) En Firebase → **Authentication → Settings → Dominios autorizados** → agrega
   `tu_usuario.github.io` para permitir el login desde la página publicada.

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

- **Seguridad:** la config de Firebase es pública (va en el navegador); la protección real
  está en `firestore.rules`. Nadie puede crear profesores ni promoverse a admin salvo el
  correo administrador.
- **Clases en vivo (servidor gratis `meet.jit.si`):** el profesor es moderador **si entra
  primero** a la sala. Para moderación 100% garantizada haría falta un Jitsi propio (con
  servidor) — fuera del alcance “gratis y sin backend”. Recomendado hasta ~50 participantes.
- Las cifras del catálogo del landing son ilustrativas; los datos de contacto de FUNCECAIND
  (dirección, teléfonos, horario, redes) son reales.
