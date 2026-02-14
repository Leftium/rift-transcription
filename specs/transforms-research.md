# Transforms: Competitive Analysis & Gap Assessment

Research supporting the [transforms spec](./transforms.md). Based on a review of 561 GitHub issues and PRs across two open-source speech-to-text projects.

## Sources

| Project    | Repository                                                        | What it is                                                                                                                                                     |
| ---------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Whispering | [EpicenterHQ/epicenter](https://github.com/EpicenterHQ/epicenter) | Cross-platform STT app (Tauri + web), supports OpenAI/Groq/Deepgram/local Whisper, has a transformation system with find-replace steps and LLM-powered prompts |
| Handy      | [cjpais/Handy](https://github.com/cjpais/Handy)                   | Desktop STT app (Tauri), local-first with ONNX models, has custom word correction and LLM post-processing                                                      |

### Scope

- Whispering: 100 open issues, 100 closed issues, 100 PRs (all states)
- Handy: 61 open issues, 100 closed issues, 100 PRs (all states)
- Date: February 2026

---

## What the Spec Already Covers

These user demands from both projects map cleanly to existing spec features:

| User demand                    | Evidence                            | Spec feature                                      |
| ------------------------------ | ----------------------------------- | ------------------------------------------------- |
| Multiple transforms at once    | Whispering #1208, #1205             | Pipeline model (scripts in sequence)              |
| Spoken punctuation → symbols   | Whispering #1253, #1205; Handy #199 | Appendix presets + literal rules                  |
| Filler word removal            | Whispering #1208; Handy PR #589     | `#Filler` tag + literal rules                     |
| Custom vocabulary/dictionary   | Whispering #904; Handy #669, #602   | Literal string rules (GUI-editable)               |
| Regex transforms               | Whispering #962                     | `regexp` option on rules                          |
| Informal contractions          | Whispering #828                     | Informal → Formal preset                          |
| Dynamic values (date/time)     | Appendix preset                     | Function rules                                    |
| LLM-powered transforms         | Whispering #821, #692; Handy #325   | Async `transform()` with `mode: 'prompt'`         |
| Per-script on/off toggles      | Whispering #1249                    | Profile system + `enabledScripts`                 |
| Hotkey-triggered transforms    | Whispering #1279, #835; Handy #334  | `TransformTrigger` with `mode: 'hotkey'`          |
| Speaker diarization labels     | Whispering #1083                    | Provider tags (`#Speaker0`, `#Speaker1`)          |
| Profiles for context switching | Whispering #1249; Handy #334        | `TransformProfile` interface                      |
| Vibe-coded custom scripts      | Whispering #1269, #988              | Single-file `.transform.ts` format                |
| Case conversion                | Handy #686                          | `transform()` function example                    |
| Slash commands                 | —                                   | `/formal`, `/translate spanish`, freeform prompts |

The pipeline model is the single biggest differentiator — Whispering's #1 pain point (#1208, #1205: "allow running multiple transformations at once") is solved by design.

---

## Gaps

### Gap 1: Multi-word / N-gram Vocabulary Matching

**Priority: HIGH**

**Evidence:**

- Handy PR #711 (merged): Implements n-gram matching for multi-word custom word correction. Fixes compound words like "ChatGPT" that STT splits to "Chat G P T", and "ChargeBee" split to "Charge Bee."
- Whispering #904: Personal dictionary for proper noun spelling/capitalization ("Bobby" vs "Bobbie", "Svelte" vs "Zvelte").

**The problem:** STT engines tokenize audio into words independently. Compound proper nouns get split at syllable/word boundaries:

| User says     | STT outputs                | Should be   |
| ------------- | -------------------------- | ----------- |
| "ChargeBee"   | "Charge B" or "Charge Bee" | ChargeBee   |
| "ChatGPT"     | "Chat G P T"               | ChatGPT     |
| "MacBook Pro" | "Mac Book Pro"             | MacBook Pro |
| "HTML"        | "H T M L"                  | HTML        |

No single input token matches the custom word. "Charge" doesn't match "ChargeBee". A naive word-by-word matcher can't fix these — you need to consider consecutive tokens together.

This also affects: acronyms spoken as letters ("A P I" → "API"), spelled-out words ("S T E V E" → "Steve"), and multi-word proper nouns with inconsistent capitalization.

**Current spec:** Literal string matching says multi-word keys "match across token boundaries" but that's phrase matching ("question mark" matches two consecutive words). The n-gram problem is the reverse: the _custom word_ is a single token ("ChargeBee") but the _input_ has been split by the STT provider.

**Handy's approach (PR #711):** Sliding window over 1–3 consecutive words, greedy longest-match-first:

1. Pre-compute each custom word with spaces removed and lowercased ("ChargeBee" → "chargebee")
2. Walk through input tokens. At each position, try 3-word window first, then 2, then 1
3. For each window, concatenate the tokens (strip punctuation, lowercase): `["Charge", "B"]` → `"chargeb"`
4. Fuzzy-match that concatenation against the custom words using Levenshtein distance + Soundex phonetic matching
5. If match found, replace the entire window with the custom word, preserving case and punctuation

**Limitation:** The fixed 3-token window is too small for some cases ("Chat G P T" is 4 tokens, "H T M L" is 4). The PR's test passes for "Chat G P T" only because the fuzzy matching threshold is loose enough that a 3-token partial concatenation gets close. This is fragile — a 5-token split would fail. The max window size should be derived from the vocabulary itself (e.g., longest word's character count as a ceiling), not hardcoded.

**Resolution:** ~~Originally classified as a `transform()` preset.~~ **Promoted to pipeline primitive.** Further research revealed that Handy's custom words are a flat list of preferred spellings — not replacement pairs. This is a fundamentally different data model from `rules` (which are match → replace). Users don't know what their STT will produce, so they can't write replacement pairs. They just know the correct spelling.

The `words` export is now the third pipeline primitive alongside `rules` and `transform()`. See the Preferred Words section in the spec. Key design decisions:

- **Data model:** `Record<string, MatchLevel | WordOptions>` — key is the preferred spelling, value configures matching (like `rules` where key is the match pattern, value is the replacement)
- **Pipeline position:** After `rules`, before `transform()` — increasing fuzziness order
- **Per-word config:** Match level, window size, threshold, case sensitivity — all with sensible defaults derived from the word itself
- **GUI:** Single-column word list with expandable per-word settings (simpler than `rules`' two-column table)

---

### Gap 2: Hallucination / Artifact Cleanup

**Priority: HIGH**

**Evidence:**

- Handy #448: Repeated words — "we we we we we we we we" when only said once.
- Handy #649: "two two" produces "Two two two two two two two two two two two."
- Handy #402: Chinese transcription appends phantom phrases ("thank you everyone, bye bye, please take care") never spoken.
- Handy #500: Invisible zero-width space characters (U+200B) inserted in output.
- Handy PR #589 (merged): Regex removal of `[AUDIO]`, `(pause)`, `<tag>...</tag>` artifacts from transcription.

**Current spec:** No mention of common STT artifacts. Filler removal covers "um/uh" but not model hallucinations or encoding artifacts.

**Gap:** STT models produce a class of artifacts that are universal across providers: repeated words, hallucinated phrases (especially at end of audio), invisible Unicode characters, and bracketed metadata. These are distinct from filler words and need their own cleanup rules.

**Recommendation:** Add a "Transcription Cleanup" preset to the appendix covering:

- Repeated-word deduplication: `\b(\w+)(\s+\1){2,}\b` → `$1`
- Invisible character stripping: zero-width spaces, BOM, etc.
- Bracketed artifact removal: `[AUDIO]`, `(pause)`, `<inaudible>`, etc.
- Trailing hallucination patterns (language-specific, may need LLM assist)

---

### Gap 3: External Command Filter

**Priority: LOW** (downgraded — see resolution)

**Evidence:**

- Whispering #1269: "Transformation that runs a user-defined script" — pass transcription to shell script, optionally place output on clipboard. Use case: machine control via voice.
- Handy PR #739 (open): General stdin/stdout command filter for post-processing. User pipes text through any external program.
- Handy PR #638 (open): "External script" paste method — pass text to user-defined script before pasting, enabling context-aware processing.

**Current spec:** Sandboxing section restricts scripts to Web Workers — no DOM, no network, no filesystem. No escape hatch for desktop users who want to invoke external processes.

**Context:** Both Whispering and Handy have limited transformation systems (find-replace steps, LLM prompts). Users in those ecosystems reach for external scripts because the built-in transform capabilities aren't expressive enough. When your only tool is a find-replace box, shelling out to Python is the natural escape hatch.

**Resolution:** RIFT transforms are already scripts — full TypeScript/Civet modules with `transform()` functions that can implement arbitrary logic. The use cases driving external command requests (context-aware formatting, custom text processing, chaining multiple operations) are directly expressible as `.transform.ts` files without leaving the sandbox. The vibe-coding workflow (describe a transform to an LLM, get a working script) further reduces the need.

The remaining legitimate use case for external commands is **side effects** — machine control via voice, triggering OS automation, writing to files. That's delivery/action, not text transformation, and is out of scope for the transforms spec.

Note in the spec's Sandboxing section that the script format's expressiveness is a deliberate alternative to external command piping. If a real need for external process invocation emerges after launch, it can be added as a permission-gated capability without changing the script format.

---

### Gap 4: Transform Context

**Priority: HIGH** (architectural — changes the function signature contract)

**Evidence:**

- Whispering #1151: "Local file context for transformations" — access to the document being dictated into, proposes `{{context}}` template variable.
- Handy PR #704 (open): Adds `$time_local`, `$current_app`, `$short_prev_transcript`, `$language` variables for LLM post-processing prompts.
- Handy #499 (closed/fixed): Bug where `${output}` placeholder wasn't substituted in LLM prompt.
- Gap 9 (language-aware selection) collapses into this: if transforms have access to transcript metadata including detected language, then language filtering is just a runner feature that reads `meta.language` and compares against `context.language`.

**Current spec:** `config` is passed as a second argument to rule functions but only contains user settings. The runner already has transcript metadata (for provider tags like `#Speaker0`, `#LowConfidence`) but doesn't expose it to `transform()` or rule functions.

**Gap:** Both projects independently invented template variable systems because transforms need runtime state beyond user settings. The spec's `config` argument needs to expand.

**Candidate fields:**

| Field           | Source                | Use case                                                    |
| --------------- | --------------------- | ----------------------------------------------------------- |
| `language`      | Transcript metadata   | Filter rules by language, format numbers/dates by locale    |
| `currentApp`    | OS (desktop only)     | Adapt formality for Slack vs email vs code editor           |
| `previousText`  | Transcription history | Continuity — don't re-capitalize if continuing mid-sentence |
| `selectedText`  | TranscriptArea        | Manual transforms operate on selection                      |
| `clipboardText` | OS                    | Transform arbitrary clipboard text (Whispering #835)        |
| `timestamp`     | Runtime               | Dynamic values (date/time rules already need this)          |

**Risks:**

1. **Non-determinism.** A rule that reads `currentApp` or `timestamp` produces different output for the same input text. Makes testing harder, makes GUI preview less reliable (preview doesn't know what app you'll paste into). The existing dynamic value rules (`"today's date": () => new Date()`) already have this problem — expanding the surface area increases it.

2. **Privacy / sandboxing tension.** Scripts run in a Web Worker sandbox. Exposing `currentApp`, `clipboardText`, or `previousText` means the sandbox has access to state outside the transcription. A malicious community preset could read clipboard contents. The spec already says "no network by default" so the data can't leave the worker without explicit permission — but it's still a wider attack surface than pure text-in/text-out.

3. **Platform divergence.** `currentApp` only exists on desktop (Tauri). `clipboardText` may require permissions on some platforms. Scripts that depend on context fields unavailable everywhere become non-portable. A script written for desktop that reads `currentApp` silently gets `undefined` on web.

4. **API stability.** Once scripts depend on context fields, the shape becomes a contract. Adding fields is fine; renaming or removing them breaks community scripts.

**Mitigations:**

- Context fields are **opt-in per script** via a capabilities declaration in `meta` (similar to how the spec already handles network access). The runner only populates fields the script declares it needs.
- Fields that aren't available return `undefined`, not errors — scripts must handle absence.
- GUI preview passes a synthetic context (current time, no app, no clipboard) so previews remain useful.

**Resolution:** The spec's `config` argument should expand to include runtime context alongside user settings. Defer the exact `TransformContext` interface shape — note that it will include transcript metadata and runtime state, list the candidate fields and risks, and let implementation drive the final API. The key architectural decision is: scripts can access context, gated by declared capabilities.

---

### Gap 5: Config Portability / Import-Export

**Priority: MEDIUM-HIGH**

**Evidence:**

- Whispering #968: "How to sync transformation configurations between machines?" — wants export/import via dotfiles or version control.
- Whispering #1186: "Ability to export / import full config setup" — transformations, shortcuts, transcription prompts.
- Handy #602: User lost all custom words (weeks of vocabulary) after an app update.

**Current spec:** Storage section (line 469) says "localStorage" and "import/export as `.transform.ts` files" but doesn't address: bulk export, pipeline ordering, profile configs, or migration safety.

**Gap:** Users build up significant configuration state over time (custom vocabulary, pipeline ordering, per-rule toggles across profiles). Losing this is painful. Syncing across machines is a common need.

**Recommendation:** Specify a bundle export format:

```
transforms-export/
├── pipeline.json          # script ordering, enabled state, profiles
├── english-punctuation.transform.ts
├── filler-removal.transform.ts
├── my-custom-vocab.transform.ts
└── ...
```

The `pipeline.json` includes a schema version for migration safety. Import merges or replaces (user choice). Could also be a single `.zip`. The key point: the spec should define this format, not leave it to implementation.

---

### Gap 6: Number Normalization Preset

**Priority: MEDIUM**

**Evidence:**

- Handy #611: "Convert spoken numbers to numeric digits" — optional, so "five" → `5`.
- Whispering #1205: Mentions number conversion alongside punctuation as a basic need.
- Handy PR #704: LLM prompt example includes "Convert numbers expressed in words to digits."

**Current spec:** `#Value` with `action: 'toNumber'` exists in the Match Patterns section (line 107) but there's no appendix preset. The feature is buried in an example, not surfaced as a usable preset.

**Gap:** Number normalization is a top-5 user request but has no preset in the appendix. Users who browse the appendix for available presets won't discover it.

**Recommendation:** Add a "Number Formatting" appendix preset:

| Spoken                | Output | Notes                                  |
| --------------------- | ------ | -------------------------------------- |
| five                  | 5      | Optional: keep words for small numbers |
| twenty three          | 23     | Multi-word number                      |
| one hundred and fifty | 150    | Compound number                        |
| three point five      | 3.5    | Decimal                                |
| first                 | 1st    | Ordinal                                |

Settings: locale (for 1,000 vs 1.000), threshold (numbers above N always use digits), ordinal style.

---

### Gap 7: Voice-Prompted Transforms

**Priority: MEDIUM**

**Evidence:**

- Whispering #1279: "Voice-recorded dynamic transformation prompt via shortcut" — speak a transformation instruction ("Rewrite this more formally," "Summarize in bullet points") instead of preconfigured static prompts.
- Handy #334: Separate shortcuts for raw vs. post-processed output + selectable profiles.

**Current spec:** Has `mode: 'prompt'` trigger for "LLM one-off: user types instructions" (line 488). Has stop-word mechanism for voice commands (line 388). But these two features aren't connected.

**Gap:** The spec describes voice-activated slash commands and typed LLM prompts as separate features. The natural user flow — speak a transform instruction — falls through the crack between them.

**Recommendation:** Explicitly connect the stop-word mechanism to `mode: 'prompt'`:

```
"...then I went home period computer make this sound professional"
                              ^^^^^^^^ ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                              stripped  → freeform LLM prompt
```

The stop-word triggers prompt mode. Everything after it is the LLM instruction. The preceding text is the input. This is already implied by the spec but should be stated explicitly.

---

### Gap 8: Output Delivery Hooks

**Priority: MEDIUM**

**Evidence:**

- Whispering #1071: Save transformed text to file/directory (for Obsidian automation).
- Whispering #949: Auto-convert saved files to Org-mode format.
- Whispering #720: Simulate Enter keypress after transcription paste.
- Handy #608: Paste without overwriting clipboard.
- Handy PR #638: External script as paste method (context-aware delivery).

**Current spec:** Pipeline diagram (line 370) shows `Clipboard / App / Export` as destinations but doesn't spec the delivery mechanism or hooks.

**Gap:** Users want post-transform actions: append a newline, simulate a keypress, save to a specific file, trigger a webhook, format for a specific app. These are downstream of transforms but upstream of the final paste.

**Recommendation:** Add a "Delivery" section or note that this is out of scope for the transforms spec (it's an app-level concern). If in scope, define delivery hooks as a separate pipeline stage:

```
[transcription] → [transforms] → [delivery hook] → [destination]
```

Delivery hooks could be another script type or a simpler config (e.g., `{ appendNewline: true, saveToFile: '~/notes/', simulateEnter: true }`). This is adjacent to transforms but architecturally distinct.

---

### Gap 9: Language-Aware Transform Selection

**Priority: MEDIUM**

**Evidence:**

- Whispering #886, #1317, #1144: Chinese, Japanese, Swedish transcription needs.
- Handy #605: Chinese post-processing skipped entirely (bug).
- Handy #679: French transcription outputs English.
- Handy #665: Chinese transcription outputs Pinyin instead of characters.
- Handy PR #559: "Follow OS Input Language" option (merged).

**Current spec:** Mentions French punctuation preset (line 338) and compromise's language limitations (line 275). No mechanism for auto-selecting scripts based on detected language.

**Gap:** A user transcribing in Chinese should not have English filler removal rules applied. A user switching between English and French needs different punctuation presets per language. Currently the spec relies on manual profile switching.

**Recommendation:** Add `meta.language` field to scripts:

```typescript
export const meta = {
	name: 'French Punctuation',
	language: 'fr' // ISO 639-1 code, or '*' for universal
};
```

The runner auto-filters scripts by detected transcription language. Scripts with `language: '*'` (or no language field) always run. This is simpler than manual profile switching for the multilingual case.

---

### Gap 10: Translation Preset

**Priority: LOW-MEDIUM**

**Evidence:**

- Handy PR #729 (closed): Translation hotkey via OpenRouter with `${translate_target_language}` variable.
- Handy PR #465 (merged): Translation display in overlay.
- Spec already has `/translate spanish` as a slash command example (line 381).

**Current spec:** Translation is mentioned as a slash command example but not as a preset or documented pattern.

**Gap:** Minor. Translation is one of the most common LLM transform use cases and deserves a preset example showing the pattern: async `transform()`, language detection, target language as a setting.

**Recommendation:** Add a brief translation preset example, perhaps in the "Full-Text Transform" section or as an appendix entry.

---

### Gap 11: LLM Transform Reliability / Prompt Guardrails

**Priority: LOW-MEDIUM**

**Evidence:**

- Whispering #1145: "When input text is a question or request, the transformed text is the answer, not transformed text." Users say "What time is the meeting?" and the LLM answers the question instead of applying the requested text transformation.

**Current spec:** Async `transform()` functions can call LLMs, but no guidance on prompt structure to prevent the LLM from interpreting transcription content as instructions.

**Gap:** LLM transforms need a system prompt that clearly separates "this is text to transform" from "this is what the user is asking you to do." Without this, the LLM confuses transcription content with instructions.

**Recommendation:** Add a note in the "Vibe-Coding" or pipeline section about LLM prompt structure:

- System prompt defines the transformation role
- User message contains the text to transform (clearly delimited)
- Never put the transcription text in the system prompt
- Example prompt template that avoids the question-answering trap

---

### Gap 12: Contraction Reversal

**Priority: LOW**

**Evidence:**

- Whispering #828: LLM transforms convert "want to" → "wanna", "going to" → "gonna" unwantedly. System prompts sometimes help, local models don't support system prompts.

**Current spec:** Informal → Formal preset handles the opposite direction (gonna → going to).

**Gap:** Minimal. The existing preset already serves as a safety net — if the LLM informalized text, the Informal → Formal rules will reverse it. Worth noting this dual role in the preset description.

**Recommendation:** Add a one-line note to the Informal Contractions appendix section: "Also serves as a safety net against LLMs that over-informalize transcription output."

---

## Summary

| Priority | Gap                                 | Category          | Spec impact                                                                                                                                                                                                                                                |
| -------- | ----------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HIGH     | 4. Transform context                | Architectural     | Changes function signature contract; scripts need runtime state (language, app, previous text) gated by capabilities                                                                                                                                       |
| HIGH     | 1. N-gram vocabulary matching       | **Architectural** | **Promoted to pipeline primitive:** new `words` export with fuzzy n-gram matching. No longer a preset — it's the third export alongside `rules` and `transform()`. Handy's flat word list (not replacement pairs) validated this as a distinct data model. |
| LOW      | 2. Hallucination / artifact cleanup | Preset            | "Transcription Cleanup" preset; minor question on whether runner auto-strips invisible characters                                                                                                                                                          |
| LOW      | 3. External command filter          | Out of scope      | Script expressiveness reduces need; remaining use case is delivery/side effects. Local LLM use case addressed by `llm` capability.                                                                                                                         |
| —        | 5. Config portability               | Out of scope      | App-level concern, not transforms spec                                                                                                                                                                                                                     |
| —        | 6. Number normalization             | Preset            | Appendix addition; `#Value` + `toNumber` already in spec                                                                                                                                                                                                   |
| —        | 7. Voice-prompted transforms        | App-level         | Stop-word → slash menu; not a script concern                                                                                                                                                                                                               |
| —        | 8. Output delivery hooks            | Out of scope      | Post-transform delivery, not transforms                                                                                                                                                                                                                    |
| —        | 9. Language-aware selection         | Subsumed by Gap 4 | `meta.language` + `context.language` in runner                                                                                                                                                                                                             |
| —        | 10. Translation                     | Preset            | Async `transform()` calling LLM; not architectural                                                                                                                                                                                                         |
| —        | 11. LLM prompt guardrails           | Documentation     | Prompt structure guidance, not a spec change                                                                                                                                                                                                               |
| —        | 12. Contraction reversal            | Documentation     | One-line note on existing preset                                                                                                                                                                                                                           |

**Architectural gaps:** Gap 4 (TransformContext) and Gap 1 (preferred words) both require spec changes to the core model. Gap 1 was promoted from preset to pipeline primitive after discovering that Handy's custom words are a flat preferred-spellings list (not replacement pairs) — a fundamentally different data model from `rules`. The `words` export now sits between `rules` and `transform()` in the pipeline. Everything else is presets, documentation, or out of scope.

---

## Signals

Patterns observed across both projects that inform design but don't represent specific gaps:

### Whispering's transformation system is single-slot

Whispering uses radio buttons for transforms — only one can be active at a time. Issues #1208 and #1205 are the most upvoted transform-related issues, both asking for multiple simultaneous transforms. RIFT's pipeline model solves this structurally.

### Handy ships real transform features

Handy has already merged: filler word removal (PR #589), n-gram custom word matching (PR #711), and multiple LLM provider integrations. These are production implementations, not theoretical. The spec should match or exceed Handy's shipped baseline.

### External script piping demand is reduced by script expressiveness

Three independent requests across both projects (Whispering #1269, Handy PRs #739 and #638). However, these come from ecosystems where the built-in transform is a find-replace box or an LLM prompt — not a full scripting environment. RIFT's `.transform.ts` format covers the text-transformation use cases directly. The remaining demand (side effects, machine control) is delivery, not transforms.

### Config loss causes real pain

Handy #602: user lost weeks of custom vocabulary after an update. Whispering #968, #1186: users want to sync config across machines. The localStorage-only approach needs a durability story.

### LLM transforms are unreliable without guardrails

Whispering #1145 is a class of bugs, not a one-off. Any time transcribed text looks like a question or instruction, naive LLM transforms will answer instead of transforming. This needs to be addressed at the prompt engineering level.

### Post-processing is "experimental" in Handy

Handy gates LLM post-processing behind an "Experimental Features" toggle (issues #661, #333). Multiple users couldn't find it. RIFT should make transforms first-class from day one, not hidden behind a flag.

---

## Source Index

### Whispering (Epicenter) — Open Issues

| #     | Title                                          | Transform category                       |
| ----- | ---------------------------------------------- | ---------------------------------------- |
| #1208 | Allow running multiple transformations at once | Pipeline ordering, regex, filler removal |
| #1205 | Support multiple transformations               | Pipeline, punctuation, custom vocabulary |
| #1253 | Simple way to add basic punctuation commands?  | Punctuation (voice → symbol)             |
| #904  | Support for personal dictionary                | Custom vocabulary, capitalization        |
| #962  | Regex transform adds double space              | Regex (bug)                              |
| #988  | Use textarea for newline chars in find-replace | Find/replace, newlines, scripting        |
| #1145 | Transformation: question input → answer output | LLM transform reliability                |
| #1269 | Transformation that runs a user-defined script | External command, extensibility          |
| #1279 | Voice-recorded dynamic transformation prompt   | Voice-prompted LLM, hotkey               |
| #1083 | Configure diarization during transcription     | Speaker labels, formatting               |
| #963  | Support .srt export                            | SRT/subtitle formatting                  |
| #1151 | Local file context for transformations         | Template variables, context              |
| #1249 | Transformation Picker: mark as active          | Style switching, hotkey                  |
| #1218 | Transformation Picker shortcuts not working    | Hotkey (bug)                             |
| #949  | Auto-convert saved files to Org-mode           | Output format conversion                 |
| #1071 | Save transcribed/transformed text to file      | Output destination                       |
| #821  | LM Studio support for local transformation     | Local LLM provider                       |
| #1317 | Where did Local Whisper C++ go?                | Language-specific (Swedish)              |
| #886  | Chinese/Cantonese model support                | Language-specific                        |
| #1144 | Support for gpt-4o-mini-transcribe snapshot    | Language-specific (Japanese)             |
| #968  | Sync transformation configs between machines   | Config portability                       |
| #1186 | Export/import full config setup                | Config portability                       |

### Whispering (Epicenter) — Closed Issues

| #     | Title                                        | Transform category           |
| ----- | -------------------------------------------- | ---------------------------- |
| #828  | Bothersome contractions                      | Contraction reversal         |
| #835  | Paste text + Transform with Global Shortcut  | Hotkey, clipboard transforms |
| #720  | Option to simulate Enter after transcription | Delivery hook                |
| #608  | Paste without copying to clipboard           | Clipboard/delivery           |
| #851  | Audio-aligned timestamps                     | SRT/timestamps               |
| #692  | Ollama models for transformations            | LLM provider                 |
| #910  | Add GPT-5 models                             | LLM provider                 |
| #604  | Allow any OpenAI-compatible API              | LLM provider                 |
| #1214 | System prompt save on every keystroke        | Transform UX (bug)           |
| #645  | Delete transformation history                | Transform management         |
| #631  | Human-friendly date/time display             | Date formatting              |
| #688  | Auto-chunking for 25MB file limit            | Long-form merging            |

### Whispering (Epicenter) — PRs

| #     | Title                                        | State  | Transform category         |
| ----- | -------------------------------------------- | ------ | -------------------------- |
| #1294 | Basic punctuation transformation step        | Open   | Spoken punctuation (regex) |
| #1207 | Trim trailing newlines from DB               | Merged | Whitespace cleanup         |
| #1272 | ElevenLabs scribe_v2 (diarization, keyterms) | Merged | Speaker labels, vocabulary |
| #1219 | DB path helpers for transformations          | Merged | Transform infrastructure   |
| #1196 | Mobile-friendly transformation UI            | Merged | Transform UX               |
| #1266 | Workspace templates with transformations     | Merged | Transform data model       |

### Handy — Open Issues

| #    | Title                                      | Transform category                    |
| ---- | ------------------------------------------ | ------------------------------------- |
| #199 | Whisper --initial-prompt for punctuation   | Punctuation, language-specific        |
| #684 | German umlauts dropped on paste            | Language-specific, character encoding |
| #669 | No feedback on duplicate custom word       | Custom vocabulary UX                  |
| #483 | API keys from env vars for post-processing | Post-processing infrastructure        |
| #429 | First character missing (GNOME/Wayland)    | Output delivery                       |
| #439 | Direct paste uses wrong keyboard layout    | Language-specific, character mapping  |

### Handy — Closed Issues

| #    | Title                                      | Transform category               |
| ---- | ------------------------------------------ | -------------------------------- |
| #686 | Lowercase mode                             | Capitalization                   |
| #611 | Convert spoken numbers to digits           | Number normalization             |
| #382 | Always capitalizes first word mid-sentence | Context-aware capitalization     |
| #583 | No space between sentences                 | Whitespace/spacing               |
| #500 | Zero-width space characters in output      | Artifact cleanup                 |
| #499 | ${output} placeholder not substituted      | Template system (bug)            |
| #661 | Ambiguous post-processing state            | Post-processing UX               |
| #605 | Post-processing skipped for Chinese        | Language-specific                |
| #334 | Separate shortcuts + selectable profiles   | Hotkey, profiles, tone/style     |
| #325 | Support Gemini API in post-processing      | LLM provider                     |
| #448 | Repeated words in transcription            | Artifact cleanup (deduplication) |
| #649 | "two two" becomes repeated string          | Artifact cleanup                 |
| #402 | Phantom phrases appended (Chinese)         | Hallucination cleanup            |
| #621 | Ukrainian "ю" instead of "."               | Language-specific punctuation    |
| #596 | Decoded text ignores keyboard layout       | Output character mapping         |
| #602 | Custom words lost after update             | Config persistence               |

### Handy — PRs

| #    | Title                                       | State  | Transform category              |
| ---- | ------------------------------------------- | ------ | ------------------------------- |
| #589 | Automatic filler word removal               | Merged | Filler removal, regex artifacts |
| #711 | N-gram matching for multi-word custom words | Merged | Custom vocabulary, n-gram       |
| #628 | Fix post-processing for Chinese             | Merged | Language-specific               |
| #706 | Structured outputs for post-processing      | Open   | LLM pipeline                    |
| #704 | Template variables for LLM prompts          | Open   | Template variables, context     |
| #739 | stdin/stdout command filter                 | Open   | External command                |
| #740 | "Processing..." overlay for post-processing | Open   | Post-processing UX              |
| #638 | External script paste method                | Open   | External command, delivery      |
| #466 | External providers for post-processing      | Closed | LLM providers                   |
| #729 | Translation hotkey via OpenRouter           | Closed | Translation, hotkey             |
| #465 | Translation in overlay                      | Merged | Translation display             |
| #559 | Follow OS input language                    | Open   | Language detection              |
| #509 | Local API server (SRT/VTT output)           | Open   | SRT/subtitle formatting         |
