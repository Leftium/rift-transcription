# Transforms

Text transforms process transcription output before display, clipboard, or export. They handle spoken punctuation, filler removal, text expansion, and NLP-aware rewrites.

## Design Principles

- **Most users never write code.** The primary interface is a GUI table with editable fields. The underlying script format is an implementation detail.
- **One model, not two.** Everything is a transform script that exports rules. Simple rules are data. Complex rules are functions. The runner doesn't distinguish — a rule is a match pattern and a replacement (string, function, or object).
- **Metadata preservation is a runner concern, not a user concern.** Users write rules against text. The runner handles timestamp/confidence alignment internally, with quality proportional to rule complexity.
- **Rules are ordered.** Insertion order determines execution order. Earlier rules run first.

---

## Transform Scripts

A transform script is a TypeScript (or Civet) module that exports `rules` and/or `transform`, plus optional `meta`/`settings`. This is the single format for everything — from a GUI-generated punctuation table to a vibe-coded NLP pipeline.

A script can export either or both:

- **`rules`** — an object of match → replace pairs. For pattern-based transforms (spoken punctuation, filler removal, text expansion).
- **`transform(text, config?)`** — a function that receives the full text. For operations that don't fit the match/replace model (case conversion, whitespace normalization, deduplication).

When both are present, `rules` run first, then `transform` receives the result.

### Basic Example

```typescript
// punctuation.transform.ts

export const meta = {
	name: 'English Punctuation',
	description: 'Spoken punctuation words → symbols'
};

export const rules = {
	comma: ',',
	period: '.',
	'full stop': '.',
	'question mark': '?',
	'exclamation mark': '!',
	'new line': '\n',
	colon: ':',
	semicolon: ';',
	'open parenthesis': '(',
	'close parenthesis': ')',
	ellipsis: '…'
};
```

A non-programmer never sees this. The GUI renders it as a table. But it's just a TS module — versionable, shareable, importable.

### Rules with Functions

When a rule needs logic, the value is a function instead of a string:

```typescript
// smart-replacements.transform.ts

export const meta = {
	name: 'Smart Replacements'
};

export const rules = {
	// Static replacements
	comma: ',',
	um: '',
	gonna: 'going to',

	// Computed replacements (no input needed)
	"today's date": () => new Date().toISOString().slice(0, 10),
	'current time': () => new Date().toLocaleTimeString(),

	// Transform the matched text
	'#Value': (match: string) => Number(match).toLocaleString(),

	// Object form for options + function
	'Dr.': {
		transform: (match: string) => (match === 'Dr.' ? 'Doctor' : match),
		word: true
	}
};
```

### Rules with Options

When a rule needs options beyond a simple replacement, the value is an object (inspired by [Dashing](https://github.com/technosophos/dashing)'s selector format):

```typescript
export const rules = {
	// Simple: value is a string
	comma: ',',

	// With options: value is an object
	'Dr.': {
		replace: 'Doctor',
		word: true,
		propagateCase: true
	},

	// Regex match
	'informal contractions': {
		regexp: /\b(gonna|wanna|gotta)\b/i,
		replace: 'going to'
	},

	// NLP action (powered by compromise.cool)
	'#Value': {
		action: 'toNumber'
	},

	// Function + options
	'#Noun': {
		transform: (match: string) => match.toLowerCase(),
		word: true
	},
	trimSpaces: {
		type: 'boolean' as const,
		label: 'Auto-trim spaces around punctuation',
		default: true
	},
	customWords: {
		type: 'list' as const,
		label: 'Additional words to remove',
		item: { type: 'string' },
		default: []
	}
};
```

| Schema type       | Generated GUI                             |
| ----------------- | ----------------------------------------- |
| `string`          | Text input                                |
| `boolean`         | Toggle switch                             |
| `number`          | Number input (with optional min/max/step) |
| `select`          | Dropdown                                  |
| `list` of strings | Tag/chip input                            |
| `list` of objects | Repeating fieldset                        |
| `text`            | Textarea                                  |

Settings values are passed to rule functions as a second argument:

```typescript
export const rules = {
	"today's date": (_match: string, config: Config) => new Date().toLocaleDateString(config.language)
};
```

### Full-Text Transform

Some operations don't match specific words — they transform the entire text. These use the `transform` export:

```typescript
// case-fix.transform.ts

export const meta = {
	name: 'Fix Case',
	description: 'Convert ALL CAPS to sentence case'
};

export const settings = {
	style: {
		type: 'select' as const,
		label: 'Case style',
		options: ['sentence', 'title', 'lower'],
		default: 'sentence'
	}
};

export function transform(text: string, config): string {
	switch (config.style) {
		case 'sentence':
			return text
				.toLowerCase()
				.replace(/(^\s*|[.!?]\s+)(\w)/g, (_, pre, ch) => pre + ch.toUpperCase());
		case 'title':
			return text.toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase());
		case 'lower':
			return text.toLowerCase();
	}
}
```

A script can also combine both — rules for pattern matching, then `transform` for cleanup:

```typescript
// full-cleanup.transform.ts

export const rules = {
	comma: ',',
	period: '.',
	um: ''
};

// Runs after rules: normalize whitespace
export function transform(text: string): string {
	return text.replace(/ {2,}/g, ' ').trim();
}
```

### Civet for Pattern Matching

[Civet](https://civet.dev) compiles to TypeScript and adds pattern matching syntax. Since valid TS is valid Civet, users can write in either:

```civet
// cleanup.transform.civet

export rules =
  "comma": ","
  "period": "."
  "question mark": "?"
  "um": ""
  "new line": "\n"
  "#Filler": (phrase: string): string =>
    switch phrase
      /^(um|uh|er)$/i then ""
      /^(like|you know)$/i then ""
      else phrase
```

Civet's compiler runs in the browser (JS-based), so no build step is needed.

---

## Match Patterns

The rule key (or `regexp` option) supports four match syntaxes. The runner auto-detects which engine to use:

### 1. Literal String (default)

```typescript
"comma": ","
"question mark": "?"
```

Matches the exact word or phrase, case-insensitive by default. `"comma"` matches "comma", "Comma", and "COMMA". Multi-word keys match across token boundaries. Works in any language.

Case-insensitive default is deliberate: transcription providers are inconsistent about case (some return ALL CAPS, some lowercase, some mixed), and spoken words have no inherent case. Opt in to case-sensitive matching with `{ caseSensitive: true }` when needed.

### 2. Regex

```typescript
"informal speech": {
  regexp: /\b(gonna|wanna|gotta)\b/i,
  replace: "going to",
}
```

Full JavaScript regex syntax. Activated when the `regexp` option is present. Works in any language.

### 3. Compromise Selectors (NLP-aware)

```typescript
"#Filler": "",
"#Value": { action: "toNumber" },
"#Adjective #Noun": (match: string) => match.toLowerCase(),
```

Keys starting with `#` are interpreted as [compromise](https://compromise.cool) match patterns. Compromise parses text into a tagged token tree, enabling CSS-like selectors over natural language:

| Selector              | Matches                               |
| --------------------- | ------------------------------------- |
| `#Filler`             | um, uh, er, like, you know (built-in) |
| `#Noun`               | any noun                              |
| `#Verb`               | any verb                              |
| `#Person`             | recognized person names               |
| `#Place`              | recognized place names                |
| `#Value`              | numbers (written or numeric)          |
| `#Adjective #Noun`    | adjective followed by noun            |
| `(go\|walk\|run)`     | alternation                           |
| `#Verb gonna`         | literal + tag match                   |
| `simon says [target]` | named capture group                   |

This is pattern matching over a linguistically-tagged token stream.

**Language limitation:** Compromise's tagging is primarily English. French, German, Spanish, and Italian have partial support via community ports. For non-supported languages, use literal or regex patterns.

### 4. Provider Tags (language-independent)

Transcription provider metadata is mapped to the same `#Tag` namespace:

```typescript
"#LowConfidence": { action: "highlight" },
"#Speaker1": (match: string) => `Alice: ${match}`,
```

| Tag                           | Source                 | Description                       |
| ----------------------------- | ---------------------- | --------------------------------- |
| `#LowConfidence`              | Any provider           | `confidence < 0.5`                |
| `#HighConfidence`             | Any provider           | `confidence > 0.9`                |
| `#Speaker0`, `#Speaker1`, ... | Diarization            | Speaker identity                  |
| `#Filler`                     | Provider OR compromise | Provider-detected or NLP-detected |

Provider tags work across all languages because they use transcription metadata, not NLP.

---

## GUI Mapping

The rules object renders directly as a table:

| Match         | Replace/Action | Enabled |
| ------------- | -------------- | ------- |
| comma         | ,              | ✓       |
| period        | .              | ✓       |
| full stop     | .              | ✓       |
| question mark | ?              | ✓       |
| um            | _(remove)_     | ✓       |
| #Filler       | _(remove)_     | ✓       |
| today's date  | _fn_           | ✓       |

- String values show the replacement text
- Empty strings show _(remove)_
- Functions show _fn_ or a summary
- Object values show the `replace` or `action` field
- Advanced options (`regexp`, `word`, `propagateCase`) are collapsed by default

Users add/remove/reorder rows in the GUI. The GUI serializes to/from the script format. For purely declarative rule sets (all string values), JSONC is sufficient — no TS compilation needed.

### UI Layers

The GUI has three levels of depth:

1. **Profile selector + script toggles** — a dropdown to pick the active profile (Casual, Medical, Programming, etc.) and a list of transform scripts with on/off toggles. Most users stop here.

2. **Rules within a script** — click a script's settings icon to see its rules, grouped by category (comment headers in JSONC). Categories are collapsible. Per-rule checkboxes toggle individual rules within the active profile.

3. **Rule editor** — expand a rule to see/edit advanced options or add custom rules (two fields: match and replace).

For large presets (50+ rules), categories start collapsed except the most-edited ones. Search/filter across all rules.

---

## Presets

Presets are transform scripts bundled with RIFT or shared by the community:

- **English Punctuation** — spoken punctuation words → symbols
- **French Punctuation** — `virgule` → `,`, `point d'interrogation` → `?`
- **Filler Removal (English)** — um, uh, er, like, you know → remove
- **Informal → Formal** — gonna → going to, wanna → want to

Users install presets, then customize individual rules (enable/disable, modify). Shareable as files or gists.

---

## Pipeline

Transform scripts run in sequence. Within each script, `rules` run first, then `transform`:

```
[transcription] → [script 1 rules → script 1 transform]
               → [script 2 rules → script 2 transform]
               → ... → [output]
```

### When Transforms Run

TranscribeArea acts as a **text preparation stage** (similar to [Drafts](https://getdrafts.com/)) — raw transcription is captured, transforms are previewed in real-time, and the result is delivered to a target (clipboard, app, export).

```
                            ┌─────────────────────────────┐
                            │ TranscribeArea              │
                            │                             │
Source → Transcript ──────► │ [text]                      │
                            │   ↕ auto transforms applied │
                            │   ↕ reversible (undo)       │
                            │                             │
                            └──────────┬──────────────────┘
                                       ↓ deliver
                              Clipboard / App / Export
```

**Auto transforms** run continuously on the raw transcription to produce the preview. The raw input is the source of truth — transforms produce a live, reversible view on top of it.

**Manual transforms** (hotkey, button, command palette) are invoked on demand, operating on selected text, the last utterance, or the full content.

**Slash commands** are the universal interface for discovering, triggering, and toggling transforms. Typing `/` in the text area opens a filtered list of all available transforms — named scripts, LLM prompts, and toggle commands. This replaces the need for a separate command palette or search interface.

- `/formal` — run the Informal → Formal transform
- `/punctuation` — toggle English Punctuation on/off
- `/translate spanish` — LLM: translate to Spanish
- `/make this sound like a pirate` — freeform LLM prompt

Predefined slash commands map to named transform scripts (using `meta.name` or a short alias). Unrecognized commands are passed to the LLM as freeform prompts. Autocomplete filters as the user types.

Slash commands are voice-compatible in two ways:

1. **Punctuation rule:** saying "slash professional" produces `/professional` via a rule (`"slash": "/"`).

2. **Stop-word:** a configurable wake word (e.g., "computer", "hey rift") triggers the slash menu. Everything spoken after the stop-word becomes the command input. The stop-word itself is stripped from the output.

```
"...then I went home period computer professional"
                              ^^^^^^^^ ^^^^^^^^^^^^
                              stripped  → /professional
```

The stop-word is a system-level setting (not a transform rule), since it changes input mode rather than transforming text. It should be a phrase that rarely appears in normal dictation. User-configurable in app settings.

**LLM transforms** can be one-off (freeform slash command) or saved as named scripts. If a prompt is reused often, it can be saved as a named transform script with an async `transform` function.

**Undo applies to transforms, not just text edits.** If an auto-transform mangles something (e.g., punctuation rule triggers on an unintended word), the user undoes the transform specifically, not the underlying transcription.

**Context-aware activation:** The set of auto transforms can change based on delivery target (clipboard vs. Slack vs. code editor), content (detected language, length), or other signals. The status bar below the text area shows which auto transforms are currently active.

Transforms do **not** modify the stored transcription data — they produce a transformed view. The original `Transcript` (with timestamps, confidence, speaker) is preserved. Toggling transforms on/off is non-destructive.

### Performance

- **String rules** are compiled into an optimized matcher when rules change, not per invocation
- **Compromise parsing** (for `#Tag` selectors) runs once per pipeline invocation, shared across all rules
- **Function rules** run in a sandboxed Web Worker (no DOM access, no main-thread blocking)
- **Timeout:** Rules that don't return within a configurable limit (default: 1 second) are terminated

---

## Sandboxing

Scripts run user-authored code and must be sandboxed:

- **Execution environment:** Web Worker (no DOM access, no main-thread blocking)
- **Communication:** Message passing (input string in, output string out)
- **No network by default:** Scripts cannot make fetch/XHR calls unless explicitly granted permission
- **Timeout:** Configurable per-script (default: 1 second)

---

## Metadata Preservation

Users write rules against plain text. The runner handles metadata (timestamps, confidence, speaker) alignment internally. Quality depends on the type of operation:

| Operation             | Example                        | Metadata                                      |
| --------------------- | ------------------------------ | --------------------------------------------- |
| 1:1 word replacement  | "comma" → ","                  | Exact — inherits original token's metadata    |
| 1:0 deletion (remove) | "um" → ""                      | Exact — token removed, gap in timestamps      |
| N:1 merge             | "question mark" → "?"          | Good — span merged (min start, max end)       |
| 1:N expansion         | "addr" → "123 Main St"         | Approximate — original span subdivided evenly |
| Case change           | toLowerCase                    | Exact — same tokens, same metadata            |
| Regex across tokens   | `/the\s+quick/` → "a fast"     | Best-effort — heuristic time division         |
| Function transform    | arbitrary `(string) => string` | Best-effort or none                           |

Whitespace adjustment around punctuation (trim space before `,`, etc.) is a **rendering concern**, not a token operation. The runner applies smart defaults:

- Remove preceding space before `.,;:!?)]}`
- Remove following space after `([{`
- Language-specific overrides (e.g., French space before `:`)

---

## Vibe-Coding

The script format is designed to be LLM-friendly:

- Self-contained single file
- `rules` export is a plain object — data or functions
- `settings` export generates GUI automatically — no UI code
- `meta` export provides context
- Standard JS/TS string methods, no framework dependencies

A user describes a transform to a coding agent:

> "Write me a transform that fixes German number formatting — replace periods with commas in numbers and vice versa, with a toggle for Swiss German"

The agent produces a complete `.transform.ts` that RIFT loads immediately.

---

## Storage

- **Transform scripts:** Stored as text in `localStorage`. Import/export as `.transform.ts` files.
- **Purely declarative scripts** (all string rules): Can also be stored/shared as `.jsonc`.
- **Presets:** Bundled scripts. Community presets downloadable from a repository.
- **Pipeline config:** Which scripts are enabled and in what order. Stored in `localStorage`.
- **Profiles:** A profile is a named configuration of which scripts are enabled and which individual rules are toggled off. Users switch profiles for different contexts (casual, medical, programming, etc.). The active profile and all profile data are stored in `localStorage`. Scripts themselves are never modified — profiles are a view layer over them.

```typescript
interface TransformProfile {
	name: string;
	enabledScripts: string[]; // which scripts are active
	disabledRules: Record<string, string[]>; // per-script rule overrides
	triggers: Record<string, TransformTrigger>; // per-script or per-rule trigger
}

type TransformTrigger =
	| { mode: 'auto' } // runs on every transcription result
	| { mode: 'hotkey'; key: string } // runs on keypress
	| { mode: 'command' } // available in command palette only
	| { mode: 'prompt' }; // LLM one-off: user types instructions
```

The default trigger is `auto` — the transform runs on every transcription result, matching current behavior. Scripts or individual rules can be bound to a hotkey instead, so they only run on demand.

When triggered manually (hotkey or command palette), the transform runs on:

- **Selected text** if there's a selection
- **Last utterance/sentence** if no selection
- **Full document** if explicitly chosen (e.g., via command palette option)

This enables two distinct usage patterns with the same rule format:

- **Auto transforms** — spoken punctuation, filler removal (always running)
- **On-demand transforms** — case conversion, formality rewrite, LLM enhancement (triggered by hotkey)

Voice-triggered transforms (e.g., say "uppercase that") are a future extension of the same mechanism.

---

## Prior Art

| System                                                                            | Format           | Key insight borrowed                                                     |
| --------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------ |
| [Espanso](https://espanso.org)                                                    | YAML             | `word` boundary matching, `propagate_case`, dynamic variables            |
| [AutoHotkey](https://www.autohotkey.com)                                          | Custom script    | Case-conforming by default (Btw → By the way)                            |
| [Dashing](https://github.com/technosophos/dashing)                                | JSON             | Progressive disclosure: simple value OR object with options for same key |
| [ICU Transforms](https://unicode-org.github.io/icu/userguide/transforms/general/) | Custom rules     | Only formal standard for text transformation (Unicode/ICU)               |
| [Hunspell REP](https://hunspell.github.io/)                                       | Plain text pairs | De facto standard for spell-check replacement suggestions                |
| [compromise.cool](https://compromise.cool)                                        | JS API           | CSS-like selectors over linguistically-tagged tokens                     |
| [Handy PR #455](https://github.com/cjpais/Handy/pull/455)                         | JSON             | Real user demand: spoken punctuation is the #1 use case                  |
| [Civet](https://civet.dev)                                                        | TS superset      | Pattern matching syntax for JS/TS; compiles in browser                   |

### Standards Landscape

No universal standard exists for text replacement rules. Despite ubiquity across every platform (macOS text replacements, Android autocorrect, TextExpander, Dragon NaturallySpeaking), there is no IETF RFC, W3C recommendation, or Unicode standard for general-purpose find/replace rule formats. ICU Transforms is the closest, but targets transliteration/normalization. Speech recognition has no post-processing standard at all.

---

## Open Questions

- **Compromise term `id` stability:** Does compromise preserve term `id` through grammar transforms (`.toPastTense()`, `.toLowerCase()`)? Needs testing before relying on side-map metadata preservation through NLP transforms.
- **Rule ordering edge cases:** Insertion-order preservation in JS objects is guaranteed for string keys (ES2015+), but should we add explicit ordering as a fallback?
- **Preset versioning:** How to handle preset updates when users have customized individual rules? Merge strategy needed.
- **Async transforms:** `rules` are always sync (they run on every transcription result and must be fast). `transform` functions can be async for LLM-powered or API-based transforms — these should only be used with manual triggers (hotkey/command/prompt), not auto mode, to avoid blocking the transcription pipeline.
- **Interim results:** Should transforms run on interim (partial) transcription, or only finals? Interims give faster feedback but waste compute on text that will be revised. Configurable per-script?

### From competitive analysis

The following gaps were identified by reviewing 561 GitHub issues/PRs across Whispering and Handy. See [transforms-research.md](./transforms-research.md) for full evidence and source index.

- **Multi-word / n-gram matching:** Compound words split by STT (e.g., "Chat G P T" → "ChatGPT"). Handy ships this (PR #711). This is a `transform()` use case, not a literal matcher extension — a "Custom Vocabulary" preset with a word list setting and sliding-window scan. The Match Patterns section should note that token-boundary reconciliation is handled via `transform()`, not rules.
- **Transform context:** Both projects independently invented template variables (`$current_app`, `$language`, `$short_prev_transcript`). The spec's `config` argument should expand to include runtime context (detected language, focused app, previous text, etc.), gated by per-script capability declarations. Subsumes the language-aware selection gap — if scripts can read `context.language`, language filtering is a runner feature. See risks: non-determinism, privacy/sandboxing tension, platform divergence.
- **Hallucination / artifact cleanup:** Repeated words, phantom phrases, invisible Unicode, bracketed metadata (`[AUDIO]`, `(pause)`). Universal across providers. Needs a "Transcription Cleanup" preset distinct from filler removal.
- **Number normalization preset:** Top-5 user request (Handy #611). `#Value` + `toNumber` exists in the spec but has no appendix preset.
- **LLM prompt guardrails:** LLMs answer questions in transcription text instead of transforming them (Whispering #1145). Spec should document prompt structure that separates content from instruction.

---

## Appendix: Common Replacement Rules

Collected from [Handy PR #455](https://github.com/cjpais/Handy/pull/455) user requests, the [Handy English punctuation preset](https://github.com/user-attachments/files/24177105/handy-replacements-english.punctuation-v1.0.json), and [Microsoft Dictation](https://support.microsoft.com/en-gb/office/dictate-your-documents-in-word-3876e05f-3fcc-418f-b8ab-db7ce0d11d3c) commands. This is the de facto standard that users expect from spoken punctuation.

### Punctuation

| Spoken phrase                       | Output       | Notes                |
| ----------------------------------- | ------------ | -------------------- |
| period, full stop                   | `.`          | Capitalize next word |
| comma                               | `,`          |                      |
| question mark                       | `?`          | Capitalize next word |
| exclamation mark, exclamation point | `!`          | Capitalize next word |
| colon                               | `:`          |                      |
| semicolon                           | `;`          |                      |
| ellipsis, dot dot dot               | `...` or `…` | Capitalize next word |
| hyphen                              | `-`          |                      |
| em dash, m dash                     | `—`          | MS dictation         |
| en dash, n dash                     | `–`          | MS dictation         |
| apostrophe s                        | `'s`         | Trim space before    |
| apostrophe                          | `'`          | MS dictation         |

<details>
<summary>Rule config</summary>

```typescript
// punctuation.transform.ts

export const meta = {
	name: 'English Punctuation',
	description: 'Spoken punctuation words → symbols'
};

// Capitalize-after-sentence-enders and space-trimming
// are runner-level smart defaults, not per-rule options.
export const rules = {
	period: '.',
	'full stop': '.',
	comma: ',',
	'question mark': '?',
	'exclamation mark': '!',
	'exclamation point': '!',
	colon: ':',
	semicolon: ';',
	ellipsis: '…',
	'dot dot dot': '…',
	hyphen: '-',
	'em dash': '—',
	'm dash': '—',
	'en dash': '–',
	'n dash': '–',
	'apostrophe s': "'s",
	apostrophe: "'"
};
```

</details>

### Quotes & Brackets

| Spoken phrase                         | Output | Notes             |
| ------------------------------------- | ------ | ----------------- |
| open quotes, begin quotes             | `"`    | Trim space after  |
| close quotes, end quotes              | `"`    | Trim space before |
| open single quote, begin single quote | `'`    | Trim space after  |
| close single quote, end single quote  | `'`    | Trim space before |
| open parenthesis, left parenthesis    | `(`    | Trim space after  |
| close parenthesis, right parenthesis  | `)`    | Trim space before |
| open bracket, left bracket            | `[`    | Trim space after  |
| close bracket, right bracket          | `]`    | Trim space before |
| open brace, left brace                | `{`    | Trim space after  |
| close brace, right brace              | `}`    | Trim space before |

<details>
<summary>Rule config</summary>

```typescript
// quotes-brackets.transform.ts

export const meta = {
	name: 'Quotes & Brackets',
	description: 'Spoken bracket/quote commands → symbols'
};

// Space-trimming around opening/closing delimiters
// is a runner-level smart default.
export const rules = {
	'open quotes': '"',
	'begin quotes': '"',
	'close quotes': '"',
	'end quotes': '"',
	'open single quote': "'",
	'begin single quote': "'",
	'close single quote': "'",
	'end single quote': "'",
	'open parenthesis': '(',
	'left parenthesis': '(',
	'close parenthesis': ')',
	'right parenthesis': ')',
	'open bracket': '[',
	'left bracket': '[',
	'close bracket': ']',
	'right bracket': ']',
	'open brace': '{',
	'left brace': '{',
	'close brace': '}',
	'right brace': '}'
};
```

</details>

### Whitespace & Structure

| Spoken phrase        | Output | Notes                |
| -------------------- | ------ | -------------------- |
| new line, line break | `\n`   | Capitalize next word |
| new paragraph        | `\n\n` | Capitalize next word |

<details>
<summary>Rule config</summary>

```typescript
// whitespace.transform.ts

export const meta = {
	name: 'Whitespace & Structure',
	description: 'Line break and paragraph commands'
};

export const rules = {
	'new line': '\n',
	'line break': '\n',
	'new paragraph': '\n\n'
};
```

</details>

### Symbols

| Spoken phrase                  | Output  | Notes                                 |
| ------------------------------ | ------- | ------------------------------------- |
| asterisk                       | `*`     | MS dictation                          |
| at sign                        | `@`     | MS dictation                          |
| backslash                      | `\`     | MS dictation                          |
| forward slash                  | `/`     | MS dictation                          |
| underscore                     | `_`     | Handy preset; trim surrounding spaces |
| vertical bar, pipe character   | `\|`    | MS dictation                          |
| backquote, backtick            | `` ` `` | MS dictation                          |
| ampersand, and sign            | `&`     | MS dictation                          |
| caret symbol                   | `^`     | MS dictation                          |
| paragraph sign, paragraph mark | `¶`     | MS dictation                          |
| section sign                   | `§`     | MS dictation                          |
| copyright sign                 | `©`     | MS dictation                          |
| registered sign                | `®`     | MS dictation                          |
| degree symbol                  | `°`     | MS dictation                          |

<details>
<summary>Rule config</summary>

```typescript
// symbols.transform.ts

export const meta = {
	name: 'Symbols',
	description: 'Spoken symbol names → characters'
};

export const rules = {
	asterisk: '*',
	'at sign': '@',
	backslash: '\\',
	'forward slash': '/',
	underscore: '_',
	'vertical bar': '|',
	'pipe character': '|',
	backquote: '`',
	backtick: '`',
	ampersand: '&',
	'and sign': '&',
	'caret symbol': '^',
	'paragraph sign': '¶',
	'paragraph mark': '¶',
	'section sign': '§',
	'copyright sign': '©',
	'registered sign': '®',
	'degree symbol': '°'
};
```

</details>

### Mathematics

| Spoken phrase                          | Output | Notes        |
| -------------------------------------- | ------ | ------------ |
| plus sign                              | `+`    | MS dictation |
| minus sign                             | `-`    | MS dictation |
| multiplication sign                    | `×`    | MS dictation |
| division sign                          | `÷`    | MS dictation |
| equal sign                             | `=`    | MS dictation |
| plus or minus sign                     | `±`    | MS dictation |
| less than sign, left angle bracket     | `<`    | MS dictation |
| greater than sign, right angle bracket | `>`    | MS dictation |
| percent sign                           | `%`    | MS dictation |
| number sign, pound sign, hash sign     | `#`    | MS dictation |

<details>
<summary>Rule config</summary>

```typescript
// mathematics.transform.ts

export const meta = {
	name: 'Mathematics',
	description: 'Spoken math operator names → symbols'
};

export const rules = {
	'plus sign': '+',
	'minus sign': '-',
	'multiplication sign': '×',
	'division sign': '÷',
	'equal sign': '=',
	'plus or minus sign': '±',
	'less than sign': '<',
	'left angle bracket': '<',
	'greater than sign': '>',
	'right angle bracket': '>',
	'percent sign': '%',
	'number sign': '#',
	'pound sign': '#',
	'hash sign': '#'
};
```

</details>

### Currency

| Spoken phrase       | Output | Notes        |
| ------------------- | ------ | ------------ |
| dollar sign         | `$`    | MS dictation |
| pound sterling sign | `£`    | MS dictation |
| euro sign           | `€`    | MS dictation |
| yen sign            | `¥`    | MS dictation |

<details>
<summary>Rule config</summary>

```typescript
// currency.transform.ts

export const meta = {
	name: 'Currency',
	description: 'Spoken currency names → symbols'
};

export const rules = {
	'dollar sign': '$',
	'pound sterling sign': '£',
	'euro sign': '€',
	'yen sign': '¥'
};
```

</details>

### Emoji

| Spoken phrase | Output | Notes        |
| ------------- | ------ | ------------ |
| smiley face   | `:)`   | MS dictation |
| frowny face   | `:(`   | MS dictation |
| winky face    | `;)`   | MS dictation |
| heart emoji   | `<3`   | MS dictation |

<details>
<summary>Rule config</summary>

```typescript
// emoji.transform.ts

export const meta = {
	name: 'Emoji',
	description: 'Spoken emoji names → emoticons'
};

export const rules = {
	'smiley face': ':)',
	'frowny face': ':(',
	'winky face': ';)',
	'heart emoji': '<3'
};
```

</details>

### Dynamic Values (Handy)

| Spoken phrase     | Output                  | Notes        |
| ----------------- | ----------------------- | ------------ |
| the date and time | _(current date + time)_ | Handy preset |
| the date          | _(current date)_        | Handy preset |
| the time          | _(current time)_        | Handy preset |

<details>
<summary>Rule config</summary>

```typescript
// dynamic-values.transform.ts

export const meta = {
	name: 'Dynamic Values',
	description: 'Insert current date/time on demand'
};

export const rules = {
	'the date and time': () => new Date().toLocaleString(),
	'the date': () => new Date().toLocaleDateString(),
	'the time': () => new Date().toLocaleTimeString()
};
```

</details>

### Filler Words (common removal targets)

| Spoken phrase | Notes                                     |
| ------------- | ----------------------------------------- |
| um            |                                           |
| uh            |                                           |
| er            |                                           |
| like          | Context-dependent — sometimes intentional |
| you know      |                                           |
| I mean        |                                           |
| sort of       |                                           |
| kind of       |                                           |
| basically     |                                           |
| actually      |                                           |
| literally     |                                           |

<details>
<summary>Rule config</summary>

```typescript
// filler-removal.transform.ts

export const meta = {
	name: 'Filler Removal',
	description: 'Remove filler words and verbal tics'
};

export const rules = {
	um: '',
	uh: '',
	er: '',
	// "like" is context-dependent — compromise's #Filler tag
	// is more accurate than a blanket removal rule.
	'you know': '',
	'I mean': '',
	'sort of': '',
	'kind of': '',
	basically: '',
	actually: '',
	literally: ''
};
```

</details>

### Informal Contractions

| Spoken phrase | Output      |
| ------------- | ----------- |
| gonna         | going to    |
| wanna         | want to     |
| gotta         | got to      |
| kinda         | kind of     |
| sorta         | sort of     |
| shoulda       | should have |
| coulda        | could have  |
| woulda        | would have  |

<details>
<summary>Rule config</summary>

```typescript
// informal-contractions.transform.ts

export const meta = {
	name: 'Informal → Formal',
	description: 'Expand informal contractions to standard English'
};

export const rules = {
	gonna: 'going to',
	wanna: 'want to',
	gotta: 'got to',
	kinda: 'kind of',
	sorta: 'sort of',
	shoulda: 'should have',
	coulda: 'could have',
	woulda: 'would have'
};
```

</details>

### Notes

- **Microsoft Dictation** is the closest thing to a de facto standard. Most users with dictation experience expect these commands to work. The English command set is comprehensive; other languages have similar but smaller sets.
- **Handy's preset** adds practical features beyond MS dictation: regex alternation for synonym matching (e.g., `period|full stop`), next-word capitalization rules, and whitespace trimming toggles. The trim/capitalize complexity was a point of contention in the PR — RIFT handles these as smart defaults in the runner rather than per-rule toggles.
- **Capitalization after sentence-ending punctuation** (`.`, `?`, `!`, `...`, `\n`) is a common need. In the Handy preset this is a per-rule `capitalization_rule` field. In RIFT, this is better handled by a separate `transform` function (like the case-fix script) or as a runner-level smart default, rather than burdening every punctuation rule with a capitalization flag.
