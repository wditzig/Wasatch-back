# WASATCH BACK — 30-second trailer

`wasatch-back-trailer.mp4`: 1920×1080, 30 fps, H.264 + AAC, 30 s.
Cut entirely from real gameplay. Godot's Movie Maker renders it from the scripted director scene `tools/trailer.tscn`.

| Time | Shot |
|---|---|
| 0.0–3.8 | Pristine public land, a kicker, a backflip. *"ONCE, THE MOUNTAIN BELONGED TO EVERYONE."* |
| 3.8–5.1 | Card: **THEN...** |
| 5.1–12.0 | *"THEY BROKE GROUND."* · *"THEY BUILT 'CABINS.'"* · *"THEY BOUGHT THE CLOUD."* (whiteout) |
| 12.0–13.3 | Card: **AND NOW...** |
| 13.3–20.9 | Chip Lodgeworth III chases, captures ("YOU'RE ON PRIVATE PROPERTY!" / "BUT I'LL SELL YOU A HOUSE WITH SKI ACCESS!") → ACQUIRED! *"HE WANTS YOUR LINE."* |
| 20.9–23.6 | Montage: powder day, the privatized final phase, Chip again |
| 23.6–30.0 | End card: WASATCH BACK · YOU CAN'T SKI FREE. · play free in your browser · URL · satire notice |

## Re-render

```bash
# 1. Render frames + audio (headless Linux: wrap in xvfb-run)
godot --path . --rendering-driver opengl3 --write-movie promo/frames/f.png \
      --fixed-fps 30 --resolution 1920x1080 res://tools/trailer.tscn
# 2. Encode
ffmpeg -framerate 30 -i promo/frames/f%08d.png -i promo/frames/f.wav \
       -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p \
       -c:a aac -b:a 192k -af "loudnorm=I=-16:TP=-1.5" -shortest \
       -movflags +faststart promo/wasatch-back-trailer.mp4
```

Edit the timeline in `_run()` in `tools/trailer.gd`. Shots are live game runs, configured with the dev flags (`--start-m`, `--zoom`, `--chip-now`, `--event=…`).
