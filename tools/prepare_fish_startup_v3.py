#!/usr/bin/env python3
"""Isolated fishing QA v3: do not upload animated vendors during GPU warmup.

This changes only /qa/fish-landing/. The stable QA, live game, fish meshes,
ocean, reflections, clouds, caustics, shadows, spray and wallet are unchanged.
"""
from pathlib import Path
root = Path("_qa/fftcore")
def replace_once(name, old, new):
    p = root / name
    s = p.read_text()
    assert s.count(old) == 1, f"{name}: stale patch anchor {old[:90]!r}: {s.count(old)}"
    p.write_text(s.replace(old, new, 1))

# In the user's loss trace, both vendors had completed uploading before
# the 13/30 GPU warmup frame. Do not allocate skinned vendor material textures
# while ocean/cloud/shadow pipelines are still being primed.
# Vendor stand-ins, dialogue, and purchasing stay functional.
# Re-enable full animated 512px vendor GLBs after 90 actual visible
# gameplay submissions, one by one via the existing serialization gate.
replace_once("src/game/Vendor.js",
    "if ( this._pendingCharacter && lookAt ) {",
    """const mobileVendor = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test( navigator.userAgent );
        const visible = typeof document === 'undefined' || document.visibilityState === 'visible';
        const readyToUpload = !mobileVendor || ( visible && ( window.__bermudaQAGameplay?.submissions ?? 0 ) >= 90 );
        if ( this._pendingCharacter && lookAt && readyToUpload ) {""")

# Read-only diagnostics: verify the delayed vendor allocations actually
# occurred after Explore, rather than assuming a smaller texture cap fixed loss.
replace_once("src/mobile/GpuAudit.js",
    "  'QA source revision coastal-v38-storm-sky-isolated',",
    """  'QA source revision coastal-v38-storm-sky-isolated',
  'QA fishing v3 startup vendor gate: '+(typeof window!=='undefined' && window.__bermudaQAGameplay
    ? 'Explore submitted '+window.__bermudaQAGameplay.submissions+' frames / 90 needed'
    : 'deferred before Explore (90 gameplay frames)'),""")

v = (root/"src/game/Vendor.js").read_text()
m = (root/"src/mobile/GpuAudit.js").read_text()
assert "readyToUpload" in v
assert "( window.__bermudaQAGameplay?.submissions ?? 0 ) >= 90" in v
assert "window.__bermudaQAVendorLoadBusy = true" in v, "serialize 3D vendor models"
assert "textureSize: compactTextures" in v, "retain 512px vendor textures"
assert "QA fishing v3 startup vendor gate:" in m
assert "const LANDING_SECONDS = 8.0;" in (root/"src/game/Game.js").read_text()
print("Fish QA v3: preserve eight-second fish; defer vendor uploads until 90 visible gameplay GPU submissions; all seven coastal FX retained")
