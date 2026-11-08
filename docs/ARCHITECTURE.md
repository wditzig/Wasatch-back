# Technical Architecture

## Principles
- **Data-driven:** obstacles, zones, riders, outfits and headlines are plain dictionaries in `scripts/data/`. Adding an obstacle = one entry in `obstacles.gd` (+ a sprite).
- **Code-built scenes:** `.tscn` files are thin roots; nodes are created in `_ready()`. This keeps diffs readable and avoids editor-only state.
- **No binary assets yet:** `Art` builds textures from ASCII maps, procedural drawing and a 5×7 pixel font; `Sfx` synthesizes all audio. Each has a single lookup (`Art.tex(id)`, `Sfx.play(id)`) so hand-made PNG/OGG files can replace entries one at a time.
- **Explicit update order:** `game.gd` calls `player.update()`, collisions, developer, events, and score in a fixed order each frame (deterministic, easy to reason about), instead of relying on node process order.
- **No physics engine:** collisions are AABB checks against small "feet" hitboxes, only for obstacles within a vertical window of the rider. It's cheap and predictable on mobile.

## Autoloads
| Name | File | Responsibility |
|---|---|---|
| `Game` | game_state.gd | Profile/settings/high scores (ConfigFile at `user://wasatch_back.cfg`), input map, unlock rules, haptics, dev screenshot tool |
| `Art` | art.gd | Texture factory + cache, outfit recoloring (J/j/H/h palette keys), pixel text |
| `Sfx` | audio.gd | Music/SFX buses, voice pool, procedural synthesis (music built on a WorkerThreadPool task) |

## Run scene graph (built by game.gd)
```
Game (Node2D, PROCESS_MODE_ALWAYS — handles pause)
├─ ground (Sprite2D, tiled speckle, follows camera)
├─ tracks (Node2D, _draw polylines)
├─ world (Node2D, y_sort) ── player, developer, obstacles…
├─ spawner (Node2D)
├─ gondola (Node2D, z 40, overhead)
├─ Camera2D (zoom 1.2, rider at 32% from top, horizontal look-ahead, shake via offset)
├─ CanvasLayer 5: fog (shader vignette), snowfall (CPUParticles2D)
└─ HUD (CanvasLayer 10, PROCESS_MODE_ALWAYS)
```

## Terrain generation
The world is an infinite grid of 80 px cells. When a cell enters the generation rect (view + margins, extra lookahead below), it's seeded from `hash(run_seed, cx, cy)`, so it's deterministic and order-independent. The zone at the cell's depth picks an obstacle by weight. `density × (0.8 + 0.7×difficulty)` decides if the cell spawns anything. Clusters (`cluster`) and set pieces (`parts`, e.g. toll plazas and paywalls) expand into several obstacles. Obstacles far behind or far to the side are freed; old cell keys are pruned. Gondola towers spawn on a fixed cable x every 560 px from Phase 1.

## Environment layer (decor.gd)
Ground details use their own grid (120 px) and their own RNG stream (`hash(seed, cx, cy, SALT)`), so adding or changing decorations can never shift obstacle generation. Obstacle sprite **variants** are chosen from a hash of the obstacle's position, for the same reason. `tools/terrain_fingerprint.tscn` prints obstacle counts per phase and a hash of every placement; it must not change when only visuals change.

Current fingerprint (seed 12345): `obstacles=3080 per_zone=[151, 465, 658, 889, 917] hash=0590e06dc560e424d32d32ee356984ab`

## Performance notes
- Typical live obstacle count is 25–65; a collision check costs O(n) with an early y-reject.
- All textures are tiny and cached; nearest filtering; no per-frame allocations in hot paths except popups.
- CPUParticles2D (not GPU) for compatibility on older GLES3 devices.
- Music synthesis runs off the main thread.

## Extending
- **New obstacle:** add a sprite to `sprites.gd` (or a `_procedural` case in `art.gd`) and a def in `obstacles.gd` with weights per zone.
- **New zone:** append to `zones.gd` and extend every `weights` array.
- **New event:** add a case in `event_director.gd::_start` and handle it in `game.gd::_on_event_started/_ended`.
- **New rider:** add to `riders.gd` and draw `<prefix>_{down,diag,side,air,grab,crash}` sprites.
- **Real art:** make `Art.tex()` check `res://art/<id>.png` first.
