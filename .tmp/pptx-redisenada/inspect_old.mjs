import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const deck = await PresentationFile.importPptx(
  await FileBlob.load("C:/Proyecto_Clínica_Veterinaria/Presentacion_TFU2_Pet-Core.pptx"),
);
const result = await deck.inspect({
  kind: "slide,textbox,notes",
  maxChars: 30000,
});
console.log(result.ndjson);
