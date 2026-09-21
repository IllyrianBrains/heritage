# Satelitë & monitorim

Për të parë ndryshimet në terren nga larg: prerje pylli, zjarre, ndërtim, ndryshim të ujërave.

*Versioni i parë: shtator 2026*

## Ç'kërkojmë

- **Të dhëna të hapura ose falas** për përdorim jo-komercial.
- Metodë e dokumentuar dhe **seri kohore** të krahasueshme.
- Rezolucion i mjaftueshëm për ndryshime lokale (10 m ose më mirë ka rëndësi).

## Mjetet

### Copernicus Browser dhe EO Browser

:material-satellite-variant: [browser.dataspace.copernicus.eu](https://browser.dataspace.copernicus.eu) · [apps.sentinel-hub.com/eo-browser](https://apps.sentinel-hub.com/eo-browser/) · falas

Imazhe **Sentinel-2** (rezolucion 10 m, çdo 5 ditë rreth). Krahaso data para/pas, shiko NDVI (bimësia) dhe shkarko shkallën e ndryshimit. Mjeti bazë për ndryshimet e shtratit të lumit, prerjet dhe ndërtimet e mëdha.

### Global Forest Watch

:material-forest: [globalforestwatch.org](https://www.globalforestwatch.org) · falas

Humbja e mbulesës së pemëve, sinjalizime të prerjeve dhe zjarreve, kufij të zonave të mbrojtura në një vend. Kërkon interpretim: humbja e pemëve përfshin edhe prerjet e ligjshme dhe kultivimin.

### NASA FIRMS

:material-fire-alert: [firms.modaps.eosdis.nasa.gov](https://firms.modaps.eosdis.nasa.gov) · falas

Zbulon zjarre aktive pothuajse në kohë reale. Sinjalizimet janë orientuese (piksele termike), jo konfirmim zjarri.

### JRC Global Surface Water

:material-waves: [global-surface-water.appspot.com](https://global-surface-water.appspot.com) · falas

Hartë e ndryshimeve të sipërfaqes së ujit që nga 1984; e dobishme për liqene, laguna dhe shtretër lumenjsh.

### Google Earth Engine

:material-google-earth: [earthengine.google.com](https://earthengine.google.com) · falas për kërkim dhe OJQ jo-fitimprurëse, **jo e hapur**

Analizë e fuqishme e serive kohore për ata që dinë programim. Përmendet për shkak të shtrirjes, por varësia nga një kompani e vetme është kompromis: ruaj rezultatet dhe metodën jashtë platformës.

## Si të dokumentosh një ndryshim me satelit

1. Zgjidh **të njëjtin sezon** në të dy datat (bimësia ndryshon nga stina).
2. Zgjidh imazhe **pa re** mbi zonë.
3. Ruaj **captura me datë dhe koordinata**, plus emrin e produktit (p.sh. `Sentinel-2 L2A`).
4. Shënoje kufizimin: 10 m nuk tregon një prerje të vogël ose një pemë të vetme.
5. Kur është e mundur, kombino me foto nga terreni.

!!! warning "Kufizime"
    Imazhet satelitore tregojnë **ndryshim**, jo **ligjshmëri**. Një ndryshim mund të ketë leje; kontrollo lejet e lëshuara para se të pretendosh shkelje.

## Burimet

- [Copernicus Data Space](https://dataspace.copernicus.eu)
- [Sentinel-2 (ESA)](https://sentiwiki.copernicus.eu)
