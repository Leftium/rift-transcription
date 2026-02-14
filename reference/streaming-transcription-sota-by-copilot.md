Okay, I've come up with a research plan. We'll do a deep dive into the current state-of-the-art in real-time streaming ASR, focusing only on transcription models like Deepgram Nova-3, ElevenLabs Scribe v2, and Sherpa-ONNX — and excluding any TTS systems.

# State-of-the-Art in Real-Time Streaming Automatic Speech Recognition (ASR) as of Early 2026

---

## Introduction

The field of automatic speech recognition (ASR) has undergone a dramatic transformation in recent years, driven by advances in deep learning architectures, the proliferation of large-scale multilingual datasets, and the increasing demand for real-time, low-latency voice interfaces. As of early 2026, real-time streaming ASR is at the core of conversational AI, powering applications from live captioning and meeting assistants to AI voice agents and telephony systems. This report provides a comprehensive analysis of the current state-of-the-art (SOTA) in real-time streaming ASR, focusing on the leading commercial APIs and open-source models. Special attention is given to Deepgram Nova-3, ElevenLabs Scribe v2 Realtime, and Sherpa-ONNX, alongside other top contenders such as AssemblyAI, Google, AWS, Microsoft, Rev.ai, Speechmatics, and the latest open-source toolkits and models.

The report systematically compares these solutions across critical dimensions: latency, word error rate (WER), multilingual capabilities, speaker diarization, domain adaptation, and deployment options. It also clarifies the distinction between ASR (speech-to-text) and TTS (text-to-speech), ensuring that only transcription models are included in the main analysis. A detailed comparison table summarizes the key attributes of each model and API, followed by in-depth paragraphs that contextualize and analyze the findings. The report draws on a wide range of recent benchmarks, technical documentation, and industry analyses to provide an authoritative overview of the field as it stands in early 2026.

---

## 1. Overview of Real-Time Streaming ASR SOTA (Early 2026)

### 1.1. The Evolution of Streaming ASR

Real-time streaming ASR refers to systems that transcribe spoken language into text as the audio is being produced, with minimal delay. Unlike batch ASR, which processes complete audio files after recording, streaming ASR must deliver partial and final transcripts in near real-time, often with sub-second latency. This requirement introduces unique challenges, particularly in balancing latency and accuracy, handling diverse languages and accents, and supporting features such as speaker diarization and domain adaptation.

The last two years have seen a convergence of several trends that have propelled streaming ASR forward:

- **Architectural Innovations:** Transformer-based models, Conformer and FastConformer architectures, and hybrid encoder-decoder frameworks have become standard, enabling robust modeling of both local and global acoustic dependencies.
- **Multilingual Expansion:** Models now routinely support dozens to hundreds of languages, with some open-source projects (e.g., Omnilingual ASR) covering over 1,600 languages.
- **Latency Optimization:** Advances in streaming inference, cache-aware architectures, and quantization have reduced end-to-end latency to well below 300ms in leading systems.
- **Deployment Flexibility:** Cloud APIs, on-premises solutions, and edge/on-device models are all available, catering to privacy, cost, and regulatory requirements.
- **Feature Integration:** Speaker diarization, keyterm prompting, and domain adaptation are increasingly integrated into core ASR offerings, moving beyond basic transcription.

### 1.2. Key Metrics and Evaluation Benchmarks

The primary metrics for evaluating streaming ASR systems are:

- **Word Error Rate (WER):** The percentage of words incorrectly transcribed, with lower values indicating higher accuracy. WER is typically measured on standard datasets such as LibriSpeech, AMI, VoxPopuli, and domain-specific corpora.
- **Latency:** Measured as end-to-end delay (from speech input to transcript output) or as real-time factor (RTF/RTFx), which quantifies how many seconds of audio can be processed per second of compute time. Sub-300ms latency is considered SOTA for real-time applications.
- **Multilingual Coverage:** The number and diversity of supported languages, including support for code-switching and dialectal variation.
- **Speaker Diarization:** The ability to attribute segments of speech to individual speakers, critical for meetings, calls, and multi-party conversations.
- **Domain Adaptation:** Mechanisms for improving recognition of domain-specific vocabulary, including keyterm prompting and prompt-tuning.
- **Deployment Options:** Availability as cloud API, on-premises, edge/on-device, or open-source self-hosted solutions.

---

## 2. Deepgram Nova-3 (ASR): Capabilities and Metrics

### 2.1. Model Overview and Architecture

Deepgram Nova-3 is the flagship ASR model from Deepgram, released in 2025 and continually updated through early 2026. It is designed specifically for enterprise-grade, real-time transcription, with a focus on accuracy, adaptability, and low latency across diverse languages and acoustic environments.

Nova-3 leverages a sophisticated audio embedding framework and advanced audio-text alignment techniques, enabling it to handle challenging acoustic conditions, rare vocabulary, and regional dialects. The model is optimized for both batch and streaming modes, with particular emphasis on streaming performance for live applications such as voice agents and AI telephony.

### 2.2. Latency and Real-Time Performance

Nova-3 consistently delivers **sub-300ms end-to-end latency** in streaming mode, making it suitable for conversational AI and live captioning. This latency is achieved through architectural optimizations, efficient buffering, and real-time inference pipelines. In production deployments, median latency is reported at approximately 150–300ms, with stable performance under load.

### 2.3. Word Error Rate (WER) and Accuracy

Nova-3 sets new benchmarks for streaming ASR accuracy:

- **Median WER:** ~6.8% on real-world datasets, representing a 54% improvement over previous models and a 54.2% reduction compared to the next-best alternative at 14.9%.
- **Relative Improvement:** Nova-3 achieves a 54.3% reduction in WER for streaming and 47.4% for batch processing compared to competitors.
- **Robustness:** The model maintains high accuracy in noisy environments, with strong performance on accented speech and overlapping conversations.

### 2.4. Multilingual Capabilities

Nova-3 supports over **36 languages**, with recent expansions adding 10 new monolingual languages and significant upgrades to its multilingual model. The model is particularly adept at handling languages with complex morphology, tonal variation, and multi-script writing systems, including Greek, Romanian, Slovak, Catalan, Lithuanian, Latvian, Estonian, Flemish, Swiss German, and Malay.

- **Keyterm Prompting:** Nova-3 Multilingual supports up to 500 tokens (about 100 words) for keyterm prompting, enabling improved recognition of brand names, technical terminology, and domain-specific vocabulary across all supported languages. This feature does not require retraining and adapts instantly to provided key terms.

### 2.5. Speaker Diarization

Speaker diarization is available as an add-on feature in Nova-3, supporting both batch and streaming modes. The diarization system can attribute speech segments to individual speakers, with per-word speaker labels in the transcript. While diarization accuracy is strong in English, support for other languages is more limited, and diarization performance may vary depending on audio quality and the number of speakers.

### 2.6. Domain Adaptation and Customization

Nova-3 offers several mechanisms for domain adaptation:

- **Keyterm Prompting:** As described above, allows for instant adaptation to domain-specific vocabulary.
- **Custom Model Training:** Enterprises can request custom model training for specialized domains, further improving accuracy for industry-specific terminology.
- **Keyword Boosting:** Developers can boost recognition of specific terms, improving recall rates for critical vocabulary.

### 2.7. Deployment Options

Nova-3 is available as a **cloud API**, with options for on-premises deployment and private VPC for enterprises with strict data privacy requirements. The model can be integrated via REST or WebSocket APIs, with SDKs available for Python, JavaScript, Go, and .NET.

- **Edge Deployment:** While Nova-3 is primarily cloud-based, Deepgram offers streaming-optimized variants (e.g., Flux) for ultra-low latency edge applications.
- **Data Privacy:** Opt-out of model training is available for paid tiers, ensuring customer data is not used for further model improvement without consent.

---

## 3. ElevenLabs Scribe v2 Realtime (ASR): Capabilities and Metrics

### 3.1. Model Overview and Architecture

ElevenLabs Scribe v2 Realtime is the latest real-time ASR model from ElevenLabs, launched in January 2026. It is purpose-built for live transcription in conversational AI, voice agents, and meeting assistants, with a strong emphasis on ultra-low latency and multilingual coverage.

Scribe v2 Realtime employs predictive transcription, next-word and punctuation prediction, and automatic language detection. The model streams partial results as the speaker talks, enabling natural conversation and immediate response.

### 3.2. Latency and Real-Time Performance

Scribe v2 Realtime achieves **median latency under 150ms**, with optimized configurations reaching as low as 30–80ms. This performance sets a new standard for live transcription, ensuring that transcripts are delivered almost instantaneously as words are spoken.

- **Negative Latency:** The model can predict the next word and punctuation before the speaker finishes, further reducing perceived delay.
- **Manual Commit:** Developers have full control over when to finalize transcript segments, allowing for flexible integration in agentic workflows.

### 3.3. Word Error Rate (WER) and Accuracy

Scribe v2 Realtime delivers **93.5% accuracy** across 30 commonly used European and Asian languages, outperforming Whisper, Gemini Flash, and Deepgram Nova-3 in multilingual benchmarks.

- **Multilingual Benchmark:** 93.5% accuracy (WER ~6.5%) on a diverse set of languages, with particularly strong performance in noisy and accented speech conditions.
- **Comparison:** Edges out Gemini 2.5 Flash (91.4%), GPT-4o MiniTranscribe (90.7%), and Deepgram Nova-3 (88.4%) in head-to-head tests.

### 3.4. Multilingual Capabilities

Scribe v2 Realtime supports **90+ languages** with automatic language detection and seamless code-switching. The model can handle language switches mid-conversation without manual configuration, making it ideal for global applications.

- **Text Conditioning:** The model continues transcription based on previous batches, useful for maintaining context in interrupted or restarted sessions.

### 3.5. Speaker Diarization

Speaker diarization is available as an **optional feature**, supporting up to 48 distinct speakers with timestamps in the batch version. In real-time mode, diarization is available for live applications, with per-segment speaker labels and support for audio-tagging of non-speech events (e.g., laughter, applause).

### 3.6. Domain Adaptation and Keyterm Prompting

- **Keyterm Prompting:** The batch version supports up to 100 technical terms for improved recognition of domain-specific vocabulary.
- **Entity Detection:** Scribe v2 Batch automatically identifies and timestamps 56 categories of sensitive data, supporting compliance workflows in healthcare, finance, and legal domains.

### 3.7. Deployment Options

Scribe v2 Realtime is available via the **ElevenLabs API** and is integrated into ElevenLabs Agents, a platform for building conversational AI applications. The model supports multiple audio formats (PCM, μ-law) and offers enterprise-grade security and compliance (SOC 2, ISO 27001, HIPAA, GDPR, zero retention mode).

- **Data Residency:** EU and India data residency options are available for compliance-sensitive workloads.
- **Zero Retention:** Audio can be deleted immediately after processing for privacy.

---

## 3b. Voxtral Transcribe 2 (Mistral): Capabilities and Metrics

### 3b.1. Model Overview and Architecture

Voxtral Transcribe 2 is Mistral's next-generation speech-to-text offering, released in early 2026. The family includes two models:

- **Voxtral Mini Transcribe V2** — Batch transcription with diarization and context biasing
- **Voxtral Realtime** — Live streaming with configurable latency-accuracy tradeoff

Voxtral Realtime uses a **novel streaming architecture** that transcribes audio as it arrives, rather than adapting offline models by processing audio in chunks. This purpose-built approach enables configurable latency down to sub-200ms while maintaining near-batch accuracy.

The 4B parameter Voxtral Realtime model is released under **Apache 2.0** open weights, enabling edge deployment for privacy-sensitive applications.

### 3b.2. Latency and Real-Time Performance

Voxtral Realtime achieves **configurable latency from sub-200ms to 2.4 seconds**, allowing developers to tune the latency-accuracy tradeoff at runtime:

- **~200ms delay** — For voice agents and real-time applications, stays within 1-2% WER of batch accuracy
- **~480ms delay** — Balanced mode for most streaming applications
- **~2.4s delay** — Matches Voxtral Mini Transcribe V2 batch accuracy, ideal for subtitling

### 3b.3. Word Error Rate (WER) and Accuracy

Voxtral achieves **state-of-the-art accuracy at the lowest price point**:

- **~4% WER** on FLEURS benchmark across supported languages
- Outperforms GPT-4o Mini Transcribe, Gemini 2.5 Flash, AssemblyAI Universal, and Deepgram Nova on accuracy
- Processes audio ~3x faster than ElevenLabs Scribe v2 while matching quality at 1/5 the cost

### 3b.4. Multilingual Capabilities

Voxtral supports **13 languages** natively: English, Chinese, Hindi, Spanish, Arabic, French, Portuguese, Russian, German, Japanese, Korean, Italian, and Dutch.

### 3b.5. Deployment Options

- **Cloud API:** $0.003/min (batch), $0.006/min (realtime)
- **Open weights:** Voxtral Realtime available on [Hugging Face](https://huggingface.co/mistralai/Voxtral-Mini-4B-Realtime-2602) under Apache 2.0
- **Edge deployment:** 4B parameter footprint runs efficiently on edge devices

---

## 3c. Soniox v4 Real-Time: Capabilities and Metrics

### 3c.1. Model Overview and Architecture

Soniox v4 Real-Time is a speech recognition model purpose-built for low-latency voice interactions, released February 2026. Unlike traditional STT systems that trade accuracy for speed, Soniox v4 delivers speaker-native accuracy across 60+ languages simultaneously.

The model is designed for mission-critical voice agents, live captioning, and real-time global communication. It introduces several architectural innovations that differentiate it from competing approaches.

### 3c.2. Latency and Real-Time Performance

Soniox v4 delivers **industry-leading low latency for final transcriptions**, producing high-accuracy final text just milliseconds after speech ends. Key latency features:

- **Token-level streaming:** Results arrive as individual tokens with `is_final` flags, not full-transcript replacements. Non-final tokens appear instantly and refine until stabilized into final tokens.
- **Manual finalization:** Send a `finalize` command over WebSocket to force all pending tokens to finalize immediately with millisecond-latency response. Critical for push-to-talk, client-side VAD, and segment-based pipelines.
- **Audio progress tracking:** Each response includes `audio_final_proc_ms` and `audio_total_proc_ms` for precise progress measurement.

### 3c.3. Semantic Endpointing

Soniox v4 introduces **semantic endpointing** — a significant advance over traditional acoustic VAD:

- **Traditional VAD:** Listens for silence, cuts audio when pause exceeds threshold. Interrupts users reading phone numbers, addresses, or thinking mid-sentence.
- **Semantic endpointing:** The model understands context, rhythm, and intent. Detects real conversational finality rather than just silence.
- **Configurable:** `max_endpoint_delay_ms` controls the maximum wait time after speech ends, allowing tuning between fast turn-taking and patient waiting.

### 3c.4. Word Error Rate (WER) and Accuracy

Soniox v4 reaches **speaker-native accuracy across 60+ languages simultaneously**, with equalized product experience across every supported language. Specific WER benchmarks not yet independently published, but Soniox provides a transparent [open-source comparison framework](https://github.com/soniox/soniox-compare) for head-to-head testing.

### 3c.5. Multilingual Capabilities

- **60+ languages** with a single multilingual model (no per-language model selection)
- **Automatic language detection** and identification per token
- **Code-switching** support for mixed-language conversations
- **Real-time translation** in a single stream across 3,600+ language pairs

### 3c.6. Speaker Diarization

Speaker diarization is available in **real-time streaming mode**, with per-token speaker labels. This is a differentiator — most competitors (Voxtral, ElevenLabs Scribe) offer diarization only in batch mode.

### 3c.7. Domain Adaptation and Context

Soniox supports structured context sent at connection time:

- **General context:** Key-value pairs for domain, topic, speaker names, organization
- **Text context:** Descriptive text to prime the model
- **Terms:** List of domain-specific vocabulary (proper nouns, medications, technical terms)
- **Translation terms:** Source-target pairs for translation consistency

### 3c.8. Deployment Options

- **Cloud API:** WebSocket at `wss://stt-rt.soniox.com/transcribe-websocket`
- **Pricing:** ~$0.12/hour (~$0.002/min) — cheapest cloud streaming option
- **Audio formats:** Auto-detected (aac, flac, mp3, ogg, wav, webm) or raw PCM/μ-law/A-law
- **Session limits:** Up to 5 hours continuous streaming
- **Security:** SOC 2 Type II, HIPAA, GDPR compliant
- **Sovereign Cloud:** In-region processing for data residency requirements

### 3c.9. Open-Source Comparison Framework

Soniox provides an [open-source comparison framework](https://github.com/soniox/soniox-compare) that benchmarks Soniox against OpenAI, Google, Azure, Speechmatics, Deepgram, and AssemblyAI — all using real API calls on the same audio. Available as a live tool at https://soniox.com/compare/.

---

## 4. Sherpa-ONNX (Open-Source): Models, Streaming, and Deployment

### 4.1. Toolkit Overview

Sherpa-ONNX is a leading open-source toolkit for speech-to-text, supporting both streaming and non-streaming ASR, as well as TTS, speaker diarization, and other audio processing tasks. It is built on ONNX Runtime and supports deployment across a wide range of platforms, including Linux, macOS, Windows, Android, iOS, Raspberry Pi, RISC-V, and embedded NPUs.

Sherpa-ONNX is not a cloud API but a self-contained, offline-first solution, making it ideal for privacy-sensitive and edge applications.

### 4.2. Supported Model Architectures

Sherpa-ONNX supports multiple ASR architectures, each optimized for different use cases:

- **Zipformer-Transducer:** High accuracy, streaming support, suitable for production ASR systems.
- **Paraformer:** Fast inference, multilingual, ideal for real-time applications.
- **Whisper:** Robust to noise, multilingual, general transcription.
- **NeMo:** Enterprise-grade, customizable, commercial applications.

Models are available in various quantization formats (FP32, FP16, INT8), enabling deployment on resource-constrained devices.

### 4.3. Latency and Real-Time Performance

Sherpa-ONNX streaming models achieve **real-time factors (RTF) of 0.1–0.3** on typical CPUs, with INT8 quantized models running efficiently on mobile and embedded hardware. On devices like the NVIDIA Jetson or Raspberry Pi, streaming latency is typically 100–200ms, with batch processing achieving much higher throughput.

- **INT8 Models:** Enable real-time streaming on devices with as little as 512MB RAM.
- **Cache-Aware Streaming:** Recent models (e.g., NVIDIA Nemotron Speech ASR) introduce cache-aware architectures for even lower latency and higher concurrency.

### 4.4. Word Error Rate (WER) and Accuracy

Sherpa-ONNX models deliver competitive WERs:

- **Zipformer-Transducer:** ~4–6% WER on English benchmarks, with higher values for low-resource languages.
- **Paraformer:** Slightly higher WER but faster inference, suitable for real-time applications.
- **Whisper:** ~7–8% WER on multilingual benchmarks, with strong robustness to noise.

Benchmarks on datasets such as LibriSpeech, AMI, and GigaSpeech2 confirm that Sherpa-ONNX models are on par with commercial APIs for many use cases.

### 4.5. Multilingual Capabilities

Sherpa-ONNX supports a wide range of languages:

- **Zipformer Models:** Available for Vietnamese, Chinese+English, Russian, Japanese, Korean, Thai, Cantonese, and more.
- **Paraformer Trilingual:** Mandarin, Cantonese, English with dialect support.
- **Whisper Models:** 100+ languages with automatic language detection.
- **Omnilingual ASR Integration:** Support for over 1,600 languages via integration with Omnilingual ASR models.

### 4.6. Speaker Diarization

Sherpa-ONNX includes built-in support for speaker diarization, speaker identification, and speaker verification. Diarization can be performed in both streaming and batch modes, with per-segment speaker labels and integration with VAD and audio tagging modules.

### 4.7. Domain Adaptation and Customization

- **Prompt-Tuning:** Support for prompt-tuning and keyterm prompting for domain adaptation, enabling improved recognition of specialized vocabulary with minimal retraining.
- **Fine-Tuning:** Models can be fine-tuned on domain-specific datasets using pseudo-labels and multi-stage filtering for efficient adaptation.

### 4.8. Deployment Options

Sherpa-ONNX offers unparalleled deployment flexibility:

- **Self-Hosted:** Runs entirely offline, with no network latency or per-request cost.
- **Edge and Embedded:** Supports deployment on Android, iOS, Raspberry Pi, RISC-V, and NPUs.
- **WebAssembly:** Enables browser-based ASR without server infrastructure.
- **APIs:** RESTful and WebSocket servers are available for integration into custom applications.

---

## 5. Other Top Commercial ASR APIs (2026)

### 5.1. AssemblyAI

AssemblyAI is a leading commercial ASR provider, offering both batch and real-time streaming transcription. Its Universal-2 model achieves **~14.5% WER** across 102 languages, with streaming latency in the 300–600ms range.

- **Speaker Diarization:** Available as an add-on, with strong performance in English.
- **Domain Adaptation:** Custom vocabulary via API.
- **Deployment:** Cloud API only, with U.S.-based infrastructure.

### 5.2. Google Speech-to-Text (Chirp)

Google's Chirp models support **125+ languages** and deliver **~11.6% WER** in batch mode, with slightly higher values in streaming. Real-time latency is typically 200–500ms, depending on network conditions and configuration.

- **Speaker Diarization:** Supported in both batch and streaming modes.
- **Domain Adaptation:** Custom classes and phrase hints.
- **Deployment:** Cloud API, with options for on-premises via Google Cloud.

### 5.3. AWS Transcribe

AWS Transcribe offers real-time streaming ASR with **~14% WER** and support for over 100 languages. Latency is typically 200–400ms, with robust integration into AWS services.

- **Speaker Diarization:** Supported as an add-on.
- **Domain Adaptation:** Custom vocabulary and language models.
- **Deployment:** Cloud API, with edge deployment via AWS Greengrass.

### 5.4. Microsoft Azure Speech

Microsoft Azure Speech provides streaming ASR with **~17% WER** and support for 100+ languages. Embedded speech models are available for on-device inference, with real-time factors below 1.0 on supported hardware.

- **Speaker Diarization:** Supported in batch and streaming.
- **Domain Adaptation:** Custom phrase lists and language models.
- **Deployment:** Cloud API, on-device, and hybrid edge-cloud.

### 5.5. Rev.ai, Speechmatics, Gladia

- **Rev.ai:** Focuses on high-accuracy English transcription, with real-time streaming and diarization.
- **Speechmatics:** Offers enhanced and standard models, with strong latency-accuracy trade-offs and configuration knobs for tuning performance.
- **Gladia:** Emphasizes multilingual support (100+ languages), native code-switching, and GDPR-compliant cloud deployment.

---

## 6. Open-Source SOTA ASR Models and Toolkits (2024–2026)

### 6.1. Whisper (OpenAI)

Whisper remains the gold standard for open-source multilingual ASR, supporting **99+ languages** and delivering **~7.4% WER** on mixed benchmarks. The Large V3 and Turbo variants offer a balance of accuracy and speed, with Turbo achieving 6x faster inference at a minor accuracy cost.

- **Deployment:** Open-source, with CTranslate2 and FastWhisper for optimized inference.
- **Streaming:** Not natively streaming, but wrappers and toolkits (e.g., Sherpa-ONNX) enable streaming operation.

### 6.2. Canary Qwen 2.5B (NVIDIA)

Canary Qwen 2.5B leads in English accuracy among open-source models, with **5.63% WER** and high throughput (RTFx 418). The hybrid SALM architecture combines a FastConformer encoder with an LLM decoder, enabling both transcription and intelligent analysis.

- **Deployment:** Requires NVIDIA NeMo toolkit, English-only.
- **Streaming:** Supports chunked inference for long audio.

### 6.3. IBM Granite Speech 3.3 8B

IBM's Granite Speech 3.3 8B is an enterprise-grade model with **5.85% WER** and support for English, French, German, and Spanish. It is optimized for translation and robust to noise.

- **Deployment:** Open-source, requires high-end GPU.
- **Streaming:** Not natively streaming, but can be adapted.

### 6.4. Parakeet TDT (NVIDIA)

Parakeet TDT models prioritize ultra-low latency, with RTFx >2,000 and WER ~8%. The RNN-Transducer architecture enables streaming recognition with minimal delay, making it ideal for live captioning and phone systems.

### 6.5. Omnilingual ASR (Meta/Facebook)

Omnilingual ASR is a groundbreaking open-source system supporting **1,600+ languages**, including 500 never before covered by ASR. It achieves **CER <10** for 78% of languages and supports zero-shot language addition with minimal data.

- **Deployment:** Open-source, with models ranging from 300M to 7B parameters.
- **Streaming:** LLM-based models support streaming with near real-time performance.

### 6.6. Moonshine v2 Streaming (Moonshine AI / UsefulSensors)

Moonshine v2 is a family of streaming ASR models from Moonshine AI (formerly UsefulSensors, founded by Pete Warden ex-Google TensorFlow). The models are purpose-built for real-time voice interfaces on edge devices, with a novel architecture that enables genuine streaming with very low latency on CPU hardware.

**Architecture:**

Moonshine v2 uses an **encoder-decoder Transformer** (like Whisper in broad strokes) but with critical architectural changes:

- **Encoder:** Sliding-window self-attention with bounded lookahead (80ms). The encoder is **ergodic** (no positional embeddings), making it translation-invariant in time. Window config uses `(16, 4)` for boundary layers (16 frames left context, 4 frames right = 80ms lookahead) and `(16, 0)` for intermediate layers (strictly causal). This makes encoder cost **linear O(Tw)** instead of Whisper's quadratic O(T^2).
- **Decoder:** Standard causal Transformer with RoPE and SwiGLU FFN. Still autoregressive (generates tokens sequentially). The paper acknowledges CTC/RNN-T decoders as future work.
- **Audio frontend:** 50Hz feature rate, non-overlapping 80-sample windows, CMVN normalization, asinh nonlinearity, two causal stride-2 convolutions. Processes raw 16kHz waveform (no Mel spectrogram).
- **Adapter:** Bridges encoder to decoder by adding learned positional embeddings to the position-free encoder outputs.

**Streaming mechanism:**

The encoder processes audio **incrementally as it arrives**, caching previous computations. When new audio frames arrive, only the new frames are processed — previously computed states are reused. The encoder emits _provisional_ representations immediately; as more audio provides right context, provisional states are replaced with finalized ones. This is **genuinely streaming at the encoder level** — not chunked batch. However, the decoder still runs as a batch pass at each update/endpoint.

**Latency (measured on Apple MacBook M3 CPU):**

| Model                      | Response Latency | Compute Load |
| -------------------------- | ---------------- | ------------ |
| Moonshine v2 Tiny (34M)    | 50ms             | 8.0%         |
| Moonshine v2 Small (123M)  | 148ms            | 18.0%        |
| Moonshine v2 Medium (245M) | 258ms            | 29.0%        |

Response latency = time from end-of-speech detection (VAD) to transcript delivery. Compare: Whisper Large v3 (1.5B) takes 11,286ms on the same hardware.

**Accuracy (HuggingFace Open ASR Leaderboard):**

| Model               | Params | Avg WER |
| ------------------- | ------ | ------- |
| Moonshine v2 Medium | 245M   | 6.65%   |
| Moonshine v2 Small  | 123M   | 7.84%   |
| Moonshine v2 Tiny   | 34M    | 12.00%  |

Moonshine v2 Medium **beats Whisper Large v3 (7.44% WER)** with 6x fewer parameters.

**Key features:**

- **Built-in VAD:** Integrated voice activity detection for segmenting speech.
- **Built-in diarization:** Speaker identification included in the library. `LineCompleted` events include `speaker_id`.
- **Built-in intent recognition:** Semantic fuzzy matching using Gemma 300M sentence embeddings. Register action phrases, get callbacks on matches with confidence scores.
- **Event-based API:** `LineStarted` / `LineTextChanged` / `LineCompleted` events with `TranscriptLine` data (text, `start_time`, `duration`, `speaker_id`).
- **Monotonic interims:** No — interim text **may be revised** as more audio context arrives. `LineTextChanged` events can update previously emitted text. Only `LineCompleted` text is final and guaranteed stable.

**Language support:**

| Language   | Model Variants              | WER/CER     |
| ---------- | --------------------------- | ----------- |
| English    | Tiny/Small/Medium Streaming | 6.65-12.00% |
| Arabic     | Base (non-streaming)        | 5.63%       |
| Japanese   | Base (non-streaming)        | 13.62%      |
| Korean     | Tiny (non-streaming)        | 6.46%       |
| Mandarin   | Base (non-streaming)        | 25.76%      |
| Spanish    | Base (non-streaming)        | 4.33%       |
| Ukrainian  | Base (non-streaming)        | 14.55%      |
| Vietnamese | Base (non-streaming)        | 8.82%       |

Note: Only English currently has streaming (v2) model variants.

**Deployment:**

- **Cross-platform C++ core** using ONNX Runtime, with native bindings for Python (pip: `moonshine-voice`), iOS/macOS (Swift Package Manager), Android (Maven), Windows (C++), Linux, Raspberry Pi.
- **Models on HuggingFace:** [UsefulSensors/moonshine-streaming](https://huggingface.co/UsefulSensors/moonshine-streaming) — ONNX models for Tiny/Small/Medium.
- **No WebSocket server mode** — designed for native integration, not client-server. Browser deployment would require a WebSocket bridge or future WASM build.
- **License:** MIT.

**Limitations:**

1. Decoder is still autoregressive — not fully streaming end-to-end (no CTC/RNN-T).
2. Non-English streaming models not yet available.
3. No word-level timestamps documented (only segment-level `start_time` + `duration`).
4. Mandarin accuracy is weak (25.76% CER).
5. Not optimized for GPU batch throughput — designed for single-stream, on-device use.
6. No WebSocket server or WASM build — needs a bridge for browser-based applications.

**References:**

- [Moonshine v2 paper (arXiv:2602.12241)](https://arxiv.org/abs/2602.12241)
- [Moonshine v1 paper (arXiv:2410.15608)](https://arxiv.org/abs/2410.15608)
- [Flavors of Moonshine paper (arXiv:2509.02523)](https://arxiv.org/abs/2509.02523)
- [GitHub: moonshine-ai/moonshine](https://github.com/moonshine-ai/moonshine)

### 6.7. Wav2Vec 2.0 and Others

- **Wav2Vec 2.0:** Pioneered self-supervised learning for ASR, strong for low-resource languages.
- **Kaldi, ESPnet, SpeechBrain:** Remain popular for research and custom deployments, with support for streaming and batch ASR.

---

## 7. Benchmarks and Leaderboards

### 7.1. Open ASR Leaderboard

The Hugging Face Open ASR Leaderboard provides a transparent, reproducible benchmark for over 60 open-source and proprietary ASR systems, reporting average WER and RTFx across multiple datasets and languages.

- **Top Performers:** Canary Qwen 2.5B, IBM Granite Speech 3.3 8B, Whisper Large V3, Parakeet TDT.
- **Metrics:** WER, RTFx, language coverage, and license.

### 7.2. MLPerf Inference Benchmark

MLCommons introduced Whisper-Large-V3 as the new standard for ASR benchmarking, replacing RNN-T. The benchmark uses the LibriSpeech dataset and standardized text normalization, with Whisper achieving a word accuracy of 97.9%.

### 7.3. Commercial API Benchmarks

Independent analyses (e.g., Artificial Analysis, Softcery) compare commercial APIs on WER, speed, and price. Deepgram Nova-3, AssemblyAI Universal-2, and ElevenLabs Scribe v2 are consistently among the top performers, with WERs in the 14–18% range and sub-300ms latency.

---

## 8. Latency Measurement Methods and Metrics

### 8.1. Real-Time Factor (RTF/RTFx)

RTF is defined as the ratio of processing time to audio duration. An RTF of 1.0 means the system processes audio in real time; higher values indicate faster-than-real-time processing. RTFx is the inverse, representing how many seconds of audio can be processed per second of compute time.

- **Streaming ASR:** RTF < 1.0 is required for real-time operation.
- **Batch ASR:** RTFx values of 100–500 are common on modern GPUs.

### 8.2. End-to-End Latency

End-to-end latency measures the time from speech input to transcript output, including audio capture, buffering, model inference, post-processing, and network transit. Sub-300ms is considered SOTA for real-time applications.

- **First Token Latency:** Time to first partial transcript, critical for conversational agents.
- **Time-to-Final:** Time to final transcript, important for turn-taking and interruption handling.

### 8.3. Latency-Accuracy Trade-Offs

Reducing latency often comes at the cost of accuracy, as models have less context to disambiguate words. Chunked attention and configurable context windows allow developers to tune this trade-off for specific use cases.

---

## 9. Multilingual Capabilities and Language Coverage

### 9.1. Commercial APIs

- **Deepgram Nova-3:** 36+ languages, strong in European and Asian languages, limited code-switching.
- **ElevenLabs Scribe v2:** 90+ languages, automatic detection, seamless code-switching.
- **AssemblyAI:** 102 languages (batch), 6 in real-time.
- **Google, AWS, Microsoft:** 100+ languages, with varying degrees of code-switching and dialect support.

### 9.2. Open-Source Models

- **Whisper:** 99+ languages, robust zero-shot capability.
- **Omnilingual ASR:** 1,600+ languages, including 500 never before supported.
- **Sherpa-ONNX:** Multilingual models for major Asian and European languages, integration with Omnilingual ASR for broader coverage.

---

## 10. Speaker Diarization and Speaker-Attributed ASR

### 10.1. Commercial APIs

- **Deepgram Nova-3:** Add-on feature, per-word speaker labels, strong in English, limited in other languages.
- **ElevenLabs Scribe v2:** Supports up to 48 speakers in batch, real-time diarization available.
- **AssemblyAI, Google, AWS, Microsoft:** Diarization available as add-on, with varying accuracy.

### 10.2. Open-Source Solutions

- **Sherpa-ONNX:** Built-in diarization, speaker identification, and verification.
- **TargetDiarization:** Open-source project for multi-speaker separation, identification, and diarization, supporting both streaming and batch modes.
- **SpeakerLM:** End-to-end multimodal LLM for joint ASR and diarization, achieving competitive DER on DIHARD III and other benchmarks.

### 10.3. Evaluation Metrics

- **Diarization Error Rate (DER):** Measures the accuracy of speaker attribution.
- **Speaker-Attributed WER (saWER):** WER calculated per speaker, reflecting the combined performance of ASR and diarization.

---

## 11. Domain Adaptation, Customization, and Keyterm Prompting

### 11.1. Keyterm Prompting

- **Deepgram Nova-3:** Supports up to 500 tokens for keyterm prompting, enabling instant adaptation to domain-specific vocabulary.
- **ElevenLabs Scribe v2:** Batch version supports up to 100 technical terms.
- **Sherpa-ONNX:** Supports prompt-tuning and keyterm prompting for domain adaptation.

### 11.2. Fine-Tuning and Pseudo-Labeling

- **Sherpa-ONNX, Whisper, Zipformer:** Support fine-tuning on domain-specific datasets using pseudo-labels and multi-stage filtering for efficient adaptation.
- **Prompt-Tuning:** Enables efficient domain adaptation with minimal parameter updates, reducing the need for full model retraining.

---

## 12. Deployment Options: Cloud APIs, Edge, On-Device, Open-Source Self-Hosting

### 12.1. Cloud APIs

- **Deepgram, ElevenLabs, AssemblyAI, Google, AWS, Microsoft, Rev.ai, Speechmatics, Gladia:** All offer cloud-based APIs for real-time and batch transcription, with varying support for privacy, compliance, and data residency.

### 12.2. Edge and On-Device

- **Sherpa-ONNX:** Runs fully offline on a wide range of devices, including mobile, embedded, and microcontrollers.
- **Whisper, Moonshine, Wav2Vec 2.0:** Can be deployed on edge devices with sufficient resources.
- **Microsoft Azure Embedded Speech:** Provides on-device models with RTF < 1.0 on supported hardware.

### 12.3. Open-Source Self-Hosting

- **Sherpa-ONNX, Whisper, Omnilingual ASR, Parakeet, Granite, Canary:** All available for self-hosted deployment, enabling full control over data and customization.

### 12.4. Hybrid Edge-Cloud

- **Adaptive Orchestration:** Systems like ASTA dynamically route inference between edge and cloud based on latency, CPU load, and network conditions, balancing performance and resource utilization.

---

## 13. Latency-Accuracy Trade-Offs and Configuration Knobs

### 13.1. Chunked Attention and Context Windows

- **Configurable Chunk Size:** Smaller chunks reduce latency but increase WER; larger chunks improve accuracy at the cost of delay.
- **Dynamic Latency Modes:** Models like Nemotron Speech ASR allow runtime selection of latency-accuracy trade-offs without retraining.

### 13.2. Streaming vs. Batch

- **Streaming:** Prioritizes low latency for live applications, with partial transcripts and rapid updates.
- **Batch:** Maximizes throughput and accuracy for offline transcription, with full context available.

---

## 14. Evaluation Datasets and Test Conditions

### 14.1. Standard Benchmarks

- **LibriSpeech:** Clean and noisy speech, standard for English ASR.
- **AMI, VoxPopuli, Earnings-22:** Real-world meeting, conversational, and financial audio.
- **GigaSpeech2:** Large-scale, multi-domain ASR corpus for low-resource languages.

### 14.2. Multilingual and Domain-Specific Corpora

- **Omnilingual ASR Corpus:** Community-contributed speech across 1,600+ languages.
- **Custom Datasets:** Used for evaluating domain adaptation and keyterm prompting.

---

## 15. Comparison Table: Top Real-Time Streaming ASR Models and APIs (Early 2026)

| Model/API               | Type        | Latency (ms) | WER (%) | Languages | Diarization | Monotonic^4^ | Domain Adaptation | Deployment Options       | Open Source | Price/min |
| ----------------------- | ----------- | ------------ | ------- | --------- | ----------- | ------------ | ----------------- | ------------------------ | ----------- | --------- |
| **Soniox v4 RT**        | Commercial  | <100         | TBD\*\* | 60+       | Yes (RT)    | No           | Context, Terms    | Cloud, Sovereign         | No          | $0.002    |
| **Voxtral Realtime**    | Commercial  | <200         | ~4      | 13        | No\*\*\*    | ?            | Context (Batch)   | Cloud, Edge, Self-host   | **Yes**     | $0.006    |
| Voxtral Mini V2 (batch) | Commercial  | N/A          | ~4      | 13        | Yes         | N/A (batch)  | Context biasing   | Cloud, Edge, Self-host   | No          | $0.003    |
| Deepgram Nova-3         | Commercial  | <300         | ~6.8    | 36+       | Add-on      | No           | Keyterm, Custom   | Cloud, On-prem, Edge     | No          | ~$0.0045  |
| ElevenLabs Scribe v2 RT | Commercial  | <150         | ~6.5    | 90+       | Optional    | ?            | Keyterm (Batch)   | Cloud API, Agents        | No          | ~$0.015   |
| Sherpa-ONNX (Zipformer) | Open-source | 100–300      | ~4–6    | 10+       | Yes         | **Yes**      | Prompt-tuning     | Self-hosted, Edge, WASM  | Yes         | Free      |
| Sherpa-ONNX (Nemotron)  | Open-source | 100–300      | ~4–6    | English   | No          | **Yes**      | Prompt-tuning     | Self-hosted, Edge        | Yes         | Free      |
| **Moonshine v2**        | Open-source | 50–258       | 6.65–12 | 8^5^      | **Yes**     | No           | Intent recog.     | Native, Edge, Mobile     | Yes         | Free      |
| AssemblyAI Universal-2  | Commercial  | 300–600      | ~14.5   | 102       | Add-on      | ?            | Custom vocab      | Cloud API                | No          | ~$0.006   |
| Google Chirp            | Commercial  | 200–500      | ~11.6   | 125+      | Yes         | ?            | Phrase hints      | Cloud, On-prem           | No          | ~$0.006   |
| AWS Transcribe          | Commercial  | 200–400      | ~14     | 100+      | Add-on      | ?            | Custom vocab      | Cloud, Edge (Greengrass) | No          | ~$0.024   |
| Microsoft Azure Speech  | Commercial  | 200–500      | ~17     | 100+      | Yes         | ?            | Phrase lists      | Cloud, On-device, Hybrid | No          | ~$0.016   |
| Whisper Large V3        | Open-source | 200–500      | ~7.4    | 99+       | No\*        | N/A^6^       | Fine-tuning       | Self-hosted, Edge        | Yes         | Free      |
| Canary Qwen 2.5B        | Open-source | 100–300      | ~5.6    | English   | No          | N/A^6^       | LLM decoder       | Self-hosted              | Yes         | Free      |
| Omnilingual ASR         | Open-source | ~1000        | <10 CER | 1,600+    | No          | ?            | Zero-shot         | Self-hosted              | Yes         | Free      |
| Parakeet TDT            | Open-source | <100         | ~8      | English   | No          | **Yes**      | Fast streaming    | Self-hosted, Edge        | Yes         | Free      |
| Web Speech API          | Browser     | 300–500      | varies  | many      | No          | No           | None              | Browser built-in         | N/A         | Free      |

\*Whisper does not natively support diarization, but can be combined with external diarization toolkits.
\*\*Soniox v4 WER benchmarks not yet independently published; open-source comparison framework available at https://github.com/soniox/soniox-compare.
\*\*\*Voxtral Realtime diarization not available; use batch mode (Voxtral Mini V2) for speaker identification.
^4^**Monotonic** = interim results are append-only (earlier tokens are never revised). "No" means interims may be revised as more audio context arrives. "?" means not confirmed.
^5^Moonshine v2 streaming models are English-only; 7 additional languages have non-streaming (v1) models.
^6^N/A — no native streaming mode; these models process complete audio segments.

---

## 16. Analysis of Comparison Table

The comparison table above highlights the diversity and strengths of leading real-time streaming ASR solutions as of early 2026.

**Soniox v4 Real-Time** (February 2026) introduces several architectural innovations that set it apart: **semantic endpointing** that understands thought completion rather than just detecting silence, **token-level `is_final` streaming** that sends individual tokens with finality flags rather than full-transcript replacements, and **manual finalization** that returns high-accuracy finals in milliseconds. At ~$0.002/min it is also the cheapest cloud streaming option. Its 60+ language support with real-time diarization and translation makes it a strong all-around choice. The open-source comparison framework (https://github.com/soniox/soniox-compare) provides transparent benchmarking against competitors.

**Voxtral Realtime** (Mistral) represents a significant shift—combining state-of-the-art accuracy (~4% WER) with competitive pricing ($0.006/min) and **open weights under Apache 2.0**, creating a compelling path from cloud API to self-hosted deployment. The configurable latency-accuracy tradeoff (sub-200ms to 2.4s) provides flexibility for different use cases. Main limitations are fewer languages (13) and no realtime diarization.

**Deepgram Nova-3** and **ElevenLabs Scribe v2 Realtime** remain strong alternatives. Deepgram offers broader language support (36+) at competitive pricing, while ElevenLabs leads in language coverage (90+), automatic code-switching, and predictive transcription—critical features for global and multi-speaker applications.

**Sherpa-ONNX** stands out among open-source toolkits for its flexibility, competitive accuracy, and support for streaming, diarization, and prompt-tuning. Its deployment options span self-hosted servers, edge devices, and browser-based WASM, making it ideal for privacy-sensitive and offline applications. The lightweight models (~200-500MB) are far more resource-efficient than Voxtral's 4B parameters (~8-16GB).

**AssemblyAI**, **Google Chirp**, **AWS Transcribe**, and **Microsoft Azure Speech** provide strong alternatives for enterprises seeking managed cloud APIs with broad language coverage and integrated features. Their WERs range from 11–17%, with latency typically in the 200–600ms range.

Among open-source models, **Whisper Large V3** remains the gold standard for multilingual ASR, while **Canary Qwen 2.5B** and **IBM Granite Speech 3.3 8B** lead in English accuracy. **Omnilingual ASR** breaks new ground with support for over 1,600 languages, though with higher latency and hardware requirements.

**Moonshine v2** (Moonshine AI) is a standout for edge deployment: its Medium model (245M params) beats Whisper Large v3 (1.5B params) on the Open ASR Leaderboard at 6.65% WER, while achieving 258ms response latency on a MacBook M3 CPU — 43x faster than Whisper Large. The sliding-window streaming encoder with caching is genuinely streaming (not chunked batch), though the autoregressive decoder means final token generation still happens at endpoint. Uniquely among open-source models, Moonshine includes **built-in diarization, VAD, and intent recognition** in a single cross-platform C++ library. The main limitations are English-only streaming, no WebSocket server mode (needs a bridge for browser apps), no word-level timestamps, and non-monotonic interims (text may be revised before finalization).

**Parakeet TDT** and **Nemotron Speech ASR** exemplify the latest advances in ultra-low latency streaming, leveraging cache-aware architectures and efficient downsampling to deliver sub-100ms responsiveness at scale.

---

## 17. Future Directions and Open Challenges

Despite remarkable progress, several challenges and opportunities remain in real-time streaming ASR:

- **Scaling Multilingual Coverage:** Expanding high-accuracy support to low-resource and endangered languages, as pioneered by Omnilingual ASR, remains a priority for digital inclusion.
- **Joint ASR and Diarization:** End-to-end models that unify ASR and speaker diarization (e.g., SpeakerLM, unified Conformer frameworks) promise improved accuracy and robustness in multi-speaker scenarios.
- **Edge and Privacy:** As privacy regulations tighten and latency demands grow, edge deployment and hybrid edge-cloud orchestration will become increasingly important.
- **Domain Adaptation:** Efficient prompt-tuning, keyterm prompting, and few-shot adaptation are critical for handling specialized vocabulary and emerging domains.
- **Latency-Accuracy Optimization:** Dynamic, runtime-configurable trade-offs and cache-aware streaming architectures will enable more responsive and scalable voice agents.
- **Evaluation and Transparency:** Continued development of open benchmarks and leaderboards is essential for reproducible, transparent evaluation across languages, domains, and deployment scenarios.

---

## Conclusion

As of early 2026, real-time streaming ASR has reached a level of maturity and sophistication that enables seamless, natural voice interactions across a wide range of applications and languages. **Soniox v4 Real-Time** pushes the frontier with semantic endpointing and token-level streaming at the lowest price point, while **Voxtral Realtime** offers the best accuracy with an open-weights self-hosting path. **Deepgram Nova-3** and **ElevenLabs Scribe v2 Realtime** remain strong for broader language coverage and established ecosystems. **Moonshine v2** sets a new bar for edge ASR with built-in diarization, intent recognition, and Whisper-beating accuracy in a 245M-parameter package. **Sherpa-ONNX**, Whisper, and Omnilingual ASR exemplify the power and flexibility of open-source solutions. The field continues to evolve rapidly, with ongoing innovations in multilingual modeling, edge deployment, joint ASR-diarization frameworks, and domain adaptation.

For developers, enterprises, and researchers, the choice of ASR solution depends on specific requirements for latency, accuracy, language coverage, privacy, and deployment flexibility. The current SOTA offers a rich ecosystem of models and APIs, each with distinct strengths and trade-offs. By leveraging the latest advances and benchmarking tools, stakeholders can build voice-enabled systems that are accurate, responsive, and inclusive—pushing the boundaries of what is possible in human-computer interaction.

---
