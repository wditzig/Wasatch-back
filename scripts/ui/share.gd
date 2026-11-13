extends RefCounted
## Score sharing.
##  - Builds a pixel-art score card image (rider, score, distance, phase).
##  - Web (phones): opens the native share sheet with the card + text
##    (Web Share API). Falls back to copying the text and downloading the card.
##  - Desktop/native builds: copies the text to the clipboard and saves the card
##    to the Pictures folder (native iOS/Android share sheets need a plugin; see docs).

const URL := "https://wditzig.github.io/Wasatch-back/"
const URL_SHORT := "WDITZIG.GITHUB.IO/WASATCH-BACK"

const DEFAULT_MESSAGE := "YOU CAN'T SKI FREE. 🏔️ Play WASATCH BACK — a retro skiing game where the developers are taking over the mountain. Think you can survive?"

static func message(data: Dictionary) -> String:
	var score := _fmt(int(data["score"]))
	var meters := _fmt(int(data["distance"]))
	var how := ""
	match String(data.get("cause", "")):
		"ACQUIRED!":
			how = " before Chip Lodgeworth III acquired me"
		"SEASON PASS REVOKED":
			how = " before they revoked my season pass"
	return "YOU CAN'T SKI FREE. 🏔️ I skied %s m and scored %s%s. Play WASATCH BACK — a retro skiing game where the developers are taking over the mountain. Think you can survive? %s" % [
		meters, score, how, URL]

## Returns a ~720x960 PNG-ready image.
static func make_card(data: Dictionary) -> Image:
	var w := 240
	var h := 320
	var img := Image.create(w, h, false, Image.FORMAT_RGBA8)
	var bands := [[0, Color8(36, 34, 88)], [40, Color8(74, 52, 120)], [70, Color8(150, 74, 130)], [92, Color8(232, 120, 120)], [108, Color8(250, 176, 120)]]
	for i in bands.size():
		var y0: int = bands[i][0]
		var y1: int = bands[i + 1][0] if i + 1 < bands.size() else 140
		img.fill_rect(Rect2i(0, y0, w, y1 - y0), bands[i][1])
	# stepped Wasatch ridgelines
	_ridge(img, 150, 46, 1.3, Color8(112, 96, 150), Color8(240, 200, 210))
	_ridge(img, 170, 34, 4.1, Color8(70, 70, 120), Color8(250, 236, 240))
	img.fill_rect(Rect2i(0, 176, w, h - 176), Color8(236, 242, 255))
	img.fill_rect(Rect2i(0, 176, w, 2), Color8(200, 214, 240))
	# title
	_blit(img, Art.text_tex("WASATCH BACK", Color.WHITE).get_image(), Vector2i(-1, 10), 2)
	# rider (+ Chip if he won)
	var Riders = load("res://scripts/data/riders.gd")
	var prefix: String = Riders.RIDERS.get(data.get("rider", "skier"), Riders.RIDERS["skier"])["sprite"]
	var outfit: Dictionary = data.get("outfit", {})
	var acquired: bool = data.get("cause", "") == "ACQUIRED!"
	var rider: Image = Art.tex(prefix + ("_crash" if acquired else "_air"), outfit).get_image()
	if data.get("cause", "") == "ACQUIRED!":
		_blit(img, rider, Vector2i(70, 120), 3)
		_blit(img, Art.tex("developer").get_image(), Vector2i(120, 112), 3)
	else:
		_blit(img, rider, Vector2i(-1, 116), 4)
	# score
	_blit(img, Art.text_tex("SCORE", Color8(36, 48, 106), Color(0, 0, 0, 0)).get_image(), Vector2i(-1, 186), 1)
	_blit(img, Art.text_tex(_fmt(int(data["score"])), Color8(255, 216, 74)).get_image(), Vector2i(-1, 198), 3)
	_blit(img, Art.text_tex("%s M" % _fmt(int(data["distance"])), Color8(20, 26, 51), Color(0, 0, 0, 0)).get_image(), Vector2i(-1, 234), 2)
	_blit(img, Art.text_tex(String(data.get("phase", "")), Color8(20, 26, 51), Color(0, 0, 0, 0)).get_image(), Vector2i(-1, 256), 1)
	var cause: String = data.get("cause", "")
	if cause != "":
		var cc := Color8(216, 54, 60) if cause == "ACQUIRED!" else Color8(240, 138, 36)
		_blit(img, Art.text_tex(cause, cc).get_image(), Vector2i(-1, 268), 1)
	img.fill_rect(Rect2i(0, h - 32, w, 32), Color8(20, 26, 51))
	_blit(img, Art.text_tex("YOU CAN'T SKI FREE.", Color8(255, 216, 74)).get_image(), Vector2i(-1, h - 30), 1)
	_blit(img, Art.text_tex(URL_SHORT, Color8(168, 188, 224)).get_image(), Vector2i(-1, h - 16), 1)
	img.resize(w * 3, h * 3, Image.INTERPOLATE_NEAREST)
	return img

## Shares the game itself (no score). Returns a short status line.
static func share_game() -> String:
	return _send(DEFAULT_MESSAGE + " " + URL, null)

## Shares a run with its score card. Returns a short status line for the UI.
static func share(data: Dictionary) -> String:
	return _send(message(data), make_card(data))

static func _send(text: String, card: Image) -> String:
	if OS.has_feature("web"):
		var b64 := Marshalls.raw_to_base64(card.save_png_to_buffer()) if card else ""
		var js := """
(async function(){
  const b64 = %s, text = %s, url = %s;
  let file = null;
  if (b64) {
    const bin = atob(b64); const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    file = new File([arr], 'wasatch-back-score.png', {type: 'image/png'});
  }
  const title = 'Wasatch Back — You Can\'t Ski Free';
  try {
    if (file && navigator.canShare && navigator.canShare({files: [file]})) { await navigator.share({files: [file], text: text, title: title}); return; }
    if (navigator.share) { await navigator.share({text: text, title: title}); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text); } catch (e) {}
  if (file) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = 'wasatch-back-score.png';
    document.body.appendChild(a); a.click(); a.remove();
  }
})();
""" % [JSON.stringify(b64), JSON.stringify(text), JSON.stringify(URL)]
		var has_share = JavaScriptBridge.eval("!!navigator.share", true)
		JavaScriptBridge.eval(js, true)
		if has_share:
			return "Opening share sheet..."
		return "Score card downloaded & brag copied!" if card else "Link copied - send it to a friend!"
	DisplayServer.clipboard_set(text)
	if card == null:
		return "Link copied to clipboard!"
	var dir := OS.get_system_dir(OS.SYSTEM_DIR_PICTURES)
	if dir == "" or not DirAccess.dir_exists_absolute(dir):
		dir = OS.get_user_data_dir()
	var path := dir.path_join("wasatch-back-score.png")
	if card.save_png(path) == OK:
		return "Copied! Card saved to %s" % path
	return "Brag copied to clipboard!"

## 1200x630 link-preview image (Open Graph / Twitter card).
static func make_social_image() -> Image:
	var w := 400
	var h := 210
	var img := Image.create(w, h, false, Image.FORMAT_RGBA8)
	var bands := [[0, Color8(36, 34, 88)], [30, Color8(74, 52, 120)], [55, Color8(150, 74, 130)], [75, Color8(232, 120, 120)], [90, Color8(250, 176, 120)]]
	for i in bands.size():
		var y0: int = bands[i][0]
		var y1: int = bands[i + 1][0] if i + 1 < bands.size() else 130
		img.fill_rect(Rect2i(0, y0, w, y1 - y0), bands[i][1])
	_ridge(img, 128, 50, 1.3, Color8(112, 96, 150), Color8(240, 200, 210))
	_ridge(img, 146, 34, 4.1, Color8(70, 70, 120), Color8(250, 236, 240))
	img.fill_rect(Rect2i(0, 150, w, h - 150), Color8(236, 242, 255))
	img.fill_rect(Rect2i(0, 150, w, 2), Color8(200, 214, 240))
	_blit(img, Art.text_tex("WASATCH BACK", Color.WHITE).get_image(), Vector2i(-1, 14), 4)
	_blit(img, Art.text_tex("YOU CAN'T SKI FREE.", Color8(255, 216, 74)).get_image(), Vector2i(-1, 62), 2)
	var Riders = load("res://scripts/data/riders.gd")
	_blit(img, Art.tex("pine_laden").get_image(), Vector2i(24, 104), 3)
	_blit(img, Art.tex("spruce_tall").get_image(), Vector2i(340, 92), 3)
	_blit(img, Art.tex("ski_diag", Riders.OUTFITS[0]).get_image(), Vector2i(150, 138), 3)
	_blit(img, Art.tex("developer").get_image(), Vector2i(212, 126), 3)
	_blit(img, Art.text_tex(URL_SHORT, Color8(36, 48, 106), Color(0, 0, 0, 0)).get_image(), Vector2i(-1, 196), 1)
	img.resize(w * 3, h * 3, Image.INTERPOLATE_NEAREST)
	return img

static func _blit(dst: Image, src: Image, pos: Vector2i, scale: int) -> void:
	var s := src.duplicate() as Image
	if scale != 1:
		s.resize(s.get_width() * scale, s.get_height() * scale, Image.INTERPOLATE_NEAREST)
	if pos.x < 0:
		pos.x = (dst.get_width() - s.get_width()) / 2
	if s.get_format() != dst.get_format():
		s.convert(dst.get_format())
	dst.blend_rect(s, Rect2i(Vector2i.ZERO, s.get_size()), pos)

static func _ridge(img: Image, base: int, amp: float, seed: float, c: Color, cap: Color) -> void:
	for x in range(0, img.get_width(), 4):
		var hh := base - amp * (0.5 + 0.5 * sin(x * 0.04 + seed)) * (0.6 + 0.4 * sin(x * 0.11 + seed * 2.0))
		var top := int(floorf(hh / 3.0) * 3.0)
		img.fill_rect(Rect2i(x, top, 4, img.get_height() - top), c)
		if top < base - amp * 0.6:
			img.fill_rect(Rect2i(x, top, 4, 3), cap)

static func _fmt(n: int) -> String:
	var s := str(n)
	var out := ""
	while s.length() > 3:
		out = "," + s.substr(s.length() - 3) + out
		s = s.substr(0, s.length() - 3)
	return s + out
