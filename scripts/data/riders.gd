extends RefCounted
## Playable riders. Stats are multipliers consumed by player.gd.
## kind: "ski" or "board" (tracks, powder surfing, per-kind best scores).
## req: unlock requirement, e.g. ["ski_score", 60000] = score that much in
##      one run on skis; ["board_score", 60000] = same on a snowboard.

const RIDERS := {
	"skier": {
		"name": "SAGE",
		"title": "Skier",
		"kind": "ski",
		"req": ["none", 0],
		"sprite": "ski",
		"desc": "Carves tight, grips ice. Bogs down in deep powder.",
		"turn_rate": 3.6,
		"accel": 270.0,
		"speed_mult": 1.0,
		"powder_mult": 0.6,
		"ice_turn": 0.85,
		"air_mult": 1.0,
		"trick_speed": 1.0,
		"stats": {"Turning": 5, "Speed": 3, "Powder": 2, "Air": 3},
	},
	"snowboarder": {
		"name": "JUNIPER",
		"title": "Snowboarder",
		"kind": "board",
		"req": ["none", 0],
		"sprite": "board",
		"desc": "Floats powder, flies further, spins faster. Sketchy on ice.",
		"turn_rate": 2.9,
		"accel": 250.0,
		"speed_mult": 1.04,
		"powder_mult": 1.08,
		"ice_turn": 0.4,
		"air_mult": 1.22,
		"trick_speed": 1.15,
		"stats": {"Turning": 3, "Speed": 4, "Powder": 5, "Air": 5},
	},
	"fourx9": {
		"name": "4X9",
		"title": "Skier",
		"kind": "ski",
		"req": ["ski_score", 60000],
		"sprite": "fourx9",
		"desc": "Oversized everything. Skis on actual 2x4s. Turns like a sofa.",
		"turn_rate": 2.7,
		"accel": 235.0,
		"speed_mult": 1.07,
		"powder_mult": 0.85,
		"ice_turn": 0.6,
		"air_mult": 0.9,
		"trick_speed": 0.88,
		"stats": {"Turning": 2, "Speed": 5, "Powder": 3, "Air": 2},
	},
	"river": {
		"name": "RIVER",
		"title": "Snowboarder",
		"kind": "board",
		"req": ["board_score", 60000],
		"sprite": "river",
		"desc": "Van-life drifter in bell-bottoms. A touch better at everything.",
		"turn_rate": 3.05,
		"accel": 258.0,
		"speed_mult": 1.07,
		"powder_mult": 1.12,
		"ice_turn": 0.48,
		"air_mult": 1.27,
		"trick_speed": 1.2,
		"stats": {"Turning": 4, "Speed": 5, "Powder": 5, "Air": 5},
	},
}

static func rider_req_text(r: Dictionary) -> String:
	var q: Array = r.get("req", ["none", 0])
	match q[0]:
		"ski_score": return "Score %s in one run on skis" % _thousands(int(q[1]))
		"board_score": return "Score %s in one run on a snowboard" % _thousands(int(q[1]))
	return "Unlocked"

static func _thousands(n: int) -> String:
	var s := str(n)
	var out := ""
	while s.length() > 3:
		out = "," + s.substr(s.length() - 3) + out
		s = s.substr(0, s.length() - 3)
	return s + out

## Cosmetic outfits. req = [type, value]; types: none, distance, score, tokens, runs.
const OUTFITS := [
	{"id": "classic", "name": "Classic Red", "jacket": Color8(216, 54, 60), "shade": Color8(140, 29, 44), "hat": Color8(248, 208, 64), "hat_shade": Color8(200, 148, 32), "req": ["none", 0]},
	{"id": "wasatch", "name": "Wasatch Blue", "jacket": Color8(62, 88, 184), "shade": Color8(36, 48, 106), "hat": Color8(216, 54, 60), "hat_shade": Color8(140, 29, 44), "req": ["none", 0]},
	{"id": "granite", "name": "Granite Gray", "jacket": Color8(120, 126, 140), "shade": Color8(70, 74, 88), "hat": Color8(240, 138, 36), "hat_shade": Color8(184, 90, 20), "req": ["distance", 1000]},
	{"id": "alpenglow", "name": "Alpenglow", "jacket": Color8(240, 122, 176), "shade": Color8(170, 70, 120), "hat": Color8(248, 160, 64), "hat_shade": Color8(200, 110, 32), "req": ["tokens", 40]},
	{"id": "aspen", "name": "Aspen Gold", "jacket": Color8(248, 200, 48), "shade": Color8(190, 140, 20), "hat": Color8(60, 120, 60), "hat_shade": Color8(30, 80, 40), "req": ["score", 8000]},
	{"id": "powder", "name": "Powderhound", "jacket": Color8(240, 246, 255), "shade": Color8(160, 184, 224), "hat": Color8(80, 200, 240), "hat_shade": Color8(42, 124, 168), "req": ["distance", 2500]},
	{"id": "neon", "name": "1991 Neon", "jacket": Color8(60, 230, 200), "shade": Color8(30, 150, 140), "hat": Color8(250, 80, 200), "hat_shade": Color8(170, 40, 140), "req": ["runs", 10]},
	{"id": "publicland", "name": "Public Lands", "jacket": Color8(60, 150, 70), "shade": Color8(30, 90, 44), "hat": Color8(150, 96, 52), "hat_shade": Color8(100, 60, 30), "req": ["distance", 3600]},
]

static func outfit(id: String) -> Dictionary:
	for o in OUTFITS:
		if o["id"] == id:
			return o
	return OUTFITS[0]

static func req_text(o: Dictionary) -> String:
	var r: Array = o["req"]
	match r[0]:
		"distance": return "Reach %d m in one run" % r[1]
		"score": return "Score %d in one run" % r[1]
		"tokens": return "Collect %d Public Access Passes (total)" % r[1]
		"runs": return "Ride %d runs" % r[1]
	return "Unlocked"
