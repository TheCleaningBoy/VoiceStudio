# 🎙️ Voicer Studio

A browser party game inspired by *The Choicer Voicer* — your voice is the controller.
Everything runs 100% locally in your browser: no accounts, no servers, no uploads.

## Game modes

| Mode | What happens |
|---|---|
| 🏆 **Studio Mode** | Hear a voice line (built-in lines read by a mystery TTS voice, **or your own uploaded audio pack**), record your impression, and get scored 0–30 by three judges on **Power, Timing and Drama**. 1–4 players, 1–4 rounds, final podium. |
| 🎬 **Dub Mode** | Pick/upload a **video clip**, the original audio gets muted, and each player records their own voice-over over the scene. Unlimited retakes. Then a blinded screening + pass-the-device vote for the best dub. |
| ⚡ **Freestyle Dub** | Same, but brutal: one preview only, captions flash on screen as cues (auto-generated or your own), and you improvise live in **one take**. |
| 📦 **My Packs** | Upload & manage your audio prompts and video clips. |

## How to run

```bash
cd voicer-studio
python3 -m http.server 8080
# open http://localhost:8080
```

## Tips

- **Chrome or Edge** recommended (best TTS voices + recording support).
- Microphone permission is asked the first time you record — use the **🎤 Check my microphone** button on the home screen.
- Short clips (10–30s) dub best. Any format your browser can play (mp4/webm/mov, mp3/wav/ogg/m4a).
- Files and recordings only live for the session; use **⬇️ Save take** to download dubs as `.webm`.
- The judges score real things: your actual loudness, how well your take's length matches the line, and how much of the window you kept talking — plus a splash of drama.
