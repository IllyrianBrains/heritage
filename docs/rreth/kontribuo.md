# Si të kontribuosh

Ky burim ka vlerë vetëm nëse përmirësohet nga njerëz të ndryshëm. Çdo kontribut, i vogël ose i madh, ndihmon.

## Mënyrat e kontributit

<div class="grid cards" markdown>

-   :material-pencil-outline:{ .lg .middle } **Korrigjo ose plotëso**

    Gjete një gabim, një ligj të vjetruar ose një burim që mungon? Përdor butonin e redaktimit në krye të çdo faqeje.

-   :material-map-marker-plus-outline:{ .lg .middle } **Shto të dhëna në hartë**

    Propozo zona, vëzhgime ose shënime me GeoJSON dhe burim të verifikuar.

    [:octicons-arrow-right-24: Udhëzimet](#shto-te-dhena-ne-harte)

-   :material-toolbox-outline:{ .lg .middle } **Propozo një mjet**

    Sugjero një mjet ose burim që përmbush [kriteret tona](../rekomandime/index.md).

-   :material-translate:{ .lg .middle } **Përkthe ose rishiko**

    Ndihmo me gjuhën, qartësinë dhe saktësinë e ligjeve dhe termave.

</div>

## Shto të dhëna në hartë

Qytetarët, ekspertët dhe organizatat mund të dokumentojnë natyrën dhe të ndajnë burime. Çdo kontribut shqyrtohet dhe publikohet me atribuim.

### 1. Përgatit vendndodhjen

Përdor GeoJSON në sistemin koordinativ WGS84. Zonat duhen si `Polygon` ose `MultiPolygon`; vëzhgimet e florës dhe faunës si `Point`.

Mund të shtosh edhe një shënim lokal drejtpërdrejt nga [harta](../../map/?notes=1). Shënimi mbetet në pajisjen tënde derisa ta dërgosh për shqyrtim.

### 2. Shto përshkrimin dhe burimet

Çdo objekt duhet të ketë:

- një ID unike dhe emër;
- një përmbledhje të qartë;
- kodin e vendit `AL` ose `XK`;
- lidhjen, datën dhe llojin e burimit;
- autorin dhe licencën për fotografitë.

### 3. Dërgoje për shqyrtim

Vendose objektin te skedari i grupit përkatës në `public/data/manual/` dhe [propozo ndryshimin në depon e projektit](https://github.com/pomodoren/heritage). Për statusin e zonave, ndërhyrjet dhe organizatat kontribuuese përdoret fleta e përbashkët e raportimit e projektit.

!!! warning "Burimi dhe atribuimi janë të detyrueshme"
    Çdo propozim duhet të tregojë burimin, datën, licencën kur aplikohet dhe personin ose organizatën kontribuuese.

## Bashkëpuno me rrjetin

- **Qytetar:** raporto një specie, ndryshim ose shqetësim dhe ruaj burimin përkatës.
- **Ekspert:** prezanto fushën, zonën ku punon dhe mënyrën si mund të shqyrtosh ose pasurosh të dhënat.
- **Organizatë:** paraqit projektet, zonat e punës dhe datasetet që mund të përdoren nga rrjeti.

Për të propozuar një profil ose organizatë, [hap një çështje në GitHub](https://github.com/pomodoren/heritage/issues). Profilet e publikuara gjenden te [Rrjeti](rrjeti.md).

## Rrjedha e kontributit

1. **Hap një çështje ose propozim** në [GitHub](https://github.com/pomodoren/heritage/issues), ose përdor butonin e redaktimit.
2. **Ndrysho ose shto** faqen në Markdown (`docs/`).
3. **Jep burime:** çdo pretendim faktik ka nevojë për lidhje ose referencë.
4. **Dërgo propozimin** (*pull request*); dikush do ta rishikojë.
5. **Pas shqyrtimit**, ndryshimi publikohet automatikisht.

## Standardet

- Shkruaj **shqip të qartë**, me fjali të shkurtra dhe pa zhargon të panevojshëm.
- Nuk shtojmë lidhje reklamuese ose tregtare.
- Mos shto **vendndodhje të sakta të specieve të rrezikuara** ose të dhëna personale.
- Ndiq [metodologjinë](metodologjia.md) dhe kërkesat e [licencës](licenca.md).

## Struktura e dokumenteve

| Seksioni | Dosja | Ç'përmban |
|---|---|---|
| Baza e njohurive | `docs/baza/` | Njohuri, kuadri, të dhëna |
| Rekomandime | `docs/rekomandime/` | Mjete dhe organizata |
| Aktivizmi | `docs/aktivizmi/` | Procese, modele, raste |
| Rreth nesh | `docs/rreth/` | Misioni, metodologjia, kontributi |

## Ndërtimi lokal

```bash
python3 -m pip install -r requirements.txt
mkdocs serve
```

Dokumentacioni hapet te `http://127.0.0.1:8000/`.
