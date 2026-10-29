// A canvas of the given size, made in `documentObj`.
function createCanvas(documentObj: Pick<Document, 'createElement'>, width: number, height: number): HTMLCanvasElement {
  const canvas = documentObj.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export { createCanvas };
