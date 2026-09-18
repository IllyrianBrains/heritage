# Trashëgimia Natyrore

Platformë GIS për trashëgiminë natyrore të Shqipërisë dhe Kosovës. Harta ka tri shtresa: **zona natyrore**, **flora** dhe **fauna**. Klikimi në objekt hap kartën dhe burimet e tij. Ndërfaqja përdor Astro dhe OpenLayers.

## Nisja lokale

```bash
npm ci
npm run dev
```

`npm run build` krijon aplikacionin statik në `dist/`.

## Publikimi në GitHub Pages

Workflow-i [`.github/workflows/pages.yml`](.github/workflows/pages.yml) ndërton dhe publikon faqen pas çdo `push` në `main`; mund të niset edhe nga **Actions → Publish to GitHub Pages → Run workflow**. Në **Settings → Pages**, zgjidhni **GitHub Actions** si burim publikimi. Adresa e projektit origjinal është `https://pomodoren.github.io/heritage/`.

Për ta publikuar një fork, aktivizoni **Actions** në fork dhe zgjidhni **GitHub Actions** te **Settings → Pages**. Workflow-i përdor adresën dhe rrugën që kthen GitHub Pages: një fork `emri/imja` publikohet zakonisht te `https://emri.github.io/imja/`, ndërsa një domen i personalizuar përdoret nga rrënja e tij. Lidhjet për propozimin e ndryshimeve në faqe drejtojnë te depoja që po ndërtohet.

Workflow-i përdor Node.js 24. Për ta provuar lokalisht me të njëjtën rrugë si projekti origjinal:

```bash
SITE_URL=https://pomodoren.github.io BASE_PATH=/heritage npm run build
```

Për një domen të personalizuar, vendoseni te **Settings → Pages** dhe konfiguroni DNS-in. Workflow-i e merr adresën automatikisht nga GitHub Pages; me publikim përmes GitHub Actions nuk kërkohet skedar `CNAME`.

## Eksplorimi në hartë

Shiriti sipër ka lidhjet **Raportet**, **Shto shënim**, **Shto të dhëna** dhe **Rreth projektit**. Filtrat me zgjedhje të shumëfishtë dhe kërkimi janë mbi hartë; **Legjenda** përmban edhe zgjedhjen e shtresave. Prezantimi i projektit, i nisur nga Flamingo Revolution me kontribute nga organizata të ndryshme, shfaqet si dritare kur hapet faqja dhe mund të rihapet nga **Rreth projektit**. Faqja **Shto të dhëna** jep hapat për përgatitjen dhe propozimin e GeoJSON. Galeria është shiriti anësor i majtë; mund të fshihet, të rihapet dhe të zgjerohet duke tërhequr skajin e saj në ekran të madh. Filtri i fotografive gjendet brenda galerisë. Klikimi i një pike e rrethon me të verdhë dhe hap menjëherë një kartë të shkurtër me figurën, kur ka, dhe butonin **Lexo më shumë** për panelin e detajeve. Zonat e zgjedhura marrin kufi të verdhë. Klikimi i kartës së galerisë ose i një zone në hartë hap panelin e djathtë pa lëvizur ose afruar hartën; butoni **Shfaq të gjitha** është kontrolli i qartë për rivendosjen e pamjes.

Galeria i grupon kartat në seksione të palosshme sipas llojit të shtresës: zona natyrore, florë dhe faunë, me numrin e rezultateve në secilin grup. Seksioni i parë hapet fillimisht; të tjerët janë të mbyllur. Karta e një zone tregon numrin e vëzhgimeve të importuara brenda kufirit; paneli i saj lidhet me regjistrimet përkatëse të florës dhe faunës. Karta e vëzhgimit tregon llojin, vendin, datën dhe fotografinë kur ka një të licencuar. Paneli i detajeve mban burimin dhe licencën pranë fotografisë.

Shënimet e publikuara lexohen nga `public/data/manual/notes.geojson`. Secila pikë ka `id` unik dhe `properties.text`, `category` e `source`; vendndodhjet orientuese shënohen si të tilla në tekst. Kategoritë e semaforit janë `red` (ndikim i raportuar), `yellow` (shqetësim për verifikim) dhe `green` (përmirësim i dokumentuar). Kategoria përmbledh shënimin dhe nuk është vlerësim zyrtar i gjendjes ose ligjshmërisë. Shënimet e publikuara kanë lidhje te burimi dhe nuk mund të fshihen nga vizitorët. Shënimet personale ruhen në shfletues, mund të eksportohen veçmas dhe bëhen të lexueshme në zmadhimin 11 ose më lart.

## Përditësimi i të dhënave

```bash
python3 -m pip install -r requirements-data.txt
python3 scripts/extract_nature.py
python3 scripts/link_species_to_areas.py
python3 scripts/enrich_wikipedia_images.py
```

Skripti kërkon parqe kombëtare (`boundary=national_park`), zona të mbrojtura (`boundary=protected_area`, duke përfshirë peizazhet e mbrojtura dhe kategori të tjera IUCN sipas `protect_class`) dhe rezervate natyrore (`leisure=nature_reserve`) të etiketuara në OpenStreetMap si `relation` ose `way`, për Shqipërinë (`AL`) dhe Kosovën (`XK`). Gjeometria merret me Overpass `out geom`; kufijtë ruhen si `Polygon` ose `MultiPolygon`, duke përfshirë vrimat. Kërkimi bëhet në kuti gjeografike dhe rezultatet filtrohen sipas kufirit të vendit nga Nominatim (kërkim i strukturuar me emrin anglisht të vendit, p.sh. `country=Albania`). Vëzhgimet e bimëve dhe kafshëve merren nga GBIF dhe ruhen si pika me datën, burimin dhe licencën e regjistrimit. **Pika e vëzhgimit nuk përfaqëson habitatin apo shtrirjen e llojit.** Mungesa e një vëzhgimi në hartë nuk tregon mungesë të llojit në terren.

Mund të përdorni `--countries AL XK`, `--osm-limit 100`, `--gbif-limit 100`, `--skip-gbif` dhe `--output-dir` për të kontrolluar importin. `--skip-gbif` merr vetëm shtresat nga OpenStreetMap/Overpass, pa e prekur fare GBIF-in as skedarët `flora.geojson`/`fauna.geojson` ekzistues. Importi shkruan një skedar për çdo shtresë:

- `public/data/groups/parqe.geojson` (parqe kombëtare)
- `public/data/groups/mbrojtura.geojson` (zona të mbrojtura, përfshi peizazhet e mbrojtura)
- `public/data/groups/rezervate.geojson` (rezervate natyrore)
- `public/data/groups/flora.geojson`
- `public/data/groups/fauna.geojson`

`public/data/groups.json` përcakton shtresat dhe skedarët e lexuar nga harta. Skedarët `public/data/manual/<grupi>.geojson` nuk mbishkruhen gjatë importit. Një grup i ri mund të shtohet në manifest me skedarin e vet GeoJSON.

Nëse Overpass është i zënë, `python3 scripts/extract_nature.py --skip-osm` përditëson vetëm vëzhgimet GBIF dhe ruan zonat ekzistuese (parqe, mbrojtura, rezervate). `python3 scripts/import_park_boundaries.py` shton parqe të emërtuara me poligonet OSM nga Nominatim, direkt te `parqe.geojson`. Importi fillestar i përfshirë në depo u bë në këtë mënyrë, sepse dy serverë publikë Overpass kthyen gabime kohore gjatë importit të gjerë. Për parqe të tjera përdorni Overpass ose hartëzim manual me kufirin dhe burimin e verifikuar.

`link_species_to_areas.py` numëron vëzhgimet GBIF që bien brenda secilit poligon dhe liston disa lloje në kartën e zonës. Kur parku nuk ka fotografi të vetën, mund të shfaqet fotografia e një vëzhgimi brenda kufirit, e shënuar qartë si e tillë. Këto numra pasqyrojnë vetëm regjistrimet e importuara, jo një inventar të plotë të parkut.

Fotografitë GBIF merren nga media e vëzhgimeve me licencë CC0, CC BY, CC BY-SA ose CC BY-NC; fotografitë me kufizim ND dhe ato pa licencë të qartë nuk shfaqen. Kartat tregojnë autorin dhe licencën, ndërsa paneli i detajeve lidhet me fotografinë dhe kushtet e licencës. `enrich_wikipedia_images.py` përdor imazhin e artikullit vetëm kur ai gjendet në Wikimedia Commons me licencë të verifikueshme. Fotografitë ngarkohen nga shërbimet burimore, prandaj mund të mungojnë kur një burim nuk përgjigjet.

## Statusi dhe ndërhyrjet

Organizatat mjedisore (NGO) raportojnë gjendjen e zonave, kuadrin ligjor dhe ndërhyrjet e planifikuara në një Google Sheet të përbashkët me katër fletë, që sinkronizohet në sit me:

```bash
python3 scripts/sync_status.py --sheet-id <ID_I_SHEET>
```

`sync_status.py` lexon çdo fletë si CSV (nuk kërkohet "publish to web", mjafton ndarja "kushdo me lidhjen mund të shohë"), i lidh rreshtat me zonat ekzistuese në `public/data/groups/` dhe `public/data/manual/` sipas `ID i zonës`, dhe shkruan `public/data/status/{areas,interventions,organizations,legislation}.json`. Një ID e panjohur, fushë e detyrueshme që mungon, ose vlerë e papranuar shpërfillet ose zëvendësohet me një vlerë të parazgjedhur dhe raportohet si paralajmërim në terminal — sinkronizimi nuk ndalet për një rresht të keq. Mund të përdorni `--areas-tab`, `--interventions-tab`, `--organizations-tab`, `--legislation-tab` nëse emrat e fletëve ndryshojnë, dhe `--areas-csv`/`--interventions-csv`/`--organizations-csv`/`--legislation-csv` për të testuar me skedarë CSV lokalë pa internet.

Krijoni Google Sheet me këto kolona (rreshti i parë, saktësisht këto emra):

**Fleta `Zonat`** — `ID i zonës` · `Emri i zonës` · `Statusi i përgjithshëm` (E mirë / Në vëzhgim / Kritike / E papërcaktuar) · `Niveli i kërcënimit` (I ulët / Mesatar / I lartë) · `Tendenca e habitatit` (Përmirësohet / Stabël / Përkeqësohet) · `Zbatimi i mbrojtjes` (I mirë / Pjesshëm / I dobët) · `Data e vlerësimit` (VVVV-MM-DD) · `Organizata vlerësuese` · `Shënime` · `Lidhje dëshmie`

**Fleta `Ndërhyrjet`** — `ID i zonës` · `Titulli` · `Përshkrimi` · `Prioriteti` (I lartë / Mesatar / I ulët) · `Statusi` (Planifikuar / Në vazhdim / Përfunduar) · `Organizata` · `Data e fillimit` · `Data e mbylljes` · `Lidhje`

**Fleta `Organizatat`** — `Emri i organizatës` · `Fokusi` · `Kontakt` · `Faqja`

**Fleta `Legjislacioni`** — `ID i zonës` · `Kategoria e mbrojtjes` (p.sh. "Park Kombëtar (Kategoria II IUCN)") · `Baza ligjore` (ligji ose vendimi që e mbron zonën) · `Niveli i përgjegjësisë` (Qendror / Vendor / Të përbashkët) · `Përparësia e qeverisë` (I lartë / Mesatar / I ulët) · `Plani i menaxhimit` (Ka / Në hartim / Nuk ka) · `Shënime` · `Lidhje` (teksti ligjor ose plani)

`ID i zonës` duhet të përputhet me `id`-në e një `Feature` ekzistues (shihni `Feature.id` te skedarët e mësipërm ose te paneli i detajeve në hartë). Zonat e reja shtohen me git te `public/data/manual/parqe.geojson`, `mbrojtura.geojson` ose `rezervate.geojson`, sipas llojit; Google Sheet mban vetëm statusin, kuadrin ligjor dhe ndërhyrjet për zonat ekzistuese. Paneli i statusit (`/dashboard`) dhe vetë harta (bordi i ngjyrës dhe seksionet "Gjendja e zonës" / "Kuadri ligjor" te paneli i detajeve) e lexojnë këtë të dhënë automatikisht pas sinkronizimit. Fusha `Niveli i përgjegjësisë` dhe `Përparësia e qeverisë` synojnë të pasqyrojnë ndarjen e kompetencave mes qeverisjes qendrore dhe vendore mbi zonën, jo vetëm gjendjen mjedisore.

## Hartëzim dhe burime lokale

Për të propozuar një objekt të ri, përgatitni GeoJSON dhe shtojeni te `public/data/manual/<grupi>.geojson` përmes një ndryshimi në depon e projektit. Faqja **Shto të dhëna** përmbledh hapat për kontribuesit.

Çdo `Feature` duhet të ketë `id` unik dhe mund të ketë `properties` si `name`, `summary`, `details`, `mapNote`, `sources` dhe `extra`. `extra` shfaqet automatikisht në panelin e detajeve. Koordinatat GeoJSON përdorin rendin `[gjatësi, gjerësi]` në WGS84.

Për t'u shfaqur kur përdoret filtri i vendit, një regjistrim manual duhet të ketë `countryCodes: ["AL"]` ose `countryCodes: ["XK"]` në `properties`.

Për një imazh të shtuar manualisht, vendosni `properties.image` si `{"url":"https://…","source":"https://…","credit":"Autori","license":"CC BY 4.0","licenseUrl":"https://creativecommons.org/licenses/by/4.0/","alt":"Përshkrimi"}`. Kontrolloni licencën dhe burimin para publikimit.

Burimi i kufijve OSM licencohet sipas [ODbL](https://www.openstreetmap.org/copyright). Vëzhgimet GBIF kanë licencë për çdo regjistrim; lidhja te regjistrimi origjinal shfaqet në kartë. Të dhënat duhen kontrolluar para përdorimit për vendime të mbrojtjes së natyrës.
