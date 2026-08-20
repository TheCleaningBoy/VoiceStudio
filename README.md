# 🎙️ Voicer Studio

**A free microphone party game where your voice is the controller — perform impressions, dub over video scenes, and battle your friends for the best take.**

Voicer Studio is a fan-made homage inspired by [*The Choicer Voicer*](https://yeahmaybe.itch.io/the-choicer-voicer). It runs entirely offline on your desktop: drop your packs in a folder, grab the mic, and go.

![platform](https://img.shields.io/badge/platform-Windows-blue) ![electron](https://img.shields.io/badge/Electron-27-47848F) ![license](https://img.shields.io/badge/license-MIT-green)

---

## 🎮 Game Modes

| Mode | What happens |
|---|---|
| 🏆 **Studio Mode** | Hear a voice line, record your best impression, and get scored 0–30 by three judges on **Power**, **Timing** and **Drama**. 1–4 players, 1–4 rounds, final podium. Prompts come from built-in lines (read by a mystery robot voice) or your own **voice packs**. |
| 🎬 **Dub Mode** | Pick a scene and voice it yourself. Works with whole clips *or* official-style **dub packs**: record line-by-line at the pack's timestamps, hear the scene in your ears as you perform, see captions and character portraits, then watch your takes stitched back into the scene. Unlimited retakes. |
| ⚡ **Freestyle Dub** | One preview. Flashing captions. You improvise the whole scene live in a single take. No safety net. |

After any dub session: **blinded screening → pass-the-device voting → winner reveal** 👑

## 📦 The Pack System (official-style)

The game creates a **`packs_voice`** folder next to the executable. Each *folder* inside is one pack — detected automatically, even while the game is running.

**Voice Pack** — a folder of audio files, one per line to imitate (Studio Mode):
```
packs_voice/
  My Sound Pack/
    01_line.ogg
    02_line.mp3
    ...
```

**Dub Pack** — a scene video plus one audio file + `.ini` per line (Dub Mode):
```
packs_voice/
  My Dub Pack/
    dub_video.ogv            ← the scene (ogv/mp4/webm/mov)
    _pack_info.ini           ← optional: title= / author=
    _backing_track.ogg       ← optional: music under your dub
    01_clip.ogg + 01_clip.ini
    02_clip.ogg + 02_clip.ini
```

Line `.ini` files use the official Godot-style format — all of these parse out of the box:

```ini
[data]

caption="\"Im.. sorry\""
image="clarkpng.png"
dub_timestamps=[4.07]
dub_characters=["Clark"]
```

Timestamps in **seconds**, **milliseconds**, or **mm:ss** are detected and converted automatically, sanity-checked against the scene length, and lines are always performed in scene order.

## ✨ Features

- 🎧 **Hear-the-scene toggle** — the clip plays in your ears with a lead-in while you record, so your timing is accurate (captions shown subtitle-style at the bottom)
- 🎯 **Pre-roll sync** — recording starts just before each line's timestamp so the beginning of your take is never clipped
- 🎥 **Video export** — render the whole scene with your voice-over baked in as a single `.webm`, or download the voice mix as `.wav`
- 🧑‍⚖️ Real scoring from your actual loudness, length-matching and delivery
- 🖼️ Character portraits and captions read straight from packs
- ⚡ Quick-add uploads for one-off files (session only)
- 🎤 Built-in microphone check

## ⬇️ Download & Install

Grab the latest **`VoicerStudio.exe`** from [Releases](../../releases). It's a **portable** app — no installation:

1. Put the exe anywhere you like (Desktop, a dedicated folder…)
2. Double-click to run — `packs_voice` is created next to it
3. Drop your packs in, start dubbing

> **Windows SmartScreen:** the exe isn't signed, so the first launch may show *"Windows protected your PC"* → click **More info → Run anyway**.
>
> **Tip:** when updating, delete the old exe so you never launch a stale copy by accident.

## 🛠️ Build from Source

The game is plain HTML/CSS/JS wrapped in Electron.

```bash
cd voicer-desktop
npm install
npm start          # run in dev
npm run build      # build the portable Windows exe
```

> Building on low-RAM Linux machines: electron-builder's default max-compression step may run out of memory; see this project's wiki/issues for the workaround.

## 🙏 Credits & Disclaimer

- Inspired by **The Choicer Voicer** by [YeahMaybe](https://yeahmaybe.itch.io/) — go support the original!
- Not affiliated with, endorsed by, or connected to YeahMaybe or The Choicer Voicer.
- Pack formats follow the community conventions of the original game. Packs are created by their respective authors — only share media you have the rights to distribute.

## 📄 License

MIT — see [LICENSE](LICENSE).
