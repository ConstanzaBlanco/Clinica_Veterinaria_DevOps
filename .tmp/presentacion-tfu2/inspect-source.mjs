import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const source = "C:/Proyecto_Clínica_Veterinaria/Presentacion_TFU2_Pet-Core.pptx";
const out = "C:/Proyecto_Clínica_Veterinaria/.tmp/presentacion-tfu2/final-verified";
await fs.mkdir(path.join(out, "slides"), { recursive: true });
await fs.mkdir(path.join(out, "layouts"), { recursive: true });
const p = await PresentationFile.importPptx(await FileBlob.load(source));
const inspect = await p.inspect({kind:"slide,textbox,shape,image,table,chart,notes,layout", maxChars:200000});
await fs.writeFile(path.join(out, "inspect.ndjson"), inspect.ndjson, "utf8");
for (let i = 0; i < p.slides.items.length; i++) {
  const slide = p.slides.items[i];
  const png = await p.export({slide, format:"png", scale:1});
  await fs.writeFile(path.join(out, "slides", `slide-${i+1}.png`), new Uint8Array(await png.arrayBuffer()));
  const layout = await slide.export({format:"layout"});
  await fs.writeFile(path.join(out, "layouts", `slide-${i+1}.json`), await layout.text(), "utf8");
}
const montage = await p.export({format:"webp", montage:true, scale:1});
await fs.writeFile(path.join(out, "montage.webp"), new Uint8Array(await montage.arrayBuffer()));
await fs.writeFile(path.join(out, "summary.json"), JSON.stringify({slides:p.slides.items.length, masters:p.masters?.items?.length ?? 0, layouts:p.layouts?.items?.length ?? 0}, null, 2));
