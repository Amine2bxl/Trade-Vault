# Pub TradeVault — 20 s, 1920×1080, 60 fps

Motion design codé avec [Remotion](https://www.remotion.dev) : de vraies captures de l'app (le plan Monte Carlo est devenu celui du calendrier quand sa capture a quitté `src/assets/product/`), les jetons de la landing (émeraude `#22e08a`, fond `#07080a`, Inter), une grille à 120 BPM que l'image et le son partagent.

Dossier isolé : ses dépendances ne touchent ni l'app ni le build Vercel.

## Lancer

```bash
cd video
bun install
bun run studio       # preview avec timeline, http://localhost:3000
bun run render       # → out/tradevault-20s.mp4 (h264, CRF 16, son inclus)
bun run render:web   # → out/tradevault-20s.webm (VP9, muet, pour la landing)
```

Le premier rendu télécharge Chrome Headless Shell tout seul.

## Les versions verticales (TikTok, Reels, Shorts, Pinterest)

Quatre compositions 1080×1920 sur la **même grille et la même bande-son** :
`Vertical-FR-A`, `Vertical-FR-B`, `Vertical-EN-A`, `Vertical-EN-B` (deux
langues × deux accroches à tester l'une contre l'autre). Le téléphone montre
les captures `-m` ; le texte vit dans la zone que l'interface TikTok ne couvre
pas ; la mention « Vraie app · données d'exemple » accompagne chaque plan
produit.

```bash
bun run render:vertical   # → out/tradevault-9x16-{fr,en}-{a,b}.mp4
```

Textes, cadrages et surlignages : `src/vertical/script.ts` (accroches dans
`HOOKS`). Sans réseau pour télécharger Chrome Headless Shell, ajouter
`--browser-executable=<chemin>` à `remotion render`.

## Modifier sans tout refaire

**Presque tout se règle dans `src/scenes.ts`.** On compte en *temps* : 1 temps = 0,5 s = 30 frames.

| Je veux changer… | Où |
|---|---|
| un texte | `copy: [{ at, text }]`, `*mot*` = mot en émeraude |
| la durée ou l'ordre d'un plan | `beat` (départ) et `len` (durée) |
| une capture | le fichier dans `src/assets/product/`, ou l'import dans `src/assets.ts` |
| le cadrage | `cam: [départ, arrivée]` : `fx`/`fy` = point de l'image (0..1), `z` = zoom, `ax`/`ay` = où ce point tombe à l'écran, `rx`/`ry` = inclinaison 3D |
| une transition | `enter` : `whip-left`, `whip-right`, `whip-up`, `zoom`, `wipe`, `fade`, `cut` |
| un surlignage sur l'UI | `marks` : rectangle `[x, y, largeur, hauteur]` en fractions de l'image |
| le montage final, le CTA, le HUD | `MONTAGE`, `CTA`, `HUD` |
| une preview plus fluide | `MOTION_BLUR.samples = 1` (remettre 10 avant le rendu) |

Une capture 2x qui garde la même mise en page garde le même cadrage, puisque tout est exprimé en fractions de l'image.

## Le son

**Étape 1 (actuelle)** : `bun run audio` *calcule* la musique et les SFX (kick, clap, hats, basse, supersaw en fa mineur, sidechain, whooshes, impacts, sub-drops, tics accordés), en lisant les mêmes temps que l'image. `studio` et `render` le relancent automatiquement. Sortie : `public/audio/synth.wav`.

`TIMECODES.md` liste chaque événement (coupe, whoosh, impact, tic, silence) en temps, frame et timecode. Il est regénéré depuis `scenes.ts`, donc toujours juste.

**Étape 2** : avec une vraie piste et un pack SFX, les fichiers se posent sur ces mêmes événements (`src/events.ts`) et le rendu les mixe. Le montage ne change pas.

Brief pour choisir la piste (Artlist, Epidemic Sound, Musicbed) :

- **120 BPM exactement**, 4/4, idéalement en fa mineur ;
- tension dans l'intro, **chute à 0:02**, énergie tenue, montée de 0:10 à 0:16,9 ;
- **coupure franche à 0:16,9**, gros impact à **0:17**, résonance jusqu'à 0:20 ;
- mots-clés : *tech house*, *future bass*, *hybrid trailer*, *sidechain*, *120 bpm*.

## Retoucher dans CapCut ou DaVinci

`out/tradevault-20s.mp4` s'importe tel quel. Les timecodes de `TIMECODES.md` servent de marqueurs pour poser ou remplacer un son à la frame près.

## Fichiers

```
src/scenes.ts    ★ le montage (texte, timing, cadrage, transitions)
src/vertical/    ★ les déclinaisons 9:16 (script.ts = textes et cadrages)
src/beats.ts     la grille (BPM, fps, temps → frame)
src/theme.ts     couleurs, polices, courbes de la landing
src/assets.ts    les captures
src/events.ts    les événements sonores déduits du montage
src/Scene.tsx    un plan : cadre LP, caméra, révélation, surlignages
src/Copy.tsx     texte cinétique (montée, frappe, glitch)
src/words.ts     découpage du texte en mots et accents
src/Finale.tsx   montage éclair + écran de fin
src/fx.tsx       fond LP, flou de bougé, grain, vignette, HUD, flashs
scripts/audio.ts synthèse audio + TIMECODES.md
```

Licence Remotion : gratuite pour un particulier ou une entreprise de 3 personnes au plus. Au-delà, il faut une licence entreprise.
