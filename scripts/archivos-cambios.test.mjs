import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { LIMITE, validarArchivo, claveArchivo, tamanoLegible, formatoArchivo } = createRequire(import.meta.url)('../assets/archivos-cambios.js');
test('acepta formatos conocidos, desconocidos, ejecutables y nombres sin extension', () => {
  for (const name of ['documento.pdf','comprimido.zip','video.mp4','programa.exe','datos.formato_nuevo','.config','sin-extension','diseño.svg']) {
    assert.equal(validarArchivo({ name, size: 1, type: '' }), '', name);
  }
});
test('el limite es por archivo y se valida antes de subir', () => {
  assert.equal(validarArchivo({ size: LIMITE }), '');
  assert.match(validarArchivo({ size: LIMITE + 1 }), /15 MB/);
  assert.match(validarArchivo({ size: 0 }), /vacío/);
  assert.match(validarArchivo({ size: NaN }), /leer/);
});
test('seleccionar lo mismo dos veces no duplica la cola y permite versiones diferentes', () => {
  const archivo = { name: 'datos.zip', size: 123, lastModified: 456 };
  assert.equal(claveArchivo(archivo), claveArchivo({ ...archivo }));
  assert.notEqual(claveArchivo(archivo), claveArchivo({ ...archivo, size: 124 }));
  assert.notEqual(claveArchivo(archivo), claveArchivo({ ...archivo, lastModified: 457 }));
});
test('muestra tamanos pequeños y formatos sin inventar una extension', () => {
  assert.equal(tamanoLegible(1), '1 B');
  assert.equal(tamanoLegible(1024), '1 KB');
  assert.equal(tamanoLegible(LIMITE), '15 MB');
  assert.equal(formatoArchivo('sin-extension'), 'ARCHIVO');
  assert.equal(formatoArchivo('.env'), 'ARCHIVO');
  assert.equal(formatoArchivo('archivo.tar.gz'), 'GZ');
});
