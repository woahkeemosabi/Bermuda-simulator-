#!/usr/bin/env python3
"""Instrument ONLY the existing pinned /qa/fftcore/ checkout with opt-in FX trials.

Run after tools/prepare_stable_qa.py, before Vite. All effects remain disabled
by default. Each ?fx=<name> removes exactly one fftcore isolation flag.
"""
from pathlib import Path
from shutil import copyfile

root = Path("_qa/fftcore")
src = root / "src/main.js"
assert src.is_file(), "QA checkout is missing"
copyfile("tools/QAEffectTrial.js", root / "src/mobile/QAEffectTrial.js")


def replace_once(old, new):
    data = src.read_text()
    assert data.count(old) == 1, f"QA FX patch anchor mismatch ({data.count(old)}): {old[:110]}"
    src.write_text(data.replace(old, new, 1))


replace_once(
    "import { preloadQAStartupAudio } from './mobile/QAStartupAudio.js';",
    "import { preloadQAStartupAudio } from './mobile/QAStartupAudio.js';\n"
    "import { configureQAEffectTrial } from './mobile/QAEffectTrial.js';",
)

replace_once(
    "configureGpuTraceUrl(url); // FFT on, auxiliary passes off, G=12",
    """configureGpuTraceUrl(url); // FFT on, auxiliary passes off, G=12
        // Re-enable only the explicitly selected subsystem AFTER fftcore
        // isolation. Default is unchanged. App() reads normalized URL next.
        window.__bermudaQAEffectTrial = configureQAEffectTrial(url);""",
)

replace_once(
    "toggle.textContent='GPU TRACE · '+gpuTraceCase.id;",
    """toggle.textContent='GPU TRACE · '+gpuTraceCase.id+
        (window.__bermudaQAEffectTrial && window.__bermudaQAEffectTrial !== 'baseline'
            ? ' + '+window.__bermudaQAEffectTrial : '');""",
)

# Report the actual runtime state so a cached or incorrectly normalized URL
# cannot masquerade as a seven-effect clouds test. Diagnostic-only: no GPU
# passes, materials, rendering settings, or player saves are modified.
audit = root / "src/mobile/GpuAudit.js"
trace = audit.read_text()
old_cloud_line = "  'Cloud experiment '+(typeof window!=='undefined'?(window.__bermudaCloudExperiment||'unknown'):'not browser'),"
assert trace.count(old_cloud_line) == 1, "Cloud diagnostic source anchor changed"
new_cloud_lines = """  'QA selected FX '+(typeof window!=='undefined'?(window.__bermudaQAEffectTrial||'unknown'):'not browser'),
  'QA URL FX '+(typeof location!=='undefined'?(new URLSearchParams(location.search).get('fx')||'none'):'not browser'),
  'QA MarineSnow profile '+(typeof window!=='undefined'?(window.__bermudaQASnowCompatibility||'original'):'not browser'),
  'QA cloud instance '+(app?.clouds?.constructor?.name||'none')+
      ' | panoramaOnly '+(app?.clouds?.mobilePanoramaOnly===true?'YES':'NO'),
  'Cloud experiment '+(typeof window!=='undefined'?(window.__bermudaCloudExperiment||'unknown'):'not browser'),"""
audit.write_text(trace.replace(old_cloud_line, new_cloud_lines, 1))

# Opt-in mobile MarineSnow compatibility trial, preserving the default build.
# The original surface-query dependency pulls terrain, shore and wake resources
# into the tiny particle shader and exceeded iPhone per-stage binding limits.
# Only ?snowCompat=1 omits that heavy dependency, approximating the wave line
# using the already-bound FFT sway. Normal MarineSnow is left untouched.
app_file = root / "src/App.js"
app_source = app_file.read_text()
old_snow_call = "this.marineSnow = new MarineSnow( { fft: this.fft, query: this.query } );"
new_snow_call = """this.marineSnow = new MarineSnow( { fft: this.fft,
            query: mobileLite && qs.get('snowCompat') === '1' ? null : this.query } );
        if (mobileLite && qs.get('snowCompat') === '1')
            window.__bermudaQASnowCompatibility = 'fft-sea-level-waterline';"""
assert app_source.count(old_snow_call) == 1, "MarineSnow App anchor changed"
app_file.write_text(app_source.replace(old_snow_call, new_snow_call, 1))

snow_file = root / "src/fx/MarineSnow.js"
snow_source = snow_file.read_text()
old_fallback = r"waterQueryHeightAtXZ( p.xz ) - p.y );\n' : '' }"
new_fallback = r"waterQueryHeightAtXZ( p.xz ) - p.y );\n' : '\tfade *= smoothstep( 0.0, 0.08, frame.seaLevel + sway.y - p.y );\n' }"
assert snow_source.count(old_fallback) == 1, "MarineSnow shader fallback anchor changed"
snow_file.write_text(snow_source.replace(old_fallback, new_fallback, 1))

# Gameplay-only FPS telemetry. Prior reports divided shader-preload time by
# total frame submissions, understating real play FPS. Reset the clock on
# Explore and keep a bounded 15-second ring of actual visible GPU submissions.
# This is passive instrumentation: no pacing, workload or game logic changes.
replace_once(
    "gpuStage('Starting simulation (audio prepared)');",
    """gpuStage('Starting simulation (audio prepared)');
            window.__bermudaQAGameplay = { startedAt: performance.now(), submissions: 0 };"""
)
audit_source = audit.read_text()
old_submit_line = " a.lastSubmitAt=Math.round(now()-began);"
new_submit_lines = """ a.lastSubmitAt=Math.round(now()-began);
  const qaPlay = typeof window!=='undefined' ? window.__bermudaQAGameplay : null;
  if (qaPlay && (typeof document==='undefined' || document.visibilityState==='visible')) {
    qaPlay.submissions++;
    const t = now();
    const samples = a.qaGameplaySubmissions || (a.qaGameplaySubmissions = []);
    samples.push(t);
    while (samples.length && samples[0] < t-15000) samples.shift();
  }"""
assert audit_source.count(old_submit_line) == 1, "GPU submit telemetry anchor changed"
audit_source = audit_source.replace(old_submit_line, new_submit_lines, 1)
old_report_line = "  'QA MarineSnow profile '+(typeof window!=='undefined'?(window.__bermudaQASnowCompatibility||'original'):'not browser'),"
new_report_lines = """  'QA gameplay FPS last 15s '+(()=>{
    const q = typeof window!=='undefined' ? window.__bermudaQAGameplay : null;
    if (!q) return 'waiting for Explore tap';
    const t=now(),start=Math.max(q.startedAt,t-15000);
    const samples=a.qaGameplaySubmissions||[];
    const elapsedSeconds=(t-start)/1000;
    const fps=elapsedSeconds>=1?(samples.length/elapsedSeconds).toFixed(1):'warming';
    return fps+' | visible gameplay submissions '+q.submissions;
  })(),
  'QA MarineSnow profile '+(typeof window!=='undefined'?(window.__bermudaQASnowCompatibility||'original'):'not browser'),"""
assert audit_source.count(old_report_line) == 1, "Gameplay FPS report insertion anchor changed"
audit.write_text(audit_source.replace(old_report_line, new_report_lines, 1))

# Opt-in panorama GPU budget: the previous iPhone device-loss trace ended
# immediately after repeated full 64x20 cloud panorama dispatches. This is
# correlation, not a proven root cause. ?cloudBudget=lattice forces the same
# 512x160 panorama to refresh in 16x5 workgroup tiles across 16 frames.
# No change to the default clouds path or the working coastal-seven preset.
clouds_file = root / "src/sky/SkyProClouds.js"
clouds_src = clouds_file.read_text()
full_pano_branch = "if ( this.panoWarm ) {\n\n\t\t\tF.pano.value = [ 0, 0, 1, 0 ];"
incremental_branch = "if ( this.panoWarm && ! this.mobileAlwaysIncrementalPanorama ) {\n\n\t\t\tF.pano.value = [ 0, 0, 1, 0 ];"
assert clouds_src.count(full_pano_branch) == 1, "Clouds Panorama full-dispatch anchor changed"
clouds_src = clouds_src.replace(full_pano_branch, incremental_branch, 1)
old_pano_else = "} else {\n\n\t\t\tconst k = this.frameIndex % ( PANO_LATTICE * PANO_LATTICE );"
new_pano_else = "} else {\n\n\t\t\tif ( this.mobileAlwaysIncrementalPanorama ) this.panoWarm = false;\n\t\t\tconst k = this.frameIndex % ( PANO_LATTICE * PANO_LATTICE );"
assert clouds_src.count(old_pano_else) == 1, "Clouds Panorama lattice anchor changed"
clouds_file.write_text(clouds_src.replace(old_pano_else, new_pano_else, 1))

# Activate only on mobile SkyPro panorama clouds and only with the explicit
# diagnostic URL. Do not change cloud quality, weather, or cloud coverage.
app_source = app_file.read_text()
old_cloud_mode = """this.clouds.mobilePanoramaOnly = true;
				window.__bermudaCloudExperiment = 'panorama-only';"""
new_cloud_mode = """this.clouds.mobilePanoramaOnly = true;
				window.__bermudaCloudExperiment = 'panorama-only';
                if (qs.get('fx') === 'coastal-seven' && qs.get('cloudBudget') === 'lattice') {
                    this.clouds.mobileAlwaysIncrementalPanorama = true;
                    window.__bermudaQACloudBudget = 'lattice-16-frame';
                }"""
assert app_source.count(old_cloud_mode) == 1, "App panorama-only setup anchor changed"
app_file.write_text(app_source.replace(old_cloud_mode, new_cloud_mode, 1))

audit_source = audit.read_text()
old_cloud_report = "  'QA cloud instance '+(app?.clouds?.constructor?.name||'none')+"
new_cloud_report = """  'QA source revision coastal-v13',
  'QA cloud panorama budget '+(typeof window!=='undefined'?(window.__bermudaQACloudBudget||'original-full-warm'):'not browser'),
  'QA cloud instance '+(app?.clouds?.constructor?.name||'none')+"""
assert audit_source.count(old_cloud_report) == 1, "Cloud pano budget report anchor changed"
audit.write_text(audit_source.replace(old_cloud_report, new_cloud_report, 1))

# Opt-in A/B: one-time terrain sun-shadow + ground-bounce GPU bake.
# GroundBounce wraps TerrainGPU.updateSunShadow, so freeze AFTER installation
# and AFTER one successful bake. Cascaded object shadows, sky cloud shadows,
# all coastal effects, the FFT and gameplay remain untouched.
# A loss shortly after Terrain Sun Shadow + Ground Bounce is a lead, not proof.
app_source = app_file.read_text()
old_light_setup = "installGroundBounce( { terrain: this.terrainGPU, clouds: this.clouds } );"
new_light_setup = """installGroundBounce( { terrain: this.terrainGPU, clouds: this.clouds } );
        if (mobileLite && qs.get('fx') === 'coastal-seven' && qs.get('lightBake') === 'prime') {
            const originalUpdateSunShadow = this.terrainGPU.updateSunShadow.bind(this.terrainGPU);
            let completedBakes = 0;
            this.terrainGPU.updateSunShadow = (renderer, force = false) => {
                if (completedBakes > 0) return false;
                const baked = originalUpdateSunShadow(renderer, force);
                if (baked) completedBakes++;
                return baked;
            };
            window.__bermudaQALightBake = 'one-time-terrain-plus-bounce';
        }"""
assert app_source.count(old_light_setup) == 1, "Terrain + ground-bounce installation anchor changed"
app_file.write_text(app_source.replace(old_light_setup, new_light_setup, 1))

audit_source = audit.read_text()
old_bake_report = "  'QA source revision coastal-v13',"
new_bake_report = """  'QA source revision coastal-v14',
  'QA light bake '+(typeof window!=='undefined'?(window.__bermudaQALightBake||'normal-rebake'):'not browser'),"""
assert audit_source.count(old_bake_report) == 1, "Light-bake QA report anchor changed"
audit.write_text(audit_source.replace(old_bake_report, new_bake_report, 1))

# Opt-in output-only render-resolution cap for a controlled same-device A/B.
# iPhone reports jumped from 462x817 to 524x927 (+28.7% pixels) while
# gameplay FPS fell from 13.6 to 7.8. The cap reduces ONLY framebuffer
# pixels, preserving CSS sizing, touch coordinates, aspect, FFT, and effects.
# Recompute at every resize so Safari viewport changes do not bypass the cap.
engine_file = root / "src/engine/Engine.js"
engine_src = engine_file.read_text()
old_dpr = "\t\tconst dpr = this.renderScale;"
new_dpr = """        const qaCap = typeof location !== 'undefined'
            && new URLSearchParams(location.search).get('fx') === 'coastal-seven'
            && new URLSearchParams(location.search).get('resCap') === '462';
        const dpr = qaCap
            ? Math.min(this.renderScale, 462 / Math.max(1, w), 817 / Math.max(1, h))
            : this.renderScale;
        if (qaCap && typeof window !== 'undefined')
            window.__bermudaQAResolutionBudget = 'max-462x817';"""
assert engine_src.count(old_dpr) == 1, "Engine output DPR resize anchor changed"
engine_file.write_text(engine_src.replace(old_dpr, new_dpr, 1))

audit_source = audit.read_text()
old_revision = "  'QA source revision coastal-v14',"
new_revision = """  'QA source revision coastal-v15',
  'QA resolution budget '+(typeof window!=='undefined'?(window.__bermudaQAResolutionBudget||'original-output'):'not browser'),"""
assert audit_source.count(old_revision) == 1, "QA revision diagnostic anchor changed"
audit.write_text(audit_source.replace(old_revision, new_revision, 1))

# QA-only night-scene grading trial. The screenshots show bright cloud tiles
# on a nearly black sky and overly turquoise water at 19:22. Do not alter
# FFT simulation, sky LUTs, the weather preset, asset textures or the game clock.
# All edits are behind ?fx=coastal-seven&nightVisual=1; default WGSL stays intact.
night_guard = "const QA_NIGHT_VISUAL = typeof location !== 'undefined' && new URLSearchParams(location.search).get('fx') === 'coastal-seven' && new URLSearchParams(location.search).get('nightVisual') === '1';\n\n"

sky_file = root / 'src/sky/Sky.js'
sky_src = sky_file.read_text()
sky_class = 'export class Sky {'
assert sky_src.count(sky_class) == 1, 'Sky QA guard insertion anchor changed'
sky_src = sky_src.replace(sky_class, night_guard + sky_class, 1)
sky_base = 'var L = atmosphereSkyLuminance( dir );'
sky_night = '''var L = atmosphereSkyLuminance( dir );
${ QA_NIGHT_VISUAL ? `
    // Low-cost coastal twilight and moonlit horizon, no additional passes.
    let duskSun = atmosphereParams.sunDir.y;
    let dusk = smoothstep( -0.24, -0.065, duskSun ) * ( 1.0 - smoothstep( -0.025, 0.06, duskSun ) );
    let horizon = exp( -max( dir.y, 0.0 ) * 7.0 ) * smoothstep( -0.07, 0.03, dir.y );
    L += horizon * ( vec3f( 0.011, 0.020, 0.040 ) * dusk + vec3f( 0.0025, 0.0050, 0.0100 ) * frame.night );
` : '' }'''
assert sky_src.count(sky_base) == 1, 'Sky night haze anchor changed'
sky_file.write_text(sky_src.replace(sky_base, sky_night, 1))

clouds_src = clouds_file.read_text()
clouds_class = 'export class SkyProClouds {'
assert clouds_src.count(clouds_class) == 1, 'Clouds QA guard anchor changed'
clouds_src = clouds_src.replace(clouds_class, night_guard + clouds_class, 1)
clouds_store = 'textureStore( scPano, texel, vec4f( m.color, 1.0 - m.alpha ) );'
clouds_night = '''${ QA_NIGHT_VISUAL ? `
    // Tone moonlit radiance down at the source rather than running a fullscreen filter.
    let nocturnal = smoothstep( 0.27, 0.90, frame.night );
    let moonCloud = min( m.color * vec3f( 0.12, 0.17, 0.23 ),
        vec3f( 0.016, 0.022, 0.033 ) * m.alpha );
    let cloudRadiance = mix( m.color, moonCloud, nocturnal );
    textureStore( scPano, texel, vec4f( cloudRadiance, 1.0 - m.alpha ) );
` : `textureStore( scPano, texel, vec4f( m.color, 1.0 - m.alpha ) );` }'''
assert clouds_src.count(clouds_store) == 1, 'Cloud panorama radiance anchor changed'
clouds_file.write_text(clouds_src.replace(clouds_store, clouds_night, 1))

water_file = root / 'src/ocean/WaterMaterial.js'
water_src = water_file.read_text()
water_class = 'export class WaterMaterial extends Material {'
assert water_src.count(water_class) == 1, 'Water QA guard anchor changed'
water_src = water_src.replace(water_class, night_guard + water_class, 1)
water_output = '\tr.color = vec4f( res, 1.0 );'
water_night = '''${ QA_NIGHT_VISUAL ? `
    // The same ocean optics, reduced tropical-water radiance after sunset.
    // Keep underwater and all material debug modes unchanged.
    if ( dbg == 0 && in.front ) {
        let nocturnal = smoothstep( 0.24, 0.90, frame.night );
        res = mix( res, res * vec3f( 0.28, 0.40, 0.55 ), nocturnal * 0.75 );
    }
` : '' }
\tr.color = vec4f( res, 1.0 );'''
assert water_src.count(water_output) == 1, 'Water radiance output anchor changed'
water_file.write_text(water_src.replace(water_output, water_night, 1))

audit_src = audit.read_text()
old_rev = "  'QA source revision coastal-v15',"
new_rev = """  'QA source revision coastal-v16',
  'QA night visual '+(typeof location!=='undefined' && new URLSearchParams(location.search).get('fx')==='coastal-seven' && new URLSearchParams(location.search).get('nightVisual')==='1'?'sky-cloud-water':'off'),"""
assert audit_src.count(old_rev) == 1, 'Night visual QA report anchor changed'
audit.write_text(audit_src.replace(old_rev, new_rev, 1))

# Actual QA game vendor characters are Joe and Martha in src/game/Vendor.js.
# v17 inadvertently targeted ProductionMeshyAssets.js, which is not imported
# by the pinned /qa/fftcore/ startup. Remove that inert patch. Both 'char0..5'
# allocations are vendor GLBs: label each by owner for unambiguous GPU reports.
# Opt-in ?vendorLoad=focus loads each unchanged, full-res GLB only within 3m
# instead of 6m. Existing vendor UI/fallbacks, saves and graphics are intact.
vendor_file = root / "src/game/Vendor.js"
vendor_src = vendor_file.read_text()
old_vendor_import = "import { createPropMaterial, PAT } from './GameMaterials.js';"
new_vendor_import = """import { createPropMaterial, PAT } from './GameMaterials.js';

const QA_VENDOR_FOCUS = typeof location !== 'undefined'
    && new URLSearchParams(location.search).get('fx') === 'coastal-seven'
    && new URLSearchParams(location.search).get('vendorLoad') === 'focus';"""
assert vendor_src.count(old_vendor_import) == 1, "QA Vendor import anchor changed"
vendor_src = vendor_src.replace(old_vendor_import, new_vendor_import, 1)

old_vendor_load = "const model = await SkinnedModel.create( await loadGLB( url ) );"
new_vendor_load = """const gltf = await loadGLB( url );
        if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('fx') === 'coastal-seven')
            gltf.__bermudaTextureRole = this.kind === 'buyer' ? 'joe' : 'martha';
        const model = await SkinnedModel.create( gltf );"""
assert vendor_src.count(old_vendor_load) == 1, "QA Vendor GLB creation anchor changed"
vendor_src = vendor_src.replace(old_vendor_load, new_vendor_load, 1)

old_range = "if ( dx * dx + dz * dz < 6 * 6 ) {"
new_range = """const radius = QA_VENDOR_FOCUS ? Math.min(this.radius, 3.0) : 6;
            if (dx * dx + dz * dz < radius * radius) {"""
assert vendor_src.count(old_range) == 1, "QA Vendor proximity anchor changed"
vendor_file.write_text(vendor_src.replace(old_range, new_range, 1))

# Character GPU resource labels retain their original format outside the QA.
skin_file = root / "src/engine/render/Skinning.js"
skin_source = skin_file.read_text()
old_label = "label: 'char' + src"
new_label = "label: g.__bermudaTextureRole ? 'char.' + g.__bermudaTextureRole + '.' + src : 'char' + src"
assert skin_source.count(old_label) == 1, "Skinned texture label anchor changed"
skin_file.write_text(skin_source.replace(old_label, new_label, 1))

audit_source = audit.read_text()
old_rev = "  'QA source revision coastal-v16',"
new_rev = """  'QA source revision coastal-v18',
  'QA vendor texture load '+(typeof location!=='undefined' && new URLSearchParams(location.search).get('fx')==='coastal-seven' && new URLSearchParams(location.search).get('vendorLoad')==='focus'?'focus-3m':'legacy-6m'),
  'QA vendor GLBs '+((app?.game?.vendors||[]).map(v=>{
    const p=app?.player?.position;
    const distance=p?Math.hypot(p.x-v.position.x,p.z-v.position.z).toFixed(1):'unknown';
    const state=v.character?'loaded':(v._pendingCharacter?'deferred':'loading');
    return (v.kind==='buyer'?'Joe':'Martha')+':'+state+'@'+distance+'m';
  }).join(' | ')||'not-ready'),"""
assert audit_source.count(old_rev) == 1, "QA vendor report revision anchor changed"
audit.write_text(audit_source.replace(old_rev, new_rev, 1))

# Remove the artificial continuous waterfront road that crosses the launch
# beach in the iPhone screenshots. The pinned QA checkout predates this fix in
# src/world/, so patch the isolated checkout as well as the main source tree.
# Remove colliders at the same time: never leave an invisible beach barrier.
blockout_file = root / 'src/world/BermudaBlockout.js'
blockout_source = blockout_file.read_text()
road_strip = "box(M.asphalt,-68,1.43,-49.2,34,.18,5,0,true,'bermuda-road',true);"
assert blockout_source.count(road_strip) == 1, "Harbour central road source anchor changed"
blockout_source = blockout_source.replace(road_strip,
    "// Central elevated asphalt road and its collider removed: public beach is open.", 1)
assert "bermuda-road',true" not in blockout_source, "Central road collider remains"
assert "bermuda-landing',true" in blockout_source, "Dock approach was inadvertently removed"
assert "bermuda-shop-apron',true" in blockout_source, "Vendor apron was inadvertently removed"
blockout_file.write_text(blockout_source)

upgrade_file = root / 'src/world/ReferenceWorldUpgrade.js'
upgrade_src = upgrade_file.read_text()
extension_start = "\t// Continue the waterfront road in both directions."
extension_end = "\t// Keep the waterfront empty. Houses, garden walls, gateposts and shrubs are not spawned here."
assert upgrade_src.count(extension_start) == 1, "Harbour road extensions start anchor changed"
assert upgrade_src.count(extension_end) == 1, "Harbour road extensions end anchor changed"
start_i = upgrade_src.index(extension_start)
end_i = upgrade_src.index(extension_end, start_i)
assert end_i > start_i, "Waterfront road patch bounds invalid"
upgrade_src = (upgrade_src[:start_i] +
    "\t// Artificial road extensions, walkable colliders and raised footway removed.\n"
    "\t// Preserve an open beach and the original reference-upgrade runtime API.\n\n" +
    upgrade_src[end_i:])
assert "bermuda-road-extension" not in upgrade_src, "Invisible road extension collider remains"
assert "bermuda-footway" not in upgrade_src, "Invisible footway collider remains"
upgrade_file.write_text(upgrade_src)

audit_src = audit.read_text()
old_rev = "  'QA source revision coastal-v18',"
new_rev = """  'QA source revision coastal-v19',
  'QA beach road removed central-plus-two-extensions-and-footway',"""
assert audit_src.count(old_rev) == 1, "Beach visual fix QA report revision anchor changed"
audit.write_text(audit_src.replace(old_rev, new_rev, 1))


# Coastal v20: actual dock scene fix, not a rendered mockup.
# Remove the five landward steps and create stepped access at the ocean-facing
# far end of the pier. Preserve original dock/vendor/boat scene and colliders.
# Sign panels use ONLY a B lettermark + "BERMUDA SIMULATOR" typography;
# no Tidewater art, icon or logo is loaded, sampled, or drawn.
blockout_file = root / "src/world/BermudaBlockout.js"
bsrc = blockout_file.read_text()
old_steps = """ // Smooth the final dock-to-road rise into five shallow walkable terraces. The old 0.5 m step
 // forced mobile players to use UP just to reach RELIC; normal navigation should not require a jump.
 const approachTops=[1.10,1.20,1.30,1.40,1.50];
 for(let i=0;i<approachTops.length;i++){
  const top=approachTops[i],z=-43.45-i*.82,h=top-.90;
  box(M.wood,-65,.90+h*.5,z,5.2,h,.90,0,true,'bermuda-approach-ramp',true);
 }"""
new_steps = """ // Bermuda dock: stairs belong at the SEAWARD end, not across the beach approach.
 // Five real, collidable treads lead onto a raised outer landing; the land side is clear.
 const outerTops=[1.10,1.20,1.30,1.40,1.50];
 visualKey='outer-steps';
 for(let i=0;i<outerTops.length;i++){
  const top=outerTops[i],z=-17.45+i*.85,h=top-.90;
  box(M.wood,-65,.90+h*.5,z,4.5,h,.90,0,true,'bermuda-outer-step',true);
 }
 box(M.wood,-65,1.20,-11.25,4.5,.60,4.9,0,true,'bermuda-outer-step-landing',true);
 visualKey='approach';"""
assert bsrc.count(old_steps) == 1, "Pinned dock stairs anchor changed"
bsrc = bsrc.replace(old_steps, new_steps, 1)

old_import = "import { Material } from '../engine/render/Material.js';"
new_import = """import { Material } from '../engine/render/Material.js';
import { PlaneGeometry } from '../engine/index.js';
import { Texture } from '../engine/gpu/Texture.js';
import { generateMipmaps } from '../engine/gpu/Mipmaps.js';
import { standard } from '../materials/Materials.js';"""
assert bsrc.count(old_import) == 1, "Dock branding import anchor changed"
bsrc = bsrc.replace(old_import, new_import, 1)

old_boot = " scene.add(group);"
new_boot = """ // One shared design language; original B typographic mark, never the Tidewater icon.
 // Both boards stand outside the 5.2m central path, with no collision barrier.
 if(typeof document!=='undefined'){
  const makeSign=(x,z,kind)=>{
   const ground=Math.max(.65,terrain.heightAt(x,z));
   const canvas=document.createElement('canvas');
   canvas.width=512; canvas.height=256;
   const c=canvas.getContext('2d');
   c.fillStyle='#061d2b';c.fillRect(0,0,512,256);
   c.strokeStyle='#3dd2c5';c.lineWidth=9;c.strokeRect(7,7,498,242);
   c.fillStyle='#ef9979';c.fillRect(22,18,6,222);
   c.textAlign='left';
   if(kind==='brand'){
    c.fillStyle='#f1b18a';c.font='900 118px sans-serif';c.fillText('B',44,146);
    c.fillStyle='#f0faf9';c.font='bold 45px sans-serif';c.fillText('BERMUDA',180,88);
    c.fillText('SIMULATOR',180,135);
    c.fillStyle='#58d8ce';c.font='bold 22px sans-serif';
    c.fillText('FISH  /  EXPLORE  /  UPGRADE',45,214);
   }else{
    c.fillStyle='#f1b18a';c.font='bold 39px sans-serif';c.fillText('B  BERMUDA SIMULATOR',36,68);
    c.fillStyle='#54dcd0';c.font='bold 31px sans-serif';c.fillText('WELCOME TO THE DOCK',36,122);
    c.fillStyle='#f8faf7';c.font='bold 27px sans-serif';
    c.fillText('JOE  -  FISH MARKET',36,173);
    c.fillText('MARTHA  -  BAIT & TACKLE',36,217);
   }
   const texture=new Texture({label:'bermudaDockSign.'+kind,width:512,height:256,format:'rgba8unorm-srgb',mips:true,usage:['sample','render','copyDst']});
   texture.upload(c.getImageData(0,0,512,256).data);
   generateMipmaps(texture);
   const material=standard({name:'bermudaDockSign.'+kind,roughness:.82,side:'front',
     textures:{bermudaSignInk:texture},
     surface:"let ink = textureSample( bermudaSignInk, smpLinearClamp, vec2f( in.uv.x, 1.0-in.uv.y ) ).rgb; s.albedo = ink; s.emissive = ink * 0.12 * smoothstep( 0.15, 0.8, frame.night );"});
   visualKey='dock-brand-signs';
   // Dark backer and twin poles. No collision to block beach navigation.
   box(M.dark,x,ground+2.0,z,2.85,1.55,.11);
   for(const dx of [-1.02,1.02])box(M.wood,x+dx,ground+1.15,z,.11,2.25,.11);
   for(const face of [-1,1]){
    const board=new Mesh(new PlaneGeometry(2.7,1.36),material);
    board.name='BermudaSimulatorSign.'+kind;
    board.position.set(x,ground+2,z+face*.07);
    board.rotation.y=face<0?Math.PI:0;
    board.castShadow=false;board.receiveShadow=false;group.add(board);
   }
  };
  makeSign(-72.7,-52.5,'brand');
  makeSign(-57.2,-52.5,'wayfinding');
 }
 scene.add(group);"""
assert bsrc.count(old_boot)==1, "Dock scene boot insertion anchor changed"
bsrc=bsrc.replace(old_boot,new_boot,1)
blockout_file.write_text(bsrc)

audit_src=audit.read_text()
old_marker="  'QA source revision coastal-v19',"
new_marker="""  'QA source revision coastal-v20',
  'QA dock stairs seaward-END (five physical treads plus outer landing)',
  'QA signs Bermuda Simulator B-lettermark only (no Tidewater brand)',"""
assert audit_src.count(old_marker)==1,"Dock QA revision anchor changed"
audit.write_text(audit_src.replace(old_marker,new_marker,1))

out = src.read_text()
assert out.count("configureQAEffectTrial(url)") == 1
assert "const gpuTraceCase = getGpuTraceCase('fftcore')" in out
assert "getFftCoreVisualProfile('crisp')" in out
assert "window.__bermudaMobilePaceMs" in out
print("QA effects and runtime cloud diagnostics installed; opt-in MarineSnow compatibility path available")
