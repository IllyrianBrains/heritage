# Verifikim & arkivim

Për të provuar që një foto, video ose dokument është i vërtetë dhe për ta ruajtur para se të zhduket.

*Versioni i parë: shtator 2026*

## Zgjidh shpejt

| Dua të… | Përdor |
|---|---|
| Lexoj ose pastroj metadatat e një fotoje | [ExifTool](#exiftool) |
| Kontrolloj nëse hijet përputhen me datën | [SunCalc](#suncalc) |
| Analizoj një video | [InVID-WeVerify](#invid-weverify) |
| Shoh nëse një foto është përdorur më parë | [Kërkim invers](#kerkim-invers-i-imazhit) |
| Ruaj një faqe para se të ndryshojë | [Wayback Machine](#wayback-machine) |
| Ruaj foto me licencë të lirë | [Wikimedia Commons](#wikimedia-commons) |

**Ç'kërkojmë:** metodë e **përsëritshme** nga të tjerët; mjeti nuk ndryshon origjinalin; ruan **metadata** dhe kohën e ruajtjes.

## Mjetet

### ExifTool

<span class="ib-pill">falas</span> <span class="ib-pill">kod i hapur</span> · [exiftool.org](https://exiftool.org)

Lexon dhe pastron metadatat e fotove (data, GPS, pajisja). **Lexo** ato para se të verifikosh; **fshiji** ato para publikimit kur vendndodhja duhet mbrojtur.

```bash
exiftool foto.jpg                        # shiko metadatat
exiftool -all= -o publike.jpg foto.jpg   # kopje publike pa metadata
```

### SunCalc

<span class="ib-pill">falas</span> · [suncalc.org](https://www.suncalc.org)

Kontrollon nëse hijet dhe ora e diellit në një foto përputhen me datën e deklaruar.

### InVID-WeVerify

<span class="ib-pill">shtesë shfletuesi</span> <span class="ib-pill">falas</span> · [invid-project.eu](https://www.invid-project.eu/tools-and-services/invid-verification-plugin/)

Analizë e videove dhe e fotove (kuadro, kërkim invers i imazhit, metadata).

### Kërkim invers i imazhit

Google Lens, TinEye, Bing Visual Search: kontrollon nëse një foto është përdorur më parë. Përdori disa mjete, jo vetëm një.

### Wayback Machine

<span class="ib-pill">falas</span> · [web.archive.org](https://web.archive.org)

Arkivon faqet publike (njoftimet e institucioneve, VNM, njoftime tenderi) para se të ndryshojnë ose hiqen. Ruaj lidhjen e arkivit dhe datën.

### Wikimedia Commons

<span class="ib-pill">falas</span> · [commons.wikimedia.org](https://commons.wikimedia.org)

Ruan fotografi me licencë të lirë në mënyrë të qëndrueshme dhe i lidh me Wikipedia/Wikidata. Vetëm për foto që ke të drejtë t'i licencosh dhe që nuk rrezikojnë specie ose njerëz.

## Katër rregulla

<div class="ib-steps" markdown>

1. **Mos redakto origjinalin.** Punoj mbi kopje.
2. **Ruaj origjinalin me metadata** në një vend të sigurt.
3. **Shëno çdo verifikim:** çfarë provove, si, dhe kur.
4. **Dallo** çka je i sigurt nga ajo që supozon.

</div>

Paketa minimale e dëshmisë: [Dokumento një problem](../aktivizmi/dokumento.md).
