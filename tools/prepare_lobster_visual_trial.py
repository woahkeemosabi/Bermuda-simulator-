#!/usr/bin/env python3
"""Optional iPhone QA lobster silhouette experiment; the default game is unchanged.

Run after the pinned FFT-core QA patcher. Activate with ?assetTrial=lobster-v1
and compare to the same QA URL without assetTrial. This does not touch game
state, ocean, lighting, graphics budget, collision or catch calculations.
"""
from pathlib import Path

file = Path("_qa/fftcore/src/game/Lobsters.js")
assert file.is_file(), "Pinned QA lobster source missing"

def change(old, new):
    src = file.read_text()
    n = src.count(old)
    assert n == 1, f"Lobster patch anchor mismatch ({n}): {old[:85]!r}"
    file.write_text(src.replace(old, new, 1))

change(
    "function lobsterGeometry() {\n\n\tconst parts = [];",
    """function lobsterGeometry() {

    // Entirely opt-in: the stable original mesh remains byte-for-byte
    // geometrically identical unless the trial query flag is present.
    const visualTrial = typeof location !== 'undefined' &&
        new URLSearchParams(location.search).get('assetTrial') === 'lobster-v1';
    if (typeof window !== 'undefined')
        window.__bermudaLobsterVisualTrial = visualTrial ? 'lobster-v1' : 'original';

\tconst parts = [];""",
)
change(
    "\tadd( sphere( 0.23, 20, 12 ), BODY, 0.5, mat4( 0, 0.15, 0.08, 0, 0, 0, 1.05, 0.48, 1.22 ) );",
    """\tadd( sphere( 0.23, 20, 12 ), BODY, 0.5, mat4( 0, 0.15, 0.08, 0, 0, 0,
        1.05, visualTrial ? 0.65 : 0.48, visualTrial ? 1.27 : 1.22 ) );
    if (visualTrial) {
        // Contrasting pale carapace markings and curved head horns, recognisable
        // Caribbean spiny lobster details instead of a featureless oval.
        for (const s of [ -1, 1 ]) {
            add( sphere(0.042, 9, 7), CREAM, 0.66,
                mat4(s * 0.165, 0.230, 0.10, 0, 0, 0, 0.76, 0.18, 1.1));
            add( rod(new Vector3(s * 0.105, 0.25, 0.22),
                new Vector3(s * 0.15, 0.34, 0.38), 0.017, 7, 0.003), SHELL, 0.65);
            for (let i=0; i<3; i++) {
                const z = 0.15 - i * 0.11;
                add(sphere(0.012, 7, 5), CREAM, 0.6,
                    mat4(s * (0.19 - i*0.006), 0.22, z));
            }
        }
    }""",
)
change(
    "\t\tadd( sphere( r, 16, 8 ), i % 2 ? BODY : SHELL, 0.56, mat4( 0, 0.12 - i * 0.004, z, 0, 0, 0, 1.05, 0.42, 0.72 ) );",
    """\t\tadd( sphere( r, 16, 8 ), i % 2 ? BODY : SHELL, 0.56,
            mat4( 0, 0.12 - i * 0.004, z, 0, 0, 0,
                1.05, visualTrial ? 0.58 : 0.42, visualTrial ? 0.78 : 0.72 ) );
        if (visualTrial) {
            // Thin transverse pale band; a flattened ellipsoid keeps all
            // detailing within the ONE already-merged lobster mesh.
            add(sphere(r * 0.98, 14, 7), CREAM, 0.7,
                mat4(0, 0.126 - i * 0.004, z - 0.047, 0, 0, 0, 1.02, 0.12, 0.13));
            for (const s of [-1,1])
                add(sphere(0.016, 8, 6), JOINT, 0.7,
                    mat4(s * (r * 0.82), 0.15, z - 0.02));
        }""",
)
change(
    "\t\tadd( rod( b, c, 0.011, 7, 0.003 ), JOINT, 0.5 );",
    """\t\tadd( rod( b, c, 0.011, 7, 0.003 ), JOINT, 0.5 );
        if (visualTrial) {
            // Long tapered feelers and pale joints make the species legible
            // at mobile gameplay distance. No animation or new shader.
            const tip = new Vector3(s * 0.62, 0.32, 1.40);
            add(rod(c, tip, 0.006, 6, 0.001), BODY, 0.62);
            for (const t of [0.23, 0.52, 0.80]) {
                const p = new Vector3().copy(b).lerp(c, t);
                add(sphere(0.012, 7, 5), CREAM, 0.68,
                    mat4(p.x, p.y, p.z, 0, 0, 0, 1, 0.68, 1.3));
            }
        }""",
)
change(
    "\treturn mergePrepared( parts );",
    """\treturn mergePrepared( parts );""",
)
out = file.read_text()
assert out.count("visualTrial") >= 6
assert "this.drawDistance = ULTRA_DENSITY ? 58 : 42;" in out
assert "this.place( count );" in out
assert "target( origin, direction, maxDist = 1.8 )" in out
assert "grab( origin, direction, maxDist = 1.8 )" in out
print("Opt-in lobster silhouette trial installed; default appearance and catch logic unchanged")
