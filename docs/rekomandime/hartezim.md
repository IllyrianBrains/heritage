# Hartëzim & terren

Mjete për të vizatuar kufij, mbledhur pika në terren dhe analizuar hapësirën.

*Versioni i parë: shtator 2026*

## Ç'kërkojmë

- Formate të hapura: GeoJSON, GPX, GeoPackage.
- Puna **offline** në terren.
- Sistemi i koordinatave i qartë (**WGS84** për shkëmbim).

## Mjetet

### QGIS

:material-map: [qgis.org](https://qgis.org) · falas, kod i hapur (GPL)

Programi kryesor i hapur GIS për desktop. Krijon, redakton dhe analizon kufij, shtresa dhe hartat e kërcënimeve. Eksporton në GeoJSON për [hartën e projektit](../../../map/).

### QField

:material-cellphone-marker: [qfield.org](https://qfield.org) · falas, kod i hapur

Përdor projektet QGIS në celular për mbledhje të dhënash në terren, offline. Mirë për ekipe monitorimi.

### OpenStreetMap

:material-map-marker-radius: [openstreetmap.org](https://www.openstreetmap.org) · të dhëna të hapura (ODbL)

Harta e hapur e botës. Kufijtë e zonave të mbrojtura, rrugët dhe ujërat mund të përmirësohen nga kushdo. Përdor **[Overpass Turbo](https://overpass-turbo.eu)** për të kërkuar dhe eksportuar të dhëna.

!!! warning "Rregull"
    Shto në OSM vetëm atë që e njeh direkt ose e verifikon nga burime të lejuara. Mos kopjo nga harta me licencë të kufizuar.

### Organic Maps dhe OsmAnd

:material-navigation: [organicmaps.app](https://organicmaps.app) · [osmand.net](https://osmand.net) · aplikacione offline

Navigim offline me të dhënat e OSM; të dobishme për shtigje malore dhe zona pa lidhje.

### KoboToolbox dhe ODK

:material-clipboard-text-outline: [kobotoolbox.org](https://www.kobotoolbox.org) · [getodk.org](https://getodk.org)

Formularë për mbledhjen e të dhënave në terren (anketa, listat e kontrollit, raportet e incidenteve), offline dhe me foto e GPS. Zgjidh ato kur disa vullnetarë duhet të plotësojnë të njëjtin format.

## Rrjedha e propozuar

1. Regjistro pika ose gjurmë me QField/ODK.
2. Pastro dhe kontrollo në QGIS.
3. Ruaj si GeoJSON me `source`, `date`, `license`.
4. Propozo për hartën: shih [Shto të dhëna](../rreth/kontribuo.md#shto-te-dhena-ne-harte).

## Burimet

- [Dokumentacioni i QGIS](https://docs.qgis.org)
- [Mësoni OSM](https://learnosm.org)
