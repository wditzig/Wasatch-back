extends RefCounted
## Development stages of the mountain. The run advances through these by
## distance travelled. All companies and quotes are fictional satire.

const ZONES := [
	{
		"id": "pristine",
		"name": "PRISTINE PUBLIC LAND",
		"subtitle": "Fresh powder. Open to everyone. For now.",
		"start_m": 0,
		"snow": Color(0.95, 0.97, 1.0),
		"speckle": Color(0.62, 0.72, 0.9),
		"density": 0.13,
		"dev_chance": 0.0,
	},
	{
		"id": "construction",
		"name": "PHASE 1: GROUNDBREAKING",
		"subtitle": "MONOPEAK HOLDINGS breaks ground on the GONDOLUX(tm).",
		"start_m": 600,
		"snow": Color(0.93, 0.94, 0.96),
		"speckle": Color(0.6, 0.55, 0.5),
		"density": 0.16,
		"dev_chance": 1.0,
	},
	{
		"id": "luxury",
		"name": "PHASE 2: LUXURY LIVING",
		"subtitle": "Slopeside 'cabins' from $24M. Mountain sold separately.",
		"start_m": 1400,
		"snow": Color(0.94, 0.93, 0.92),
		"speckle": Color(0.7, 0.6, 0.45),
		"density": 0.18,
		"dev_chance": 1.0,
	},
	{
		"id": "datacenter",
		"name": "PHASE 3: THE CLOUD",
		"subtitle": "GRANITECORE DATA: 'Your snowpack is our coolant.'",
		"start_m": 2400,
		"snow": Color(0.88, 0.9, 0.93),
		"speckle": Color(0.45, 0.5, 0.58),
		"density": 0.2,
		"dev_chance": 1.0,
	},
	{
		"id": "privatized",
		"name": "FINAL PHASE: PRIVATIZED",
		"subtitle": "Thank you for skiing MONOPEAK(tm). Your card has been charged.",
		"start_m": 3600,
		"snow": Color(0.86, 0.85, 0.88),
		"speckle": Color(0.5, 0.4, 0.55),
		"density": 0.22,
		"dev_chance": 1.0,
	},
]

static func index_for_distance(m: float) -> int:
	var idx := 0
	for i in ZONES.size():
		if m >= float(ZONES[i]["start_m"]):
			idx = i
	return idx
