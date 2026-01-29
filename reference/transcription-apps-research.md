# Transcription Apps Research

A curated list of open-source transcription applications for architecture and feature research.

## Tier 1 - High Stars (1000+)

| App                                                            | Stars | Description                                                                       | Platforms             | Tech      |
| -------------------------------------------------------------- | ----- | --------------------------------------------------------------------------------- | --------------------- | --------- |
| [Buzz](https://github.com/chidiwilliams/buzz)                  | 17.5k | Most feature-rich - batch transcription, live recording, diarization, GPU support | macOS, Windows, Linux | Python/Qt |
| [WhisperKit](https://github.com/argmaxinc/WhisperKit)          | 5.5k  | Apple Silicon optimized, Swift native                                             | iOS, macOS, watchOS   | Swift     |
| [Vibe](https://github.com/thewh1teagle/vibe)                   | 5.1k  | Modern UI, YouTube support, diarization                                           | macOS, Windows, Linux | Tauri     |
| [whisper_streaming](https://github.com/ufal/whisper_streaming) | 3.5k  | Real-time streaming transcription                                                 | Cross-platform        | Python    |
| [whisper-writer](https://github.com/savbell/whisper-writer)    | 1k    | Dictation-focused                                                                 | Cross-platform        | Python    |
| [Whisperboard](https://github.com/Saik0s/Whisperboard)         | 978   | iOS transcription                                                                 | iOS                   | Swift     |

## Tier 2 - Medium Stars (200-999)

| App                                                                | Stars | Description                          | Tech             |
| ------------------------------------------------------------------ | ----- | ------------------------------------ | ---------------- |
| [Open Whispr](https://github.com/HeroTools/open-whispr)            | 869   | Privacy-first, local + cloud         | Cross-platform   |
| [Amical](https://github.com/amicalhq/amical)                       | 651   | Local-first dictation, MCP support   | macOS (Electron) |
| [OpenSuperWhisper](https://github.com/Starmel/OpenSuperWhisper)    | 583   | macOS native dictation               | macOS            |
| [NotelyVoice](https://github.com/tosinonikute/NotelyVoice)         | 580   | 50+ languages, Compose Multiplatform | Android, iOS     |
| [Say](https://github.com/addyosmani/say)                           | 369   | Whisper AI Notes (Addy Osmani)       | Web              |
| [VoiceTypr](https://github.com/moinulmoin/voicetypr)               | 254   | SuperWhisper alternative             | Tauri            |
| [AudioWhisper](https://github.com/mazdak/AudioWhisper)             | 221   | macOS menu bar, hotkey-triggered     | macOS            |
| [Tambourine Voice](https://github.com/kstonekuan/tambourine-voice) | 220   | Cursor-position typing               | Tauri            |
| [whisper-dictation](https://github.com/foges/whisper-dictation)    | 209   | OpenAI API-based                     | Python           |

## Hotkey/Push-to-Talk Focused

| App                                                                        | Stars | Description                           |
| -------------------------------------------------------------------------- | ----- | ------------------------------------- |
| [super-voice-assistant](https://github.com/ykdojo/super-voice-assistant)   | 85    | macOS voice assistant, screen capture |
| [whisper-overlay](https://github.com/oddlama/whisper-overlay)              | 78    | Wayland push-to-talk overlay          |
| [better-voice-typing](https://github.com/Elevate-Code/better-voice-typing) | 70    | Windows Voice Typing replacement      |
| [whisper-key-local](https://github.com/PinW/whisper-key-local)             | 60    | Windows global hotkey                 |

## Real-time/Streaming

| App                                                       | Stars | Description                            |
| --------------------------------------------------------- | ----- | -------------------------------------- |
| [hyprvoice](https://github.com/LeonardoTrapani/hyprvoice) | 103   | Wayland/Hyprland real-time             |
| [lycoris](https://github.com/solaoi/lycoris)              | 71    | Real-time + AI notes, Japanese support |
| [keyless](https://github.com/hate/keyless)                | 13    | 100% local, Rust, privacy-first        |

## Tauri-based (Same Stack as Whispering)

| App                                                                | Stars | Description                         |
| ------------------------------------------------------------------ | ----- | ----------------------------------- |
| [Vibe](https://github.com/thewh1teagle/vibe)                       | 5.1k  | Most mature Tauri transcription app |
| [VoiceTypr](https://github.com/moinulmoin/voicetypr)               | 254   | SuperWhisper alternative            |
| [Tambourine Voice](https://github.com/kstonekuan/tambourine-voice) | 220   | Personal voice interface            |
| [whisper-ui](https://github.com/bits-by-brandon/whisper-ui)        | 138   | Tauri + Svelte                      |
| [recordscript](https://github.com/Recordscript/recordscript)       | 125   | Screen recorder with transcription  |

## Best Repos for Research

Based on similar architecture to Whispering and active communities:

1. **[Buzz](https://github.com/chidiwilliams/buzz)** - 17.5k stars, lots of issues/discussions
2. **[Vibe](https://github.com/thewh1teagle/vibe)** - Same Tauri stack, actively maintained
3. **[Open Whispr](https://github.com/HeroTools/open-whispr)** - Privacy-focused, active development
4. **[Amical](https://github.com/amicalhq/amical)** - Recent (2025), MCP support, interesting architecture
5. **[WhisperKit](https://github.com/argmaxinc/WhisperKit)** - Apple-focused, great for macOS optimization insights

---

## Hacker News Discussions

### Desktop/Mobile Apps

| Title                                                            | Pts | Comments | Year | Links                                                                                                                                      |
| ---------------------------------------------------------------- | --- | -------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Whispering – Open-source, local-first dictation you can trust    | 591 | 152      | 2025 | [Project](https://github.com/epicenter-so/epicenter/tree/main/apps/whispering) [HN](https://news.ycombinator.com/item?id=44942731)         |
| Willow – Open-source privacy-focused voice assistant hardware    | 581 | 138      | 2023 | [Project](https://github.com/toverainc/willow) [HN](https://news.ycombinator.com/item?id=35948462)                                         |
| I made a free transcription service powered by Whisper AI        | 224 | 129      | 2022 | [Project](https://freesubtitles.ai) [HN](https://news.ycombinator.com/item?id=33663486)                                                    |
| Offline voice messages transcription in Signal Desktop           | 191 | 71       | 2022 | [Project](https://www.a2p.it/tech-stuff/coquistt-signal-love-death-to-voice-messages/) [HN](https://news.ycombinator.com/item?id=31735754) |
| Podscripter – Automated Transcription for Podcasters             | 153 | 59       | 2018 | [Project](https://www.podscripter.co/?ref=hn) [HN](https://news.ycombinator.com/item?id=17227564)                                          |
| Aqua Voice 2 – Fast Voice Input for Mac and Windows              | 140 | 83       | 2025 | [Project](https://withaqua.com) [HN](https://news.ycombinator.com/item?id=43634005)                                                        |
| Scriber Pro – Offline AI transcription for macOS                 | 137 | 113      | 2025 | [Project](https://scriberpro.cc/hn/) [HN](https://news.ycombinator.com/item?id=45591222)                                                   |
| Project S.A.T.U.R.D.A.Y. – open-source, self hosted J.A.R.V.I.S. | 121 | 30       | 2023 | [Project](https://github.com/GRVYDEV/S.A.T.U.R.D.A.Y) [HN](https://news.ycombinator.com/item?id=36564923)                                  |
| Python Audio Transcription: Convert Speech to Text Locally       | 110 | 29       | 2025 | [Project](https://www.pavlinbg.com/posts/python-speech-to-text-guide) [HN](https://news.ycombinator.com/item?id=45337400)                  |
| Oasis AI – Craft Emails, Essays and Notes, Just by Talking       | 103 | 47       | 2023 | [Project](https://apps.apple.com/us/app/oasis-ai/id1668222944) [HN](https://news.ycombinator.com/item?id=35527070)                         |
| We brought iOS dictation to Windows                              | 82  | 17       | 2014 | [Project](http://www.myechoapp.com) [HN](https://news.ycombinator.com/item?id=7792072)                                                     |
| Record voice memo, receive transcription in email                | 76  | 47       | 2022 | [Project](https://whispermemos.com/) [HN](https://news.ycombinator.com/item?id=33274661)                                                   |
| Speech Meter – Improve Your English Pronunciation                | 71  | 66       | 2023 | [Project](https://speechmeter.com/) [HN](https://news.ycombinator.com/item?id=37843621)                                                    |
| Pinch – macOS voice translation for real-time conversations      | 65  | 23       | 2025 | [Project](https://www.startpinch.com/) [HN](https://news.ycombinator.com/item?id=44961153)                                                 |
| superwhisper – AI powered offline voice to text for macOS        | 43  | 48       | 2023 | [Project](https://superwhisper.com) [HN](https://news.ycombinator.com/item?id=37204722)                                                    |
| Chirp – Local Windows dictation with ParakeetV3                  | 34  | 18       | 2025 | [Project](https://github.com/Whamp/chirp) [HN](https://news.ycombinator.com/item?id=45930659)                                              |

### APIs/Services

| Title                                                                  | Pts | Comments | Year | Links                                                                                                                                                   |
| ---------------------------------------------------------------------- | --- | -------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Voice bots with 500ms response times                                   | 315 | 99       | 2024 | [Project](https://fastvoiceagent.cerebrium.ai/) [HN](https://news.ycombinator.com/item?id=40805010)                                                     |
| Self-host Whisper As a Service with GUI and queueing                   | 267 | 54       | 2023 | [Project](https://github.com/schibsted/WAAS) [HN](https://news.ycombinator.com/item?id=34770898)                                                        |
| Siri-as-a-Service Speech API                                           | 242 | 60       | 2014 | [Project](https://wit.ai/blog/2014/02/12/speech-api) [HN](https://news.ycombinator.com/item?id=7224436)                                                 |
| Sparrow-1 – Audio-native model for human-level turn-taking without ASR | 123 | 49       | 2026 | [Project](https://www.tavus.io/post/sparrow-1-human-level-conversational-timing-in-real-time-voice) [HN](https://news.ycombinator.com/item?id=46619614) |
| Using GPT-3 and Whisper to save doctors' time                          | 117 | 137      | 2023 | [HN](https://news.ycombinator.com/item?id=35151881)                                                                                                     |

### Libraries/Frameworks

| Title                                                               | Pts | Comments | Year | Links                                                                                                                        |
| ------------------------------------------------------------------- | --- | -------- | ---- | ---------------------------------------------------------------------------------------------------------------------------- |
| Port of OpenAI's Whisper model in C/C++ (whisper.cpp)               | 399 | 87       | 2022 | [Project](https://github.com/ggerganov/whisper.cpp) [HN](https://news.ycombinator.com/item?id=33877893)                      |
| State-of-the-art German speech recognition in 284 lines of C++      | 231 | 128      | 2022 | [Project](https://github.com/DeutscheKI/tevr-asr-tool) [HN](https://news.ycombinator.com/item?id=32409966)                   |
| Open-source, native audio turn detection model                      | 126 | 28       | 2025 | [Project](https://github.com/pipecat-ai/smart-turn) [HN](https://news.ycombinator.com/item?id=43283317)                      |
| Open-source real-time transcription playground (React, Python, GCP) | 76  | 11       | 2021 | [Project](https://github.com/saharmor/realtime-transcription-playground) [HN](https://news.ycombinator.com/item?id=27762350) |
| Windows port of OpenAI's Whisper automatic speech recognition       | 43  | 20       | 2023 | [Project](https://github.com/Const-me/Whisper) [HN](https://news.ycombinator.com/item?id=34401710)                           |
| Real-time voice chat with AI, no transcription                      | 33  | 6        | 2024 | [Project](https://demo.tincans.ai/) [HN](https://news.ycombinator.com/item?id=39759147)                                      |

### Other Tools

| Title                                                               | Pts | Comments | Year | Links                                                                                                                                            |
| ------------------------------------------------------------------- | --- | -------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Live coaching app for remote SWE interviews, uses Whisper and GPT-4 | 301 | 114      | 2023 | [Project](https://github.com/leetcode-mafia/cheetah) [HN](https://news.ycombinator.com/item?id=35447288)                                         |
| I made an open source and local translation app                     | 236 | 56       | 2024 | [Project](https://github.com/niedev/RTranslator) [HN](https://news.ycombinator.com/item?id=40722317)                                             |
| Bulk Creation of Transcripts from YouTube Playlists with Whisper    | 125 | 43       | 2023 | [Project](https://github.com/Dicklesworthstone/bulk_transcribe_youtube_videos_from_playlist) [HN](https://news.ycombinator.com/item?id=38236198) |
| PDF to Podcast – Convert Any PDF into a Podcast Episode             | 118 | 42       | 2024 | [Project](https://pdf-to-podcast.com) [HN](https://news.ycombinator.com/item?id=40653417)                                                        |

---

## Feature Requests & Problems Analysis

_Compiled from GitHub issues/discussions/PRs and HN threads across Buzz, Vibe, WhisperKit, whisper.cpp, and HN discussions._

### Top Feature Requests (by frequency across sources)

| Rank | Feature                           | Sources                                     | Priority |
| ---- | --------------------------------- | ------------------------------------------- | -------- |
| 1    | **Global Hotkeys / Push-to-Talk** | Vibe #531, #634; HN (all threads); Buzz gap | Critical |
| 2    | **100% Local/Offline**            | HN #1 concern; all threads                  | Critical |
| 3    | **Real-time Streaming**           | Vibe PR#534; HN; whisper.cpp #137, #304     | High     |
| 4    | **Auto-paste / Insert at Cursor** | Vibe #601, #530; Buzz #669; HN              | High     |
| 5    | **Speaker Diarization**           | Buzz #492; Vibe #521, #752; Scriber Pro     | High     |
| 6    | **Parakeet Model Support**        | HN (multiple threads); faster than Whisper  | High     |
| 7    | **System Audio Capture**          | Buzz #1103, #717; Vibe #108                 | Medium   |
| 8    | **One-time Purchase**             | HN (anti-subscription sentiment)            | Medium   |
| 9    | **Visual Recording Indicator**    | HN; Whispering feedback                     | Medium   |
| 10   | **LLM Post-processing**           | HN; Whispering transformations              | Medium   |

### Top Problems (by frequency across sources)

| Rank | Problem                           | Sources                                         | Severity |
| ---- | --------------------------------- | ----------------------------------------------- | -------- |
| 1    | **GPU Detection/Usage Failures**  | Buzz #1160, #1111, #910; Vibe #365; whisper.cpp | Critical |
| 2    | **AMD Vulkan "!!!!!" Output**     | Vibe #365, #655, #819; whisper.cpp #3611        | Critical |
| 3    | **Hallucinations on Silence**     | whisper.cpp #1724, #2191; all apps              | High     |
| 4    | **Crashes During Transcription**  | Vibe #370, #776; Buzz #1351; WhisperKit         | High     |
| 5    | **Memory Leaks**                  | whisper.cpp #2467; WhisperKit #300, #393        | High     |
| 6    | **Model Download Failures**       | Buzz #1287, #697; WhisperKit #396               | Medium   |
| 7    | **macOS Code Signing/Gatekeeper** | Vibe #737, #775                                 | Medium   |
| 8    | **Repetition Loops**              | whisper.cpp #1853, #896; Vibe #789              | Medium   |
| 9    | **Linux Record Feature Broken**   | Vibe #108, #462, #617                           | Medium   |
| 10   | **CoreML Caching Issues**         | WhisperKit #393; whisper.cpp #2126              | Medium   |

---

## Detailed Findings by Category

### 1. Hotkeys/Shortcuts

**Status**: Gap in most apps - Whispering's key differentiator

| Finding                                                      | Source          |
| ------------------------------------------------------------ | --------------- |
| Buzz has virtually NO hotkey requests - not its focus        | Buzz research   |
| Vibe #531, #634: Global hotkeys + auto-record is #1 request  | Vibe issues     |
| "Push-to-talk option would be a fine addition"               | HN superwhisper |
| "right shift as toggle" - short press toggle, long press PTT | HN Whispering   |
| Foot pedal integration mentioned                             | HN Whispering   |
| Users want separate hotkeys: record, cancel, paste           | HN threads      |

**Recommendations**:

- Multiple hotkey modes (toggle, push-to-talk, hold-to-record)
- Configurable modifier keys
- Per-action hotkeys (start, stop, cancel, paste)

### 2. Model Support

**Emerging trend**: Parakeet gaining over Whisper

| Model                 | Status      | Notes                                                      |
| --------------------- | ----------- | ---------------------------------------------------------- |
| **Parakeet**          | Rising      | "3000x real-time on A100, 5x on laptop CPU, more accurate" |
| **Whisper large-v3**  | Problematic | More hallucinations than v2 (whisper.cpp #1507, #2191)     |
| **Whisper turbo**     | Recommended | 8x faster, minor degradation                               |
| **Distilled models**  | Requested   | WhisperKit #317; Buzz #1326                                |
| **Custom fine-tuned** | Requested   | WhisperKit #369; Buzz #1360                                |

**Issues**:

- Buzz users confused about model backends (Whisper vs Faster-Whisper vs whisper.cpp)
- Model directory location flexibility needed (Buzz #450, #1035)
- Download resume capability needed (Buzz #1287)

### 3. Real-time/Streaming

**Status**: Architectural limitation of Whisper (30s chunks)

| Issue            | Source      | Details                                                    |
| ---------------- | ----------- | ---------------------------------------------------------- |
| whisper.cpp #137 | 27 comments | "Faster streaming support" - needs encoder chunking        |
| whisper.cpp #304 | 21 comments | "Continuous recognition" not natively supported            |
| Vibe PR#534      | Maintainer  | "Not planned with whisper" - waiting for faster CPU models |
| HN expectation   | Multiple    | Sub-second latency expected ("450ms" Aqua Voice claim)     |

**Workarounds**:

- Chunking with overlap (30s chunks, 5s overlap)
- VAD to find natural speech boundaries
- Separate "preview" and "final" states
- Word merging at chunk boundaries

**Warning**: VAD doesn't work with `whisper_full_with_state` (whisper.cpp #3402) - affects whisper-rs

### 4. Audio Input

| Issue                                          | Source                | Platform |
| ---------------------------------------------- | --------------------- | -------- |
| System audio capture highly requested          | Buzz #1103, #717      | All      |
| Linux record feature broken                    | Vibe #108, #462, #617 | Linux    |
| AirPods mic init latency                       | HN Aqua Voice         | macOS    |
| Screen recording permission required for audio | Vibe #715             | macOS    |
| Device unavailable errors                      | Buzz #1268            | Linux    |

**Platform-specific solutions**:

- Windows: WASAPI loopback or virtual audio cable
- macOS: BlackHole or screencapturekit
- Linux: PulseAudio/PipeWire loopback (problematic)

### 5. Performance / GPU

**Critical**: GPU detection is the #1 pain point

| GPU             | Status      | Issues                                             |
| --------------- | ----------- | -------------------------------------------------- |
| **NVIDIA CUDA** | Most stable | Best tested, some memory issues on older cards     |
| **Apple Metal** | Good        | CoreML caching doesn't persist (whisper.cpp #2126) |
| **AMD Vulkan**  | Problematic | RDNA1 crashes (whisper.cpp #3611); "!!!!!" output  |
| **AMD ROCm**    | Breaking    | ROCm 7.x incompatible (whisper.cpp #3553)          |
| **Intel**       | Limited     | WhisperKit crashes (EXC_ARITHMETIC)                |

**WhisperKit-specific**:

- CoreML audio resource leak (#393) - `coreaudiod` stays at 10-12% CPU
- Memory grows unbounded with repeated `loadModels()` (#300)
- ANE compilation expensive (5-10 min) but subsequent loads fast (3-5s)

**Recommendations**:

- Clear GPU detection feedback in UI
- Automatic fallback to CPU
- Test AMD GPUs thoroughly
- Pin ROCm to 6.x if possible

### 6. Output/Integration

| Request                                  | Source               | Priority |
| ---------------------------------------- | -------------------- | -------- |
| Auto-copy to clipboard on completion     | Vibe #605; Buzz #669 | High     |
| Insert at cursor position                | Vibe #601, #530      | High     |
| Paragraph formatting options             | Buzz #1236, #1150    | Medium   |
| Detected language in output              | Buzz #601            | Low      |
| Send to specific app (not just active)   | HN Aqua Voice        | Medium   |
| Custom instructions (lowercase in Slack) | HN Aqua Voice        | Low      |

**Clipboard handling concerns** (HN):

- "how the clipboard is handled during recording (does it copy? clear after output?)"
- "auto-paste feature is frustrating" - users want control

### 7. Platform Issues

| Platform    | Issues                                              | Status  |
| ----------- | --------------------------------------------------- | ------- |
| **macOS**   | Best supported; Gatekeeper blocks (Vibe #737, #775) | Good    |
| **Windows** | GPU issues; "whisper clones run poorly" (HN)        | Fair    |
| **Linux**   | Underserved; recording broken; Flatpak version lag  | Poor    |
| **iOS**     | "tough ergos given Apple's restrictions" (HN)       | Limited |

**Tauri-specific** (from Vibe):

- Platform-specific feature compilation needed
- Separate `tauri.conf.json` per platform
- Custom crash handler with `catch_unwind` for whisper context

### 8. Accuracy

| Issue                     | Source                   | Mitigation               |
| ------------------------- | ------------------------ | ------------------------ |
| Hallucinations on silence | whisper.cpp #1724        | VAD, but trade-offs      |
| Repetition loops          | whisper.cpp #1853, #896  | Detect patterns, restart |
| large-v3 worse than v2    | whisper.cpp #1507, #2191 | Use v2 or turbo          |
| "uuuuhmms" not filtered   | HN Whispering            | LLM post-processing      |
| Can't handle corrections  | HN Whispering            | UX challenge             |
| Children's speech issues  | HN Whispering            | Model limitation         |

### 9. Privacy/Local-first

**HN #1 concern** - non-negotiable for many users

| Quote                                                           | Source        |
| --------------------------------------------------------------- | ------------- |
| "Local inference only is an absolute requirement"               | HN Aqua Voice |
| "I want privacy, offline mode and source code"                  | HN Aqua Voice |
| Users abandoned Aqua Voice when they saw data collection policy | HN Aqua Voice |
| VoiceInk repeatedly recommended as "offline alternative"        | HN multiple   |

### 10. Pricing/Business Model

**Strong anti-subscription sentiment**

| Finding                                                       | Source          |
| ------------------------------------------------------------- | --------------- |
| "I won't pay monthly. I would pay once, maybe a lot."         | HN superwhisper |
| "Death by 1000 $65/year apps"                                 | HN superwhisper |
| superwhisper added $165 lifetime license same day - sold zero | HN superwhisper |
| Scriber Pro at $3.99 called "instant buy"                     | HN Scriber Pro  |
| MacWhisper praised for one-time purchase                      | HN multiple     |

---

## Whispering & Handy Research (Our Apps)

### Whispering (Epicenter) - Top Issues

**Most Discussed Bugs:**

| #   | Comments | Issue                                | Platform |
| --- | -------- | ------------------------------------ | -------- |
| 879 | 13       | FFMPEG compression error message     | Windows  |
| 856 | 9        | Pasting text at cursor doesn't work  | Linux    |
| 973 | 8        | FFmpeg still not working             | Windows  |
| 919 | 5        | App slow/inactive when in background | macOS    |
| 893 | 5        | No recording devices found (FFmpeg)  | Windows  |

**Top Feature Requests:**

| Category            | Issues                     | Description                                            |
| ------------------- | -------------------------- | ------------------------------------------------------ |
| **Hotkeys**         | #1264, #1263, #1153, #1152 | Difficult shortcuts, conflicts, Fn key, paste shortcut |
| **Recording**       | #1129, #1053, #1246        | Visual indicator, system audio, default mic            |
| **Models**          | #1247, #1213, #1187        | AMD NPU, local Whisper on Windows                      |
| **Transformations** | #1269, #1208, #1249        | Script support, multiple transforms, picker            |
| **UI**              | #848, #1191, #1186         | Minimize-to-tray, don't quit on close, config export   |

**Platform-Specific Pain Points:**

- **Windows**: FFmpeg recording failures (#893, #879, #973) - "#1 complaint"
- **macOS**: Background performance degradation (#919, #1025)
- **Linux**: Paste doesn't work on Wayland (#856, #1172, #1001)

**What Users Love:**

- Groq API integration (fast and free)
- Transformations feature (LLM post-processing)
- Global shortcuts (when they work)
- Open source and self-hostable

**What Users Hate:**

- FFmpeg/Windows recording issues
- No visual recording indicator
- Tray behavior removed in v7.0.1
- Push-to-talk missing (Discussion #307)

### Handy - Top Issues & Solutions

**Critical Crashes:**

| Issue      | Description                               | Platform      |
| ---------- | ----------------------------------------- | ------------- |
| #641, #462 | Race condition when PTT hit twice rapidly | All           |
| #537, #436 | Crash when recording starts               | Windows       |
| #646       | AirPods Handoff stealing audio session    | macOS         |
| #471, #615 | Global hotkey not working                 | Linux/Wayland |

**Problems Handy Solved (Adopt These):**

1. **Audio Ducking with Crash Recovery** (PR #626)
   - Configurable volume slider (0-100%) instead of binary mute
   - Persists original volume to disk for restore after crash
   - Cross-platform: CoreAudio, COM API, wpctl/pactl/amixer

2. **SIGUSR2 Signal Handling** for Wayland

   ```bash
   # User configures WM shortcut to:
   pkill -USR2 -n handy
   ```

   - Bypasses Wayland's global shortcut restrictions

3. **State Machine for Race Conditions** (PR #672)
   - Prevents crashes from rapid push-to-talk triggers
   - `Idle → Recording → Processing → Idle`

4. **Model Unloading** for Memory
   - "Unload model immediately" option frees VRAM

5. **Custom Word Correction** with Phonetic Matching
   - Soundex algorithm for similar-sounding words
   - Filler word removal (PR #589)

6. **Modifier Key Release** Before Paste
   - Prevents catastrophic shortcuts (Issue #595)

**Handy Architecture (No FFmpeg):**

```
cpal (audio) → rubato (resample) → transcribe-rs → enigo (paste)
```

- **No FFmpeg dependency** - Audio goes directly to transcribe-rs
- **transcribe-rs** supports: Whisper, Parakeet V3, Moonshine
- **handy-keys** for better cross-platform hotkey handling

**Handy vs Whispering Comparison:**

| Aspect           | Handy                     | Whispering                    |
| ---------------- | ------------------------- | ----------------------------- |
| Audio capture    | cpal → direct             | May use FFmpeg                |
| Transcription    | transcribe-rs             | whisper.cpp via FFI           |
| Parakeet support | Yes (5x real-time on CPU) | No                            |
| Cloud providers  | Groq (PR #654)            | Multiple (Groq, OpenAI, etc.) |
| Transformations  | Basic LLM cleanup         | Rich transformation system    |
| VAD              | vad-rs (Silero)           | Configurable                  |

---

## Architectural Patterns

### From Vibe (Tauri)

```rust
// Platform-specific features
#[cfg(target_os = "macos")]
vibe_core = { features = ["coreml", "metal"] }

#[cfg(windows)]
vibe_core = { features = [] }  // Vulkan default

// Panic handling for whisper
let ctx = catch_unwind(AssertUnwindSafe(|| {
    WhisperContext::new_with_params(model_path, ctx_params)
}));
```

- Uses forked whisper-rs for bug fixes
- Custom crash handler with panic hook
- Audio normalized via FFmpeg to 16kHz mono WAV
- No chunking/streaming for long files (causes crashes)

### From WhisperKit (Apple)

```swift
// Recommended compute configuration
computeOptions: .init(
    audioEncoderCompute: .cpuAndNeuralEngine,
    textDecoderCompute: .cpuAndGPU
)
```

- ANE for audio encoder, GPU for text decoder
- Prewarm models to avoid cold-start latency
- Model caching: 3-5s subsequent loads vs 440s initial

### From Buzz (Python)

- Multiple backends: Whisper, whisper.cpp, Faster-Whisper, OpenAI API
- Live recording separate from file transcription
- Speaker diarization resource-intensive, causes crashes

---

## Whispering's Differentiators (Validated)

Based on this research, Whispering's focus areas are **validated gaps**:

| Feature                    | Competitor Status            | Whispering Advantage |
| -------------------------- | ---------------------------- | -------------------- |
| Global hotkeys             | Buzz: none; Vibe: #1 request | Core feature         |
| Push-to-talk               | Most apps lack it            | Core feature         |
| Clipboard/paste automation | Underserved (Buzz #669)      | Core feature         |
| Open-source local-first    | Aqua Voice lost trust        | Core value           |
| Transformations (LLM)      | Novel approach               | Differentiator       |

---

## Recommendations for Whispering

### Critical (Do First)

1. **Fix Windows FFmpeg recording** - #893, #879, #973 are top complaints
2. **Add visual recording indicator** - #1129, users miss start sound
3. **Fix Linux paste on Wayland** - #856, #1172 (consider SIGUSR2 like Handy)
4. **Race condition prevention** - State machine like Handy PR #672
5. **AMD Vulkan fallback** - Auto-detect and use CPU if Vulkan fails

### High Priority

1. **Restore minimize-to-tray** - #848, was removed, users want it back
2. **Fix macOS background performance** - #919, #1025
3. **Push-to-talk mode** - Discussion #307, hold-to-record
4. **Parakeet model support** - HN users want it, Handy has it via transcribe-rs
5. **Audio ducking with crash recovery** - Adopt Handy's approach

### Medium Priority

1. **System audio capture** - #1053, platform-specific implementations
2. **Streaming preview** - Show partial results during recording
3. **Speaker diarization** - High demand, resource-intensive
4. **Config export/import** - #1186
5. **Model unloading option** - Free VRAM when not transcribing

### Adopt from Handy

1. **transcribe-rs** - No FFmpeg, supports Parakeet + Moonshine
2. **State machine** for recording state (prevents race conditions)
3. **Audio ducking** with volume persistence for crash recovery
4. **SIGUSR2 signal** for Wayland hotkey workaround
5. **handy-keys** for better cross-platform hotkey handling
6. **Modifier key release** before paste to prevent catastrophic shortcuts

### Research Further

1. **Parakeet integration** - Via transcribe-rs or ONNX runtime
2. **Turn detection** - pipecat-ai/smart-turn model
3. **Audio-native models** - Sparrow-1 bypasses ASR entirely
4. **Consider ditching FFmpeg** - Handy's cpal→transcribe-rs pipeline

---

## Key Technical Issues to Watch

| Issue                              | whisper.cpp # | Impact             |
| ---------------------------------- | ------------- | ------------------ |
| VAD with `whisper_full_with_state` | #3402         | Affects whisper-rs |
| Memory leak on context dealloc     | #2467         | Long-running apps  |
| AMD Vulkan RDNA1 crash             | #3611         | User GPU support   |
| ROCm 7.x breaking changes          | #3553         | AMD Linux          |
| CoreML caching doesn't persist     | #2126         | macOS cold starts  |

---

## Open Source Alternatives Mentioned on HN

Users recommend these as alternatives:

1. **VoiceInk** - macOS, open-source, local, Parakeet
2. **MacWhisper** - One-time purchase, Parakeet, speaker detection
3. **Vibe** - Cross-platform, open-source, diarization
4. **whisper.cpp CLI** - Fastest local option
5. **Hyprnote** - Meeting notes focused
6. **Handy** - Cross-platform, Parakeet, no FFmpeg dependency

---

## Summary: Cross-App Issue Patterns

### Universal Pain Points (All Apps)

| Issue            | Affected Apps           | Root Cause             |
| ---------------- | ----------------------- | ---------------------- |
| AMD GPU failures | Vibe, Buzz, whisper.cpp | Vulkan backend bugs    |
| Wayland hotkeys  | Whispering, Handy, Vibe | Platform restrictions  |
| Hallucinations   | All                     | Whisper model behavior |
| Race conditions  | Whispering, Handy       | State management       |
| Memory leaks     | whisper.cpp, WhisperKit | Context handling       |

### Platform-Specific Patterns

| Platform    | Common Issues                            | Solutions Seen                  |
| ----------- | ---------------------------------------- | ------------------------------- |
| **Windows** | FFmpeg device enumeration, GPU detection | cpal instead of FFmpeg          |
| **macOS**   | Background performance, AirPods handoff  | Audio session management        |
| **Linux**   | Wayland paste/hotkeys, audio capture     | SIGUSR2, wtype/dotool fallbacks |

### Feature Request Consensus

| Feature          | Buzz      | Vibe       | Handy | Whispering | HN       |
| ---------------- | --------- | ---------- | ----- | ---------- | -------- |
| Global hotkeys   | Gap       | #1 request | Core  | Core       | Critical |
| Push-to-talk     | No        | Requested  | Core  | Missing    | High     |
| Visual indicator | No        | -          | Has   | Missing    | High     |
| System audio     | Requested | Broken     | -     | Requested  | Medium   |
| Parakeet         | No        | No         | Yes   | No         | High     |
| Diarization      | Has       | Has        | No    | No         | High     |

### Architectural Lessons

1. **FFmpeg is problematic** - Handy's no-FFmpeg approach avoids Windows issues
2. **State machines prevent crashes** - Both Handy and Vibe learned this
3. **Wayland needs workarounds** - SIGUSR2 signal is clever solution
4. **Model flexibility matters** - Users want Parakeet, Moonshine, not just Whisper
5. **Crash recovery essential** - Persist state to recover from panics
