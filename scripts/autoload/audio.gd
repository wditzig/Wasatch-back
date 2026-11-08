extends Node
## Procedural chiptune audio. Every sound effect and the music loop are
## synthesised at startup, so the prototype ships with zero audio files.
## Replace any entry in `_streams` with a loaded .ogg/.wav later.

const RATE := 22050

var _streams := {}
var _players: Array[AudioStreamPlayer] = []
var _music: AudioStreamPlayer
var _hiss: AudioStreamPlayer
var _engine: AudioStreamPlayer
var _music_thread_task := -1
var _music_stream: AudioStreamWAV

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_setup_buses()
	for i in 10:
		var p := AudioStreamPlayer.new()
		p.bus = "SFX"
		add_child(p)
		_players.append(p)
	_music = AudioStreamPlayer.new()
	_music.bus = "Music"
	add_child(_music)
	_hiss = AudioStreamPlayer.new()
	_hiss.bus = "SFX"
	_hiss.volume_db = -80
	add_child(_hiss)
	_engine = AudioStreamPlayer.new()
	_engine.bus = "SFX"
	_engine.volume_db = -80
	add_child(_engine)
	_build_sfx()
	_hiss.stream = _streams["hiss"]
	_engine.stream = _streams["engine"]
	apply_volumes()
	Game.settings_changed.connect(apply_volumes)
	_music_thread_task = WorkerThreadPool.add_task(_build_music)

func _process(_d: float) -> void:
	if _music_thread_task != -1 and WorkerThreadPool.is_task_completed(_music_thread_task):
		WorkerThreadPool.wait_for_task_completion(_music_thread_task)
		_music_thread_task = -1
		_music.stream = _music_stream
		_music.play()

func _exit_tree() -> void:
	if _music_thread_task != -1:
		WorkerThreadPool.wait_for_task_completion(_music_thread_task)

func _setup_buses() -> void:
	for b in ["Music", "SFX"]:
		if AudioServer.get_bus_index(b) == -1:
			AudioServer.add_bus()
			var idx := AudioServer.bus_count - 1
			AudioServer.set_bus_name(idx, b)
			AudioServer.set_bus_send(idx, "Master")

func apply_volumes() -> void:
	_set_bus("Music", float(Game.settings.get("music", 0.6)))
	_set_bus("SFX", float(Game.settings.get("sfx", 0.85)))

func _set_bus(n: String, v: float) -> void:
	var idx := AudioServer.get_bus_index(n)
	AudioServer.set_bus_mute(idx, v <= 0.001)
	AudioServer.set_bus_volume_db(idx, linear_to_db(maxf(v, 0.001)))

func play(id: String, pitch_jitter := 0.0, vol_db := 0.0) -> void:
	if not _streams.has(id):
		return
	for p in _players:
		if not p.playing:
			p.stream = _streams[id]
			p.pitch_scale = 1.0 + randf_range(-pitch_jitter, pitch_jitter)
			p.volume_db = vol_db
			p.play()
			return

## Continuous ski hiss, louder with speed (0..1). Pass 0 to silence.
func set_hiss(amount: float) -> void:
	if amount <= 0.01:
		if _hiss.playing:
			_hiss.stop()
		return
	if not _hiss.playing:
		_hiss.play()
	_hiss.volume_db = lerpf(-30.0, -10.0, clampf(amount, 0, 1))
	_hiss.pitch_scale = lerpf(0.8, 1.3, clampf(amount, 0, 1))

## Chip's snowmobile. amount 0..1 (proximity), pitch rises with speed.
func set_engine(amount: float, pitch := 1.0) -> void:
	if amount <= 0.01:
		if _engine.playing:
			_engine.stop()
		return
	if not _engine.playing:
		_engine.play()
	_engine.volume_db = lerpf(-34.0, -14.0, clampf(amount, 0, 1))
	_engine.pitch_scale = clampf(pitch, 0.7, 1.6)

func set_music_pitch(p: float) -> void:
	_music.pitch_scale = p

# ---------------------------------------------------------------- synthesis
static func _wav(buf: PackedFloat32Array, loop := false) -> AudioStreamWAV:
	var data := PackedByteArray()
	data.resize(buf.size() * 2)
	for i in buf.size():
		data.encode_s16(i * 2, int(clampf(buf[i], -1.0, 1.0) * 32000.0))
	var w := AudioStreamWAV.new()
	w.format = AudioStreamWAV.FORMAT_16_BITS
	w.mix_rate = RATE
	w.stereo = false
	w.data = data
	if loop:
		w.loop_mode = AudioStreamWAV.LOOP_FORWARD
		w.loop_begin = 0
		w.loop_end = buf.size()
	return w

## wave: 0 square, 1 triangle, 2 noise, 3 sine. Frequency sweeps f0 -> f1.
static func _tone(buf: PackedFloat32Array, start: float, dur: float, f0: float, f1: float, wave: int, vol: float, duty := 0.5, attack := 0.004) -> void:
	var s0 := int(start * RATE)
	var n := int(dur * RATE)
	if buf.size() < s0 + n:
		buf.resize(s0 + n)
	var phase := 0.0
	var lp := 0.0
	for i in n:
		var t := float(i) / n
		var f := lerpf(f0, f1, t)
		phase = fmod(phase + f / RATE, 1.0)
		var v := 0.0
		match wave:
			0: v = 1.0 if phase < duty else -1.0
			1: v = 4.0 * absf(phase - 0.5) - 1.0
			2:
				lp += (randf_range(-1, 1) - lp) * clampf(f / 4000.0, 0.02, 1.0)
				v = lp * 1.6
			3: v = sin(phase * TAU)
		var env := minf(1.0, float(i) / maxf(1.0, attack * RATE)) * pow(1.0 - t, 1.6)
		buf[s0 + i] += v * vol * env

func _build_sfx() -> void:
	var b: PackedFloat32Array
	b = PackedFloat32Array(); _tone(b, 0, 0.05, 880, 880, 0, 0.25, 0.25); _streams["click"] = _wav(b)
	b = PackedFloat32Array(); _tone(b, 0, 0.2, 260, 820, 0, 0.3, 0.25); _streams["jump"] = _wav(b)
	b = PackedFloat32Array(); _tone(b, 0, 0.12, 300, 300, 2, 0.5); _tone(b, 0, 0.1, 140, 60, 3, 0.5); _streams["land"] = _wav(b)
	b = PackedFloat32Array(); _tone(b, 0, 0.06, 988, 988, 0, 0.22, 0.5); _tone(b, 0.06, 0.16, 1319, 1319, 0, 0.22, 0.5); _streams["token"] = _wav(b)
	b = PackedFloat32Array(); _tone(b, 0, 0.18, 1200, 3000, 2, 0.35); _tone(b, 0, 0.18, 700, 1400, 3, 0.12); _streams["close"] = _wav(b)
	b = PackedFloat32Array()
	var notes := [523.25, 659.25, 783.99]
	for i in notes.size():
		_tone(b, i * 0.05, 0.09, notes[i], notes[i], 0, 0.18, 0.25)
	_streams["trick"] = _wav(b)
	b = PackedFloat32Array(); _tone(b, 0, 0.35, 180, 900, 3, 0.25); _tone(b, 0.0, 0.35, 360, 1800, 0, 0.06, 0.125); _streams["flip"] = _wav(b)
	b = PackedFloat32Array()
	var arp := [523.25, 659.25, 783.99, 1046.5]
	for i in arp.size():
		_tone(b, i * 0.06, 0.14, arp[i], arp[i], 0, 0.2, 0.5)
	_streams["combo"] = _wav(b)
	b = PackedFloat32Array(); _tone(b, 0, 0.5, 2500, 400, 2, 0.6); _tone(b, 0, 0.35, 220, 50, 0, 0.25, 0.5); _streams["crash"] = _wav(b)
	b = PackedFloat32Array(); _tone(b, 0, 0.15, 400, 200, 2, 0.35); _streams["bump"] = _wav(b)
	b = PackedFloat32Array()
	for i in 6:
		var f := 660.0 if i % 2 == 0 else 880.0
		_tone(b, i * 0.12, 0.12, f, f, 0, 0.18, 0.5, 0.002)
	_streams["alarm"] = _wav(b)
	b = PackedFloat32Array()
	var go := [523.25, 440.0, 349.23, 261.63]
	for i in go.size():
		_tone(b, i * 0.18, 0.3 if i < 3 else 0.7, go[i], go[i], 0, 0.22, 0.5)
	_streams["gameover"] = _wav(b)
	b = PackedFloat32Array(); _tone(b, 0, 0.08, 3000, 3000, 2, 0.4); _tone(b, 0.05, 0.4, 1568, 1568, 3, 0.3); _tone(b, 0.1, 0.5, 2093, 2093, 3, 0.25); _streams["toll"] = _wav(b)
	b = PackedFloat32Array()
	var fan := [392.0, 523.25, 659.25, 783.99]
	for i in fan.size():
		_tone(b, i * 0.1, 0.25 if i < 3 else 0.5, fan[i], fan[i], 0, 0.18, 0.25)
	_streams["zone"] = _wav(b)
	b = PackedFloat32Array(); _tone(b, 0, 0.25, 100, 100, 3, 0.4); _tone(b, 0.0, 0.25, 600, 200, 2, 0.2); _streams["mogul"] = _wav(b)
	# Looping snow hiss: low-passed noise without envelope.
	b = PackedFloat32Array()
	b.resize(RATE)
	var lp := 0.0
	for i in RATE:
		lp += (randf_range(-1, 1) - lp) * 0.18
		b[i] = lp * 0.5
	_streams["hiss"] = _wav(b, true)
	# Looping two-stroke snowmobile putter: low sawtooth, chopped at 18 Hz,
	# with a little noise. 0.5 s loop; 56 Hz and 18 Hz both fit it exactly.
	b = PackedFloat32Array()
	var n := RATE / 2
	b.resize(n)
	var lp2 := 0.0
	for i in n:
		var t := float(i) / RATE
		var saw := 2.0 * fmod(t * 56.0, 1.0) - 1.0
		var chop := 0.55 + 0.45 * signf(sin(TAU * 18.0 * t))
		var nz := randf_range(-1, 1) * 0.25
		lp2 += ((saw + nz) * chop - lp2) * 0.35
		b[i] = lp2 * 0.45
	_streams["engine"] = _wav(b, true)
	# Short snowmobile skid for the capture.
	b = PackedFloat32Array(); _tone(b, 0, 0.35, 1800, 600, 2, 0.4); _tone(b, 0, 0.3, 120, 70, 0, 0.12, 0.3); _streams["skid"] = _wav(b)

## Background chiptune loop (Am - F - C - G - Am - F - G - E), built on a worker thread.
func _build_music() -> void:
	var bpm := 150.0
	var step := 60.0 / bpm / 2.0 # eighth notes
	var melody := [
		76, -1, 72, 76, 79, 0, 76, 74,
		72, -1, 69, 72, 77, 0, 76, 72,
		74, -1, 72, 67, 72, 0, 74, 76,
		74, 0, 71, 74, 79, 0, 0, -1,
		81, 0, 79, 76, 79, 0, 76, 72,
		77, 0, 76, 72, 69, 0, 72, 74,
		74, 0, 79, 0, 77, 76, 74, 71,
		68, 0, 71, 0, 74, 0, 76, -1,
	]
	var bass_roots := [45, 41, 48, 43, 45, 41, 43, 40]
	var total := melody.size() * step
	var buf := PackedFloat32Array()
	buf.resize(int(total * RATE) + 10)
	# melody (pulse 25%)
	var i := 0
	while i < melody.size():
		var n: int = melody[i]
		if n > 0:
			var length := 1
			while i + length < melody.size() and melody[i + length] == 0:
				length += 1
			var f := 440.0 * pow(2.0, (n - 69) / 12.0)
			_tone(buf, i * step, length * step * 0.95, f, f, 0, 0.11, 0.25)
			i += length
		else:
			i += 1
	# bass (triangle, octave bounce on eighths)
	for bar in bass_roots.size():
		for e in 8:
			var n2: int = bass_roots[bar] + (12 if e % 2 == 1 else 0)
			var f2 := 440.0 * pow(2.0, (n2 - 69) / 12.0)
			_tone(buf, (bar * 8 + e) * step, step * 0.9, f2, f2, 1, 0.22)
	# drums: kick on beats, hat on off-beats, snare on 2 & 4
	for s in melody.size():
		var t := s * step
		if s % 2 == 0:
			_tone(buf, t, 0.09, 150, 45, 3, 0.4)
		else:
			_tone(buf, t, 0.03, 8000, 8000, 2, 0.08)
		if s % 4 == 2:
			_tone(buf, t, 0.1, 3000, 1500, 2, 0.16)
	buf.resize(int(total * RATE))
	_music_stream = _wav(buf, true)
