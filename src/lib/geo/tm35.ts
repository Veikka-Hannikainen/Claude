/**
 * WGS84 (lat/lon) → ETRS-TM35FIN (EPSG:3067) -tasokoordinaatit.
 * Poikittainen Mercator, GRS80, kaista 35 (keskimeridiaani 27°E), k0=0.9996.
 * Tarkkuus ~metrin luokkaa — riittää Karttapaikka-linkkiin.
 */
const A = 6378137
const F = 1 / 298.257222101
const K0 = 0.9996
const LON0 = (27 * Math.PI) / 180
const FE = 500000

export function toTm35fin(lat: number, lon: number): { e: number; n: number } {
  const e2 = F * (2 - F)
  const e4 = e2 * e2
  const e6 = e4 * e2
  const ep2 = e2 / (1 - e2)
  const phi = (lat * Math.PI) / 180
  const lam = (lon * Math.PI) / 180

  const sin = Math.sin(phi)
  const cos = Math.cos(phi)
  const N = A / Math.sqrt(1 - e2 * sin * sin)
  const T = Math.tan(phi) ** 2
  const C = ep2 * cos * cos
  const Aa = (lam - LON0) * cos

  const M =
    A *
    ((1 - e2 / 4 - (3 * e4) / 64 - (5 * e6) / 256) * phi -
      ((3 * e2) / 8 + (3 * e4) / 32 + (45 * e6) / 1024) * Math.sin(2 * phi) +
      ((15 * e4) / 256 + (45 * e6) / 1024) * Math.sin(4 * phi) -
      ((35 * e6) / 3072) * Math.sin(6 * phi))

  const east =
    FE +
    K0 *
      N *
      (Aa +
        ((1 - T + C) * Aa ** 3) / 6 +
        ((5 - 18 * T + T * T + 72 * C - 58 * ep2) * Aa ** 5) / 120)
  const north =
    K0 *
    (M +
      N *
        Math.tan(phi) *
        (Aa ** 2 / 2 +
          ((5 - T + 9 * C + 4 * C * C) * Aa ** 4) / 24 +
          ((61 - 58 * T + T * T + 600 * C - 330 * ep2) * Aa ** 6) / 720))

  return { e: Math.round(east), n: Math.round(north) }
}

/** MML Karttapaikka -linkki pisteeseen — maanomistuksen ja rantojen tarkistukseen */
export function karttapaikkaUrl(lat: number, lon: number): string {
  const { e, n } = toTm35fin(lat, lon)
  return `https://asiointi.maanmittauslaitos.fi/karttapaikka/?lang=fi&share=customMarker&n=${n}&e=${e}&zoom=10`
}
