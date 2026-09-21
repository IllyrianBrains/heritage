# Verifikim & arkivim

Për të provuar që një foto, video ose dokument është i vërtetë dhe për ta ruajtur para se të zhduket.

*Versioni i parë: shtator 2026*

## Ç'kërkojmë

- Metodë e **përsëritshme** nga të tjerët.
- Mjeti nuk ndryshon origjinalin.
- Ruan **metadata** dhe kohën e ruajtjes.

## Mjetet

### ExifTool

:material-file-image-outline: [exiftool.org](https://exiftool.org) · falas, kod i hapur

Lexon dhe pastron metadatat e fotove (data, GPS, pajisja). **Lexo** ato para se të verifikosh; **fshiji** ato para publikimit kur vendndodhja duhet mbrojtur.

```bash
exiftool foto.jpg                 # shiko metadatat
exiftool -all= -o publike.jpg foto.jpg   # kopje publike pa metadata
```

### SunCalc

:material-white-balance-sunny: [suncalc.org](https://www.suncalc.org) · falas

Kontrollon nëse hijet dhe ora e diellit në një foto përputhen me datën e deklaruar.

### InVID-WeVerify

:material-video-outline: [invid-project.eu](https://www.invid-project.eu/tools-and-services/invid-verification-plugin/) · shtesë shfletuesi, falas

Analizë e videove dhe e fotove (kuadro, kërkim invers i imazhit, metadata).

### Kërkim invers i imazhit

Google Lens, TinEye, Bing Visual Search: kontrollon nëse një foto është përdorur më parë. Përdori disa mjete, jo vetëm një.

### Wayback Machine

:material-archive-outline: [web.archive.org](https://web.archive.org) · falas

Arkivon faqet publike (njoftimet e institucioneve, VNM, njoftime tenderi) para se të ndryshojnë ose hiqen. Ruaj lidhjen e arkivit dhe datën.

### Wikimedia Commons

:material-image-multiple-outline: [commons.wikimedia.org](https://commons.wikimedia.org) · falas

Ruan fotografi me licencë të lirë në mënyrë të qëndrueshme dhe i lidh me Wikipedia/Wikidata. Vetëm për foto që ke të drejtë t'i licencosh dhe që nuk rrezikojnë specie ose njerëz.

## Rregulla

1. **Mos redakto origjinalin.** Punoj mbi kopje.
2. Ruaj **origjinalin me metadata** në një vend të sigurt.
3. Shënoje çdo verifikim: çfarë provove, si, dhe kur.
4. **Dallo** çka je i sigurt nga ajo që supozon.

Shih [Dokumento një problem](../aktivizmi/dokumento.md) për paketën minimale të dëshmisë.
