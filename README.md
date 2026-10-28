# Sangbog

A songbook restoration project. *Sangbog* is Danish for "songbook".

## Prompt
Made by Claude Opus 5.5 on Extra with this prompt:

I want to create a simple online songbook. the song lyrics should come from: gammel-sangbog.md and the functionality and style should be a trimmed down version of: Carollyrics that also live on https://github.com/jjkramhoeft/julesangtekster.
This songbook should be without:
* The background graphics
* The info pop-up 
* The slider with for 'all' or 'selected verses'
The index page should have the title:
Kristi Kirke København
Sangbog

and the the list of songs in sections

and at the buttom the 'forord' as a 'efterskrift'
and below that a QR-code for sharing

## What it is

A phone-first web app with the songbook of Kristi Kirke København: an index of all songs in sections, one song per page, and the foreword at the bottom of the index as *Efterskrift*, followed by a QR code so others can open the songbook on their own phone.

It is a trimmed-down version of [Juletræssange](https://github.com/jjkramhoeft/julesangtekster), without the background animation, the info pop-up and the *Udvalgte vers* / *Alle vers* switch.

- Black and white with a green accent, following the phone's light/dark setting.
- Large serif lyrics, numbered verses; choruses (*omkvæd*) in italics without a number.
- Swipe left/right, tap the edge of the screen, or use the arrow keys to move to the next or previous song.
- The screen stays awake while a song is open (Screen Wake Lock API, where supported).
- Works offline once opened, and can be installed to the home screen.
- No login, no ads, no tracking, no stored settings.

## The songs

The lyrics come straight from [gammel-sangbog.md](gammel-sangbog.md); the app reads that file in the browser, so editing it is all it takes to change a song. The app expects this layout:

- `## Forord` is shown at the bottom of the index as *Efterskrift*.
- `## Indhold` is skipped; the index is built from the songs themselves.
- Every other `## …` heading is a section (*Salmer*, *Hymner*, *Åndelige sange*, *Udenlandske sange*, *Højtidssange*).
- `### <nr>. <title>` is a song, linked as `#/sang/<nr>`. Its verses are paragraphs separated by a blank line, with `\` at the end of each line.
- A paragraph written all in `*italics*` is a chorus. `**bold**` is shown as bold, and a `**(…)**` line right under the title is a subtitle.

## Technical approach

- Plain HTML, CSS and JavaScript. No build step and no dependencies at runtime, apart from a vendored QR code generator ([vendor/qrcode.js](vendor/qrcode.js), MIT).
- A web app manifest and a service worker make it installable and offline-capable.
- Hosted as a static site, for example on GitHub Pages. All paths are relative, so it works from a sub-path such as `/sangbog/`. The empty `.nojekyll` file stops GitHub Pages from turning `gammel-sangbog.md` into HTML.

```
index.html            App shell
styles.css            Layout and light/dark theme
app.js                Reads the songbook, navigation, wake lock, QR code
sw.js                 Service worker for offline use
manifest.webmanifest
icons/                App icons (SVG and PNG)
vendor/qrcode.js      QR code generator (Kazuhiko Arase, MIT)
gammel-sangbog.md     The songbook
orig/                 The original songbook as PDF
tools/serve.mjs       Small static server for local testing
```

## Running locally

The app has to be served over HTTP (not opened as a file):

```bash
node tools/serve.mjs
```

It prints the address on your network, which you can open on a phone on the same Wi-Fi.

The service worker answers from its cache first and refreshes it in the background, so a change to `gammel-sangbog.md` shows up the second time the app is opened. When you change the app shell (HTML, CSS or JS), bump `VERSION` in [sw.js](sw.js) so installed copies pick up the change.
