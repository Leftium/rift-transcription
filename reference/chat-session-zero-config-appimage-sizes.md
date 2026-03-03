# Chat Session: Zero-Config AppImage Sizes

**Session ID**: `ses_3ffc89b6effet1VM6m6jO0rsg8`
**Date**: January 28, 2026
**Source**: epicenter project (OpenCode)

---

## Summary

Short follow-up session about why the amd64 AppImage release of Whispering is relatively larger than other platform releases, and what model bundling would mean for release sizes.

---

## Conversation

### User

> Why is the amd64.appimage relatively so much larger? (https://github.com/EpicenterHQ/epicenter/releases/tag/v7.11.0)

### Assistant

From the v7.11.0 release:

- **amd64.AppImage**: 156 MB
- **arm64.AppImage**: 139 MB
- **x64.dmg** (macOS): ~140 MB
- **arm64.dmg** (macOS): ~133 MB
- **x64-setup.exe** (Windows): ~102 MB

The amd64 AppImage being ~156MB (vs ~139MB for arm64) is about **12% larger**. This is a common pattern:

1. **x86_64 instruction encoding is larger** - variable-length instructions (1-15 bytes) vs ARM64's fixed 4-byte instructions
2. **Library dependencies** - x86_64 Linux libraries tend to be slightly larger due to instruction set complexity
3. **SIMD/vector instructions** - x86_64 includes multiple code paths for different CPU features (SSE, AVX, AVX2, AVX-512)
4. **Rust/LLVM codegen** - LLVM generates slightly more verbose code for x86_64 (CISC vs RISC)

### Impact of Model Bundling

If you bundle Moonshine Tiny (~30MB), both AppImages would grow proportionally:

- amd64: ~156MB -> ~186MB
- arm64: ~139MB -> ~169MB

The ~12% architecture overhead remains consistent. Model files are architecture-independent (ONNX), adding the same ~30MB to both.

---

## Key Takeaway

Even with a bundled model, the total app size (~170-190MB) is comparable to typical Electron apps. The architecture size difference is a non-issue for zero-config goals.
