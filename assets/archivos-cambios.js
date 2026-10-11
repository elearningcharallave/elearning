/* Reglas comunes de la cola: el formato nunca es una restriccion. */
(function (global) {
  'use strict';
  const LIMITE = 15 * 1024 * 1024;
  function validarArchivo(archivo) {
    if (!archivo || !Number.isSafeInteger(archivo.size) || archivo.size < 0) return 'No se pudo leer este archivo.';
    if (!archivo.size) return 'El archivo está vacío.';
    if (archivo.size > LIMITE) return 'Supera el límite de 15 MB por archivo.';
    return '';
  }
  function claveArchivo(archivo) { return JSON.stringify([archivo.name, archivo.size, archivo.lastModified || 0]); }
  function tamanoLegible(bytes) {
    if (bytes < 1024) return bytes + ' B';
    const unidad = bytes < 1024 * 1024 ? 'KB' : 'MB';
    return new Intl.NumberFormat('es-VE', { maximumFractionDigits: 1 }).format(bytes / (unidad === 'KB' ? 1024 : 1024 * 1024)) + ' ' + unidad;
  }
  function formatoArchivo(nombre) {
    const punto = String(nombre).lastIndexOf('.');
    return punto > 0 && punto < nombre.length - 1 ? nombre.slice(punto + 1).toUpperCase().slice(0, 16) : 'ARCHIVO';
  }
  const reglas = { LIMITE, validarArchivo, claveArchivo, tamanoLegible, formatoArchivo };
  global.FCArchivos = reglas;
  if (typeof module !== 'undefined') module.exports = reglas;
})(typeof window === 'undefined' ? globalThis : window);
