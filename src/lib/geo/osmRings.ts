import type { Feature, MultiPolygon, Position } from 'geojson'

/** Overpassin `out geom` -muotoinen relaation jäsen */
export interface OsmRelMember {
  type: string
  role: string
  geometry?: { lat: number; lon: number }[]
}

interface Segment {
  coords: Position[]
}

/**
 * Kasaa OSM-multipolygonrelaation way-pätkistä suljetut renkaat.
 * Wayt eivät ole valmiiksi järjestyksessä eivätkä aina samansuuntaisia,
 * joten pätkiä ommellaan yhteen päätepisteitä sovittamalla.
 */
function assembleRings(segments: Segment[]): Position[][] {
  const remaining = segments.filter((s) => s.coords.length >= 2).map((s) => [...s.coords])
  const rings: Position[][] = []
  const same = (a: Position, b: Position) => a[0] === b[0] && a[1] === b[1]

  while (remaining.length > 0) {
    const ring = remaining.shift()!
    let extended = true
    while (!same(ring[0], ring[ring.length - 1]) && extended) {
      extended = false
      const tail = ring[ring.length - 1]
      for (let i = 0; i < remaining.length; i++) {
        const seg = remaining[i]
        if (same(seg[0], tail)) {
          ring.push(...seg.slice(1))
        } else if (same(seg[seg.length - 1], tail)) {
          ring.push(...seg.slice(0, -1).reverse())
        } else {
          continue
        }
        remaining.splice(i, 1)
        extended = true
        break
      }
    }
    if (same(ring[0], ring[ring.length - 1]) && ring.length >= 4) rings.push(ring)
    // Avoimeksi jäänyt pätkä hylätään (rikkinäinen data) — parempi kuin ikuinen silmukka
  }
  return rings
}

/** Shoelace-pinta-ala asteissa — riittää renkaiden kokovertailuun ja suunnistukseen */
function ringArea(ring: Position[]): number {
  let sum = 0
  for (let i = 0; i < ring.length - 1; i++) {
    sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
  }
  return sum / 2
}

function pointInRing(pt: Position, ring: Position[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 2; i < ring.length - 1; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

/**
 * OSM-relaation jäsenet (Overpass `out geom`) → GeoJSON MultiPolygon.
 * Outer-renkaat muodostavat polygonit, inner-renkaat (saaret) rei'iksi
 * siihen outer-renkaaseen jonka sisällä ne ovat.
 */
export function relationToMultiPolygon(members: OsmRelMember[]): Feature<MultiPolygon> {
  const toSegments = (role: string): Segment[] =>
    members
      .filter((m) => m.type === 'way' && m.role === role && m.geometry)
      .map((m) => ({ coords: m.geometry!.map((p) => [p.lon, p.lat] as Position) }))

  const outers = assembleRings(toSegments('outer'))
  const inners = assembleRings(toSegments('inner'))

  // Suurin outer ensin, jotta saaret osuvat oikeaan polygoniin nopeasti
  outers.sort((a, b) => Math.abs(ringArea(b)) - Math.abs(ringArea(a)))

  const polygons: Position[][][] = outers.map((o) => {
    // GeoJSON: outer vastapäivään
    return [ringArea(o) < 0 ? [...o].reverse() : o]
  })

  for (const inner of inners) {
    const probe = inner[0]
    const host = polygons.find((p) => pointInRing(probe, p[0]))
    if (host) {
      // GeoJSON: reiät myötäpäivään
      host.push(ringArea(inner) > 0 ? [...inner].reverse() : inner)
    }
  }

  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'MultiPolygon', coordinates: polygons },
  }
}
