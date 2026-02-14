# ASR Model Radar

Tracking promising ASR models discovered from upstream projects and the open-source community. This doc is maintained as a living reference for RIFT source selection.

**Tracking sources:**

- [cjpais/transcribe-rs issues](https://github.com/cjpais/transcribe-rs/issues?q=sort%3Aupdated-desc+is%3Aissue+is%3Aopen) (Handy's transcription backend)
- cjpais/transcribe-rs PRs -- TODO
- [Whispering issues](https://github.com/braden-w/whispering/issues) -- TODO
- Whispering PRs -- TODO

**Last updated:** 2026-02-14

---

## Tier 1: Strong Candidates

Models with genuine streaming support, high accuracy, and permissive licenses.

### Qwen3-ASR (Alibaba)

| Field           | Value                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **HuggingFace** | [Qwen/Qwen3-ASR-0.6B](https://huggingface.co/Qwen/Qwen3-ASR-0.6B), [Qwen/Qwen3-ASR-1.7B](https://huggingface.co/Qwen/Qwen3-ASR-1.7B) |
| **Source**      | [transcribe-rs #30](https://github.com/cjpais/transcribe-rs/issues/30)                                                               |
| **Params**      | 0.6B / 1.7B                                                                                                                          |
| **Streaming**   | Yes -- unified streaming/offline with single model                                                                                   |
| **Languages**   | 52 languages + 22 Chinese dialects                                                                                                   |
| **Accuracy**    | SOTA open-source. 1.7B: LS-clean 1.63%, LS-other 3.38% (offline); 1.95%/4.51% (streaming)                                            |
| **Timestamps**  | Word-level via companion `Qwen3-ForcedAligner-0.6B` (separate model, separate pass)                                                  |
| **Diarization** | No (on their roadmap)                                                                                                                |
| **Hotwords**    | No                                                                                                                                   |
| **Interims**    | Non-monotonic (streaming mode)                                                                                                       |
| **Runtime**     | vLLM (day-0 support), Transformers, OpenAI-compatible API                                                                            |
| **Hardware**    | GPU required (no CPU-only path)                                                                                                      |
| **License**     | Apache-2.0                                                                                                                           |
| **Downloads**   | ~71K/month                                                                                                                           |
| **Paper**       | [arXiv 2601.21337](https://arxiv.org/abs/2601.21337)                                                                                 |

**RIFT relevance:** Strongest new open-source streaming ASR model. The 0.6B variant could run on consumer GPUs. vLLM's OpenAI-compatible streaming API makes WebSocket bridge feasible. Main gaps vs RIFT needs: no built-in diarization, timestamps require a separate aligner model (adds latency), GPU-only.

**Singing/music:** Qwen3-ASR-1.7B also handles singing voice and songs with background music -- unique among ASR models.

### VibeVoice-ASR (Microsoft)

| Field           | Value                                                                     |
| --------------- | ------------------------------------------------------------------------- |
| **HuggingFace** | [microsoft/VibeVoice-ASR](https://huggingface.co/microsoft/VibeVoice-ASR) |
| **Source**      | [transcribe-rs #26](https://github.com/cjpais/transcribe-rs/issues/26)    |
| **Params**      | Large (not disclosed)                                                     |
| **Streaming**   | No -- long-form single-pass (up to 60 min)                                |
| **Languages**   | 50+ with code-switching support                                           |
| **Accuracy**    | Competitive (see benchmarks on model card)                                |
| **Timestamps**  | Yes -- integrated in output                                               |
| **Diarization** | **Yes** -- built-in, joint with ASR (Who/When/What)                       |
| **Hotwords**    | **Yes** -- customizable for domain-specific terms                         |
| **Runtime**     | Transformers, vLLM                                                        |
| **Hardware**    | GPU required                                                              |
| **License**     | MIT                                                                       |
| **Downloads**   | ~472K/month (very popular)                                                |
| **Paper**       | [arXiv 2601.18184](https://arxiv.org/abs/2601.18184)                      |

**RIFT relevance:** Not streaming, but the only open model doing joint ASR + diarization + timestamps in one pass. Could serve as a "refine" step for final transcripts, or for non-realtime batch scenarios. The hotword support is unique among free models. Extremely popular (472K downloads/month).

### nemotron-asr.cpp (GGML port)

| Field         | Value                                                                  |
| ------------- | ---------------------------------------------------------------------- |
| **GitHub**    | [m1el/nemotron-asr.cpp](https://github.com/m1el/nemotron-asr.cpp)      |
| **Source**    | [transcribe-rs #31](https://github.com/cjpais/transcribe-rs/issues/31) |
| **Params**    | 0.6B (quantized: Q8_0, Q4, etc.)                                       |
| **Streaming** | Yes -- configurable latency (80ms to 1.12s)                            |
| **Languages** | English only                                                           |
| **Accuracy**  | Claims better quality than Whisper; infinite-length streaming          |
| **Runtime**   | Pure C++ with ggml only -- no Python, no NeMo                          |
| **Hardware**  | CPU (with ggml backend)                                                |
| **License**   | MIT (code); NVIDIA Open Model License (weights)                        |

**RIFT relevance:** Enhances the existing Nemotron/Sherpa pathway. This GGML port means Nemotron could run on CPU without Python/NeMo dependencies -- analogous to how whisper.cpp relates to Whisper. Lightweight, low-dependency edge deployment. Only 10 stars but actively developed.

---

## Tier 2: Interesting but Gaps for RIFT

Models with strong accuracy but missing streaming, timestamps, or other RIFT requirements.

### Fun-ASR-Nano (Alibaba/FunAudioLLM)

| Field           | Value                                                                                 |
| --------------- | ------------------------------------------------------------------------------------- |
| **HuggingFace** | [FunAudioLLM/Fun-ASR-Nano-2512](https://huggingface.co/FunAudioLLM/Fun-ASR-Nano-2512) |
| **Source**      | [transcribe-rs #21](https://github.com/cjpais/transcribe-rs/issues/21)                |
| **Params**      | 800M (Nano) / 7.7B (full)                                                             |
| **Streaming**   | Claims "low-latency real-time transcription" -- details sparse                        |
| **Languages**   | 31 (Nano: ZH/EN/JA; MLT-Nano: 31 languages)                                           |
| **Accuracy**    | Nano competitive with Whisper Large v3; strong on dialects/accents                    |
| **Timestamps**  | No (TODO)                                                                             |
| **Diarization** | No (TODO)                                                                             |
| **License**     | Not specified                                                                         |
| **Downloads**   | ~709/month                                                                            |

**RIFT relevance:** Strong accuracy, especially for Chinese dialects and noisy/far-field audio. Missing timestamps and diarization (both listed as TODO). The MLT-Nano variant covering 31 languages at 800M is interesting for edge deployment if timestamps land. Monitor for updates.

**Notable:** Trained on tens of millions of hours of real speech data. Handles lyrics recognition and rap speech -- unusual capability.

### GLM-ASR-Nano (Z.ai / Zhipu)

| Field            | Value                                                                         |
| ---------------- | ----------------------------------------------------------------------------- |
| **HuggingFace**  | [zai-org/GLM-ASR-Nano-2512](https://huggingface.co/zai-org/GLM-ASR-Nano-2512) |
| **Source**       | [transcribe-rs #20](https://github.com/cjpais/transcribe-rs/issues/20)        |
| **Params**       | 1.5B                                                                          |
| **Streaming**    | No evidence of streaming                                                      |
| **Languages**    | Chinese + English                                                             |
| **Accuracy**     | Claims lowest avg WER (4.10) among comparable open-source models              |
| **Key strength** | Cantonese dialect optimization, low-volume/whisper speech robustness          |
| **License**      | MIT                                                                           |
| **Downloads**    | ~215K/month                                                                   |

**RIFT relevance:** Low. Offline only, limited to Chinese/English. No streaming, timestamps, or diarization. Primarily relevant if RIFT needs exceptional Chinese dialect or whisper-speech recognition.

### SenseVoice (Alibaba/FunAudioLLM)

| Field           | Value                                                                             |
| --------------- | --------------------------------------------------------------------------------- |
| **HuggingFace** | [FunAudioLLM/SenseVoiceSmall](https://huggingface.co/FunAudioLLM/SenseVoiceSmall) |
| **Source**      | [transcribe-rs #12](https://github.com/cjpais/transcribe-rs/issues/12)            |
| **Params**      | Small (non-autoregressive)                                                        |
| **Streaming**   | No -- batch/offline only                                                          |
| **Languages**   | 50+                                                                               |
| **Key feature** | Multi-task: ASR + emotion recognition + audio event detection                     |
| **Speed**       | 70ms for 10s audio (15x faster than Whisper Large)                                |
| **License**     | Custom model license                                                              |
| **Downloads**   | ~2.3K/month                                                                       |

**RIFT relevance:** Low. Not streaming. Emotion recognition and audio event detection are unique but not RIFT priorities. Largely superseded by Fun-ASR-Nano from the same team.

---

## Tier 3: Niche / Not Relevant

### MedASR (Google)

| Field           | Value                                                                   |
| --------------- | ----------------------------------------------------------------------- |
| **HuggingFace** | [google/medasr](https://huggingface.co/google/medasr)                   |
| **Source**      | [transcribe-rs #25](https://github.com/cjpais/transcribe-rs/issues/25)  |
| **Params**      | 105M (Conformer CTC)                                                    |
| **Streaming**   | No -- offline CTC                                                       |
| **Languages**   | English only                                                            |
| **Key feature** | SOTA for medical dictation; n-gram KenLM boosting                       |
| **License**     | Restrictive (Health AI Developer Foundations terms, requires agreement) |
| **Downloads**   | ~36K/month                                                              |

**RIFT relevance:** Very low. English-only, offline, medical-domain-specific, restrictive license. Not relevant for general-purpose streaming transcription.

### Vosk

| Field      | Value                                                                |
| ---------- | -------------------------------------------------------------------- |
| **Source** | [transcribe-rs #9](https://github.com/cjpais/transcribe-rs/issues/9) |
| **Note**   | Kaldi-based, well-established but largely superseded by sherpa-onnx  |

**RIFT relevance:** Low. sherpa-onnx already fills this niche with better models and more active development.

---

## Already in RIFT Spec

These models are already documented in `specs/rift-transcription.md`:

| Model                              | RIFT Phase           | Notes                                                                                                                                                                           |
| ---------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Voxtral Mini 4B Realtime (Mistral) | Phase 3b             | Natively streaming, 13 languages, configurable delay, Apache-2.0. Community ports exist in C, Rust, MLX. [transcribe-rs #32](https://github.com/cjpais/transcribe-rs/issues/32) |
| Moonshine v2 (UsefulSensors)       | Phase 2b             | True streaming encoder, built-in diarization, smallest models. [transcribe-rs #29](https://github.com/cjpais/transcribe-rs/issues/29)                                           |
| Nemotron Streaming (NVIDIA)        | Phase 2 (via Sherpa) | FastConformer transducer, monotonic interims, ONNX via sherpa-onnx. [transcribe-rs #31](https://github.com/cjpais/transcribe-rs/issues/31)                                      |

---

## Quick Comparison Matrix

| Model                | Params    | Streaming | Languages | Diarization | Word Timestamps | Monotonic | License     | RIFT Priority |
| -------------------- | --------- | --------- | --------- | ----------- | --------------- | --------- | ----------- | ------------- |
| **Qwen3-ASR**        | 0.6B/1.7B | Yes       | 52        | No          | Via aligner     | No        | Apache-2.0  | Watch         |
| **VibeVoice-ASR**    | Large     | No        | 50+       | **Yes**     | **Yes**         | N/A       | MIT         | Watch         |
| **nemotron-asr.cpp** | 0.6B      | Yes       | EN        | No          | No              | Yes       | MIT/NVIDIA  | Watch         |
| Fun-ASR-Nano         | 0.8B      | Partial   | 31        | No          | No              | ?         | Unclear     | Monitor       |
| GLM-ASR-Nano         | 1.5B      | No        | ZH/EN     | No          | No              | N/A       | MIT         | Low           |
| SenseVoice           | Small     | No        | 50+       | No          | No              | N/A       | Custom      | Low           |
| MedASR               | 105M      | No        | EN        | No          | No              | N/A       | Restrictive | Skip          |

**Priority legend:**

- **Watch** -- Actively track releases; consider for RIFT integration
- **Monitor** -- Check back when key features (timestamps, streaming) ship
- **Low** -- Only relevant for specific niche requirements
- **Skip** -- Not applicable to RIFT

---

## Other Issues (Not Model Requests)

| Issue                                                    | Topic                    | Notes                                                                                  |
| -------------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------- |
| [#4](https://github.com/cjpais/transcribe-rs/issues/4)   | On-the-fly transcription | Feature request for live streaming in Handy -- validates the use case RIFT is building |
| [#10](https://github.com/cjpais/transcribe-rs/issues/10) | CTranslate2 backend      | Faster Whisper via ct2rs with CUDA -- not relevant for RIFT (Whisper not streaming)    |
