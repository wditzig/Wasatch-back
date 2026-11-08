# WASATCH BACK
**YOU CAN'T SKI FREE.**

*WASATCH BACK is the game. YOU CAN'T SKI FREE is the punchline. TAKE BACK THE MOUNTAIN is the larger message.*

A satirical, retro downhill skiing & snowboarding game for iOS and Android, set on a fictionalized Wasatch Range that gets steadily paved over by luxury development, a perpetually delayed gondola, and data centers — while you try to outrun a real-estate developer on a gold-trimmed snowmobile.

> **Satire notice:** MONOPEAK HOLDINGS, Chip Lodgeworth III, the GONDOLUX™, GRANITECORE DATA and every in-game headline, sign and quote are fictional. See [`docs/SATIRE_AND_FACTS.md`](docs/SATIRE_AND_FACTS.md) for how fiction and real-world facts are kept separate.

---

## ▶ Play in your browser

**https://wditzig.github.io/Wasatch-back/** works on phones and desktop, with nothing to install.

Every push rebuilds and redeploys this page automatically (`.github/workflows/web.yml`). For the best experience on a phone, open it in Chrome or Safari, then *Add to Home Screen* so it runs full-screen. Sound starts after your first tap (browsers require that).

## Engine: Godot 4.3 (GL Compatibility renderer)

| Why Godot | |
|---|---|
| Free, MIT-licensed, no royalties | Matters for an indie / advocacy release |
| First-class 2D, tiny runtime | ~30–40 MB app; low-end Android friendly |
| One-click iOS + Android export | Same project, same code |
| GDScript | Fast iteration, readable by contributors |
| GL Compatibility renderer | Runs on the widest range of phones (OpenGL ES 3 / WebGL2) |

Unity or a JS/Canvas stack would also work, but Godot gives the best size/cost/iteration trade-off for a 2D arcade game.

## What you need to install

| Purpose | Install |
|---|---|
| Run & edit the game | [Godot **4.3** stable](https://godotengine.org/download/archive/4.3-stable/) (standard build, not .NET). Any 4.3+ should work. |
| Export templates | In Godot: *Editor → Manage Export Templates → Download* |
| Android builds | Android Studio (SDK + platform-tools), OpenJDK 17, a debug keystore — then set paths in *Editor Settings → Export → Android* |
| iOS builds | macOS + Xcode, an Apple Developer account |

There are **no other dependencies**: all art, fonts-for-titles, sound effects and music are generated in code at startup, and there is no backend.

## Run it

1. Open Godot → *Import* → select this folder's `project.godot`.
2. Press **F5**. (The main scene is `scenes/main_menu.tscn`.)

Command line: `godot --path .`

## Controls

| Action | Touch (default "Follow finger") | Touch ("Tap zones") | Keyboard |
|---|---|---|---|
| Steer | Hold & drag — rider skis toward your finger | Hold left / right half | ← → / A D |
| Tuck (faster) | Drag far below the rider | Hold both halves | ↓ / S |
| Brake / stop | Drag above the rider | — | ↑ / W |
| Hop (ground) / **360** (air) | Tap | Tap | Space / J |
| **Backflip** (air) | Swipe up | Swipe up | K (or ↑ in air) |
| Grab (air) | Swipe down | Swipe down | L (or ↓ in air) |
| Pause | ‖ button | ‖ button | Esc / P |
| Restart | "Ride again" | | R |

**Jumps & tricks:** hit a snow kicker (or a construction spoil-pile kicker for bigger air), then chain tricks — two 360s = **720**, two backflips = **DOUBLE BACKFLIP**, mixes like **BACKFLIP + 360** get a 1.5× bonus. Land mid-trick and you bail. Moguls pop you into small air; you can also hop over small stuff.

## Project structure

```
project.godot             Engine config (portrait 360x640, canvas_items stretch, GL Compatibility)
scenes/
  main_menu.tscn          Title, rider & gear, high scores, settings, about
  game.tscn               A run
scripts/
  autoload/
    game_state.gd  (Game) Save data, settings, input map, unlocks, high scores
    art.gd         (Art)  Builds/caches all textures: ASCII sprites, procedural buildings, 5x7 pixel font
    audio.gd       (Sfx)  Synthesised SFX + threaded chiptune music; audio buses
  data/                   Pure data: tune the game here without touching logic
    obstacles.gd          Every obstacle: kind, hitbox, spawn weight per zone, crash message...
    zones.gd              The 5 development phases (distance, palette, density)
    riders.gd             Skier/snowboarder stats, outfits & unlock requirements
    sprites.gd            Pixel art as ASCII maps
    headlines.gd          Fictional newswire
  game/
    game.gd               Run controller: input, collisions, scoring, zones, events, game over
    player.gd             Rider physics, airtime, trick system
    spawner.gd            Infinite deterministic cell-based terrain generation + culling
    obstacle.gd           Generic data-driven obstacle node
    developer.gd          The enemy: chases, bulldozes trees into stumps, gives up
    score_system.gd       Distance points + combo pool/multiplier/banking
    event_director.gd     Whiteout / Powder Day events, gondola delays, headlines
    tracks.gd             Ski/board tracks (deep trench in powder)
    decor.gd              Non-colliding environment: ground details, property lines, flyovers
    gondola_line.gd       Overhead gondola cable + cabins
  ui/
    ui_kit.gd             Theme + widget factories
    hud.gd                HUD, pause, game over
    how_to_play.gd        Illustrated, paged guide
    share.gd              Score card image + Web Share / clipboard fallback
    main_menu.gd, menu_background.gd
docs/                     Game design doc, architecture, satire/fact policy
tools/smoke_test.sh       Headless autoplay test
```

## How to Play & sharing

- **How to Play**: a 4-page illustrated guide (steer, jumps & tricks, the mountain, combos & Chip). It opens automatically before your very first run, and is always available from the title screen and the pause menu.
- **Share**: the game-over screen and the High Scores page have a SHARE button. It builds a pixel-art score card (your rider, score, distance, phase reached, how it ended). On phones in the browser, this opens the native share sheet with the card attached. Elsewhere it copies a brag line with the game link and downloads/saves the card. Native iOS/Android share sheets need a share plugin (milestone M5).

## Testing

```bash
GODOT=/path/to/godot tools/smoke_test.sh      # headless: plays runs with a bot, fails on script errors
godot --path . res://scenes/game.tscn -- --autoplay              # watch the bot play
godot --path . res://scenes/game.tscn -- --start-m=2500          # jump straight to a later phase
godot --path . -- --shots=/tmp/shots --shot-every=2              # periodic screenshots
godot --path . res://scenes/game.tscn -- --autoplay --calm        # bot with no Developer & infinite lives (visual review)
godot --headless res://tools/terrain_fingerprint.tscn             # obstacle count per phase + placement hash
godot --headless res://tools/card_preview.tscn -- --out=/tmp      # render sample share cards
```

## Exporting to phones

1. *Project → Export → Add…* **Android** and/or **iOS**.
2. Android: set package name (e.g. `com.yourstudio.wasatchback`), keystore, and enable *Screen → Immersive mode*. Export `.aab` for Play Store.
3. iOS: set bundle id + team id, export, open the Xcode project, archive & upload.
4. Orientation is already locked to portrait in `project.godot`.

## Milestones

| # | Milestone | Status |
|---|---|---|
| M0 | Design doc, architecture, engine choice | ✅ |
| M1 | **Vertical slice**: skier + snowboarder, procedural terrain, natural hazards, construction obstacles, Developer enemy, jumps & tricks, scoring/combos, lives, game over, instant restart, high scores, settings, audio, unlockable outfits | ✅ (this commit) |
| M2 | Feel pass on device: tune speeds/turning/density with playtesters; haptics; 60 fps profiling on low-end Android | next |
| M3 | Hand-drawn art pass (replace ASCII sprites one by one), composed music, more rider animation frames | |
| M4 | Content: more obstacles/events per phase, daily seeded "Canyon of the Day", achievements, more riders/cosmetics | |
| M5 | Store readiness: icons/splash, privacy policy (no data collected), accessibility (colorblind palette, reduced motion), localization hooks, store listing, TestFlight / Play internal testing | |
| M6 | Optional: Game Center / Play Games leaderboards, share-a-run card | |

See [`docs/GDD.md`](docs/GDD.md) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
