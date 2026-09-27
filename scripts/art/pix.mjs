// Tiny pixel-art canvas: fill shapes, auto-outline, emit a crisp SVG.
export function canvas(w, h) {
  const px = Array.from({ length: h }, () => Array(w).fill(null));
  const set = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < w && y < h) px[y][x] = c; };
  const api = {
    w, h, px, set,
    rect(x, y, rw, rh, c) { for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) set(x + i, y + j, c); return api; },
    ellipse(cx, cy, rx, ry, c) {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry; if (dx * dx + dy * dy <= 1) set(x, y, c);
      } return api;
    },
    // Filled polygon (even-odd) sampled at pixel centres.
    poly(pts, c) {
      const ys = pts.map((p) => p[1]); const y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
      for (let y = y0; y <= y1; y++) for (let x = 0; x < w; x++) {
        const X = x + 0.5, Y = y + 0.5; let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i], [xj, yj] = pts[j];
          if ((yi > Y) !== (yj > Y) && X < ((xj - xi) * (Y - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) set(x, y, c);
      } return api;
    },
    // Recolour pixels of one colour inside a region (for shading).
    recolor(from, to, test) { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[y][x] === from && test(x, y)) px[y][x] = to; return api; },
    outline(c) {
      const add = [];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!px[y][x]) {
        if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => px[y + dy]?.[x + dx] && px[y + dy][x + dx] !== c)) add.push([x, y]);
      }
      add.forEach(([x, y]) => (px[y][x] = c)); return api;
    },
    mirror() { for (const row of px) row.reverse(); return api; },
    svg(scale) {
      const out = [];
      for (let y = 0; y < h; y++) { let x = 0; while (x < w) { const c = px[y][x]; if (!c) { x++; continue; } let e = x; while (e < w && px[y][e] === c) e++; out.push([c, x, y, e - x]); x = e; } }
      const byColor = {};
      for (const [c, x, y, l] of out) (byColor[c] ??= []).push(`M${x} ${y}h${l}v1h-${l}z`);
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w * scale}" height="${h * scale}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">\n${Object.entries(byColor).map(([c, d]) => `  <path fill="${c}" d="${d.join('')}"/>`).join('\n')}\n</svg>\n`;
    },
  };
  return api;
}
