#!/usr/bin/env python3
"""QA-only cosmetic Bermuda coastal look. No new GPU passes or game-state changes.

Applies AFTER prepare_stable_qa.py to the pinned /qa/fftcore/ checkout.
Use ?look=classic to recover the exact previous visual parameters.
The production root, FFT dimensions/cascades, physics and save keys are untouched.
"""
from pathlib import Path

ROOT = Path("_qa/fftcore")
identity = ROOT / "src/world/BermudaIdentity.js"
blockout = ROOT / "src/world/BermudaBlockout.js"
assert identity.is_file() and blockout.is_file(), "Pinned QA sources unavailable"


def replace_once(path: Path, old: str, new: str):
    source = path.read_text()
    count = source.count(old)
    assert count == 1, f"{path}: expected 1 anchor; found {count}: {old[:72]!r}"
    path.write_text(source.replace(old, new, 1))


replace_once(
    identity,
    "};\n\nlet terrainProfileInstalled = false;",
    """};

// This is a modest visual-only QA profile: clearer blue-green shallows,
// more legible depth transitions and a little less atmospheric veiling.
// It reuses the existing physically based water and atmospheric materials;
// no shader code, extra render pass or FFT workload is introduced.
const BERMUDA_COASTAL_QA_LOOK = {
    ...BERMUDA_LOOK,
    water: {
        ...BERMUDA_LOOK.water,
        absorption: [ 0.220, 0.041, 0.021 ],
        scattering: [ 0.0065, 0.024, 0.026 ],
        backscatter: 0.020,
        refraction: 0.098,
        roughness: 0.022,
        reflectionStrength: 0.98,
        foamIntensity: 0.70,
    },
    atmosphere: {
        ...BERMUDA_LOOK.atmosphere,
        rayleighScale: 1.06,
        mieScale: 0.48,
    },
};

function activeBermudaQALook() {
    const classic = typeof location !== 'undefined' &&
        new URLSearchParams(location.search).get('look') === 'classic';
    if (typeof window !== 'undefined') {
        window.__bermudaVisualProfile = classic ? 'classic' : 'coastal-v1';
    }
    return classic ? BERMUDA_LOOK : BERMUDA_COASTAL_QA_LOOK;
}

let terrainProfileInstalled = false;""",
)

source = identity.read_text()
assert source.count("const look = BERMUDA_LOOK;") == 2, "Boot/runtime look anchor mismatch"
source = source.replace("const look = BERMUDA_LOOK;", "const look = activeBermudaQALook();")
assert source.count("activeBermudaQALook();") == 2
identity.write_text(source)

replace_once(
    identity,
    "app.settings.exposure = mobileHardware() ? 0.84 : look.daylight.exposure;",
    "app.settings.exposure = mobileHardware() ? "
    "(look === BERMUDA_COASTAL_QA_LOOK ? 0.87 : 0.84) : look.daylight.exposure;",
)

# The former mobile clock was 0.05 in-game hours/real second: a full day
# passed in eight minutes, so an early afternoon load turned black in ~2 min.
# Slow ONLY the coastal QA lighting clock. Preserve a functioning day/night
# cycle, gameplay saves, shadows, clouds, oceans and all rendering workloads.
# ?clock=original restores the fast cycle. ?clock=hold fixes the sun during
# controlled before/after screenshot comparisons. ?look=classic is untouched.
replace_once(
    identity,
    "app.settings.timeOfDay = look.daylight.timeOfDay;",
    """app.settings.timeOfDay = look.daylight.timeOfDay;
    if (mobileHardware() && look === BERMUDA_COASTAL_QA_LOOK) {
        const clock = new URLSearchParams(location.search).get('clock');
        if (clock === 'hold') app.settings.timeSpeed = 0;
        else if (clock !== 'original') app.settings.timeSpeed = 0.0025;
        if (typeof window !== 'undefined')
            window.__bermudaQADaySpeed = app.settings.timeSpeed;
    }""",
)

# Existing mesh/materials only. No new geometry, instances or collisions.
# Bermuda's pale limestone reads clearer against the weathered wooden pier.
replace_once(
    blockout,
    "const M={limestone:makeMaterial('limestone',0xe8e3d6,.96)",
    "const coastalQA = typeof window !== 'undefined' && "
    "window.__bermudaVisualProfile === 'coastal-v1';\n"
    " const M={limestone:makeMaterial('limestone',coastalQA ? 0xf0ebdf : 0xe8e3d6,.96)",
)
for old, new in [
    ("wood:makeMaterial('dock-wood',0x8a7052,.97)",
     "wood:makeMaterial('dock-wood',coastalQA ? 0x947b5f : 0x8a7052,.97)"),
    ("asphalt:makeMaterial('road',0x777d80,.98)",
     "asphalt:makeMaterial('road',coastalQA ? 0x6f7475 : 0x777d80,.98)"),
    ("green:makeMaterial('palmetto',0x4f7655,.94)",
     "green:makeMaterial('palmetto',coastalQA ? 0x547c5e : 0x4f7655,.94)"),
]:
    replace_once(blockout, old, new)

identity_source, blockout_source = identity.read_text(), blockout.read_text()
assert "'coastal-v1'" in identity_source and "?look=classic" not in identity_source
assert "new URLSearchParams(location.search).get('look') === 'classic'" in identity_source
assert "foamBias: 0.61" in identity_source and "choppiness: 0.56" in identity_source
assert "coastalQA ? 0xf0ebdf : 0xe8e3d6" in blockout_source
assert "clock !== 'original'" in identity_source
assert "app.settings.timeSpeed = 0.0025" in identity_source
print("QA coastal-v1 applied: water, atmosphere, exposure, slower day/night cycle and existing waterfront material colors")
print("Fallback: ?look=classic restores original profile; no FFT, geometry, shadow or save changes")
