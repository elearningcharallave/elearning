# 🌐 Cómo publicar la página en internet

El proyecto vive en GitHub (`elearningcharallave/elearning`). Para que tenga una **dirección pública** hay dos caminos. No se sube ninguna clave secreta: la llave privada de JaaS (`.jaas-key.pem`) y el token de Supabase (`.supabase-token`) están en `.gitignore` y **nunca** llegan a GitHub.

---

## Opción A — GitHub Pages (gratis, requiere repo **público**)

1. En GitHub, entra al repositorio → **Settings → General** → al final, **Change repository visibility** → **Public**.
   - Es seguro: en el repo solo hay claves *públicas* (la `anon key` de Supabase y el AppID de JaaS), que por diseño van en el navegador y están protegidas por las reglas de seguridad (RLS).
2. **Settings → Pages** → en **Source** elige **Deploy from a branch** → rama **`main`**, carpeta **`/ (root)`** → **Save**.
3. En 1–2 minutos queda publicada en:
   ```
   https://elearningcharallave.github.io/elearning/
   ```
4. **Importante:** en Supabase → **Authentication → URL Configuration**, agrega esa dirección a *Site URL* y a *Redirect URLs* (`https://elearningcharallave.github.io/**`) para que el inicio de sesión y el “recuperar contraseña” funcionen desde el sitio publicado.

---

## Opción B — Cloudflare Pages o Netlify (gratis, repo **privado**)

GitHub Pages sobre un repo privado requiere plan de pago. Si quieres mantener el repo **privado**, publícalo gratis así:

1. Entra a **Cloudflare Pages** (`pages.cloudflare.com`) o **Netlify** (`netlify.com`) y crea una cuenta.
2. **Conectar con GitHub** → autoriza el repositorio `elearningcharallave/elearning`.
3. Configuración de build:
   - Framework preset: **None**
   - Build command: *(vacío)*
   - Output directory: **/** (la raíz; no hay build, es estático)
4. **Deploy** → te dan una URL pública (ej. `funcecaind.pages.dev`).
5. Agrega esa URL en Supabase → **Authentication → URL Configuration** (igual que en la Opción A).

---

## Subir cambios después de publicar

Cada vez que cambies algo, desde la carpeta del proyecto:

```bash
git add .
git commit -m "describe el cambio"
git push
```

El sitio publicado (Pages / Cloudflare / Netlify) se **actualiza solo** en uno o dos minutos.

---

## Recordatorio de seguridad

- Cambia o borra las **cuentas de prueba** (`admin@admin.com`, `profe1/2@test.com`, `alumno1/2/3@test.com`) antes del uso real.
- Como el **token de Supabase** y la **llave JaaS** pasaron por el chat de configuración, lo ideal es **rotarlos**: genera un token nuevo en Supabase y una API key nueva en JaaS cuando termines las pruebas.
