import fs from "fs";
import path from "path";

const dir = "scripts/tmp-geo";
const ids = [
  "hokkaido",
  "tohoku",
  "kanto",
  "chubu",
  "kinki",
  "chugoku",
  "shikoku",
  "kyushu",
];

const PAD = 14;
const W = 480;
const H = 640;

function ringsFromGeom(geom) {
  if (!geom) return [];
  if (geom.type === "Polygon") return geom.coordinates.map((r) => r);
  if (geom.type === "MultiPolygon") return geom.coordinates.flatMap((p) => p);
  if (geom.type === "GeometryCollection") {
    return geom.geometries.flatMap(ringsFromGeom);
  }
  return [];
}

function avg(xs) {
  return xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
}

function closeRing(pts) {
  if (pts.length < 3) return null;
  const out = pts.slice();
  const a = out[0];
  const b = out[out.length - 1];
  if (a[0] !== b[0] || a[1] !== b[1]) out.push([...a]);
  return out.length >= 4 ? out : null;
}

function clipRing(ring, pred) {
  return closeRing(ring.filter(([lon, lat]) => pred(lon, lat)));
}

function isMainPoint(lon, lat) {
  return lon >= 128 && lon <= 146.5 && lat >= 30 && lat <= 46;
}

function isOkinawaPoint(lon, lat) {
  return lon >= 122 && lon <= 131 && lat >= 24 && lat <= 28.8;
}

function collect(file) {
  const raw = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
  const features = raw.type === "FeatureCollection" ? raw.features : [raw];
  const main = [];
  const okinawa = [];
  for (const f of features) {
    for (const ring of ringsFromGeom(f.geometry)) {
      const lons = ring.map((p) => p[0]);
      const lats = ring.map((p) => p[1]);
      const cx = avg(lons);
      const cy = avg(lats);
      const maxLon = Math.max(...lons);
      const minLat = Math.min(...lats);

      // Clean mainland / regional polygon
      if (maxLon < 146.8 && minLat > 29.8 && cx > 128 && cy < 46) {
        main.push(ring);
        continue;
      }
      // Pure Okinawa
      if (cx >= 122 && cx <= 131 && cy >= 24 && cy <= 28.8) {
        okinawa.push(ring);
        continue;
      }
      // Mixed junk (Kanto islands / Kyushu+Okinawa blob): clip
      const m = clipRing(ring, isMainPoint);
      const o = clipRing(ring, isOkinawaPoint);
      if (m) main.push(m);
      if (o) okinawa.push(o);
    }
  }
  return { main, okinawa };
}

const byId = {};
let minLon = Infinity,
  maxLon = -Infinity,
  minLat = Infinity,
  maxLat = -Infinity;

for (const id of ids) {
  const { main, okinawa } = collect(`${id}.geojson`);
  byId[id] = { main, okinawa };
  for (const ring of main) {
    for (const [lon, lat] of ring) {
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
  }
}

const spanLon = maxLon - minLon || 1;
const spanLat = maxLat - minLat || 1;
const scale = Math.min((W - PAD * 2) / spanLon, (H - PAD * 2 - 80) / spanLat);
const ox = (W - spanLon * scale) / 2;
const oy = PAD;

function project(lon, lat) {
  return [ox + (lon - minLon) * scale, oy + (maxLat - lat) * scale];
}

const inset = { x: 24, y: H - 100, w: 120, h: 78 };

function makeOkinawaProj(rings) {
  let lo = Infinity,
    hi = -Infinity,
    la = Infinity,
    lb = -Infinity;
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      lo = Math.min(lo, lon);
      hi = Math.max(hi, lon);
      la = Math.min(la, lat);
      lb = Math.max(lb, lat);
    }
  }
  const s = Math.min(inset.w / ((hi - lo) || 1), inset.h / ((lb - la) || 1)) * 0.82;
  const px = inset.x + (inset.w - (hi - lo) * s) / 2;
  const py = inset.y + (inset.h - (lb - la) * s) / 2;
  return (lon, lat) => [px + (lon - lo) * s, py + (lb - lat) * s];
}

function ringPath(ring, proj) {
  return (
    ring
      .map(([lon, lat], i) => {
        const [x, y] = proj(lon, lat);
        return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ") + " Z"
  );
}

function centroid(rings, proj) {
  let sx = 0,
    sy = 0,
    c = 0;
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      const [x, y] = proj(lon, lat);
      sx += x;
      sy += y;
      c++;
    }
  }
  return { x: sx / (c || 1), y: sy / (c || 1) };
}

function bboxOf(rings, proj) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      const [x, y] = proj(lon, lat);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return [minX, minY, maxX, maxY].map((n) => Number(n.toFixed(2)));
}

const allOkinawa = ids.flatMap((id) => byId[id].okinawa);
const oProj = allOkinawa.length ? makeOkinawaProj(allOkinawa) : null;

const regions = ids.map((id) => {
  const { main, okinawa } = byId[id];
  const parts = main.map((r) => ringPath(r, project));
  if (okinawa.length && oProj) {
    parts.push(...okinawa.map((r) => ringPath(r, oProj)));
  }
  const labelRings = main.length ? main : okinawa;
  const labelProj = main.length ? project : oProj || project;
  const c = centroid(labelRings, labelProj);
  const boxRings = main.length ? main : okinawa;
  const boxProj = main.length ? project : oProj || project;
  return {
    id,
    d: parts.join(" "),
    labelX: Number(c.x.toFixed(2)),
    labelY: Number(c.y.toFixed(2)),
    bbox: bboxOf(boxRings, boxProj),
  };
});

const out = {
  viewBox: [0, 0, W, H],
  inset: allOkinawa.length ? inset : null,
  attribution: "Simplified region outlines adapted from aoheart/Japan-regions (OSM/NSI).",
  regions,
};

fs.mkdirSync("src/data", { recursive: true });
fs.writeFileSync("src/data/japan-region-paths.json", JSON.stringify(out, null, 2));
console.log(
  "bounds",
  minLon.toFixed(2),
  maxLon.toFixed(2),
  minLat.toFixed(2),
  maxLat.toFixed(2),
);
console.log(regions.map((r) => `${r.id} d=${r.d.length} bbox=${r.bbox.join(",")}`).join("\n"));
