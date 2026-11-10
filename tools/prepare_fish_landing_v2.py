#!/usr/bin/env python3
"""Improve the isolated GitHub Pages fishing test, without changing production or stable QA.

Run only after tools/patches/fish-landing.patch has been applied to _qa/fftcore.
All modifications are pinned-source assertions: fail the build rather than silently drift.
"""
from pathlib import Path

ROOT = Path("_qa/fftcore")
assert (ROOT / "src/game/Game.js").is_file(), "Expected prepared, pinned iPhone QA checkout"

def replace_once(relative, before, after):
    file = ROOT / relative
    source = file.read_text()
    count = source.count(before)
    assert count == 1, f"{relative}: expected one matching anchor; found {count}: {before[:90]!r}"
    file.write_text(source.replace(before, after, 1))

# Hold the actual fish on the line for eight seconds. The existing rod moves it
# out of the water in the first 600ms and the same batched fish mesh keeps rendering.
replace_once("src/game/Game.js",
    "const LANDING_SECONDS = 3.3;",
    "const LANDING_SECONDS = 8.0;")
replace_once("src/game/Game.js",
    "rod.t >= 0.45 && this.hud && L.info",
    "rod.t >= 0.7 && this.hud && L.info")
replace_once("src/game/Game.js",
    "this.hud.showDiveCatch( L.info, 'LANDED' );",
    "this.hud.showLandedCatch( L.info );")
replace_once("src/game/Game.js",
    "if ( this.hud && this.hud.catchOpen ) this.hud.hideCatch();",
    "if ( this.hud && this.hud.catchOpen ) this.hud.hideCatch();\n\t\tif ( this.hud ) this.hud.hideLandedCatch();")

# No new canvas/WebGPU pass: use the existing DOM overlay, but keep it visible
# until the fish has actually gone into the cooler.
new_style = """
/* Fishing catch stays visible during the eight-second in-world lift.
   No blur and no interaction capture: the 3D fish and gameplay remain visible. */
.gm-dive-catch.is-landing {
  animation: none; opacity: 1; transform: translate(-50%, 0);
  top: max(88px, 12vh); min-width: 0; width: min(90vw, 430px); box-sizing: border-box;
  padding: 12px 16px; background: rgba(5, 26, 38, 0.94);
  border: 1px solid rgba(var(--tw-aqua-rgb), 0.5); pointer-events: none;
}
.gm-dive-catch.is-landing .gm-dive-catch-kicker { font-size: 11px; letter-spacing: 0.22em; }
.gm-dive-catch.is-landing strong { font-size: clamp(23px, 6vw, 34px); line-height: 1.15; margin-top: 6px; }
.gm-dive-catch.is-landing .gm-dive-catch-meta { font-size: clamp(12px, 3.4vw, 16px); line-height: 1.5; margin-top: 7px; }
.gm-dive-catch.is-landing .gm-dive-catch-status { font-size: clamp(12px, 3.2vw, 15px); font-weight: 750; margin-top: 7px; }
"""
replace_once("src/game/GameHUD.js",
    "/* catch card: full screen.",
    new_style + "\n/* catch card: full screen.")

new_methods = """
\t// In-world rod landing: readable, persistent fish identification on iPhone.
\t// Reuse diveCatch's DOM; unlike spear catches, this does not fade after 3.1s.
\tshowLandedCatch( info ) {

\t\tconst f = FISH[ info.species ];
\t\tif ( ! f || ! this.diveCatch ) return;
\t\tlet status = info.kept ? ( info.record ? 'NEW RECORD · IN COOLER' : info.newSpecies ? 'NEW SPECIES · IN COOLER' : 'ADDED TO COOLER' ) : 'RELEASED';
\t\tif ( info.protectedSpecies ) status = 'PROTECTED · RELEASED';
\t\telse if ( info.legalSize === false ) status = 'UNDERSIZE · RELEASED';
\t\telse if ( ! info.kept ) status = 'COOLER FULL · RELEASED';
\t\tconst detail = info.cm + ' cm · ' + info.kg.toFixed( 2 ) + ' kg';
\t\tconst value = info.kept ? ' · BMD $' + info.value : '';
\t\tthis.diveCatch.innerHTML = '<div class="gm-dive-catch-kicker">YOUR CATCH</div><strong>' + f.name + '</strong>' +
\t\t\t'<div class="gm-dive-catch-meta">' + detail + value + '</div>' +
\t\t\t'<div class="gm-dive-catch-status ' + ( info.kept ? '' : 'is-release' ) + '">' + status + '</div>';
\t\tthis.diveCatch.classList.remove( 'is-on' );
\t\tthis.diveCatch.classList.add( 'is-landing' );

\t}

\thideLandedCatch() {

\t\tif ( this.diveCatch ) this.diveCatch.classList.remove( 'is-landing', 'is-on' );

\t}

"""
replace_once("src/game/GameHUD.js",
    "\t// ---- catch card\n",
    new_methods + "\t// ---- catch card\n")

# The crash is not conclusively attributed. The user's GPU trace nevertheless
# shows 12 fully resident 1024px trader textures consuming ~65MiB including mips.
# Allow selective downsampling before GPU upload for traders only on iPhones.
# Every other game texture, FFT ocean, shadow cascade, and effect remains unchanged.
replace_once("src/engine/render/Skinning.js",
    "await m._buildMeshes( materials );",
    "await m._buildMeshes( materials, textureSize );")
replace_once("src/engine/render/Skinning.js",
    "async _buildMeshes( materialOptions ) {",
    "async _buildMeshes( materialOptions, textureSize = null ) {")
replace_once("src/engine/render/Skinning.js",
    "const px = await decodeImage( im.bytes, im.mimeType );",
    "const px = await decodeImage( im.bytes, im.mimeType, textureSize );")

replace_once("src/engine/loaders/GLTF.js",
    "export async function decodeImage( bytes, mimeType ) {",
    "export async function decodeImage( bytes, mimeType, maxSize = null ) {")
replace_once("src/engine/loaders/GLTF.js",
    "if ( globalThis.__assetImage ) return globalThis.__assetImage( bytes, mimeType );",
    "if ( globalThis.__assetImage && ! maxSize ) return globalThis.__assetImage( bytes, mimeType );")
replace_once("src/engine/loaders/GLTF.js",
    """\tconst cv = new OffscreenCanvas( bmp.width, bmp.height );
\tconst ctx = cv.getContext( '2d', { willReadFrequently: true } );
\tctx.drawImage( bmp, 0, 0 );
\tconst width = bmp.width, height = bmp.height;
""",
    """\tconst factor = maxSize && maxSize > 0 ? Math.min( 1, maxSize / Math.max( bmp.width, bmp.height ) ) : 1;
\tconst width = Math.max( 1, Math.round( bmp.width * factor ) ), height = Math.max( 1, Math.round( bmp.height * factor ) );
\tconst cv = new OffscreenCanvas( width, height );
\tconst ctx = cv.getContext( '2d', { willReadFrequently: true } );
\tctx.drawImage( bmp, 0, 0, width, height );
""")

replace_once("src/game/Vendor.js",
    "const model = await SkinnedModel.create( gltf );",
    """const compactTextures = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test( navigator.userAgent ) ? 512 : null;
        const model = await SkinnedModel.create( gltf, { textureSize: compactTextures } );""")

game = (ROOT / "src/game/Game.js").read_text()
hud = (ROOT / "src/game/GameHUD.js").read_text()
skin = (ROOT / "src/engine/render/Skinning.js").read_text()
glb = (ROOT / "src/engine/loaders/GLTF.js").read_text()
vendor = (ROOT / "src/game/Vendor.js").read_text()
assert "const LANDING_SECONDS = 8.0;" in game
assert "this.hud.showLandedCatch( L.info );" in game
assert "this.hud.hideLandedCatch();" in game
assert "this.hud.showCatch( L.card" not in game
assert "gpuPlayerMovement( p, inp, this.vendors );" in game
assert "showLandedCatch( info )" in hud and "BMD $" in hud
assert "decodeImage( im.bytes, im.mimeType, textureSize )" in skin
assert "maxSize / Math.max( bmp.width, bmp.height )" in glb
assert "textureSize: compactTextures" in vendor
assert "vendor" in vendor.lower()
print("Fish landing v2: 8-second actual 3D fish, persistent species details, iPhone-only 512px vendor textures")
