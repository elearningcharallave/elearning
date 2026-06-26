# FUNCECAIND — Plataforma de Teleformación

Sitio web de **FUNCECAIND**, formación en línea (teleformación) en **ofimática** y **áreas
técnicas** para Venezuela: Word, Excel, Seguridad Industrial, Electricidad, Informática.

Es un sitio **estático** (HTML/CSS/JS, sin backend) listo para publicar en GitHub Pages,
Netlify, Cloudflare Pages o cualquier hosting estático.

## Estructura

```
Elearning/
├── index.html                  Landing principal (catálogo + pruebas + equipo)
├── pruebas/
│   ├── acceso-alumno.html      Prueba de competencias digitales — Alumno (15 V/F)
│   ├── acceso-docente.html     Prueba de conocimientos básicos — Docente
│   ├── test-word.html          Test de Microsoft Word básico
│   └── test-excel.html         Test de Microsoft Excel
├── docs/
│   └── flowchart-plataforma.svg   Diagrama de la plataforma (referencia)
└── README.md
```

## Cómo verlo localmente

Abre `index.html` en el navegador, o sirve la carpeta:

```bash
# Python
python -m http.server 8080
# o Node
npx serve .
```

Luego entra a http://localhost:8080

## Pruebas de acceso y EmailJS

Las pruebas de **alumno** y **docente** envían el resultado por correo usando
[EmailJS](https://www.emailjs.com) (gratis). Para que funcione el envío hay que
configurar tus claves dentro de cada archivo de prueba:

```js
const EMAILJS_PUBLIC_KEY  = 'TU_PUBLIC_KEY';   // Perfil > API Keys
const EMAILJS_SERVICE_ID  = 'TU_SERVICE_ID';   // Email Services
const EMAILJS_TEMPLATE_ID = 'TU_TEMPLATE_ID';  // Email Templates
```

La plantilla de EmailJS debe usar las variables `{{from_name}}`, `{{message}}`, `{{reply_to}}`.
El correo destino actual está fijado en el código (`to_email`) — cámbialo por el del
administrador del curso. Mientras no se configure EmailJS, la prueba muestra el formulario
pero el envío fallará con un aviso.

> Los tests de **Word** y **Excel** se evalúan en el propio navegador (no requieren correo).

## Publicar en GitHub Pages

1. Sube el repo a GitHub (ya hecho).
2. En el repo → **Settings → Pages** → Source: `Deploy from a branch` → rama `main`, carpeta `/ (root)`.
3. En unos minutos queda en `https://<usuario>.github.io/Elearning/`.

## Notas

- Diseño y contenido son un **prototipo/MVP** estático. Las cifras del catálogo (horas,
  estadísticas) son ilustrativas — ajústalas a tu oferta real.
- Para una plataforma completa con usuarios, cursos y certificados, el proyecto original
  contempla **Moodle** alojado en un servidor cloud (ver los documentos de planificación).
