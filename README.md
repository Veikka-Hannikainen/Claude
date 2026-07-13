# Päijänne luonnonsatamat ⚓

Selaimessa toimiva PWA-sovellus Päijänteen parhaiden **luonnonsatamien** löytämiseen,
**veneretkien suunnitteluun** ja määränpään **tuulensuojan arviointiin** seuraaville
5 päivälle. Mitoitettu Aquador 23 HT:lle (matkavauhti 20 kn, kulutus 22 l/h) —
kaikki arvot säädettävissä asetuksista.

## Ominaisuudet

- **Orca-henkinen käyttöliittymä**: koko ruudun kartta, kelluvat pyöreät napit ja
  raahattava bottom sheet mobiilissa (peek/half/full), kelluva kortti työpöydällä.
- **Karttanäkymä** (MapLibre): pohjakarttana vaalea CARTO Voyager; vaihtoehtoina
  OSM, MML:n ilmakuva (ilmainen api-avain) ja Esri-satelliittikuva. Väyläviraston
  viralliset väylät overlay-tasona.
- **Kuratoitu aloituslista** (~19 paikkaa): Kelventeen poukamat, Pulkkilanharju,
  Haukkasalo, Judinsalo, Vaarunvuoret ym. + kaksi palvelusatamaa (mm. Kuhmoisten
  Sahanranta saunalla). Omia paikkoja voi lisätä +-napilla ja siirtää raahaamalla —
  esim. satelliittikuvasta tai Päijänteen veneilijät -ryhmän vinkeistä bongatut
  poukamat muistiinpanoineen ja lähdelinkkeineen.
- **Suosikit**: tähtää paikka ★-napilla; suosikit nousevat listan kärkeen ja
  saavat oman suodattimen.
- **Palvelutagit**: sauna, laituri, ankkurointi, nuotiopaikka, WC, uimaranta,
  telttailu, polku — ikoneina listassa ja kortissa, suodatinchipit yleisimmille.
- **Suoja-analyysi**: jokaiselle paikalle lasketaan avoin vesimatka (fetch) 24 suuntaan
  oikeasta rantaviivageometriasta (OSM). Ruusukaavio näyttää suojaiset ja alttiit suunnat.
- **Auringonlasku**: laskusuunta lasketaan päivälle ja paikalle (SunCalc) ja verrataan
  paikan avoimuuteen — badge kertoo näkyykö lasku veden ylle.
- **Väylävaroitus**: etäisyys lähimpään väylään; lippu jos alle 500 m (peräaallot).
- **Reittisuunnittelu**: reittipisteet klikkaamalla, matka (mpk/km), kesto valitulla
  matkavauhdilla, polttoainearvio (l ja €). Punainen katkoviiva ja varoitus, jos
  etappi leikkaa maata.
- **Tuulensuoja 5 vrk**: Open-Meteon tuntikohtainen tuuliennuste (MET Nordic 1 km
  -malli) yhdistettynä paikan fetch-taulukkoon → päiväkohtainen luokitus
  *suojassa / kohtalainen / altis aallokolle* yksinkertaistetulla SMB-aallokkomallilla.
- **PWA / offline**: asennettavissa kotinäytölle; sovellus, aineistot ja selatut
  karttatiilet toimivat ilman verkkoa (sääennuste vaatii verkon).
- **Ei palvelinta**: omat paikat ja reitit tallentuvat selaimeen (localStorage +
  IndexedDB), vienti/tuonti JSON-tiedostona.

## Käyttöönotto

```bash
npm install
npm run dev        # kehityspalvelin
npm run build      # tuotantobuildi dist/-hakemistoon
npm run preview    # buildin esikatselu
```

Ensimmäisellä käynnistyksellä sovellus lataa Päijänteen rantaviivan (OpenStreetMap
Overpass) ja väylät (Väylävirasto) suoraan selaimeen ja tallentaa ne IndexedDB:hen —
tämä vaatii verkkoyhteyden kerran. Vaihtoehtoisesti aineistot voi esiladata repoon:

```bash
npm run data:fetch   # kirjoittaa public/data/*.geojson (aja omalla koneella)
```

Sovelluksen voi julkaista mihin tahansa staattiseen hostaukseen (esim. GitHub Pages):
`vite.config.ts` käyttää suhteellista basea, joten `dist/` toimii alipoluissa.

### MML:n ilmakuva (suositus paikkojen tutkimiseen)

Hae ilmainen henkilökohtainen api-avain osoitteesta
[omatili.maanmittauslaitos.fi](https://omatili.maanmittauslaitos.fi), valitse
asetuksista pohjakartaksi *Ilmakuva (MML)* ja liitä avain kenttään. Avain
tallentuu vain omaan selaimeesi.

## Testit

```bash
npm test        # vitest-yksikkötestit (geometria, aallokkomalli, reittilaskenta)
npm run e2e     # Playwright-selaintestit mockatuilla rajapinnoilla
```

Jos Playwrightin selainta ei ole asennettu, aja `npx playwright install chromium`
tai osoita valmis Chromium ympäristömuuttujalla `PW_CHROMIUM_PATH`.

## Arkkitehtuuri

```
src/
  lib/geo/        fetch-säteet, rantaviivan kasaus OSM-datasta, maaleikkaus, väyläetäisyys
  lib/shelter/    tuuli + fetch → aallokkoarvio ja suojaluokitus
  lib/sun/        auringonlaskun suunta ja avoimuus
  lib/route/      reittimetriikat (matka, kesto, polttoaine)
  lib/weather/    Open-Meteo-asiakas
  lib/data/       aineistojen lataus (Overpass, Väylävirasto), IndexedDB
  lib/compute/    laskenta web workerissa
  components/     kartta (MapLibre), paneelit, ruusukaavio
  state/          zustand-store (localStorage-persistointi)
scripts/          valinnainen aineistojen esilatausskripti
tests/            vitest + Playwright
```

## Datalähteet ja lisenssit

| Aineisto | Lähde | Lisenssi |
|---|---|---|
| Rantaviiva ja saaret | © OpenStreetMapin tekijät (Overpass API) | ODbL |
| Vesiväylät | Väylävirasto, avoin OGC API Features | CC BY 4.0 |
| Ilmakuvat | Maanmittauslaitos (avoin karttakuvapalvelu) | CC BY 4.0 |
| Sääennuste | Open-Meteo (MET Nordic / ECMWF) | ei-kaupallinen käyttö |
| Karttatiilet | OpenStreetMap / Esri | ks. palveluehdot |

## Huomautukset

- **Ei navigointikäyttöön.** Sovellus ei korvaa merikarttaa: syvyyksiä, kiviä tai
  matalikkoja ei tarkisteta. Maaleikkaustarkistus käyttää yksinkertaistettua
  rantaviivaa — varmista kapeikot kartalta.
- Osa aloituslistan koordinaateista on likimääräisiä (merkitty sovelluksessa) —
  tarkenna satelliittikuvan päällä raahaamalla.
- Aallokkoarvio on yksinkertaistettu fetch-pohjainen malli; se ei huomioi
  virtauksia, heijastuvaa aallokkoa eikä veneliikennettä.
- Facebook-ryhmien sisältöä ei voi hakea ohjelmallisesti — lisää ryhmästä löytyneet
  vinkit käsin omiksi paikoiksi lähdelinkin kera.
