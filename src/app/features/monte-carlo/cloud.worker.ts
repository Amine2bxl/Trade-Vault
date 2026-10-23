/** Rasterisation du nuage hors du fil d'affichage. Les 10 000 trajectoires
 * contribuent à une image de densité ; aucune immense liste de commandes
 * Canvas/Skia ne doit être rejouée à chaque peinture ou capture d'écran. */
interface CloudRequest {
  matrix: Float64Array;
  points: number[];
  stops: Uint16Array;
  endBalances: Float64Array;
  runs: number;
  width: number;
  height: number;
  left: number;
  top: number;
  plotWidth: number;
  plotHeight: number;
  lo: number;
  hi: number;
  trades: number;
  objective: boolean;
  color: number[];
}

self.onmessage = async (event: MessageEvent<CloudRequest>) => {
  const c = event.data;
  const width = c.width,
    height = c.height,
    density = new Float32Array(width * height);
  const x = (step: number) => c.left + (step / c.trades) * c.plotWidth;
  const y = (value: number) => c.top + ((c.hi - value) / (c.hi - c.lo)) * c.plotHeight;
  const xmin = c.left,
    xmax = c.left + c.plotWidth,
    ymin = c.top,
    ymax = c.top + c.plotHeight;
  // Liang–Barsky : les extrêmes hors axe sont rognés, pas projetés sur le bord.
  const segment = (ax: number, ay: number, bx: number, by: number) => {
    const dx = bx - ax,
      dy = by - ay;
    let from = 0,
      to = 1;
    const clip = (p: number, q: number) => {
      if (p === 0) return q >= 0;
      const r = q / p;
      if (p < 0) {
        if (r > to) return false;
        from = Math.max(from, r);
      } else {
        if (r < from) return false;
        to = Math.min(to, r);
      }
      return true;
    };
    if (
      !clip(-dx, ax - xmin) ||
      !clip(dx, xmax - ax) ||
      !clip(-dy, ay - ymin) ||
      !clip(dy, ymax - ay)
    )
      return;
    const sx = ax + from * dx,
      sy = ay + from * dy,
      ex = ax + to * dx,
      ey = ay + to * dy;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(ex - sx), Math.abs(ey - sy))));
    for (let i = 0; i <= steps; i++) {
      const px = sx + ((ex - sx) * i) / steps,
        py = sy + ((ey - sy) * i) / steps;
      const ix = Math.floor(px),
        iy = Math.floor(py),
        fx = px - ix,
        fy = py - iy;
      if (ix >= 0 && ix < width && iy >= 0 && iy < height)
        density[iy * width + ix] += (1 - fx) * (1 - fy);
      if (ix + 1 < width && iy >= 0 && iy < height) density[iy * width + ix + 1] += fx * (1 - fy);
      if (ix >= 0 && ix < width && iy + 1 < height) density[(iy + 1) * width + ix] += (1 - fx) * fy;
      if (ix + 1 < width && iy + 1 < height) density[(iy + 1) * width + ix + 1] += fx * fy;
    }
  };
  const columns = c.points.length;
  for (let run = 0; run < c.runs; run++) {
    const offset = run * columns,
      stop = c.stops[run];
    let px = x(c.points[0]),
      py = y(c.matrix[offset]);
    for (let j = 1; j < columns; j++) {
      const halted = c.objective && c.points[j] > stop;
      const nx = x(halted ? stop : c.points[j]),
        ny = y(halted ? c.endBalances[run] : c.matrix[offset + j]);
      segment(px, py, nx, ny);
      if (halted) break;
      px = nx;
      py = ny;
    }
  }
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < density.length; i++)
    if (density[i] > 0) {
      pixels[i * 4] = c.color[0];
      pixels[i * 4 + 1] = c.color[1];
      pixels[i * 4 + 2] = c.color[2];
      pixels[i * 4 + 3] = Math.round(Math.min(0.58, 1 - Math.exp(-density[i] * 0.025)) * 255);
    }
  const surface = new OffscreenCanvas(width, height);
  const ctx = surface.getContext("2d");
  if (!ctx) throw new Error("NO_RASTER_CONTEXT");
  ctx.putImageData(new ImageData(pixels, width, height), 0, 0);
  const blob = await surface.convertToBlob({ type: "image/png" });
  self.postMessage({ blob });
};
