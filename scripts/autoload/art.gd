extends Node
## Builds and caches every texture in the game from code: ASCII sprite maps
## (scripts/data/sprites.gd), procedural buildings, and a 5x7 pixel font.
## No binary art assets are required for the prototype; swap any entry for a
## hand-drawn PNG later by returning a loaded texture from tex().

const SpriteData = preload("res://scripts/data/sprites.gd")

const PALETTE := {
	"K": Color8(26, 28, 44), "X": Color8(13, 13, 18),
	"W": Color8(255, 255, 255), "w": Color8(214, 226, 245), "v": Color8(168, 188, 224),
	"G": Color8(29, 74, 46), "g": Color8(47, 122, 63), "l": Color8(88, 168, 74), "q": Color8(18, 50, 34),
	"T": Color8(90, 52, 32), "t": Color8(138, 84, 48),
	"R": Color8(216, 54, 60), "r": Color8(140, 29, 44),
	"O": Color8(240, 138, 36), "o": Color8(184, 90, 20),
	"Y": Color8(248, 208, 64), "y": Color8(200, 148, 32),
	"S": Color8(242, 194, 154), "s": Color8(200, 138, 100),
	"D": Color8(60, 65, 80), "d": Color8(108, 115, 132), "L": Color8(169, 176, 191),
	"C": Color8(80, 200, 240), "c": Color8(42, 124, 168),
	"N": Color8(36, 48, 106), "n": Color8(62, 88, 184),
	"P": Color8(138, 74, 192), "p": Color8(240, 122, 176),
	"M": Color8(74, 46, 28), "m": Color8(122, 78, 48), "B": Color8(176, 128, 80),
	"E": Color8(255, 216, 74), "e": Color8(200, 144, 28),
	"Z": Color8(248, 232, 144), "z": Color8(74, 106, 154),
	"J": Color8(216, 54, 60), "j": Color8(140, 29, 44),
	"H": Color8(248, 208, 64), "h": Color8(200, 148, 32),
}

const FONT := {
	"A": [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
	"B": ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
	"C": [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
	"D": ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
	"E": ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
	"F": ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
	"G": [".####", "#....", "#....", "#.###", "#...#", "#...#", ".####"],
	"H": ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
	"I": ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
	"J": ["..###", "...#.", "...#.", "...#.", "#..#.", "#..#.", ".##.."],
	"K": ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
	"L": ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
	"M": ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
	"N": ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
	"O": [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
	"P": ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
	"Q": [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
	"R": ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
	"S": [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
	"T": ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
	"U": ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
	"V": ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
	"W": ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
	"X": ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
	"Y": ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
	"Z": ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
	"0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
	"1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
	"2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
	"3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
	"4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
	"5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
	"6": [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
	"7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
	"8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
	"9": [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
	"!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
	"?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
	":": [".....", "..#..", ".....", ".....", ".....", "..#..", "....."],
	".": [".....", ".....", ".....", ".....", ".....", ".....", "..#.."],
	",": [".....", ".....", ".....", ".....", ".....", "..#..", ".#..."],
	"-": [".....", ".....", ".....", ".###.", ".....", ".....", "....."],
	"+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
	"'": ["..#..", "..#..", ".....", ".....", ".....", ".....", "....."],
	"$": ["..#..", ".####", "#.#..", ".###.", "..#.#", "####.", "..#.."],
	"&": [".##..", "#..#.", "#.#..", ".#...", "#.#.#", "#..#.", ".##.#"],
	"/": ["....#", "...#.", "...#.", "..#..", ".#...", ".#...", "#...."],
}

var _cache := {}

func _ready() -> void:
	# Warm the cache so the first run never hitches.
	for k in SpriteData.SPRITES.keys():
		tex(k)

## Returns a texture for a sprite id, optionally recoloured with an outfit.
func tex(id: String, outfit: Dictionary = {}) -> Texture2D:
	var key := id
	if not outfit.is_empty():
		key += "|" + String(outfit.get("id", "custom"))
	if _cache.has(key):
		return _cache[key]
	var img: Image
	if SpriteData.SPRITES.has(id):
		img = _from_ascii(SpriteData.SPRITES[id], _recolor_for(outfit))
	else:
		img = _procedural(id)
	var t := ImageTexture.create_from_image(img)
	_cache[key] = t
	return t

func _recolor_for(outfit: Dictionary) -> Dictionary:
	if outfit.is_empty():
		return {}
	return {"J": outfit["jacket"], "j": outfit["shade"], "H": outfit["hat"], "h": outfit["hat_shade"]}

func _from_ascii(rows: Array, recolor: Dictionary) -> Image:
	var h := rows.size()
	var w := 0
	for r in rows:
		w = maxi(w, String(r).length())
	var img := Image.create(w, h, false, Image.FORMAT_RGBA8)
	for y in h:
		var row: String = rows[y]
		for x in row.length():
			var c := row[x]
			if c == "." or c == " ":
				continue
			var col: Color = recolor.get(c, PALETTE.get(c, Color.MAGENTA))
			img.set_pixel(x, y, col)
	return img

# ---------------------------------------------------------------- helpers
func _img(w: int, h: int) -> Image:
	return Image.create(w, h, false, Image.FORMAT_RGBA8)

func _r(img: Image, x: int, y: int, w: int, h: int, c: String) -> void:
	img.fill_rect(Rect2i(x, y, w, h), PALETTE[c])

func _px(img: Image, x: int, y: int, c: String) -> void:
	if x >= 0 and y >= 0 and x < img.get_width() and y < img.get_height():
		img.set_pixel(x, y, PALETTE[c])

func _tri(img: Image, cx: int, top: int, height: int, slope: float, c: String) -> void:
	for y in height:
		var half := int(1 + y * slope)
		_r(img, cx - half, top + y, half * 2, 1, c)

func _procedural(id: String) -> Image:
	match id:
		"sign": return _sign()
		"porta_potty": return _porta_potty()
		"excavator": return _excavator()
		"mansion": return _mansion()
		"hot_tub": return _hot_tub()
		"toll_booth": return _toll_booth()
		"toll_arm": return _toll_arm(false)
		"toll_arm_up": return _toll_arm(true)
		"data_center": return _data_center()
		"cooling_unit": return _cooling_unit()
		"pylon": return _pylon()
		"paywall_wall": return _paywall(false)
		"paywall_gate": return _paywall(true)
		"paywall_open": return _paywall_open()
		"gondola_tower": return _gondola_tower()
		"shadow": return _shadow()
		"speckle": return _speckle()
		"pixel": return _pixel()
		"shadow_soft": return _shadow_soft()
		"ground_detail": return _ground_detail()
		"d_treads": return _treads()
		"d_corduroy": return _corduroy()
		"d_heated": return _heated()
		"d_cart": return _cart_tracks()
		"d_valet": return _valet()
		"d_cable": return _cable()
		"d_qr": return _qr()
		"heli": return _heli()
		"blimp": return _blimp()
	push_warning("Art: unknown sprite '%s'" % id)
	var img := _img(8, 8)
	img.fill(Color.MAGENTA)
	return img

func _pixel() -> Image:
	var img := _img(2, 2)
	img.fill(Color.WHITE)
	return img

func _sign() -> Image:
	var img := _img(36, 20)
	_r(img, 7, 12, 2, 7, "T"); _r(img, 27, 12, 2, 7, "T")
	_r(img, 0, 0, 36, 14, "K")
	_r(img, 1, 1, 34, 12, "Y")
	_r(img, 1, 12, 34, 1, "y")
	_r(img, 4, 19, 28, 1, "w")
	return img

func _porta_potty() -> Image:
	var img := _img(12, 20)
	_r(img, 0, 2, 12, 17, "N")
	_r(img, 1, 0, 10, 3, "n")
	_r(img, 2, 4, 8, 14, "n")
	_r(img, 3, 6, 6, 2, "C")
	_r(img, 8, 11, 1, 2, "W")
	_r(img, 0, 19, 12, 1, "w")
	return img

func _excavator() -> Image:
	var img := _img(34, 24)
	# boom + arm + bucket
	for i in 10:
		_r(img, 18 + i, 9 - i, 3, 2, "y")
		_r(img, 18 + i, 9 - i, 3, 1, "Y")
	_r(img, 28, 0, 3, 9, "y")
	_r(img, 27, 8, 6, 4, "D")
	_r(img, 28, 11, 1, 2, "D"); _r(img, 30, 11, 1, 2, "D"); _r(img, 32, 11, 1, 2, "D")
	# cab and body
	_r(img, 3, 7, 20, 10, "Y")
	_r(img, 3, 7, 20, 1, "W")
	_r(img, 4, 9, 7, 5, "z")
	_r(img, 5, 10, 2, 2, "C")
	_r(img, 13, 12, 10, 1, "y")
	_r(img, 13, 14, 10, 1, "y")
	# tracks
	_r(img, 1, 17, 26, 5, "D")
	for x in range(2, 26, 3):
		_r(img, x, 18, 1, 3, "d")
	_r(img, 0, 22, 28, 2, "w")
	return img

func _mansion() -> Image:
	var img := _img(50, 42)
	# chimney
	_r(img, 36, 2, 5, 10, "d"); _r(img, 36, 1, 5, 2, "W")
	# roof
	_tri(img, 25, 4, 16, 1.45, "D")
	_tri(img, 25, 4, 3, 1.45, "W")
	for y in range(8, 20, 3):
		_r(img, 25 - int(1 + (y - 4) * 1.45), y, 2, 1, "W")
		_r(img, 25 + int((y - 4) * 1.45) - 1, y, 2, 1, "W")
	# timber walls
	_r(img, 4, 20, 42, 19, "t")
	for y in range(22, 39, 3):
		_r(img, 4, y, 42, 1, "T")
	# glass wall (floor-to-ceiling, naturally)
	_r(img, 9, 22, 32, 10, "K")
	_r(img, 10, 23, 30, 8, "Z")
	for x in range(17, 40, 8):
		_r(img, x, 23, 1, 8, "K")
	_r(img, 11, 24, 3, 2, "W")
	# door + garage (for the snowmobiles)
	_r(img, 21, 32, 8, 7, "T"); _r(img, 22, 33, 6, 6, "M"); _r(img, 26, 36, 1, 1, "E")
	_r(img, 32, 33, 12, 6, "L"); _r(img, 32, 35, 12, 1, "d"); _r(img, 32, 37, 12, 1, "d")
	# snow drift
	_r(img, 0, 39, 50, 3, "w"); _r(img, 2, 38, 8, 1, "W"); _r(img, 38, 38, 10, 1, "W")
	return img

func _hot_tub() -> Image:
	var img := _img(24, 16)
	_r(img, 2, 0, 1, 2, "w"); _r(img, 8, 1, 1, 2, "w"); _r(img, 15, 0, 1, 2, "w"); _r(img, 20, 1, 1, 2, "w")
	_r(img, 0, 3, 24, 12, "T")
	_r(img, 1, 4, 22, 10, "t")
	_r(img, 3, 5, 18, 7, "c")
	_r(img, 4, 6, 16, 5, "C")
	_r(img, 7, 7, 3, 1, "W"); _r(img, 14, 9, 3, 1, "W")
	_r(img, 0, 15, 24, 1, "w")
	return img

func _toll_booth() -> Image:
	var img := _img(16, 24)
	_r(img, 0, 0, 16, 4, "R")
	_r(img, 0, 0, 16, 1, "W")
	_r(img, 1, 4, 14, 18, "L")
	_r(img, 3, 6, 10, 7, "K"); _r(img, 4, 7, 8, 5, "C")
	_r(img, 5, 15, 6, 2, "E")
	_r(img, 1, 21, 14, 1, "d")
	_r(img, 0, 22, 16, 2, "w")
	return img

func _toll_arm(up: bool) -> Image:
	var img := _img(40, 8)
	if up:
		_r(img, 0, 2, 3, 4, "D")
		_r(img, 37, 2, 3, 4, "D")
		return img
	_r(img, 0, 2, 40, 4, "K")
	for x in range(0, 40, 6):
		_r(img, x, 3, 3, 2, "R")
		_r(img, x + 3, 3, 3, 2, "W")
	_r(img, 18, 0, 4, 8, "E")
	_r(img, 19, 2, 2, 4, "e")
	return img

func _data_center() -> Image:
	var img := _img(54, 40)
	# rooftop units
	for x in [6, 18, 30, 42]:
		_r(img, x, 0, 8, 5, "d"); _r(img, x + 1, 1, 6, 3, "D")
		_r(img, x + 2, 2, 4, 1, "L")
	_r(img, 0, 5, 54, 3, "D")
	_r(img, 0, 8, 54, 29, "L")
	_r(img, 0, 8, 54, 1, "W")
	# logo band
	_r(img, 0, 11, 54, 4, "c"); _r(img, 2, 12, 50, 2, "C")
	# server windows with blinking LEDs
	for row in 3:
		for col in 7:
			var x: int = 3 + col * 7
			var y: int = 18 + row * 6
			_r(img, x, y, 5, 4, "K")
			_px(img, x + 1, y + 1, "l" if (row + col) % 3 else "R")
			_px(img, x + 3, y + 2, "C")
	_r(img, 24, 30, 6, 7, "D")
	_r(img, 0, 37, 54, 3, "w")
	return img

func _cooling_unit() -> Image:
	var img := _img(18, 14)
	_r(img, 0, 0, 18, 12, "d")
	_r(img, 1, 1, 16, 10, "L")
	for cx in [5, 12]:
		_r(img, cx - 3, 3, 6, 6, "D")
		_r(img, cx - 1, 4, 2, 4, "d")
		_r(img, cx - 2, 5, 4, 2, "d")
	_r(img, 0, 12, 18, 2, "w")
	return img

func _pylon() -> Image:
	var img := _img(22, 48)
	_r(img, 0, 4, 22, 2, "D")
	_r(img, 3, 14, 16, 2, "D")
	_px(img, 1, 6, "L"); _px(img, 20, 6, "L"); _px(img, 4, 16, "L"); _px(img, 17, 16, "L")
	for y in range(0, 44):
		var spread := int(2 + y * 0.16)
		_px(img, 11 - spread, y + 2, "D")
		_px(img, 10 + spread, y + 2, "D")
	for y in range(6, 44, 6):
		var s := int(2 + y * 0.16)
		for i in range(0, s * 2):
			_px(img, 11 - s + i, y + 2 + int(i * 0.5) % 3, "d")
	_r(img, 9, 0, 4, 4, "d")
	_r(img, 2, 46, 18, 2, "w")
	return img

func _paywall(gate: bool) -> Image:
	var img := _img(24, 22)
	if gate:
		_r(img, 0, 0, 3, 20, "P"); _r(img, 21, 0, 3, 20, "P")
		_r(img, 0, 0, 24, 4, "P")
		_r(img, 3, 6, 18, 12, "E")
		_r(img, 4, 7, 16, 10, "Y")
		# "$" glyph
		_r(img, 11, 8, 2, 8, "e"); _r(img, 8, 9, 7, 1, "e"); _r(img, 8, 12, 7, 1, "e"); _r(img, 8, 15, 7, 1, "e")
		_r(img, 8, 9, 1, 3, "e"); _r(img, 14, 12, 1, 3, "e")
	else:
		_r(img, 0, 0, 24, 20, "P")
		for y in range(2, 20, 4):
			_r(img, 0, y, 24, 1, "N")
		for i in 3:
			_r(img, 3 + i * 8, 6, 3, 1, "E")
		_r(img, 0, 0, 24, 1, "p")
	_r(img, 0, 20, 24, 2, "w")
	return img

func _paywall_open() -> Image:
	var img := _img(24, 22)
	_r(img, 0, 0, 3, 20, "P"); _r(img, 21, 0, 3, 20, "P"); _r(img, 0, 0, 24, 4, "P")
	_r(img, 0, 20, 24, 2, "w")
	return img

func _gondola_tower() -> Image:
	var img := _img(22, 52)
	_r(img, 0, 3, 22, 3, "D"); _r(img, 1, 4, 20, 1, "d")
	_r(img, 0, 0, 4, 3, "K"); _r(img, 18, 0, 4, 3, "K")
	_r(img, 9, 6, 4, 38, "d"); _r(img, 9, 6, 1, 38, "L"); _r(img, 12, 6, 1, 38, "D")
	for y in range(8, 43, 4):
		_r(img, 9, y, 4, 1, "D")
	# unfinished: hazard stripes on the base
	_r(img, 4, 44, 14, 5, "K")
	for x in range(4, 18, 4):
		_r(img, x, 45, 2, 3, "Y")
	_r(img, 2, 49, 18, 3, "w")
	return img

func _shadow() -> Image:
	var img := _img(16, 6)
	for y in 6:
		for x in 16:
			var dx := (x - 7.5) / 8.0
			var dy := (y - 2.5) / 3.0
			if dx * dx + dy * dy <= 1.0:
				img.set_pixel(x, y, Color(0.1, 0.12, 0.25, 0.28))
	return img

func _speckle() -> Image:
	var img := _img(64, 64)
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	for i in 26:
		var x := rng.randi_range(0, 62)
		var y := rng.randi_range(0, 63)
		img.set_pixel(x, y, Color(1, 1, 1, 0.55))
		if rng.randf() < 0.4:
			img.set_pixel(x + 1, y, Color(1, 1, 1, 0.35))
	return img

# ---------------------------------------------------------------- environment
func _shadow_soft() -> Image:
	# Soft elliptical contact shadow; sun from the upper-left.
	var img := _img(32, 8)
	for y in 8:
		for x in 32:
			var dx := (x - 15.5) / 16.0
			var dy := (y - 3.5) / 4.0
			var d := dx * dx + dy * dy
			if d <= 1.0:
				img.set_pixel(x, y, Color(0.16, 0.2, 0.42, 0.22 * (1.0 - d * 0.7)))
	return img

func _ground_detail() -> Image:
	# Large tile of faint wind ripples (sastrugi) layered over the base snow.
	var img := _img(256, 256)
	var rng := RandomNumberGenerator.new()
	rng.seed = 11
	for i in 34:
		var x0 := rng.randi_range(0, 255)
		var y0 := rng.randi_range(0, 255)
		var length := rng.randi_range(14, 40)
		var amp := rng.randf_range(1.0, 3.0)
		var ph := rng.randf() * TAU
		for t in length:
			var x := (x0 + t) % 256
			var y := (y0 + int(sin(t * 0.25 + ph) * amp) + 256) % 256
			img.set_pixel(x, y, Color(0.55, 0.65, 0.88, 0.16))
			img.set_pixel(x, (y + 1) % 256, Color(1, 1, 1, 0.25))
	return img

func _treads() -> Image:
	var img := _img(22, 64)
	for y in range(0, 64, 3):
		for x in [0, 2, 4, 6, 15, 17, 19, 21]:
			_px(img, x, y + (x / 2) % 2, "v")
	return img

func _corduroy() -> Image:
	var img := _img(48, 56)
	for x in range(0, 48, 3):
		for y in 56:
			if (y + x) % 7 != 0:
				img.set_pixel(x, y, Color(0.66, 0.74, 0.9, 0.55))
	return img

func _heated() -> Image:
	# A heated driveway in the backcountry: wet, bare and steaming.
	var img := _img(40, 26)
	img.fill_rect(Rect2i(1, 1, 38, 24), Color(0.62, 0.66, 0.74, 1.0))
	for i in 6:
		_r(img, 3 + i * 6, 4, 3, 1, "w")
	# melted, irregular snow edge
	for x in 40:
		if x % 3 != 0:
			_px(img, x, 0, "v")
			_px(img, x, 25, "v")
	return img

func _cart_tracks() -> Image:
	var img := _img(14, 70)
	for y in 70:
		var o := int(sin(y * 0.08) * 2.0)
		_px(img, 2 + o, y, "v")
		_px(img, 11 + o, y, "v")
	return img

func _valet() -> Image:
	var img := _img(46, 20)
	for i in 4:
		_r(img, 2 + i * 13, 0, 2, 18, "Y")
	_r(img, 0, 18, 46, 2, "Y")
	return img

func _cable() -> Image:
	var img := _img(90, 8)
	for x in 90:
		var y := 3 + int(sin(x * 0.09) * 2.0)
		_px(img, x, y, "K")
		_px(img, x, y + 1, "D")
	for x in range(10, 90, 30):
		_r(img, x, 0, 2, 8, "O")
	return img

func _qr() -> Image:
	var img := _img(21, 21)
	var rng := RandomNumberGenerator.new()
	rng.seed = 99
	for y in 21:
		for x in 21:
			if rng.randf() < 0.5:
				_px(img, x, y, "K")
	for c in [Vector2i(0, 0), Vector2i(14, 0), Vector2i(0, 14)]:
		_r(img, c.x, c.y, 7, 7, "K")
		img.fill_rect(Rect2i(c.x + 1, c.y + 1, 5, 5), Color(0, 0, 0, 0))
		_r(img, c.x + 2, c.y + 2, 3, 3, "K")
	return img

func _heli() -> Image:
	var img := _img(40, 40)
	_r(img, 15, 10, 10, 16, "K")
	_r(img, 16, 11, 8, 14, "E")
	_r(img, 17, 12, 6, 4, "C")
	_r(img, 19, 26, 2, 12, "K")
	_r(img, 15, 36, 10, 2, "K")
	_r(img, 0, 17, 40, 2, "D")
	_r(img, 19, 0, 2, 36, "D")
	return img

func _blimp() -> Image:
	var img := _img(72, 24)
	for y in 24:
		for x in 72:
			var dx := (x - 35.5) / 36.0
			var dy := (y - 10.5) / 10.5
			if dx * dx + dy * dy <= 1.0:
				img.set_pixel(x, y, PALETTE["P"] if y < 16 else PALETTE["N"])
	_r(img, 64, 2, 6, 6, "P"); _r(img, 64, 15, 6, 6, "P")
	_r(img, 30, 21, 12, 3, "D")
	_r(img, 8, 9, 56, 5, "E")
	return img

# ---------------------------------------------------------------- pixel font
## Renders text in the built-in 5x7 font with a 1px outline and drop shadow.
func text_tex(text: String, color: Color = Color.WHITE, outline: Color = Color8(20, 26, 51)) -> Texture2D:
	var key := "txt|%s|%s|%s" % [text, color.to_html(), outline.to_html()]
	if _cache.has(key):
		return _cache[key]
	var lines := text.to_upper().split("\n")
	var w := 0
	for l in lines:
		w = maxi(w, l.length() * 6)
	var h := lines.size() * 9
	var img := _img(w + 3, h + 3)
	var mask := {}
	for li in lines.size():
		var line: String = lines[li]
		var ox := (w - line.length() * 6) / 2
		for ci in line.length():
			var g: Array = FONT.get(line[ci], [])
			for gy in g.size():
				var row: String = g[gy]
				for gx in row.length():
					if row[gx] == "#":
						mask[Vector2i(ox + ci * 6 + gx + 1, li * 9 + gy + 1)] = true
	var shadow := Color(outline.r, outline.g, outline.b, 0.6)
	for p in mask.keys():
		img.set_pixelv(p + Vector2i(1, 2), shadow)
	for p in mask.keys():
		for d in [Vector2i(-1, 0), Vector2i(1, 0), Vector2i(0, -1), Vector2i(0, 1), Vector2i(1, 1), Vector2i(-1, -1), Vector2i(1, -1), Vector2i(-1, 1)]:
			var q: Vector2i = p + d
			if not mask.has(q) and q.x >= 0 and q.y >= 0 and q.x < img.get_width() and q.y < img.get_height():
				img.set_pixelv(q, outline)
	for p in mask.keys():
		img.set_pixelv(p, color)
	var t := ImageTexture.create_from_image(img)
	_cache[key] = t
	return t
