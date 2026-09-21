# Të dhënat e nevojshme

Raportet ndërkombëtare kërkojnë të njëjtat lloje të dhënash, edhe pse formularët ndryshojnë. Kjo faqe i grupon sipas asaj që duhet të përmbajë një dosje për një sit ose një çështje.

## Tetë kategoritë e dosjes

| Kategoria | Çfarë duhet | Shembull |
|---|---|---|
| **Identifikimi** | Emri, kodi, akti i shpalljes dhe data, autoriteti menaxhues | Vendimi i Këshillit të Ministrave, viti, AKZM |
| **Vendndodhja dhe kufijtë** | Poligoni i kufirit, sipërfaqja, sistemi i koordinatave | GeoJSON në WGS84; hektarë |
| **Kategoria dhe statusi** | Kategoria IUCN, statusi ndërkombëtar (Ramsar, UNESCO, Emerald, KBA) | Kategoria II; sit Ramsar |
| **Gjendja e natyrës** | Habitatet, speciet, popullatat, cilësia e ujit, mbulesa e tokës | Listë specieve me status IUCN; klasa ekologjike e lumit |
| **Trysnitë dhe kërcënimet** | Çfarë e prek zonën, ku, kur dhe sa e rëndë | Prerje pylli; klasifikimi IUCN, shih [Kërcënimet](../baza/kercenime.md) |
| **Menaxhimi** | Plani, zonimi, stafi, buxheti, monitorimi, efektshmëria | Plan i miratuar; rezultati METT |
| **Vendimet dhe lejet** | Lejet mjedisore, VNM, vendimet gjyqësore, ankesat | Numri dhe data e lejes; statusi i procedurës |
| **Metadata** | Burimi, data, metoda, licenca, pasiguria | "Vëzhgim në terren, 12.06.2026, GPS ±5 m, CC-BY" |

## Standardet e të dhënave

| Standardi | Për çfarë shërben |
|---|---|
| **Darwin Core** | Formati ndërkombëtar për vëzhgime specieve; përdoret nga [GBIF](https://www.gbif.org) |
| **Atributet e WDPA** | Fusha standarde për zona të mbrojtura; përdoren nga [Protected Planet](https://www.protectedplanet.net) |
| **EBV** | Variablat Thelbësorë të Biodiversitetit (GEO BON): gjenetika, popullatat, tiparet, bashkësitë, funksioni dhe struktura e ekosistemit |
| **INSPIRE** | Standardi evropian për të dhëna hapësinore, përfshirë *Vendet e mbrojtura* |
| **ISO 19115** | Metadatat e të dhënave gjeohapësinore |
| **FAIR** | Të dhëna të gjetshme, të qasshme, ndërvepruese dhe të ripërdorshme |

## Fushat minimale për një vëzhgim specieje

Në formatin Darwin Core, një regjistrim i përdorshëm ka të paktën:

| Fusha | Kuptimi |
|---|---|
| `scientificName` | Emri shkencor |
| `eventDate` | Data (dhe ora) e vëzhgimit |
| `decimalLatitude`, `decimalLongitude` | Koordinatat në WGS84 |
| `coordinateUncertaintyInMeters` | Pasiguria e vendndodhjes |
| `basisOfRecord` | Lloji i dëshmisë (vëzhgim njerëzor, foto, mostër) |
| `recordedBy` | Kush e regjistroi |
| `occurrenceID` | Identifikues unik i regjistrimit |

## Cilësia që kërkojnë raportet

<div class="grid cards ib-compact" markdown>

-   :material-flag-outline:{ .lg .middle } **Vijë referimi**

    Një tregues ka kuptim ndaj një pike fillestare; shëno vitin dhe metodën.

-   :material-chart-timeline-variant:{ .lg .middle } **Seri kohore**

    E njëjta gjë e matur me të njëjtën metodë në intervale të rregullta.

-   :material-book-open-outline:{ .lg .middle } **Metodë e dokumentuar**

    Që dikush tjetër ta përsërisë.

-   :material-plus-minus-variant:{ .lg .middle } **Pasiguri e deklaruar**

    Numri i mostrave, saktësia e GPS-it, kufizimet.

-   :material-license:{ .lg .middle } **Burim dhe licencë**

    Shih [Burimet e të dhënave](../baza/burime-te-dhena.md).

</div>

## Të dhëna të ndjeshme

!!! warning "Para se të publikosh vendndodhjen e një specieje"
    Vendndodhja e saktë e specieve të rrezikuara ose të kërkuara për tregti mund t'i ekspozojë ato ndaj gjuetisë dhe mbledhjes.

    1. **Përgjithëso koordinatat** (p.sh. katror 10 km) për speciet e ndjeshme.
    2. **Ruaj vendndodhjen e saktë** në një arkiv të mbyllur për institucionet.
    3. **Shëno që janë përgjithësuar** (Darwin Core ka fushën `dataGeneralizations`).

## Hapi tjetër

Mbledh të dhënat me [mjetet e rekomanduara](../rekomandime/index.md), pastaj shih [Treguesit](treguesit.md) për t'i kthyer në matje që përdoren në raporte.

## Burimet

- [Darwin Core (TDWG)](https://dwc.tdwg.org)
- [GBIF: publikimi i të dhënave](https://www.gbif.org/publishing-data)
- [Protected Planet: WDPA Manual](https://www.protectedplanet.net)
- [GEO BON: Essential Biodiversity Variables](https://geobon.org/ebvs/what-are-ebvs/)
- [GO FAIR: Parimet FAIR](https://www.go-fair.org/fair-principles/)
