import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const input = "C:/Proyecto_Clínica_Veterinaria/.tmp/presentacion-tfu2/template-starter.pptx";
const output = "C:/Proyecto_Clínica_Veterinaria/Presentacion_TFU2_Pet-Core.pptx";
const qaDir = "C:/Proyecto_Clínica_Veterinaria/.tmp/presentacion-tfu2/final";

const p = await PresentationFile.importPptx(await FileBlob.load(input));

function shape(slide, name) {
  const found = slide.shapes.items.find((item) => item.name === name);
  if (!found) throw new Error(`No se encontró ${name}`);
  return found;
}

function text(slide, name, value, options = {}) {
  const target = shape(slide, name);
  target.text = value;
  if (options.fontSize || options.bold !== undefined || options.color || options.alignment) {
    target.text.style = {
      ...(options.fontSize ? { fontSize: options.fontSize } : {}),
      ...(options.bold !== undefined ? { bold: options.bold } : {}),
      ...(options.color ? { color: options.color } : {}),
      ...(options.alignment ? { alignment: options.alignment } : {}),
    };
  }
  if (options.position) target.position = { ...target.position, ...options.position };
}

function notes(slide, body) {
  slide.speakerNotes.textFrame.setText(`${body}\n\n[Sources]\n- Consigna TFU2 y documentación interna de Pet-Core.\n- Repositorio local: compose.yaml, nginx/andis.conf, README.md, scripts y código de la API.`);
  slide.speakerNotes.setVisible(true);
}

// 1. Portada
{
  const s = p.slides.items[0];
  text(s, "TextBox 9", "Tácticas de arquitectura", { fontSize: 56, position: { left: 154, top: 500, width: 900, height: 130 } });
  text(s, "TextBox 10", "Constanza Blanco · Manuel Cabrera\nDiego de Oliveira · Martin Mujica", { fontSize: 25, position: { top: 690, height: 100 } });
  text(s, "TextBox 11", "TFU2 · Análisis y Diseño de Aplicaciones II · Pet-Core", { fontSize: 21 });
  notes(s, "Tiempo sugerido: 30 segundos.\nPresentar al equipo y anticipar la idea central: demostrar cuatro tácticas sobre una API REST real, no solamente describirlas.");
}

// 2. Contexto
{
  const s = p.slides.items[1];
  text(s, "TextBox 7", "Pet-Core", { fontSize: 78 });
  text(s, "TextBox 8", "Gestión para una clínica veterinaria", { fontSize: 27 });
  text(s, "TextBox 11", "Dos procesos críticos", { fontSize: 30 });
  text(s, "TextBox 12", "Reserva de turnos\nHistorial clínico de mascotas", { fontSize: 25 });
  text(s, "TextBox 22", "Tres roles", { fontSize: 30 });
  text(s, "TextBox 23", "Cliente · Veterinario · Administrador\nCada rol ve y modifica información diferente.", { fontSize: 23 });
  notes(s, "Tiempo sugerido: 1 minuto.\nExplicar que la separación de roles es una decisión central: el cliente ve sus mascotas, el veterinario trabaja con información clínica y el administrador opera la agenda sin leer diagnósticos.");
}

// 3. Requerimientos y tácticas
{
  const s = p.slides.items[2];
  text(s, "TextBox 38", "De requerimientos a tácticas", { fontSize: 58 });
  text(s, "TextBox 9", "99,5 % disponible\nReserva de turnos 24/7\n→ Replicación", { fontSize: 24 });
  text(s, "TextBox 14", "99,9 % disponible\nAgenda e historial en horario clínico\n→ Replicación", { fontSize: 23 });
  text(s, "TextBox 34", "Recuperación < 2 min\nSin perder turnos ni historial\n→ Replicación + reintentos", { fontSize: 23 });
  text(s, "TextBox 19", "Acceso según rol\n→ Autenticar + autorizar", { fontSize: 22 });
  text(s, "TextBox 24", "Administrador sin contenido clínico\n→ Autorizar", { fontSize: 22 });
  text(s, "TextBox 39", "Combinación elegida\nDisponibilidad + seguridad", { fontSize: 22 });
  notes(s, "Tiempo sugerido: 1 minuto 30 segundos.\nAclarar que los ASR provienen del trabajo anterior. La combinación elegida es una de las permitidas: replicación y reintentos para disponibilidad, más autenticar y autorizar actores para resistir ataques.");
}

// 4. Arquitectura real
{
  const s = p.slides.items[3];
  text(s, "TextBox 14", "La arquitectura convierte las tácticas en comportamiento observable", { fontSize: 47 });
  text(s, "TextBox 7", "La demo corre en Docker Compose con dos réplicas de la misma API.", { fontSize: 28 });
  text(s, "TextBox 13", "1\nPostman", { fontSize: 30 });
  text(s, "TextBox 15", "2\nNginx\n:8000", { fontSize: 30 });
  text(s, "TextBox 16", "3\nFastAPI × 2", { fontSize: 30 });
  text(s, "TextBox 17", "4\nPostgreSQL", { fontSize: 30 });
  text(s, "TextBox 19", "Nginx reparte solicitudes y reintenta con otra réplica cuando una falla.", { fontSize: 24 });
  text(s, "TextBox 20", "Las dos APIs comparten una única base persistente y los mismos secretos.", { fontSize: 24 });
  notes(s, "Tiempo sugerido: 1 minuto 30 segundos.\nRecorrer el pedido de izquierda a derecha. Señalar que no existen dos bases: hay un solo PostgreSQL compartido. La demostración de replicación cubre la API; la base sigue siendo un punto único de falla y se reconoce como limitación.");
}

// 5. Cómo conviven
{
  const s = p.slides.items[4];
  text(s, "TextBox 13", "Las cuatro tácticas conviven en un mismo pedido", { fontSize: 49 });
  text(s, "TextBox 14", "GET /mascotas atraviesa seguridad y disponibilidad antes de responder.", { fontSize: 27 });
  text(s, "TextBox 11", "Seguridad", { fontSize: 30 });
  text(s, "TextBox 10", "Autenticar\n¿Quién sos?\n\nAutorizar\n¿Qué podés hacer?", { fontSize: 25 });
  text(s, "TextBox 12", "", { fontSize: 1 });
  text(s, "TextBox 14", "Recuperación", { fontSize: 30 });
  text(s, "TextBox 15", "Reintentos\nFalla transitoria de BD\n\nMáximo 3 intentos", { fontSize: 25 });
  text(s, "TextBox 16", "Continuidad", { fontSize: 30 });
  text(s, "TextBox 17", "Replicación\nUna API cae\n\nLa otra responde", { fontSize: 25 });
  notes(s, "Tiempo sugerido: 1 minuto 15 segundos.\nDiferenciar los conceptos: autenticación identifica; autorización verifica permisos; reintentos absorbe fallas breves; replicación mantiene el servicio si una instancia completa cae.");
}

// 6. Transición a las demos
{
  const s = p.slides.items[5];
  text(s, "TextBox 6", "Demostración en vivo", { fontSize: 70 });
  text(s, "TextBox 11", "1 · Autenticar actores", { fontSize: 27 });
  text(s, "TextBox 16", "2 · Autorizar actores", { fontSize: 27 });
  text(s, "TextBox 21", "3 · Replicación y reintentos", { fontSize: 25 });
  text(s, "TextBox 24", "Problema → táctica → evidencia observable", { fontSize: 28 });
  notes(s, "Tiempo sugerido: 15 segundos.\nAbrir Postman y la terminal. Las cuatro demostraciones deben ocupar aproximadamente 7 minutos en total. Mantener esta diapositiva como respaldo si la demo tarda en abrir.");
}

// 7. Autenticación
{
  const s = p.slides.items[6];
  text(s, "TextBox 7", "Autenticar", { fontSize: 72 });
  text(s, "TextBox 8", "Verificar la identidad antes de dar acceso", { fontSize: 26 });
  text(s, "TextBox 11", "Sin token", { fontSize: 30 });
  text(s, "TextBox 12", "GET /demo/instancia\n→ 401 Unauthorized", { fontSize: 26 });
  text(s, "TextBox 22", "Con identidad verificada", { fontSize: 30 });
  text(s, "TextBox 23", "POST /auth/login → JWT\nGET /demo/instancia → 200 OK", { fontSize: 25 });
  notes(s, "Tiempo sugerido de demo: 1 minuto 15 segundos.\nEn Postman abrir Seguridad_Collection y ejecutar las peticiones 1, 2 y 3. Mostrar que el mismo recurso primero rechaza la solicitud y luego la acepta al recibir Authorization: Bearer <token>.");
}

// 8. Autorización
{
  const s = p.slides.items[7];
  text(s, "TextBox 7", "Autorizar", { fontSize: 68, position: { left: 150, width: 700 } });
  text(s, "TextBox 8", "Decidir qué puede hacer cada identidad", { fontSize: 26 });
  text(s, "TextBox 11", "Token de CLIENTE", { fontSize: 30 });
  text(s, "TextBox 12", "GET /agenda\n→ 403 Forbidden", { fontSize: 26, position: { left: 1100, width: 650 } });
  text(s, "TextBox 22", "Token de VETERINARIO", { fontSize: 30 });
  text(s, "TextBox 23", "GET /agenda\n→ 200 OK", { fontSize: 26 });
  notes(s, "Tiempo sugerido de demo: 1 minuto 15 segundos.\nContinuar con las peticiones 4, 5 y 6 de Seguridad_Collection. Subrayar que 403 no significa identidad desconocida: el cliente fue autenticado, pero su rol no tiene permiso para consultar la agenda veterinaria.");
}

// 9. Replicación
{
  const s = p.slides.items[8];
  text(s, "TextBox 14", "Replicación: una instancia cae y el servicio continúa", { fontSize: 48 });
  text(s, "TextBox 7", "Dos contenedores ejecutan la misma API; Nginx distribuye los pedidos.", { fontSize: 27 });
  text(s, "TextBox 13", "1\nLogin", { fontSize: 30 });
  text(s, "TextBox 15", "2\nAlternan\nhostnames", { fontSize: 29 });
  text(s, "TextBox 16", "3\nDetener\nuna réplica", { fontSize: 29 });
  text(s, "TextBox 17", "4\nSigue\n200 OK", { fontSize: 29 });
  text(s, "TextBox 19", "Antes: dos identificadores demuestran balanceo round-robin.", { fontSize: 23 });
  text(s, "TextBox 20", "Después: queda un identificador y no se interrumpe el servicio.", { fontSize: 23 });
  notes(s, "Tiempo sugerido de demo: 2 minutos 15 segundos.\nUsar Replicacion_Collection. Ejecutar varias veces Identificar instancia y mostrar dos hostnames. En terminal detener server-1. Repetir la petición: debe seguir en 200 desde la réplica activa. Si aparece X-Upstream-Status: 502, 200, señalar que Nginx falló contra una réplica y reintentó con la otra.");
}

// 10. Reintentos
{
  const s = p.slides.items[9];
  text(s, "TextBox 14", "Reintentos: una falla transitoria no llega al usuario", { fontSize: 48 });
  text(s, "TextBox 7", "Se simulan dos fallas de conexión para observar el mecanismo de recuperación.", { fontSize: 27 });
  text(s, "TextBox 13", "1\nSimular 2 fallas", { fontSize: 29 });
  text(s, "TextBox 15", "2\nIntento 1\n+ 0,5 s", { fontSize: 28 });
  text(s, "TextBox 16", "3\nIntento 2\n+ 1 s", { fontSize: 28 });
  text(s, "TextBox 17", "4\nIntento 3\n200 OK", { fontSize: 28 });
  text(s, "TextBox 19", "Evidencia: intentos_usados = 3 y duración aproximada de 1,5 s.", { fontSize: 23 });
  text(s, "TextBox 20", "El límite evita ocultar una falla permanente o saturar la base.", { fontSize: 23 });
  notes(s, "Tiempo sugerido de demo: 2 minutos 15 segundos.\nDejar temporalmente una sola réplica porque la falla simulada vive en memoria. Usar Re-intentos_Collection: login, simular 2 fallas, GET /mascotas y consultar el último intento. Mostrar intentos_usados: 3, exitoso: true y la demora cercana a 1,5 segundos.");
}

// 11. Costos y límites
{
  const s = p.slides.items[10];
  text(s, "TextBox 38", "Costos y límites", { fontSize: 58 });
  text(s, "TextBox 9", "Replicación\nMás recursos activos\ny coordinación", { fontSize: 24 });
  text(s, "TextBox 14", "Reintentos\nDeben tener límite\ny espera gradual", { fontSize: 24 });
  text(s, "TextBox 34", "Autenticación\nAgrega fricción\ny gestión de tokens", { fontSize: 24 });
  text(s, "TextBox 19", "Autorización\nVerificación constante por rol", { fontSize: 22 });
  text(s, "TextBox 24", "Alcance\nSe replica la API, no PostgreSQL", { fontSize: 22 });
  text(s, "TextBox 39", "Resultado\nSeguridad y continuidad observables", { fontSize: 22 });
  notes(s, "Tiempo sugerido: 1 minuto.\nReconocer los trade-offs demuestra criterio arquitectónico. La base de datos única es una limitación explícita: esta demo prueba recuperación ante la caída de una instancia de aplicación, no alta disponibilidad total de todos los componentes.");
}

// 12. Cierre
{
  const s = p.slides.items[11];
  text(s, "TextBox 8", "Las tácticas se notan menos cuando funcionan bien", { fontSize: 55 });
  notes(s, "Tiempo sugerido: 1 minuto.\nCerrar con tres ideas: cuatro tácticas demostradas sobre una API real; satisfacen requerimientos anteriores, no inventados para esta entrega; y cada beneficio tiene un costo reconocido. Abrir el espacio para preguntas.");
}

await fs.mkdir(qaDir, { recursive: true });
for (let i = 0; i < p.slides.items.length; i++) {
  const s = p.slides.items[i];
  const png = await p.export({ slide: s, format: "png", scale: 1 });
  await fs.writeFile(path.join(qaDir, `slide-${i + 1}.png`), new Uint8Array(await png.arrayBuffer()));
  const layout = await s.export({ format: "layout" });
  await fs.writeFile(path.join(qaDir, `slide-${i + 1}.layout.json`), await layout.text(), "utf8");
}
const montage = await p.export({ format: "webp", montage: true, scale: 1 });
await fs.writeFile(path.join(qaDir, "montage.webp"), new Uint8Array(await montage.arrayBuffer()));
const inspection = await p.inspect({ kind: "slide,textbox,shape,notes,layout", maxChars: 200000 });
await fs.writeFile(path.join(qaDir, "inspect.ndjson"), inspection.ndjson, "utf8");
const pptx = await PresentationFile.exportPptx(p);
await pptx.save(output);
