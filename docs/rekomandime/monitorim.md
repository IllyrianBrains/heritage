# Satelitë & monitorim

Për të parë ndryshimet në terren nga larg: prerje pylli, zjarre, ndërtim, ndryshim të ujërave.

*Versioni i parë: shtator 2026*

## Zgjidh shpejt

| Dua të… | Përdor |
|---|---|
| Krahasoj imazhe para/pas | [Copernicus / EO Browser](#copernicus-browser-dhe-eo-browser) |
| Ndjek humbjen e pyjeve | [Global Forest Watch](#global-forest-watch) |
| Kontrolloj zjarre aktive | [NASA FIRMS](#nasa-firms) |
| Shoh ndryshimin e ujërave nga 1984 | [JRC Global Surface Water](#jrc-global-surface-water) |
| Analizoj seri kohore të mëdha | [Google Earth Engine](#google-earth-engine) |

**Ç'kërkojmë:** të dhëna të hapura ose falas për përdorim jo-komercial; metodë e dokumentuar dhe seri kohore të krahasueshme; rezolucion i mjaftueshëm për ndryshime lokale (10 m ose më mirë).

## Mjetet

### Copernicus Browser dhe EO Browser

<span class="ib-pill">falas</span> · [browser.dataspace.copernicus.eu](https://browser.dataspace.copernicus.eu) · [apps.sentinel-hub.com/eo-browser](https://apps.sentinel-hub.com/eo-browser/)

Imazhe **Sentinel-2** (rezolucion 10 m, rreth çdo 5 ditë). Krahaso data para/pas, shiko NDVI (bimësia) dhe shkarko shkallën e ndryshimit. Mjeti bazë për shtretërit e lumenjve, prerjet dhe ndërtimet e mëdha.

### Global Forest Watch

<span class="ib-pill">falas</span> · [globalforestwatch.org](https://www.globalforestwatch.org)

Humbja e mbulesës së pemëve, sinjalizime prerjesh dhe zjarresh, kufij zonash të mbrojtura. Kërkon interpretim: humbja e pemëve përfshin edhe prerjet e ligjshme dhe kultivimin.

### NASA FIRMS

<span class="ib-pill">falas</span> · [firms.modaps.eosdis.nasa.gov](https://firms.modaps.eosdis.nasa.gov)

Zbulon zjarre aktive pothuajse në kohë reale. Sinjalizimet janë orientuese (piksele termike), jo konfirmim zjarri.

### JRC Global Surface Water

<span class="ib-pill">falas</span> · [global-surface-water.appspot.com](https://global-surface-water.appspot.com)

Hartë e ndryshimeve të sipërfaqes së ujit që nga 1984; e dobishme për liqene, laguna dhe shtretër lumenjsh.

### Google Earth Engine

<span class="ib-pill">falas për kërkim dhe OJQ jo-fitimprurëse</span> <span class="ib-pill ib-pill--warn">jo e hapur</span> · [earthengine.google.com](https://earthengine.google.com)

Analizë e fuqishme e serive kohore për ata që dinë programim. Varësia nga një kompani e vetme është kompromis: ruaj rezultatet dhe metodën jashtë platformës.

## Si të dokumentosh një ndryshim me satelit

<div class="ib-steps" markdown>

1. **Zgjidh të njëjtin sezon** në të dy datat (bimësia ndryshon nga stina).
2. **Zgjidh imazhe pa re** mbi zonë.
3. **Ruaj captura** me datë dhe koordinata, plus emrin e produktit (p.sh. `Sentinel-2 L2A`).
4. **Shëno kufizimin:** 10 m nuk tregon një prerje të vogël ose një pemë të vetme.
5. **Kombino me foto nga terreni** kur është e mundur.

</div>

!!! warning "Ndryshim nuk do të thotë shkelje"
    Imazhet satelitore tregojnë **ndryshim**, jo **ligjshmëri**. Një ndryshim mund të ketë leje; kontrollo lejet e lëshuara para se të pretendosh shkelje.

## Burimet

- [Copernicus Data Space](https://dataspace.copernicus.eu)
- [Sentinel-2 (ESA)](https://sentiwiki.copernicus.eu)
