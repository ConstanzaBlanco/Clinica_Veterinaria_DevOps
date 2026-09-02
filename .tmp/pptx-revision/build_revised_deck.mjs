import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const OUT = "C:/Proyecto_Clínica_Veterinaria/Presentacion_TFU2_Pet-Core_Canva_ASR.pptx";
const TMP = "C:/Proyecto_Clínica_Veterinaria/.tmp/pptx-revision";
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
  const s = baseSlide("Negocio", 2);
  title(s, "Pet-Core organiza la atención de una clínica veterinaria", "La aplicación convierte tareas operativas en procesos digitales trazables.");
  box(s, 74, 198, 1118, 92, C.navy);
  text(s, "Cliente  →  operación de la clínica  →  equipo veterinario", 110, 222, 1045, 40, { size: 26, bold: true, color: C.white, align: "center" });
  const processes = [
    ["Reserva de turnos", "El cliente elige mascota, tipo de atención, veterinario y horario."],
    ["Agenda diaria", "El veterinario consulta sus turnos y registra la atención."],
    ["Historial clínico", "Las consultas quedan asociadas a cada mascota y disponibles según el rol."],
  ];
  processes.forEach((it, i) => {
    const x = 74 + i * 374;
    box(s, x, 334, 344, 205, i === 1 ? C.aqua2 : C.white, "rounded-xl", C.line, 1);
    text(s, String(i + 1).padStart(2, "0"), x + 28, 358, 54, 32, { size: 17, bold: true, color: i === 1 ? C.teal : C.coral });
    text(s, it[0], x + 28, 410, 290, 38, { size: 24, bold: true, color: C.navy });
    text(s, it[1], x + 28, 464, 282, 58, { size: 17, color: C.muted });
  });
  notes(s, "Tiempo sugerido: 45 segundos. Presentar el negocio y los tres procesos automatizados antes de hablar de arquitectura.");
}

// 3 — roles
{
  const s = baseSlide("Roles", 3);
  title(s, "Cada rol existe para una responsabilidad distinta", "Los permisos limitan el acceso a la información y a las operaciones necesarias.");
  const roles = [
    ["Cliente", "Gestiona sus mascotas y reserva turnos.", "Ver mascotas · reservar/cancelar turnos · consultar su historial", C.teal, C.aqua2],
    ["Veterinario", "Atiende pacientes y registra información clínica.", "Ver agenda · consultar historial · registrar consultas", C.navy2, C.white],
    ["Administrador", "Coordina la agenda sin acceder al contenido clínico.", "Gestionar turnos de clientes · ver metadatos · sin diagnósticos ni tratamiento", C.coral, C.coral2],
  ];
  roles.forEach((it, i) => {
    const x = 74 + i * 374;
    box(s, x, 202, 344, 350, it[4], "rounded-xl", C.line, 1);
    rect(s, x, 202, 344, 9, it[3]);
    text(s, it[0], x + 28, 236, 276, 40, { size: 28, bold: true, color: C.navy });
    text(s, it[1], x + 28, 302, 284, 76, { size: 19, color: C.muted });
    text(s, "Permisos generales", x + 28, 414, 250, 26, { size: 16, bold: true, color: it[3] });
    text(s, it[2], x + 28, 456, 284, 70, { size: 17, color: C.ink });
  });
  notes(s, "Tiempo sugerido: 55 segundos. Destacar que el administrador puede gestionar turnos, pero no leer contenido clínico; esto anticipa el ASR de seguridad 02.");
}

// 4 — contexto resumido
{
  const s = baseSlide("Contexto", 4);
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

// 5 — requisitos ASR
{
  const s = baseSlide("Requerimientos", 5);
  title(s, "Los ASR definen qué debe proteger la arquitectura", "Disponibilidad y seguridad se expresan como resultados verificables.");
  const items = [
    ["ASR-DISP-01a", "Turnos disponibles 24/7", "El sistema deberá mantener disponible el módulo de reserva y gestión de turnos al menos el 99,5 % del tiempo, medido las 24 horas de todos los días del mes.", C.teal],
    ["ASR-DISP-01b", "Atención clínica en horario", "El sistema deberá mantener disponibles las funciones de consulta de agenda, consulta del historial clínico y registro de consultas al menos el 99,9 % del tiempo, de lunes a viernes entre las 8:00 y las 18:00.", C.coral],
    ["ASR-DISP-02", "Recuperación sin perder información", "El sistema deberá recuperarse en un máximo de 2 minutos ante la falla de una instancia de la aplicación, sin perder turnos confirmados ni información del historial clínico.", C.gold],
    ["ASR-SEG-01", "Acceso según rol", "El sistema deberá aplicar control de acceso según el rol del usuario, impidiendo que acceda o modifique información para la cual no está autorizado.", C.navy2],
    ["ASR-SEG-02", "Administrador sin contenido clínico", "El sistema deberá permitir al rol Administrador gestionar turnos de cualquier cliente sin acceder en ningún caso al contenido clínico de las consultas, quedando su acceso limitado a los metadatos del turno.", C.teal],
  ];
  items.forEach((it, i) => {
    const y = 194 + i * 87;
    text(s, it[0], 76, y + 2, 160, 36, { size: 15, bold: true, color: it[3] });
    rect(s, 252, y, 5, 58, it[3]);
    text(s, it[1], 278, y - 2, 292, 52, { size: 19, bold: true, color: C.navy });
    text(s, it[2], 595, y - 4, 574, 66, { size: 15, color: C.muted });
  });
  notes(s, "Tiempo sugerido: 1 minuto 30 segundos. Leer el resumen y usar el texto a la derecha para fundamentar cada ASR cuando sea necesario.");
}

// 4 — tácticas
{
  const s = baseSlide("Tácticas elegidas", 6);
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
  const s = baseSlide("Arquitectura", 7);
  title(s, "La arquitectura vuelve observables las cuatro tácticas");
  box(s, 56, 150, 1168, 490, C.white, "rounded-xl", C.line, 1);
  image(s, archBytes, 80, 166, 1120, 454, "contain");
  notes(s, "Tiempo sugerido: 1 minuto 30 segundos. Recorrer Postman, Nginx, dos réplicas, seguridad/reintentos dentro de la API, PostgreSQL, volumen y secretos. Aclarar que no hay frontend en la demo.");
}

// 6 — disponibilidad y seguridad juntas
{
  const s = baseSlide("Cómo actúan", 8);
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
  const s = baseSlide("", 9, true);
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

// 10 — autenticar actores: beneficio y costo
{
  const s = baseSlide("Táctica · Seguridad", 10);
  title(s, "Autenticar actores confirma la identidad antes de dar acceso");
  box(s, 76, 200, 1118, 92, C.navy);
  text(s, "Qué logramos: ningún endpoint protegido responde sin una identidad validada con JWT.", 108, 226, 1056, 40, { size: 23, bold: true, color: C.white, align: "center" });
  box(s, 76, 334, 530, 210, C.aqua2, "rounded-xl", C.aqua, 1);
  text(s, "Ventaja", 112, 364, 190, 36, { size: 26, bold: true, color: C.teal });
  text(s, "Es la base de todo el control de acceso: sin saber quién es el usuario, no se puede aplicar ningún permiso.", 112, 424, 440, 78, { size: 20, color: C.ink });
  box(s, 664, 334, 530, 210, C.coral2, "rounded-xl", "#F5B7AA", 1);
  text(s, "Desventaja", 700, 364, 220, 36, { size: 26, bold: true, color: C.coral });
  text(s, "Agrega fricción: iniciar sesión y verificar el token en cada request aumenta el trabajo del usuario y del sistema.", 700, 424, 442, 78, { size: 20, color: C.ink });
  notes(s, "Transición o demo: la autenticación identifica al actor. Relacionarla con ASR-SEG-01.");
}

// 11 — autorizar actores: beneficio y costo
{
  const s = baseSlide("Táctica · Seguridad", 11);
  title(s, "Autorizar actores aplica permisos a cada operación puntual");
  box(s, 76, 200, 1118, 92, C.navy);
  text(s, "Qué logramos: el rol habilita o rechaza acciones específicas, como gestionar turnos sin leer contenido clínico.", 108, 220, 1056, 52, { size: 22, bold: true, color: C.white, align: "center" });
  box(s, 76, 334, 530, 210, C.aqua2, "rounded-xl", C.aqua, 1);
  text(s, "Ventaja", 112, 364, 190, 36, { size: 26, bold: true, color: C.teal });
  text(s, "Permite reglas de negocio finas: cada rol accede solo a la información y las operaciones que le corresponden.", 112, 424, 440, 78, { size: 20, color: C.ink });
  box(s, 664, 334, 530, 210, C.coral2, "rounded-xl", "#F5B7AA", 1);
  text(s, "Desventaja", 700, 364, 220, 36, { size: 26, bold: true, color: C.coral });
  text(s, "Suma una verificación por request y obliga a mantener actualizada la relación entre roles y permisos al crecer.", 700, 424, 442, 78, { size: 20, color: C.ink });
  notes(s, "Transición o demo: autorización se ejecuta después de la autenticación. Relacionarla con ASR-SEG-01 y ASR-SEG-02.");
}

// 12 — replicación: beneficio y costo
{
  const s = baseSlide("Táctica · Disponibilidad", 12);
  title(s, "Replicación mantiene la API disponible ante la caída de una instancia");
  box(s, 76, 200, 1118, 92, C.navy);
  text(s, "Qué logramos: varias instancias del backend atienden en paralelo y el tráfico se reparte entre ellas.", 108, 226, 1056, 40, { size: 23, bold: true, color: C.white, align: "center" });
  box(s, 76, 334, 530, 210, C.aqua2, "rounded-xl", C.aqua, 1);
  text(s, "Ventaja", 112, 364, 190, 36, { size: 26, bold: true, color: C.teal });
  text(s, "El sistema tolera la falla de una instancia sin que el usuario note una interrupción del servicio.", 112, 424, 440, 78, { size: 20, color: C.ink });
  box(s, 664, 334, 530, 210, C.coral2, "rounded-xl", "#F5B7AA", 1);
  text(s, "Desventaja", 700, 364, 220, 36, { size: 26, bold: true, color: C.coral });
  text(s, "Cada réplica consume recursos y debe compartir el mismo estado; los datos locales impedirían que fueran intercambiables.", 700, 414, 442, 90, { size: 20, color: C.ink });
  notes(s, "Transición o demo: relacionar replicación con ASR-DISPONIBILIDAD-01a, 01b y 02. Aclarar que PostgreSQL sigue siendo una instancia única.");
}

// 13 — reintentos: beneficio y costo
{
  const s = baseSlide("Táctica · Disponibilidad", 13);
  title(s, "Reintentos absorben fallas transitorias antes de devolver un error");
  box(s, 76, 200, 1118, 92, C.navy);
  text(s, "Qué logramos: la conexión a PostgreSQL se reintenta automáticamente con espera creciente entre intentos.", 108, 226, 1056, 40, { size: 23, bold: true, color: C.white, align: "center" });
  box(s, 76, 334, 530, 210, C.aqua2, "rounded-xl", C.aqua, 1);
  text(s, "Ventaja", 112, 364, 190, 36, { size: 26, bold: true, color: C.teal });
  text(s, "Una falla breve puede quedar absorbida de forma transparente: el usuario recibe la respuesta sin repetir su operación.", 112, 414, 440, 90, { size: 20, color: C.ink });
  box(s, 664, 334, 530, 210, C.coral2, "rounded-xl", "#F5B7AA", 1);
  text(s, "Desventaja", 700, 364, 220, 36, { size: 26, bold: true, color: C.coral });
  text(s, "Sin límites puede ocultar un problema real. Por eso se usa un máximo de 3 intentos; luego se devuelve el error.", 700, 414, 442, 90, { size: 20, color: C.ink });
  notes(s, "Transición o demo: relacionar reintentos con ASR-DISPONIBILIDAD-02. Mostrar que el máximo de tres intentos evita ocultar una falla permanente.");
}

// 12 — cierre
{
  const s = baseSlide("Conclusión", 14);
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
