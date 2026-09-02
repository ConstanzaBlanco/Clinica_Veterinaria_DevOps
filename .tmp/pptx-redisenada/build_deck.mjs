import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const OUT = "C:/Proyecto_Clínica_Veterinaria/Presentacion_TFU2_Pet-Core_Canva.pptx";
const TMP = "C:/Proyecto_Clínica_Veterinaria/.tmp/pptx-redisenada";
const ARCH = "C:/Proyecto_Clínica_Veterinaria/arquitectura-andis.png";
const REPL = "C:/Proyecto_Clínica_Veterinaria/diagrama-replicacion-andis.png";
const PAW = `${TMP}/paw-motif.png`;

const C = {
  navy: "#0B2D3B",
  navy2: "#123E4D",
  teal: "#0C7C78",
  aqua: "#BFE4DF",
  aqua2: "#E3F3F0",
  coral: "#F26B5B",
  coral2: "#FFE5DF",
  cream: "#FFF7EF",
  paper: "#F5FAF9",
  white: "#FFFFFF",
  ink: "#163440",
  muted: "#58727C",
  line: "#CFDFDF",
  gold: "#E5A84B",
};

const deck = Presentation.create({ slideSize: { width: 1280, height: 720 } });
const pawBytes = await readBytes(PAW);
const archBytes = await readBytes(ARCH);
const replBytes = await readBytes(REPL);

async function readBytes(path) {
  const b = await fs.readFile(path);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
}

function box(slide, x, y, w, h, fill, radius = "rounded-xl", line = "none", lineWidth = 0) {
  return slide.shapes.add({
    geometry: "roundRect",
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: { style: "solid", fill: line, width: lineWidth },
    borderRadius: radius,
  });
}

function rect(slide, x, y, w, h, fill) {
  return slide.shapes.add({
    geometry: "rect",
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: { style: "solid", fill: "none", width: 0 },
  });
}

function text(slide, value, x, y, w, h, opts = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    name: opts.name,
    position: { left: x, top: y, width: w, height: h },
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = value;
  shape.text.style = {
    fontFamily: opts.fontFamily || "Aptos",
    fontSize: opts.size || 22,
    bold: opts.bold || false,
    color: opts.color || C.ink,
    alignment: opts.align || "left",
    verticalAlignment: opts.valign || "middle",
  };
  return shape;
}

function image(slide, bytes, x, y, w, h, fit = "contain", geometry = "rect") {
  return slide.images.add({
    blob: bytes,
    contentType: "image/png",
    fit,
    geometry,
    position: { left: x, top: y, width: w, height: h },
  });
}

function baseSlide(section, number, dark = false) {
  const s = deck.slides.add();
  s.background.fill = dark ? C.navy : C.paper;
  if (!dark) {
    rect(s, 0, 0, 14, 720, C.teal);
    text(s, section.toUpperCase(), 66, 30, 530, 24, { size: 13, bold: true, color: C.teal });
    text(s, String(number).padStart(2, "0"), 1182, 662, 42, 24, { size: 13, bold: true, color: C.muted, align: "right" });
    rect(s, 66, 680, 1090, 2, C.line);
  }
  return s;
}

function title(slide, value, subtitle = null) {
  text(slide, value, 66, 62, 1145, 76, { size: 38, bold: true, color: C.navy, name: "slide-title" });
  if (subtitle) text(slide, subtitle, 68, 132, 1110, 44, { size: 19, color: C.muted });
}

function notes(slide, body) {
  slide.speakerNotes.textFrame.setText(`${body}\n\n[Sources]\n- Consigna TFU2 provista por la cátedra.\n- C:/Proyecto_Clínica_Veterinaria/README.md\n- C:/Proyecto_Clínica_Veterinaria/compose.yaml\n- Código y scripts de demostración del repositorio local.`);
  slide.speakerNotes.setVisible(true);
}

// 1 — portada
{
  const s = baseSlide("", 1, true);
  rect(s, 0, 0, 1280, 18, C.coral);
  image(s, pawBytes, 880, 60, 360, 360, "contain");
  text(s, "TFU2 · ANÁLISIS Y DISEÑO DE APLICACIONES II", 76, 72, 690, 30, { size: 15, bold: true, color: C.aqua });
  text(s, "Tácticas de\narquitectura", 76, 170, 760, 180, { size: 66, bold: true, color: C.white });
  text(s, "Disponibilidad y seguridad sobre una API REST real", 80, 376, 760, 55, { size: 25, color: C.aqua });
  rect(s, 80, 458, 132, 6, C.coral);
  text(s, "PET-CORE", 80, 484, 300, 34, { size: 18, bold: true, color: C.white });
  text(s, "Constanza Blanco · Manuel Cabrera\nDiego de Oliveira · Martin Mujica", 80, 548, 700, 72, { size: 20, color: "#D7E8E8" });
  notes(s, "Tiempo sugerido: 30 segundos. Presentar al equipo y anticipar que se demostrarán cuatro tácticas con comportamiento observable.");
}

// 2 — contexto
{
  const s = baseSlide("Contexto", 2);
  title(s, "Pet-Core expone procesos que no pueden fallar en silencio");
  box(s, 66, 190, 520, 390, C.navy);
  text(s, "Una API REST para la gestión de una clínica veterinaria", 104, 228, 430, 108, { size: 32, bold: true, color: C.white });
  text(s, "La funcionalidad da un contexto real para observar decisiones de arquitectura.", 104, 378, 414, 88, { size: 21, color: C.aqua });
  text(s, "Pet-Core", 104, 500, 240, 38, { size: 18, bold: true, color: C.coral });
  box(s, 642, 192, 548, 168, C.white, "rounded-xl", C.line, 1);
  text(s, "Procesos críticos", 680, 216, 240, 30, { size: 18, bold: true, color: C.teal });
  text(s, "Reserva de turnos\nAgenda e historial clínico", 680, 258, 450, 76, { size: 27, bold: true, color: C.navy });
  box(s, 642, 388, 548, 190, C.aqua2, "rounded-xl", C.aqua, 1);
  text(s, "Tres identidades, permisos diferentes", 680, 414, 448, 34, { size: 22, bold: true, color: C.navy });
  text(s, "Cliente  ·  Veterinario  ·  Administrador", 680, 468, 450, 40, { size: 23, bold: true, color: C.teal });
  text(s, "La identidad y el rol determinan qué información puede consultarse.", 680, 520, 450, 40, { size: 18, color: C.muted });
  notes(s, "Tiempo sugerido: 55 segundos. Explicar el dominio solo lo necesario: procesos críticos y separación de roles.");
}

// 3 — requisitos
{
  const s = baseSlide("Requerimientos", 3);
  title(s, "Los requerimientos exigen continuidad y control de acceso", "Cada táctica responde a un riesgo concreto.");
  const items = [
    ["01", "Servicio disponible", "Los turnos deben poder reservarse aun cuando una instancia de la API falle.", C.teal],
    ["02", "Recuperación breve", "Las fallas transitorias de conexión no deberían interrumpir una operación válida.", C.coral],
    ["03", "Identidad comprobada", "Los recursos protegidos deben rechazar actores que no hayan iniciado sesión.", C.gold],
    ["04", "Permisos por rol", "Un actor autenticado solo puede ejecutar acciones autorizadas para su rol.", C.navy2],
  ];
  items.forEach((it, i) => {
    const y = 204 + i * 104;
    text(s, it[0], 78, y + 4, 58, 46, { size: 28, bold: true, color: it[3] });
    rect(s, 150, y + 2, 4, 68, it[3]);
    text(s, it[1], 180, y, 310, 34, { size: 23, bold: true, color: C.navy });
    text(s, it[2], 510, y - 2, 650, 60, { size: 19, color: C.muted });
  });
  notes(s, "Tiempo sugerido: 1 minuto. Formular cada requisito como riesgo y resultado esperado, sin entrar todavía en implementación.");
}

// 4 — tácticas
{
  const s = baseSlide("Tácticas elegidas", 4);
  title(s, "Cuatro tácticas cubren dos atributos de calidad");
  text(s, "DISPONIBILIDAD", 80, 180, 510, 32, { size: 17, bold: true, color: C.teal });
  text(s, "SEGURIDAD · RESISTIR ATAQUES", 690, 180, 500, 32, { size: 17, bold: true, color: C.coral });
  box(s, 74, 230, 510, 142, C.aqua2, "rounded-xl", C.aqua, 1);
  text(s, "Replicación", 112, 252, 250, 40, { size: 29, bold: true, color: C.navy });
  text(s, "Dos instancias ejecutan la misma API; si una cae, la otra mantiene el servicio.", 112, 302, 420, 56, { size: 18, color: C.muted });
  box(s, 74, 398, 510, 142, C.white, "rounded-xl", C.line, 1);
  text(s, "Reintentos", 112, 420, 250, 40, { size: 29, bold: true, color: C.navy });
  text(s, "Una operación fallida se repite con espera y un límite explícito.", 112, 470, 420, 56, { size: 18, color: C.muted });
  box(s, 682, 230, 510, 142, C.coral2, "rounded-xl", "#F5B7AA", 1);
  text(s, "Autenticar actores", 720, 252, 340, 40, { size: 29, bold: true, color: C.navy });
  text(s, "Correo y contraseña válidos permiten emitir un token JWT.", 720, 302, 420, 56, { size: 18, color: C.muted });
  box(s, 682, 398, 510, 142, C.cream, "rounded-xl", "#EDD5B4", 1);
  text(s, "Autorizar actores", 720, 420, 340, 40, { size: 29, bold: true, color: C.navy });
  text(s, "El rol del token determina si una operación está permitida.", 720, 470, 420, 56, { size: 18, color: C.muted });
  notes(s, "Tiempo sugerido: 1 minuto. Diferenciar claramente disponibilidad de seguridad y nombrar las cuatro tácticas seleccionadas.");
}

// 5 — arquitectura
{
  const s = baseSlide("Arquitectura", 5);
  title(s, "La arquitectura vuelve observables las cuatro tácticas");
  box(s, 56, 150, 1168, 490, C.white, "rounded-xl", C.line, 1);
  image(s, archBytes, 80, 166, 1120, 454, "contain");
  notes(s, "Tiempo sugerido: 1 minuto 30 segundos. Recorrer Postman, Nginx, dos réplicas, seguridad/reintentos dentro de la API, PostgreSQL, volumen y secretos. Aclarar que no hay frontend en la demo.");
}

// 6 — disponibilidad y seguridad juntas
{
  const s = baseSlide("Cómo actúan", 6);
  title(s, "Las tácticas se aplican en distintos momentos del pedido");
  box(s, 76, 192, 1120, 106, C.navy);
  text(s, "Postman", 106, 222, 130, 40, { size: 23, bold: true, color: C.white, align: "center" });
  text(s, "→", 244, 220, 50, 40, { size: 28, bold: true, color: C.coral, align: "center" });
  text(s, "Nginx", 306, 222, 130, 40, { size: 23, bold: true, color: C.white, align: "center" });
  text(s, "→", 445, 220, 50, 40, { size: 28, bold: true, color: C.coral, align: "center" });
  text(s, "FastAPI", 510, 222, 150, 40, { size: 23, bold: true, color: C.white, align: "center" });
  text(s, "→", 664, 220, 50, 40, { size: 28, bold: true, color: C.coral, align: "center" });
  text(s, "JWT + rol", 720, 222, 170, 40, { size: 23, bold: true, color: C.white, align: "center" });
  text(s, "→", 895, 220, 50, 40, { size: 28, bold: true, color: C.coral, align: "center" });
  text(s, "PostgreSQL", 952, 222, 205, 40, { size: 23, bold: true, color: C.white, align: "center" });
  const labels = [
    ["Replicación", "Nginx elige una réplica disponible.", 76, C.teal],
    ["Autenticación", "FastAPI comprueba la identidad y valida el JWT.", 356, C.gold],
    ["Autorización", "El rol habilita o rechaza la operación.", 636, C.coral],
    ["Reintentos", "La conexión a datos se repite ante una falla transitoria.", 916, C.navy2],
  ];
  labels.forEach((it) => {
    box(s, it[2], 350, 250, 190, C.white, "rounded-xl", C.line, 1);
    rect(s, it[2], 350, 250, 8, it[3]);
    text(s, it[0], it[2] + 26, 374, 200, 36, { size: 23, bold: true, color: C.navy });
    text(s, it[1], it[2] + 26, 426, 196, 84, { size: 18, color: C.muted });
  });
  notes(s, "Tiempo sugerido: 1 minuto 15 segundos. Mostrar que no son cuatro demos aisladas: las tácticas forman parte de un mismo recorrido.");
}

// 7 — transición demo
{
  const s = baseSlide("", 7, true);
  image(s, pawBytes, 64, 392, 250, 250, "contain");
  text(s, "DEMOSTRACIÓN EN VIVO", 76, 78, 600, 30, { size: 15, bold: true, color: C.aqua });
  text(s, "De la decisión\na la evidencia", 76, 170, 690, 176, { size: 60, bold: true, color: C.white });
  text(s, "1  Autenticación", 800, 172, 330, 40, { size: 24, bold: true, color: C.white });
  text(s, "2  Autorización", 800, 238, 330, 40, { size: 24, bold: true, color: C.white });
  text(s, "3  Replicación", 800, 304, 330, 40, { size: 24, bold: true, color: C.white });
  text(s, "4  Reintentos", 800, 370, 330, 40, { size: 24, bold: true, color: C.white });
  text(s, "Postman + terminal · 7 minutos", 800, 488, 350, 34, { size: 20, color: C.coral });
  notes(s, "Tiempo sugerido: 15 segundos. Abrir Postman y terminal. Las cuatro demostraciones ocupan aproximadamente siete minutos.");
}

// 8 — autenticación
{
  const s = baseSlide("Demo 1 · Autenticación", 8);
  title(s, "Sin identidad no hay acceso; con JWT, el recurso responde");
  box(s, 74, 196, 500, 320, C.coral2, "rounded-xl", "#F5B7AA", 1);
  text(s, "SIN TOKEN", 112, 226, 250, 28, { size: 16, bold: true, color: C.coral });
  text(s, "GET /demo/instancia", 112, 286, 390, 44, { size: 27, bold: true, color: C.navy });
  text(s, "401", 112, 364, 150, 86, { size: 62, bold: true, color: C.coral });
  text(s, "Unauthorized", 260, 388, 230, 42, { size: 23, bold: true, color: C.navy });
  box(s, 704, 196, 500, 320, C.aqua2, "rounded-xl", C.aqua, 1);
  text(s, "LOGIN + JWT", 742, 226, 250, 28, { size: 16, bold: true, color: C.teal });
  text(s, "POST /auth/login\nGET /demo/instancia", 742, 280, 390, 82, { size: 26, bold: true, color: C.navy });
  text(s, "200", 742, 390, 150, 80, { size: 62, bold: true, color: C.teal });
  text(s, "OK", 890, 412, 120, 40, { size: 23, bold: true, color: C.navy });
  text(s, "Evidencia: el mismo endpoint cambia su respuesta cuando se presenta una identidad válida.", 106, 552, 1060, 54, { size: 20, color: C.muted, align: "center" });
  notes(s, "Demo: 1 minuto 15 segundos. Ejecutar en Seguridad_Collection las peticiones sin token, login y acceso con token. Mostrar 401 y luego 200.");
}

// 9 — autorización
{
  const s = baseSlide("Demo 2 · Autorización", 9);
  title(s, "Un JWT válido no concede todos los permisos");
  box(s, 76, 198, 1120, 322, C.white, "rounded-xl", C.line, 1);
  text(s, "GET /agenda", 456, 220, 360, 46, { size: 30, bold: true, color: C.navy, align: "center" });
  rect(s, 635, 280, 3, 190, C.line);
  text(s, "TOKEN DE CLIENTE", 128, 300, 360, 30, { size: 16, bold: true, color: C.coral, align: "center" });
  text(s, "403", 176, 350, 260, 90, { size: 68, bold: true, color: C.coral, align: "center" });
  text(s, "Forbidden", 176, 432, 260, 34, { size: 22, bold: true, color: C.navy, align: "center" });
  text(s, "TOKEN DE VETERINARIO", 786, 300, 360, 30, { size: 16, bold: true, color: C.teal, align: "center" });
  text(s, "200", 834, 350, 260, 90, { size: 68, bold: true, color: C.teal, align: "center" });
  text(s, "OK", 834, 432, 260, 34, { size: 22, bold: true, color: C.navy, align: "center" });
  text(s, "Evidencia: ambos actores están autenticados; el rol determina el resultado.", 106, 554, 1060, 54, { size: 20, color: C.muted, align: "center" });
  notes(s, "Demo: 1 minuto 15 segundos. Iniciar sesión como cliente y luego como veterinario. Explicar que 403 significa identidad válida sin permiso suficiente.");
}

// 10 — replicación
{
  const s = baseSlide("Demo 3 · Replicación", 10);
  title(s, "Una réplica cae y la API continúa respondiendo");
  image(s, replBytes, 62, 150, 750, 455, "contain");
  box(s, 844, 174, 350, 408, C.navy);
  text(s, "EVIDENCIA EN VIVO", 882, 208, 270, 28, { size: 16, bold: true, color: C.aqua });
  text(s, "1", 880, 270, 42, 42, { size: 27, bold: true, color: C.coral });
  text(s, "Dos identificadores alternan", 934, 266, 214, 54, { size: 21, bold: true, color: C.white });
  text(s, "2", 880, 356, 42, 42, { size: 27, bold: true, color: C.coral });
  text(s, "Se detiene server-1", 934, 352, 214, 54, { size: 21, bold: true, color: C.white });
  text(s, "3", 880, 442, 42, 42, { size: 27, bold: true, color: C.coral });
  text(s, "La respuesta sigue en 200", 934, 438, 214, 58, { size: 21, bold: true, color: C.white });
  text(s, "Nginx conserva una única URL para el cliente.", 884, 526, 260, 40, { size: 17, color: C.aqua });
  notes(s, "Demo: 2 minutos 15 segundos. Ejecutar varias veces Identificar instancia, detener una réplica y repetir. Mostrar continuidad desde la instancia restante.");
}

// 11 — reintentos
{
  const s = baseSlide("Demo 4 · Reintentos", 11);
  title(s, "Dos fallas transitorias se recuperan dentro de la misma operación");
  const steps = [
    ["01", "Simular", "2 fallas", C.coral],
    ["02", "Intento 1", "+ 0,5 s", C.gold],
    ["03", "Intento 2", "+ 1 s", C.teal],
    ["04", "Intento 3", "200 OK", C.navy2],
  ];
  steps.forEach((it, i) => {
    const x = 72 + i * 292;
    box(s, x, 226, 250, 230, i === 3 ? C.navy : C.white, "rounded-xl", i === 3 ? C.navy : C.line, 1);
    text(s, it[0], x + 28, 248, 65, 34, { size: 18, bold: true, color: it[3] });
    text(s, it[1], x + 28, 310, 190, 40, { size: 25, bold: true, color: i === 3 ? C.white : C.navy });
    text(s, it[2], x + 28, 372, 190, 42, { size: 23, bold: true, color: i === 3 ? C.aqua : C.muted });
    if (i < 3) text(s, "→", x + 250, 316, 42, 40, { size: 26, bold: true, color: C.coral, align: "center" });
  });
  box(s, 210, 512, 860, 74, C.aqua2, "rounded-xl", C.aqua, 1);
  text(s, "Resultado observable: intentos_usados = 3 · duración aproximada = 1,5 s · exitoso = true", 244, 529, 792, 40, { size: 20, bold: true, color: C.navy, align: "center" });
  notes(s, "Demo: 2 minutos 15 segundos. Dejar una réplica, simular dos fallas, ejecutar GET /mascotas y consultar el último intento. Mostrar tres intentos y resultado exitoso.");
}

// 12 — cierre
{
  const s = baseSlide("Conclusión", 12);
  title(s, "El resultado es observable, pero el alcance tiene límites");
  box(s, 76, 190, 520, 356, C.navy);
  text(s, "Lo que demostramos", 114, 224, 400, 38, { size: 27, bold: true, color: C.white });
  text(s, "• Continuidad ante la caída de una API\n• Recuperación ante fallas transitorias\n• Identidad mediante JWT\n• Permisos según rol", 114, 292, 410, 190, { size: 21, color: C.aqua });
  box(s, 654, 190, 540, 356, C.white, "rounded-xl", C.line, 1);
  text(s, "Límite reconocido", 694, 224, 400, 38, { size: 27, bold: true, color: C.navy });
  text(s, "La API está replicada; PostgreSQL sigue siendo una única instancia.", 694, 294, 422, 98, { size: 27, bold: true, color: C.coral });
  text(s, "La demo prueba continuidad de la capa de aplicación, no alta disponibilidad total.", 694, 422, 420, 70, { size: 19, color: C.muted });
  text(s, "Las tácticas se notan menos cuando funcionan bien.", 128, 594, 1020, 48, { size: 29, bold: true, color: C.teal, align: "center" });
  notes(s, "Tiempo sugerido: 1 minuto. Cerrar con los cuatro resultados y reconocer explícitamente que PostgreSQL no está replicado. Abrir preguntas.");
}

await fs.mkdir(TMP, { recursive: true });
for (const [i, slide] of deck.slides.items.entries()) {
  const png = await deck.export({ slide, format: "png", scale: 1 });
  await fs.writeFile(`${TMP}/slide-${String(i + 1).padStart(2, "0")}.png`, new Uint8Array(await png.arrayBuffer()));
  const layout = await slide.export({ format: "layout" });
  await fs.writeFile(`${TMP}/slide-${String(i + 1).padStart(2, "0")}.layout.json`, await layout.text());
}
const montage = await deck.export({ format: "webp", montage: true, scale: 1 });
await fs.writeFile(`${TMP}/montage.webp`, new Uint8Array(await montage.arrayBuffer()));
const pptx = await PresentationFile.exportPptx(deck);
await pptx.save(OUT);
console.log(OUT);
