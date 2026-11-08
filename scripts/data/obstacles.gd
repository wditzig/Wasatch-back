extends RefCounted
## Data-driven obstacle definitions.
##
## kind:    solid  - crash on contact (unless airborne and not `tall`)
##          bump   - stumble: lose speed and combo, no crash
##          slow   - deep powder (rider powder_mult applies)
##          ice    - reduced turning
##          ramp   - launches the rider; `air` scales airtime
##          mogul  - small pop into the air
##          token  - Public Access Pass pickup
##          toll   - pay `cost` points to pass (or jump it for a bonus)
## hit:     hitbox [w, h] in world px, anchored at the bottom-centre of the sprite
## weights: spawn weight per zone (see zones.gd), 5 entries
## tall:    cannot be jumped over
## raze:    what the Developer bulldozes this into
## speed:   [min, max] horizontal movement speed in px/s
## cluster: {"count": [min, max], "step": [dx, dy], "jitter": px}
## parts:   compound set pieces: [[def_id, dx, dy], ...]
## flat:    drawn under everything (ground decals)
## label / labels: sign text; with `labels`, one is picked by position
## variants: alternative sprites, picked from the obstacle's position (not the
##           spawn RNG) so terrain generation stays identical

const DEFS := {
	# --- Nature --------------------------------------------------------
	"pine_big": {"sprite": "pine_big", "variants": ["pine_big", "pine_big", "pine_laden", "spruce_tall"], "kind": "solid", "tall": true, "hit": [14, 10], "raze": "stump",
		"weights": [10, 5, 3, 1.5, 1], "msg": "Tree. It was here first."},
	"pine_small": {"sprite": "pine_small", "variants": ["pine_small", "pine_small_b"], "kind": "solid", "tall": true, "hit": [10, 8], "raze": "stump",
		"weights": [9, 4, 2, 1, 1], "msg": "Small tree. Big feelings."},
	"snag": {"sprite": "snag", "variants": ["snag", "snag_b"], "kind": "solid", "tall": true, "hit": [6, 6], "raze": "stump",
		"weights": [3, 2, 1, 1, 0.5], "msg": "Bare aspen. Still winning."},
	"rock": {"sprite": "rock", "variants": ["rock", "rock_slab"], "kind": "solid", "hit": [24, 10],
		"weights": [4, 3, 2, 2, 1.5], "msg": "Granite. Very old. Very hard. Very public."},
	"rock_small": {"sprite": "rock_small", "kind": "solid", "hit": [12, 6],
		"weights": [4, 2, 1, 1, 1], "msg": "Tiny rock. Core shot."},
	"stump": {"sprite": "stump", "kind": "bump", "hit": [12, 6],
		"weights": [0.5, 3, 2, 1, 1], "msg": "A stump. Formerly a tree. Formerly public."},
	"mogul": {"sprite": "mogul", "kind": "mogul", "flat": true, "hit": [26, 8],
		"weights": [4, 2, 1, 0.3, 0.3], "cluster": {"count": [3, 6], "step": [30, 26], "jitter": 10}},
	"powder": {"sprite": "powder", "kind": "slow", "flat": true, "hit": [48, 18],
		"weights": [4, 2, 1, 0.5, 0.3]},
	"ice": {"sprite": "ice", "kind": "ice", "flat": true, "hit": [48, 14],
		"weights": [1, 1, 1, 2.5, 2]},
	"ramp": {"sprite": "ramp", "kind": "ramp", "flat": true, "hit": [30, 10], "air": 1.0,
		"weights": [3.5, 3, 3, 3, 3]},
	"moose": {"sprite": "moose", "kind": "solid", "hit": [30, 10], "speed": [25, 45],
		"weights": [1.5, 0.8, 0.3, 0, 0], "msg": "Moose. It has the right of way. Always."},
	"token": {"sprite": "token", "kind": "token", "hit": [16, 16],
		"weights": [3, 3, 3.5, 3.5, 4]},
	"sign_public": {"sprite": "sign", "kind": "solid", "hit": [26, 6], "label": "PUBLIC\nLAND",
		"weights": [1.2, 0.3, 0, 0, 0], "msg": "You hit the PUBLIC LAND sign. It's being replaced anyway."},

	# --- Phase 1: construction -----------------------------------------
	"cone": {"sprite": "cone", "kind": "bump", "hit": [10, 6],
		"weights": [0, 5, 3, 2, 2], "cluster": {"count": [3, 6], "step": [22, 0], "jitter": 2},
		"msg": "Traffic cone. On a ski run."},
	"stake": {"sprite": "stake", "kind": "bump", "hit": [6, 6],
		"weights": [0.5, 4, 2, 1, 1], "msg": "Survey stake. Someone is measuring your freedom."},
	"fence": {"sprite": "fence", "kind": "solid", "hit": [32, 8],
		"weights": [0, 3, 2, 2, 3], "cluster": {"count": [3, 6], "step": [32, 0], "jitter": 0},
		"msg": "Construction fencing. Trespassers will be invoiced."},
	"excavator": {"sprite": "excavator", "kind": "solid", "tall": true, "hit": [42, 14],
		"weights": [0, 2.5, 1, 1, 1], "msg": "Excavator. Workers' comp not included."},
	"porta_potty": {"sprite": "porta_potty", "kind": "solid", "tall": true, "hit": [18, 8],
		"weights": [0, 1.5, 0.8, 0.3, 0.5], "msg": "Port-a-potty. Somehow, it was occupied."},
	"kicker_big": {"sprite": "kicker_big", "kind": "ramp", "flat": true, "hit": [40, 12], "air": 1.45,
		"weights": [0, 2, 1.5, 1.5, 1.5]},
	"sign_soon": {"sprite": "sign", "kind": "solid", "hit": [26, 6], "label": "GONDOLUX\nOPENING SOON\nEST. 2057",
		"weights": [0, 2.5, 1, 0.6, 0.5], "msg": "Read the sign. Became the sign."},
	"snowcat": {"sprite": "snowcat", "kind": "solid", "tall": true, "hit": [44, 12], "speed": [40, 70],
		"weights": [0, 1.2, 1, 1, 1], "msg": "Run over by a MONOPEAK snowcat. It did not stop."},

	# --- Phase 2: luxury -----------------------------------------------
	"mansion": {"sprite": "mansion", "kind": "solid", "tall": true, "hit": [80, 22],
		"weights": [0, 0, 2.5, 1, 1.8], "msg": "You hit a 14,000 sq ft 'cabin'. The HOA has been notified."},
	"hot_tub": {"sprite": "hot_tub", "kind": "solid", "hit": [40, 12],
		"weights": [0, 0, 2, 0.5, 1], "msg": "Hot tub. Members only. You are not a member."},
	"sign_private": {"sprite": "sign", "kind": "solid", "hit": [26, 6], "labels": ["PUBLIC LAND\nPRIVATE POWDER", "FOR SALE\nSTARTING AT\n$1 BILLION"],
		"weights": [0, 0.3, 2.5, 1, 2], "msg": "Private property. Violators will be invoiced."},
	"golf_cart": {"sprite": "golf_cart", "kind": "solid", "hit": [30, 10], "speed": [50, 80],
		"weights": [0, 0, 1.5, 0.5, 1], "msg": "Valet golf cart. Your parking validation was denied."},
	"toll_plaza": {"parts": [["fence", -136, 0], ["fence", -104, 0], ["toll_booth", -62, 0], ["toll_arm", 0, 0],
			["toll_booth", 62, 0], ["fence", 104, 0], ["fence", 136, 0]],
		"weights": [0, 0.4, 1.2, 1, 1.4]},

	# --- Phase 3: data centres -----------------------------------------
	"data_center": {"sprite": "data_center", "kind": "solid", "tall": true, "hit": [100, 22],
		"weights": [0, 0, 0, 2.5, 2], "msg": "Your body is now training data."},
	"cooling_unit": {"sprite": "cooling_unit", "kind": "solid", "hit": [32, 10],
		"weights": [0, 0, 0, 3, 2], "msg": "Industrial chiller. Coldest thing on the mountain now."},
	"pylon": {"sprite": "pylon", "kind": "solid", "tall": true, "hit": [18, 10],
		"weights": [0, 0, 0.3, 2, 1.5], "msg": "High-voltage pylon. Shocking, really."},
	"drone": {"sprite": "drone", "kind": "solid", "hit": [24, 10], "speed": [60, 100],
		"weights": [0, 0, 0.3, 1.5, 1.5], "msg": "Delivery drone. Your package: regret."},
	"sign_hiring": {"sprite": "sign", "kind": "solid", "hit": [26, 6], "label": "WE SUPPORT A\nWASATCH BACK\nDATA CENTER",
		"weights": [0, 0, 0, 2, 1], "msg": "The community support sign was installed by the data center."},

	# --- Final phase ----------------------------------------------------
	"paywall": {"parts": [["paywall_wall", -144, 0], ["paywall_wall", -96, 0], ["paywall_wall", -48, 0], ["paywall_gate", 0, 0],
			["paywall_wall", 48, 0], ["paywall_wall", 96, 0], ["paywall_wall", 144, 0]],
		"weights": [0, 0, 0, 0.4, 1.8]},

	# --- Set-piece parts (never spawned directly) -----------------------
	"toll_booth": {"sprite": "toll_booth", "kind": "solid", "tall": true, "hit": [26, 10], "weights": [0, 0, 0, 0, 0],
		"msg": "You hit the toll booth. Exact change only."},
	"toll_arm": {"sprite": "toll_arm", "kind": "toll", "hit": [76, 8], "cost": 150, "weights": [0, 0, 0, 0, 0]},
	"paywall_wall": {"sprite": "paywall_wall", "kind": "solid", "tall": true, "hit": [48, 10], "weights": [0, 0, 0, 0, 0],
		"msg": "Hit the PAYWALL. Subscribe to continue."},
	"paywall_gate": {"sprite": "paywall_gate", "kind": "toll", "hit": [48, 10], "cost": 300, "weights": [0, 0, 0, 0, 0]},
	"gondola_tower": {"sprite": "gondola_tower", "kind": "solid", "tall": true, "hit": [16, 10], "weights": [0, 0, 0, 0, 0],
		"msg": "Gondola tower. The only part that's finished."},
	"trailhead": {"sprite": "sign", "kind": "solid", "hit": [26, 6], "label": "TRAILHEAD\nALL WELCOME", "weights": [0, 0, 0, 0, 0],
		"msg": "Crashed at the trailhead. Bold start."},
}
