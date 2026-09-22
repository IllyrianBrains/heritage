# Puna në terren

Mjete për të vizatuar kufij, mbledhur pika në terren dhe kontrolluar nga larg, me satelitë, çfarë ndodh në një zonë.

*Versioni i parë: shtator 2026*

<div class="ib-glance">
<div><strong>Për kë</strong>Ekipe hartëzimi dhe monitorimi, vullnetarë me përgjegjësi terreni</div>
<div><strong>Të duhet</strong>Njohuri bazë GIS; QGIS e instaluar për punën desktop</div>
<div><strong>Del</strong>Shtresa GeoJSON, pika terreni dhe krahasime satelitore, gati për hartë ose dosje</div>
</div>

## Katër faqet e këtij profili

<div class="grid cards" markdown>

-   :material-map-marker-path:{ .lg .middle } **Praktikat**

    ---

    Një ditë terreni shembull, rrjedha e propozuar, dhe si të dokumentosh një ndryshim me satelit.

    [:octicons-arrow-right-24: Shiko](praktikat.md)

-   :material-map-outline:{ .lg .middle } **Hartëzim & mbledhje**

    ---

    QGIS, QField, OpenStreetMap, Organic Maps/OsmAnd, KoboToolbox/ODK.

    [:octicons-arrow-right-24: Shiko](hartezim.md)

-   :material-puzzle-outline:{ .lg .middle } **Shtesa (plugins) të QGIS**

    ---

    Gjashtë shtesa falas që lidhin QGIS me terrenin, OSM-në dhe satelitët.

    [:octicons-arrow-right-24: Shiko](shtesa-qgis.md)

-   :material-satellite-variant:{ .lg .middle } **Satelitë & monitorim**

    ---

    Copernicus, Global Forest Watch, FIRMS, SNAP, SentinelHub, SCP.

    [:octicons-arrow-right-24: Shiko](monitorim.md)

</div>

## Zgjidh shpejt

| Dua të… | Përdor |
|---|---|
| Vizatoj kufij dhe analizoj shtresa në kompjuter | [QGIS](hartezim.md#qgis) |
| Mbledh pika në terren, offline | [QField](hartezim.md#qfield) ose [KoboToolbox / ODK](hartezim.md#kobotoolbox-dhe-odk) |
| Përmirësoj ose kërkoj në hartën e hapur | [OpenStreetMap](hartezim.md#openstreetmap) |
| Navigoj në mal pa lidhje | [Organic Maps / OsmAnd](hartezim.md#organic-maps-dhe-osmand) |
| Importoj OSM ose shtoj sfond direkt në QGIS | [QuickOSM / QuickMapServices](shtesa-qgis.md#quickmapservices-qms) |
| Dërgoj një projekt QGIS te QField dhe e marr mbrapsht | [QFieldSync](shtesa-qgis.md#qfieldsync) |
| Krahasoj imazhe satelitore para/pas | [Copernicus / EO Browser](monitorim.md#copernicus-browser-dhe-eo-browser) |
| Ndjek humbjen e pyjeve ose zjarret aktive | [Global Forest Watch](monitorim.md#global-forest-watch) · [NASA FIRMS](monitorim.md#nasa-firms) |
| Analizoj Sentinel pa u varur nga një kompani e vetme | [SNAP](monitorim.md#snap-dhe-qgis) ose [SentinelHub (plugin)](monitorim.md#sentinelhub-plugin) |

**Ç'kërkojmë:** formate të hapura (GeoJSON, GPX, GeoPackage); punë **offline** në terren; sistem koordinatash i qartë (**WGS84** për shkëmbim); për satelitët — të dhëna të hapura ose falas jo-komerciale, metodë e dokumentuar, rezolucion i mjaftueshëm (10 m ose më mirë); përparësi ndaj mjeteve me kod të hapur.

## Hapi tjetër

Kur të dhënat janë mbledhur dhe verifikuar, kalo te [Raportuesi](../raportuesi/index.md) për t'i kthyer në një dosje ose kontribut.
