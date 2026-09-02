import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const OUT = "C:/Proyecto_Clínica_Veterinaria/Diagrama_Arquitectura_ANDIS_Editable.pptx";
const TMP = "C:/Proyecto_Clínica_Veterinaria/.tmp/pptx-revision";
const C = {
  bg: "#FBFCFE", navy: "#0A1857", slate: "#243052", border: "#9CAAD1",
  teal: "#00A2A6", tealLine: "#03959A", green: "#128329", orange: "#D89200",
  paleBlue: "#EAF2FF", paleTeal: "#E8FBFC", paleGold: "#FFF8E8", paleGray: "#F2F5FD",
  gold: "#D89100", white: "#FFFFFF", muted: "#53617D",
};

const deck = Presentation.create({ slideSize: { width: 1280, height: 720 } });
const s = deck.slides.add();
s.background.fill = C.bg;

function shape(geometry, x, y, w, h, fill, line = "none", width = 0, radius = "rounded-xl", name) {
  const config = { geometry, name, position: { left: x, top: y, width: w, height: h }, fill,
    line: { style: "solid", fill: line, width }, shadow: geometry === "roundRect" ? "shadow-sm" : "shadow-none" };
  if (["rect", "textbox", "roundRect"].includes(geometry)) config.borderRadius = radius;
  return s.shapes.add(config);
}
function rect(x, y, w, h, fill) { return shape("rect", x, y, w, h, fill); }
function label(value, x, y, w, h, opts = {}) {
  const t = s.shapes.add({ geometry: "textbox", name: opts.name, position: { left: x, top: y, width: w, height: h }, fill: "none", line: { style: "solid", fill: "none", width: 0 } });
  t.text = value;
  t.text.style = { fontFamily: "Aptos", fontSize: opts.size || 18, bold: opts.bold ?? false,
    color: opts.color || C.navy, alignment: opts.align || "left", verticalAlignment: opts.valign || "middle" };
  return t;
}
function arrow(from, to, { fromSide = "bottom", toSide = "top", kind = "elbow", color = C.navy, dash = false } = {}) {
  const connector = s.shapes.connect(from, to, { fromSide, toSide, kind,
    line: { style: dash ? "dashed" : "solid", fill: color, width: dash ? 2 : 3 },
    tail: { type: "triangle", width: "med", length: "med" } });
  connector.bringToFront();
  return connector;
}
function tagIcon(text, x, y, color, w = 43) {
  const circle = shape("ellipse", x, y, w, w, color, color, 1, "rounded-full");
  label(text, x, y + 1, w, w - 2, { size: 24, bold: true, color: C.white, align: "center" });
  return circle;
}
function miniRow(x, y, text, symbol) {
  const r = shape("roundRect", x, y, 220, 34, C.white, C.teal, 1, "rounded-md");
  label(symbol, x + 12, y + 3, 27, 26, { size: 21, bold: true, color: C.teal, align: "center" });
  label(text, x + 46, y + 5, 164, 24, { size: 13, color: C.navy });
  return r;
}

// Main Docker Compose boundary.
const compose = shape("roundRect", 360, 38, 610, 644, C.paleGray, C.border, 1.5, "rounded-2xl", "docker-compose");
label("Docker Compose", 560, 52, 210, 34, { size: 23, bold: true, align: "center" });

// Client block.
const client = shape("roundRect", 34, 88, 230, 88, C.white, "#F37B14", 1.5, "rounded-xl", "postman-client");
tagIcon("↗", 48, 107, "#F37B14", 45);
label("Postman / curl", 104, 118, 145, 30, { size: 18, bold: true });

// Nginx block.
const nginx = shape("roundRect", 475, 90, 330, 88, C.white, C.green, 1.5, "rounded-xl", "nginx-balanceador");
tagIcon("N", 495, 106, C.green, 48);
label("Nginx · balanceador", 558, 118, 224, 30, { size: 20, bold: true });

// API replicas.
function apiReplica(x, title, name) {
  const card = shape("roundRect", x, 255, 245, 206, C.white, C.teal, 1.5, "rounded-xl", name);
  tagIcon("ϟ", x + 16, 272, C.teal, 43);
  label(title, x + 68, 284, 158, 27, { size: 17, bold: true });
  miniRow(x + 16, 330, "Autenticación JWT", "♢");
  miniRow(x + 16, 375, "Autorización por roles", "♙");
  miniRow(x + 16, 420, "Reintentos de conexión", "↻");
  return card;
}
const api1 = apiReplica(385, "FastAPI · réplica 1", "api-replica-1");
const api2 = apiReplica(690, "FastAPI · réplica 2", "api-replica-2");

// Database and its volume.
const db = shape("roundRect", 540, 525, 210, 74, C.paleBlue, "#17429D", 1.5, "rounded-xl", "postgresql");
label("♞", 558, 543, 42, 36, { size: 31, bold: true, color: "#17429D", align: "center" });
label("PostgreSQL", 622, 548, 115, 28, { size: 19, bold: true, color: C.navy, align: "center" });
const volume = shape("roundRect", 540, 626, 210, 55, C.paleBlue, "#17429D", 1.5, "rounded-xl", "persistent-volume");
label("▱", 560, 638, 34, 26, { size: 24, bold: true, color: "#17429D", align: "center" });
label("Volumen persistente", 604, 640, 130, 23, { size: 16, bold: true, color: C.navy, align: "center" });

// Secrets group.
const secrets = shape("roundRect", 1015, 263, 215, 190, C.paleGold, C.gold, 1.5, "rounded-xl", "secrets");
tagIcon("▣", 1030, 280, C.gold, 39);
label("Secrets", 1082, 292, 110, 28, { size: 19, bold: true });
const secret1 = shape("roundRect", 1034, 330, 176, 46, C.white, "#E2B65A", 1, "rounded-md", "db-password");
label("⚿", 1045, 340, 30, 24, { size: 22, bold: true, color: C.gold, align: "center" });
label("Contraseña de BD", 1080, 342, 112, 22, { size: 14, color: C.navy });
const secret2 = shape("roundRect", 1034, 384, 176, 46, C.white, "#E2B65A", 1, "rounded-md", "jwt-key");
label("⚿", 1045, 394, 30, 24, { size: 22, bold: true, color: C.gold, align: "center" });
label("Clave JWT", 1080, 396, 112, 22, { size: 14, color: C.navy });

// Connectors are created after labels but sent behind all entities to preserve clean reading.
arrow(client, nginx, { fromSide: "right", toSide: "left", kind: "straight" });
label("HTTP · localhost:8000", 282, 104, 190, 28, { size: 17, color: C.navy, align: "center" });
arrow(nginx, api1, { fromSide: "bottom", toSide: "top", kind: "elbow" });
arrow(nginx, api2, { fromSide: "bottom", toSide: "top", kind: "elbow" });
arrow(api1, db, { fromSide: "bottom", toSide: "top", kind: "elbow" });
arrow(api2, db, { fromSide: "bottom", toSide: "top", kind: "elbow" });
arrow(db, volume, { fromSide: "bottom", toSide: "top", kind: "straight" });
arrow(secrets, api2, { fromSide: "left", toSide: "right", kind: "straight", color: C.gold, dash: true });
arrow(secrets, db, { fromSide: "bottom", toSide: "right", kind: "elbow", color: C.gold, dash: true });

// Replica equivalence annotation above connectors.
rect(610, 324, 130, 62, C.paleGray);
label("Misma API y\nmisma versión", 610, 334, 130, 42, { size: 15, color: C.navy, bold: false, align: "center" });
rect(620, 321, 112, 2, C.teal);
rect(620, 385, 112, 2, C.teal);

// Subtle labels to clarify the two edge categories.
label("distribuye cada petición entre las réplicas", 676, 184, 282, 20, { size: 12, color: C.muted, align: "center" });

s.speakerNotes.textFrame.setText("Diagrama editable construido con formas y conectores nativos de PowerPoint. No utiliza una imagen de fondo.\n\n[Sources]\n- Arquitectura de la demo ANDIS del repositorio local.\n- Diagrama de referencia provisto por la estudiante.");
s.speakerNotes.setVisible(true);

await fs.mkdir(TMP, { recursive: true });
const preview = await deck.export({ slide: s, format: "png", scale: 1 });
await fs.writeFile(`${TMP}/editable-architecture-slide.png`, new Uint8Array(await preview.arrayBuffer()));
const layout = await s.export({ format: "layout" });
await fs.writeFile(`${TMP}/editable-architecture.layout.json`, await layout.text());
const pptx = await PresentationFile.exportPptx(deck);
await pptx.save(OUT);
console.log(OUT);
