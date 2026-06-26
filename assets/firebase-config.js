/* ============================================================================
   CONFIGURA AQUÍ TU PROYECTO FIREBASE  (ver pasos en el README)
   Firebase Console → ⚙️ Configuración del proyecto → "Tus apps" → Web → Config.
   Pega los valores reales. Estos son de cliente (públicos): la seguridad real
   vive en las Reglas de Firestore (firestore.rules), no aquí.
   ============================================================================ */
window.FIREBASE_CONFIG = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};

/* Correo del ADMINISTRADOR principal. La primera vez que esta cuenta inicia
   sesión, se le asigna automáticamente el rol "admin". Cámbialo por el tuyo. */
window.ADMIN_EMAIL = "admin@funcecaind.edu.ve";
