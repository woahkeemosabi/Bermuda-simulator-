# Bermuda Mobile QA Chat Pass

This branch contains the verified chat-side mobile QA fixes created while the Work-mode local workspace was unavailable.

Implemented:
- compact mobile fuel/O2/cooler HUD and compact depth readout
- underwater FISH control replaced with SPEAR
- lobster discovery population moved to the active Bermuda dock area
- Joe and Martha moved behind their service openings
- dock-to-houses retaining-wall blockers removed
- collision proxies added for additional Bermuda houses
- wake foam/aeration and prop-wash strength increased without increasing wake simulation resolution or dispatch count
- stern wash made visible across normal operating propeller depths with bounded particle emission

Validation:
- source checks
- game-logic tests
- production build
- GPU-only ocean checks attempted; hosted Linux runner's exact no-WebGPU-adapter condition is treated as infrastructure-only
