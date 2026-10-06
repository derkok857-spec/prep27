// Squarified treemap (Bruls, Huizing and van Wijk). Lays rows along the shorter side and keeps
// adding items to a row while the worst aspect ratio in that row improves.

export interface TreemapInput<T> {
  value: number;
  data: T;
}

export interface TreemapRect<T> {
  x: number;
  y: number;
  w: number;
  h: number;
  value: number;
  data: T;
}

export function squarify<T>(items: TreemapInput<T>[], x0: number, y0: number, w0: number, h0: number): TreemapRect<T>[] {
  const out: TreemapRect<T>[] = [];
  const positive = items.filter((it) => it.value > 0);
  const total = positive.reduce((a, b) => a + b.value, 0);
  if (!total || w0 <= 0 || h0 <= 0) return out;
  const scale = (w0 * h0) / total;
  const rest = positive.map((it) => ({ ...it, area: it.value * scale })).sort((a, b) => b.area - a.area);

  let x = x0;
  let y = y0;
  let w = w0;
  let h = h0;

  const worst = (row: { area: number }[], side: number) => {
    const s = row.reduce((a, b) => a + b.area, 0);
    let mx = 0;
    let mn = Infinity;
    for (const r of row) {
      mx = Math.max(mx, r.area);
      mn = Math.min(mn, r.area);
    }
    return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn));
  };

  while (rest.length) {
    const side = Math.max(Math.min(w, h), 1e-9);
    const row = [rest.shift()!];
    while (rest.length && worst([...row, rest[0]], side) <= worst(row, side)) row.push(rest.shift()!);
    const s = row.reduce((a, b) => a + b.area, 0);
    if (w >= h) {
      const cw = h > 0 ? s / h : 0;
      let cy = y;
      for (const r of row) {
        const rh = cw > 0 ? r.area / cw : 0;
        out.push({ x, y: cy, w: cw, h: rh, value: r.value, data: r.data });
        cy += rh;
      }
      x += cw;
      w -= cw;
    } else {
      const ch = w > 0 ? s / w : 0;
      let cx = x;
      for (const r of row) {
        const rw = ch > 0 ? r.area / ch : 0;
        out.push({ x: cx, y, w: rw, h: ch, value: r.value, data: r.data });
        cx += rw;
      }
      y += ch;
      h -= ch;
    }
  }
  return out;
}
