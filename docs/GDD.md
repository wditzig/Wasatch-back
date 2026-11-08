# WASATCH BACK — Game Design Document

**Title:** WASATCH BACK  
**Tagline:** YOU CAN'T SKI FREE. (a play on the 1990s classic and the commercialization of Utah's public lands)  
**Supporting line:** THE GREATEST SNOW ON EARTH. TERMS APPLY.  
**Larger message:** TAKE BACK THE MOUNTAIN.

### Tagline in play
The run opens with **SKI FREE!**. Each phase banner, and the property line painted across the slope there, takes a little more of it back: PUBLIC ACCESS SUBJECT TO CHANGE → YOUR MOUNTAIN. THEIR INVESTMENT. → POWDER NOW AVAILABLE BY SUBSCRIPTION → THE GREATEST SNOW ON EARTH. TERMS APPLY. A final line painted at 4,800 m reads **YOU CAN'T SKI FREE.** The game-over screen rotates through YOU CAN'T SKI FREE / THE DEVELOPERS WIN THIS ROUND / PUBLIC ACCESS REVOKED / YOUR POWDER HAS BEEN REZONED / THANK YOU FOR VISITING. PARKING IS $85.
**Genre:** Endless downhill arcade (top-down), 1990s PC-arcade inspired, original IP.
**Platforms:** iOS, Android (portrait, one thumb). Desktop for development.
**Session length:** 30 s – 4 min. Instant restart.

## 1. Pillars
1. **Feels great in one thumb.** Responsive steering, readable hazards, satisfying crashes and landings.
2. **One more run.** Short runs, combos worth chasing, visible unlocks, a personal best always in sight.
3. **Funny first, point second.** Satire through the *environment* changing under you — not lectures. Enjoyable whatever your politics.
4. **Clearly fiction.** All villains/brands invented; real-world facts kept separate and sourced (see SATIRE_AND_FACTS.md).

## 2. Core loop
Ski downhill → dodge, jump, trick, collect → build a combo → bank it → mountain develops into the next phase → the Developer shows up → crash 3 times or get ACQUIRED → see score/unlocks → **Ride again** (one tap).

## 3. Riders
| | SAGE (Skier) | JUNIPER (Snowboarder) |
|---|---|---|
| Turning | Sharp (3.6 rad/s) | Wider (2.9) |
| Top speed | 1.0× | 1.04× |
| Deep powder | Bogs down (0.6×) | Floats (1.08×) + "POWDER SURF" bonus |
| Ice | Grips (0.85 turn) | Sketchy (0.4 turn) |
| Air | 1.0× | 1.22× airtime |
| Trick speed | 1.0× | 1.15× |

## 4. Movement
- Heading angle from straight downhill, ±88°. Target speed = max × cos(heading)^1.3, so turning across the slope bleeds speed and full sideways stops you (SkiFree-style control).
- **Follow-finger** control: rider steers toward where you hold. Finger above the rider = brake; far below = tuck.
- Tuck: +22% top speed, −40% turning. Max speed rises with distance (difficulty 0→1 over 4,500 m).

## 5. Jumps & tricks
- **Kickers** (snow ramp, construction spoil-pile = 1.45× air), **moguls** (small pops), **hop** (tap on the ground, 0.55 s cooldown).
- In the air: **360** (tap), **BACKFLIP** (swipe up), **GRAB** (swipe down, satirical grab names). One trick can be queued after the current one.
- Chains collapse into names: 360+360 = **720**, flip+flip = **DOUBLE BACKFLIP**, mixed = "BACKFLIP + 360" (×1.5).
- Landing with >20% of a trick left = **bail** (crash, lose a life and the combo).
- Airborne riders clear anything not flagged `tall` (rocks, cones, fences, hot tubs, drones, toll arms…). Trees and buildings still hit.

## 6. Scoring
| Source | Points |
|---|---|
| Distance | 0.5 / m (instant) |
| Close call (<16 px from a solid) | 40, razor-close (<8 px) 75 |
| Airtime | 80 / s |
| 360 / Backflip / Grab | 150 / 250 / 100 |
| Public Access Pass (token) | 50 (+1 currency) |
| Jumping a toll gate | 250 |
| Escaping the Developer | 400 |
| New phase | 500 × phase |
| Paying a toll / paywall | −150 / −300 |

Style points go into a **combo pool**; each event adds +0.5× (cap 8×) and resets a 3 s timer (paused in the air). When the timer runs out the pool × multiplier is **banked**. Crashing or hitting a cone/stump **loses** the unbanked pool. Powder Day doubles everything.

## 7. Failure
3 lives ("beanies"). Solid hit = crash (1.1 s, then 1.6 s invulnerable). 0 lives = **SEASON PASS REVOKED**. Caught by the Developer = **ACQUIRED!** (instant game over).

## 8. The mountain (environmental storytelling)
| Phase | Starts | Obstacles | Mood |
|---|---|---|---|
| Pristine Public Land | 0 m | pines, snags, granite, moguls, powder, kickers, moose, PUBLIC LAND signs | bright white, blue tracks |
| Phase 1: Groundbreaking | 600 m | cones, survey stakes, fencing, excavators, port-a-potties, snowcats, GONDOLUX towers + stalled cabins, "OPENING SOON" signs | slightly muddy snow |
| Phase 2: Luxury Living | 1,400 m | $24M "cabins", hot tubs, PRIVATE POWDER, valet golf carts, **toll plazas** | beige snow, gondola runs "VIP" |
| Phase 3: The Cloud | 2,400 m | data centers, chillers, pylons, delivery drones, refrozen ice, "NOW HIRING: 3 JOBS" | gray snow |
| Final Phase: Privatized | 3,600 m | everything + **PAYWALLS** | purple-gray snow |

The Developer first appears in Phase 1 and returns every ~16–30 s (more often later). He bulldozes trees he drives through into stumps.

### 8b. Environmental storytelling (visual only, never affects gameplay)
Obstacle density is deliberately low at the start and rises each phase. Visual detail follows the same arc on a separate, non-colliding layer (`decor.gd`), so the start stays peaceful and the end feels chaotic:

| Phase | Ground details (muted, flat) | Overhead | Light & snowfall |
|---|---|---|---|
| Pristine | wind drifts, sagebrush, rabbit & deer tracks, pine needles, twinkling sparkles | raven flocks | clean white |
| Groundbreaking | snowcat treads, mud, orange survey X's, boot prints | ravens | slightly warm |
| Luxury Living | groomed corduroy, steaming heated driveways, golf-cart tracks, valet stripes, litter | helicopter (heli-ski for members) | golden-hour glow, champagne-tinted flakes |
| The Cloud | data cables, slush, ice cracks, steam vents | delivery-drone swarms | cold gray, gray flakes |
| Privatized | QR codes and "$" stencils stamped in the snow, painted ads | "OWN THE VIEW" blimp | purple dusk |

Each phase boundary is a painted property line on the snow ("SURVEY LINE - PUBLIC ACCESS ENDS", "PRIVATE PROPERTY - LOFTSIDE ESTATES", ...). Detail density runs 0.10 → 0.48 per 120 px cell. Everything is drawn under the obstacles at low contrast so hazards stay readable.

Also: tree/rock variants (snow-laden pines, tall spruce, granite slabs), soft contact shadows (sun from upper-left), wind-ripple snow texture, deep powder trenches and plumes, snow shaken off trees on impact.

### 8c. Rider animation
Pole-push/skate at low speed, tuck pose, lean into turns, knee flex that quickens with speed, take-off stretch, landing squash + snow puff, arm wobble in the air, crash tumble, then a get-up pose.

## 9. Events
- **Whiteout:** vignette fog; gondola "CLOSED DUE TO {WIND|LITIGATION|VIBES…}. STILL OPENING 2057."
- **Powder Day:** heavy snowfall, ×2 points.
- **MONOPEAK Newswire:** ticker of fictional headlines, always ending "GONDOLUX™ OPENING SOON: EST. 2057" (matching the in-game sign). Delays change the excuse, never the date.

## 10. Characters & brands (all fictional)
- **Chip Lodgeworth III** — Founder & Chief Exclusivity Officer, MONOPEAK HOLDINGS. Sunglasses, navy suit, red tie, clipboard, snowmobile. "LET'S TALK EQUITY!"
- **MONOPEAK HOLDINGS** — "Own the View."
- **GONDOLUX™** — Opening Soon™.
- **GRANITECORE DATA** — "Your snowpack is our coolant."

## 11. Progression & cosmetics
8 outfits recolor the rider sprite: 2 free; others unlock by best distance (1,000 / 2,500 / 3,600 m), score (8,000), total passes (40), runs (10). Top-10 local high scores.

## 12. Audio
Procedural chiptune loop (Am–F–C–G…), pulse lead, triangle bass, noise drums. SFX: carve hiss (speed-scaled), hop, land, 360 arpeggio, backflip whoosh, combo bank, close call, crash, cash-register toll, siren for the Developer, game-over jingle.

## 13. UX
Portrait 360×640 logical, expands to any aspect. 44 px+ touch targets. Auto-pause on app background and Android back. Settings: music, SFX, control scheme, screen shake, haptics.

## 14. Future ideas
Daily seeded canyon, ghost of your best run, "Public Comment" power-up (slows the Developer), avalanche-control event, lift-line minigame, more riders (telemark, sit-ski), share card, leaderboards.
