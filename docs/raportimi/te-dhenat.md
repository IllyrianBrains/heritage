# Të dhënat e nevojshme

Raportet ndërkombëtare kërkojnë të njëjtat lloje të dhënash, edhe pse formularët ndryshojnë. Kjo faqe i grupon sipas asaj që duhet të përmbajë një dosje për një sit ose një çështje, me standardet ku ka.

## Lista e të dhënave sipas kategorisë

| Kategoria | Çfarë duhet | Shembull |
|---|---|---|
| **Identifikimi** | Emri, kodi, akti i shpalljes dhe data, autoriteti menaxhues | Vendimi i Këshillit të Ministrave, viti, AKZM |
| **Vendndodhja dhe kufijtë** | Poligoni i kufirit, sipërfaqja, sistemi i koordinatave | GeoJSON në WGS84; hektarë |
| **Kategoria dhe statusi** | Kategoria IUCN, statusi ndërkombëtar (Ramsar, UNESCO, Emerald, KBA) | Kategoria II; sit Ramsar |
| **Gjendja e natyrës** | Habitatet, speciet, popullatat, cilësia e ujit, mbulesa e tokës | Listë e specieve me status IUCN; klasa ekologjike e lumit |
| **Trysnitë dhe kërcënimet** | Çfarë e prek zonën, ku, kur dhe sa e rëndë | Prerje pylli; përdor klasifikimin e kërcënimeve të IUCN, shih [Kërcënimet](../baza/kercenime.md) |
| **Menaxhimi** | Plani i menaxhimit, zonimi, stafi, buxheti, monitorimi, efektshmëria | Plan i miratuar; rezultati i vlerësimit METT |
| **Vendimet dhe lejet** | Lejet mjedisore, VNM, vendimet gjyqësore, ankesat | Numri dhe data e lejes; statusi i procedurës |
| **Metadata** | Burimi, data, metoda, licenca, pasiguria | "Vëzhgim në terren, 12.06.2026, GPS ±5 m, CC-BY" |

## Standardet e të dhënave

| Standardi | Për çfarë shërben |
|---|---|
| **Darwin Core** | Formati ndërkombëtar për vëzhgime specieve; përdoret nga [GBIF](https://www.gbif.org) |
| **Atributet e WDPA** | Fusha standarde për zona të mbrojtura (emri, kategoria IUCN, statusi, viti, autoriteti); përdoren nga [Protected Planet](https://www.protectedplanet.net) |
| **Variablat Thelbësorë të Biodiversitetit (EBV)** | Kornizë e GEO BON: gjenetika, popullatat, tiparet, bashkësitë, funksioni dhe struktura e ekosistemit |
| **INSPIRE** | Standardi evropian për të dhëna hapësinore, përfshirë *Vendet e mbrojtura* |
| **ISO 19115** | Standardi për metadatat e të dhënave gjeohapësinore |
| **Parimet FAIR** | Të dhëna të gjetshme, të qasshme, ndërvepruese dhe të ripërdorshme |

## Fushat minimale për një vëzhgim specieje

Në formatin Darwin Core, një regjistrim i përdorshëm ka të paktën:

| Fusha | Kuptimi |
|---|---|
| `scientificName` | Emri shkencor i specieve |
| `eventDate` | Data (dhe ora) e vëzhgimit |
| `decimalLatitude`, `decimalLongitude` | Koordinatat në WGS84 |
| `coordinateUncertaintyInMeters` | Pasiguria e vendndodhjes |
| `basisOfRecord` | Lloji i dëshmisë (vëzhgim njerëzor, foto, mostër) |
| `recordedBy` | Kush e regjistroi |
| `occurrenceID` | Identifikues unik i regjistrimit |

## Cilësia që kërkojnë raportet

- **Vijë referimi (*baseline*).** Një tregues ka kuptim vetëm ndaj një pike fillestare; shëno vitin dhe metodën.
- **Seri kohore.** Të njëjtën gjë matur me të njëjtën metodë në intervale të rregullta.
- **Metodë e dokumentuar.** Që dikush tjetër ta përsërisë.
- **Pasiguri e deklaruar.** Numri i mostrave, saktësia e GPS-it, kufizimet.
- **Burim dhe licencë.** Shih [Burimet e të dhënave](../baza/burime-te-dhena.md).

## Të dhëna të ndjeshme

Vendndodhja e saktë e specieve të rrezikuara ose të kërkuara për tregti mund të ekspozojë ato ndaj gjuetisë dhe mbledhjes. Para se të publikosh:

- **Përgjithëso koordinatat** (p.sh. katror 10 km) për speciet e ndjeshme.
- Ruaj vendndodhjen e saktë në një arkiv të mbyllur për institucionet.
- Shëno në të dhëna që janë përgjithësuar (Darwin Core ka fushën `dataGeneralizations`).

## Hapi tjetër

Mbledh të dhënat me mjetet te [Rekomandime](../rekomandime/index.md) dhe pastaj shih [Treguesit](treguesit.md) për ta kthyer në matje që përdoren në raporte.

## Burimet

- [Darwin Core (TDWG)](https://dwc.tdwg.org)
- [GBIF: publikimi i të dhënave](https://www.gbif.org/publishing-data)
- [Protected Planet: WDPA Manual](https://www.protectedplanet.net)
- [GEO BON: Essential Biodiversity Variables](https://geobon.org/ebvs/what-are-ebvs/)
- [GO FAIR: Parimet FAIR](https://www.go-fair.org/fair-principles/)
