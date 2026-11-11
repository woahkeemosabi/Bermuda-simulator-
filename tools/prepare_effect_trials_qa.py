#!/usr/bin/env python3
"""Instrument pinned FFT-core source with restored default Coastal seven FX.

Run after tools/prepare_stable_qa.py, before Vite. Unparameterized main and QA
URLs now activate user-tested seven-effect coastal settings. ?fx=baseline
remains an explicitly selected isolation test. MarineSnow/AirMotes stay off.
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
        // Restore user-tested seven-effect coastal preset AFTER the FFT isolation.
        // Only explicit ?fx=baseline keeps the GPU isolation profile.
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


# Coastal v23 emergency iPhone device-loss isolation.
# v22 added a unique pixel-level noise WGSL material to the pier and the new
# crash trace reached only 46 submits in 82 seconds / 3.5 FPS before device
# loss. Single-variable rollback: remove shader, keep the grey concrete colour,
# seven concrete expansion joints, coping, v21 steps and collision geometry.
# This is not proof the shader caused the device loss; it tests that hypothesis.
blockout_file = root / 'src/world/BermudaBlockout.js'
canonical_blockout = Path(__file__).resolve().parents[1] / 'src/world/BermudaBlockout.js'
concrete_source = canonical_blockout.read_text()
assert "concrete:makeMaterial('weathered-pier-concrete',0xc9ceca,.98)" in concrete_source
assert "makePierConcrete" not in concrete_source
assert "mat.surface=" not in concrete_source
assert "bermuda-beach-pier-step',true" in concrete_source
assert "bermuda-shop-apron',true" in concrete_source
assert "bermuda-landing-head',true" in concrete_source
assert "const joints=new InstancedMesh(GEO.box,M.joint,7)" in concrete_source
assert "visualKey='pier-coping'" in concrete_source
assert "M.wood" not in concrete_source and "const planks=" not in concrete_source
assert "bermuda-outer-step" not in concrete_source
assert "BermudaSimulatorSign" not in concrete_source and "bermudaDockSign" not in concrete_source
assert "bermuda-road',true" not in concrete_source
blockout_file.write_text(concrete_source)

audit_src = audit.read_text()
old_marker = "  'QA source revision coastal-v19',"
new_marker = """  'QA source revision coastal-v23',
  'QA dock access landward-beach-to-pier (adaptive treads)',
  'QA added signs NONE',
  'QA pier material pale-concrete shader-free (no procedural fragment work)',
  'QA pier deck 7 concrete expansion joints (no wooden plank strips)',"""
assert audit_src.count(old_marker) == 1, "Coastal v23 report anchor changed"
audit.write_text(audit_src.replace(old_marker, new_marker, 1))


# Coastal v24: opt-in iPhone performance profiling and guarded 60 Hz pacing.
# ?perf=profile leaves the existing 42ms pacing untouched while capturing data.
# ?perf=60 raises the *target*, NEVER exceeds one in-flight GPU submission.
# ?perf=60&simBudget=balanced decouples visual-only caustics, shore sim and
# panorama clouds from the FFT/physics frame rate. Their textures persist.
# No change to default QA or production visuals, physics, save or performance.
qa_engine_file = root / 'src/engine/Engine.js'
qa_engine = qa_engine_file.read_text()
old_mobile_gate = "if ( this._gpuInFlight || ( this._mobileLastFrame && t - this._mobileLastFrame < (window.__bermudaMobilePaceMs || 42) ) ) return;"
new_mobile_gate = """if ( this._gpuInFlight ) {
                    if ( qaPerf ) qaPerf.skippedInFlight++;
                    return;
                }
                const minInterval = this.mobileGpuTargetIntervalMs || 42;
                if ( this._mobileLastFrame && t - this._mobileLastFrame < minInterval ) {
                    if ( qaPerf ) qaPerf.skippedPacing++;
                    return;
                }"""
assert qa_engine.count(old_mobile_gate)==1, "FPS scheduler gate changed"
qa_engine=qa_engine.replace(old_mobile_gate,new_mobile_gate,1)
old_rafs = "this._raf = requestAnimationFrame( loop );\n\t\t\tif ( this.mobileGpuFramePacing ) {"
new_rafs = """this._raf = requestAnimationFrame( loop );
            const qaPerf = typeof window !== 'undefined' ? window.__bermudaQAPerf : null;
            if ( qaPerf ) qaPerf.rafTicks++;
			if ( this.mobileGpuFramePacing ) {"""
assert qa_engine.count(old_rafs)==1, "Frame-loop measurement anchor changed"
qa_engine=qa_engine.replace(old_rafs,new_rafs,1)
old_update = "update( dt, this.clock.getElapsed() );"
new_update = """const qaCpuStart = qaPerf ? performance.now() : 0;
                update( dt, this.clock.getElapsed() );
                if ( qaPerf ) qaPerf.push('cpuFrame', performance.now()-qaCpuStart);"""
assert qa_engine.count(old_update)==1, "Frame CPU measurement anchor changed"
qa_engine=qa_engine.replace(old_update,new_update,1)
old_submit_callback = "GPU.queue.onSubmittedWorkDone().then( () => {\n\t\t\t\t\t\tgpuQueueAck(submittedFrame);"
new_submit_callback = """const qaAckStart = qaPerf ? performance.now() : 0;
                    GPU.queue.onSubmittedWorkDone().then( () => {
                        if ( qaPerf ) qaPerf.push('submitAckWall', performance.now()-qaAckStart);
						gpuQueueAck(submittedFrame);"""
assert qa_engine.count(old_submit_callback)==1, "GPU ack telemetry anchor changed"
qa_engine_file.write_text(qa_engine.replace(old_submit_callback,new_submit_callback,1))

qa_main_init = """		app.engine.mobileGpuFramePacing = mobileFastStart;"""
qa_main_new = """        // QA-only performance study: preserve Safari's one-in-flight safety gate.
        // 'profile' is a 42ms baseline. '60' removes only the pacing ceiling;
        // actual FPS remains limited by CPU time and GPU completion.
        const qaPerfQuery = new URLSearchParams(location.search);
        const qaPerfMode = mobileFastStart && qaPerfQuery.get('fx') === 'coastal-seven'
            ? qaPerfQuery.get('perf') : null;
        if (qaPerfMode === 'profile' || qaPerfMode === '60') {
            const qa = {
                mode: qaPerfMode, requestedFps: qaPerfMode === '60' ? 60 : 24,
                rafTicks:0, skippedInFlight:0, skippedPacing:0,
                samples:{}, lastMark:0, lastStage:null,
                push(key,ms){
                    if (!Number.isFinite(ms)) return;
                    const arr=this.samples[key]||(this.samples[key]=[]);
                    arr.push(ms);
                    if(arr.length>120)arr.shift();
                },
                pct(key,p){
                    const arr=this.samples[key]||[];
                    if(!arr.length)return 'warming';
                    const sorted=arr.slice().sort((a,b)=>a-b);
                    return sorted[Math.min(sorted.length-1,Math.floor((sorted.length-1)*p))].toFixed(1)+'ms';
                },
                mark(stage){
                    const t=performance.now();
                    if(this.lastStage&&this.lastMark) this.push(this.lastStage,t-this.lastMark);
                    this.lastMark=t;
                    this.lastStage=stage==='frame-end'?null:stage;
                },
                summary(){
                    return 'mode '+this.mode+' | interval '+(app.engine?.mobileGpuTargetIntervalMs||42)+'ms'
                        +' | RAF '+this.rafTicks+' | gated GPU '+this.skippedInFlight
                        +' | gated pace '+this.skippedPacing;
                },
                phaseSummary(){
                    return ['logic','ocean','world','render','post'].map(k=>k+' '+this.pct(k,.95)).join(' | ');
                }
            };
            window.__bermudaQAPerf=qa;
            if(qaPerfMode==='60') { app.engine.mobileGpuTargetIntervalMs=16; window.__bermudaMobilePaceMs=16; }
            // Optional independent workload trial: keeps all effect textures
            // and FFT simulation; only recalculation cadence changes.
            if(qaPerfMode==='60' && qaPerfQuery.get('simBudget')==='balanced') {
                window.__bermudaQASimBudget = {
                    label:'caustics15-shore15-cloud10',
                    last:{}, runs:{}, skips:{}, delta:{}, usedDelta:{},
                    allow(key,intervalMs,dt=0){
                        this.delta[key]=(this.delta[key]||0)+dt;
                        const now=performance.now();
                        if(now-(this.last[key]??-Infinity)<intervalMs){
                            this.skips[key]=(this.skips[key]||0)+1;
                            return false;
                        }
                        this.last[key]=now;
                        this.usedDelta[key]=this.delta[key]; this.delta[key]=0;
                        this.runs[key]=(this.runs[key]||0)+1;
                        return true;
                    }
                };
            }
        }
		app.engine.mobileGpuFramePacing = mobileFastStart;"""
# main.js is pinned checkout generated during QA and may have custom prior patches.
main_source=src.read_text()
assert main_source.count(qa_main_init)==1, "Mobile init perf anchor changed"
src.write_text(main_source.replace(qa_main_init,qa_main_new,1))

qa_app = app_file.read_text()
phase_anchors=[
    ("gpuStage('Frame begin', GPU.frame + 1);",
     "gpuStage('Frame begin', GPU.frame + 1);\n        if(window.__bermudaQAPerf) window.__bermudaQAPerf.mark('logic');"),
    ("gpuStage('FFT and ocean simulation', GPU.frame);",
     "gpuStage('FFT and ocean simulation', GPU.frame);\n        if(window.__bermudaQAPerf) window.__bermudaQAPerf.mark('ocean');"),
    ("gpuStage('Island world preparation', GPU.frame);",
     "gpuStage('Island world preparation', GPU.frame);\n        if(window.__bermudaQAPerf) window.__bermudaQAPerf.mark('world');"),
    ("gpuStage('Scene rendering', GPU.frame);",
     "gpuStage('Scene rendering', GPU.frame);\n        if(window.__bermudaQAPerf) window.__bermudaQAPerf.mark('render');"),
    ("gpuStage('Post/presentation', GPU.frame);",
     "gpuStage('Post/presentation', GPU.frame);\n        if(window.__bermudaQAPerf) window.__bermudaQAPerf.mark('post');"),
    ("this.post.endFrame();\n\t\tGPU.submit();",
     "this.post.endFrame();\n\t\tGPU.submit();\n        if(window.__bermudaQAPerf) window.__bermudaQAPerf.mark('frame-end');")
]
for old,new in phase_anchors:
    assert qa_app.count(old)==1, "Phase CPU anchor changed: "+old[:65]
    qa_app=qa_app.replace(old,new,1)

effect_anchors=[
    ("if ( this.caustics ) this.caustics.update();",
     "if ( this.caustics && (!window.__bermudaQASimBudget || window.__bermudaQASimBudget.allow('caustics',67))) this.caustics.update();"),
    ("if ( this.shoreSim ) this.shoreSim.update();",
     "if ( this.shoreSim && (!window.__bermudaQASimBudget || window.__bermudaQASimBudget.allow('shore',67))) this.shoreSim.update();"),
    ("if ( this.clouds ) this.clouds.update( dt, this.camera );",
     "if ( this.clouds && (!window.__bermudaQASimBudget || window.__bermudaQASimBudget.allow('clouds',100,dt))) this.clouds.update( window.__bermudaQASimBudget ? window.__bermudaQASimBudget.usedDelta.clouds : dt, this.camera );")
]
for old,new in effect_anchors:
    assert qa_app.count(old)==1, "Visual cadence anchor changed: "+old
    qa_app=qa_app.replace(old,new,1)
app_file.write_text(qa_app)

audit_src = audit.read_text()
old_rev = "  'QA source revision coastal-v23',"
new_rev = """  'QA source revision coastal-v24',
  'QA performance '+(typeof window!=='undefined'&&window.__bermudaQAPerf?window.__bermudaQAPerf.summary():'off (use perf=profile or perf=60)'),
  'QA CPU frame p50/p95 '+(typeof window!=='undefined'&&window.__bermudaQAPerf?window.__bermudaQAPerf.pct('cpuFrame',.5)+' / '+window.__bermudaQAPerf.pct('cpuFrame',.95):'off'),
  'QA submit-to-queue-ack wall p50/p95 '+(typeof window!=='undefined'&&window.__bermudaQAPerf?window.__bermudaQAPerf.pct('submitAckWall',.5)+' / '+window.__bermudaQAPerf.pct('submitAckWall',.95):'off')+' (NOT GPU timestamp)',
  'QA CPU stages p95 '+(typeof window!=='undefined'&&window.__bermudaQAPerf?window.__bermudaQAPerf.phaseSummary():'off'),
  'QA independent simulation budget '+(typeof window!=='undefined'&&window.__bermudaQASimBudget?window.__bermudaQASimBudget.label+' | runs '+JSON.stringify(window.__bermudaQASimBudget.runs)+' | skips '+JSON.stringify(window.__bermudaQASimBudget.skips):'all visual effects each frame'),"""
assert audit_src.count(old_rev)==1, "Performance QA revision anchor changed"
audit.write_text(audit_src.replace(old_rev,new_rev,1))



# Coastal v25: optional shadow-cascade cadence and resource-lifetime telemetry.
# The v24 iPhone trace measured 10 FPS despite a 16ms target, with CPU p95 13ms
# and ~88ms submission-to-ack wall latency. Reduce redundant GPU pass frequency,
# without altering CSM texture resolution or daytime visual shaders.
# Existing production/root build and default QA are unchanged.
qa_app = app_file.read_text()
old_shadow_mask = "this.shadows.layerMask = ( 1 << LAYERS.OPAQUE ) | ( 1 << LAYERS.TRANSPARENT );"
new_shadow_mask = """this.shadows.layerMask = ( 1 << LAYERS.OPAQUE ) | ( 1 << LAYERS.TRANSPARENT );
        if (mobileLite && qs.get('fx') === 'coastal-seven' && qs.get('shadowBudget') === 'half') {
            this.shadows.periods = [2,4,8];
            window.__bermudaQAShadowBudget = { periods:'2/4/8', frames:0, passes:0 };
        }"""
assert qa_app.count(old_shadow_mask) == 1, "Shadow cascade setup anchor changed"
qa_app=qa_app.replace(old_shadow_mask,new_shadow_mask,1)

old_shadow_render = "this.shadows.render( this.scene, this.engine.meshRenderer, this.shadows.update( this.camera, G.sunDir.value ) );"
new_shadow_render = """const qaShadowIndices = this.shadows.update( this.camera, G.sunDir.value );
        if (window.__bermudaQAShadowBudget) {
            window.__bermudaQAShadowBudget.frames++;
            window.__bermudaQAShadowBudget.passes += qaShadowIndices.length;
        }
        this.shadows.render( this.scene, this.engine.meshRenderer, qaShadowIndices );"""
assert qa_app.count(old_shadow_render) == 1, "Scene shadow update/render anchor changed"
app_file.write_text(qa_app.replace(old_shadow_render,new_shadow_render,1))

audit_src = audit.read_text()
old_rev = "  'QA source revision coastal-v24',"
new_rev = """  'QA source revision coastal-v25',
  'QA shadow cadence '+(typeof window!=='undefined' && window.__bermudaQAShadowBudget
    ? window.__bermudaQAShadowBudget.periods+' | rendered '+window.__bermudaQAShadowBudget.passes+
      ' passes in '+window.__bermudaQAShadowBudget.frames+' frames'
    : 'default cascade periods 1/2/4'),
  'QA vendor GPU residency '+(typeof location!=='undefined' && new URLSearchParams(location.search).get('vendorStream')==='1'
    ? 'distance-based release ENABLED' : 'retained after loading')+
    ' | loads '+(typeof window!=='undefined'?(window.__bermudaVendorStreamStats?.loads??0):0)+
    ' | releases '+(typeof window!=='undefined'?(window.__bermudaVendorStreamStats?.releases??0):0),"""
assert audit_src.count(old_rev) == 1, "v25 audit revision anchor changed"
audit.write_text(audit_src.replace(old_rev,new_rev,1))



# Coastal v26: make the next FPS investigation about pass cost, not cosmetic changes.
# A/B-mode surfBudget=half updates the existing breaker crest/spray-emitter
# buffer every >=67ms (roughly 15 Hz), while keeping spray particle integration,
# four-cascade FFT, water queries, rendering, physics and save unchanged.
# It is a diagnostic and may visibly reduce splash-generation smoothness.
# Default remains the v25 full-rate crest generation, with corrected profiler
# stage accounting for the portrait-modal early-return path.
qa_engine_file = root / 'src/engine/Engine.js'
qa_engine = qa_engine_file.read_text()
old_raf_marker = "if ( qaPerf ) qaPerf.rafTicks++;"
new_raf_marker = """if ( qaPerf ) {
                qaPerf.rafTicks++;
                if (document.visibilityState === 'visible') {
                    if(qaPerf.lastVisibleRAF && t - qaPerf.lastVisibleRAF < 300)
                        qaPerf.push('visibleRafInterval', t - qaPerf.lastVisibleRAF);
                    qaPerf.lastVisibleRAF = t;
                } else qaPerf.lastVisibleRAF = 0;
            }"""
assert qa_engine.count(old_raf_marker)==1, "v26 RAF telemetry anchor changed"
qa_engine=qa_engine.replace(old_raf_marker,new_raf_marker,1)
old_frame_marker = "this._mobileLastFrame = t;"
new_frame_marker = """if (qaPerf && this._mobileLastFrame && t - this._mobileLastFrame < 300)
                    qaPerf.push('renderInterval',t-this._mobileLastFrame);
                this._mobileLastFrame = t;"""
assert qa_engine.count(old_frame_marker)==1, "v26 frame interval anchor changed"
qa_engine_file.write_text(qa_engine.replace(old_frame_marker,new_frame_marker,1))

qa_app=app_file.read_text()
old_crest = "this.breakers.update( this.camera );"
new_crest = """if (!window.__bermudaQASurfBudget ||
            window.__bermudaQASurfBudget.allow()) this.breakers.update( this.camera );"""
assert qa_app.count(old_crest)==1, "v26 breaker update anchor changed"
qa_app=qa_app.replace(old_crest,new_crest,1)
old_portrait_marker = "gpuStage( 'Fish portrait isolated (world paused)', GPU.frame );"
new_portrait_marker = """gpuStage( 'Fish portrait isolated (world paused)', GPU.frame );
            // Finalize per-frame stage timer on the early-return path as well.
            if(window.__bermudaQAPerf) window.__bermudaQAPerf.mark('frame-end');"""
assert qa_app.count(old_portrait_marker)==1, "v26 portrait timing anchor changed"
app_file.write_text(qa_app.replace(old_portrait_marker,new_portrait_marker,1))

main_source=src.read_text()
old_perf_attach = "window.__bermudaQAPerf=qa;"
new_perf_attach = """window.__bermudaQAPerf=qa;
            if(qaPerfQuery.get('surfBudget')==='half') {
                window.__bermudaQASurfBudget={
                    mode:'breakers >=67ms (A/B only)',last:-Infinity,runs:0,skips:0,
                    allow(){
                        const now=performance.now();
                        if(now-this.last<67){this.skips++;return false;}
                        this.last=now;this.runs++;return true;
                    }
                };
            }"""
assert main_source.count(old_perf_attach)==1, "v26 surf mode setup anchor changed"
src.write_text(main_source.replace(old_perf_attach,new_perf_attach,1))

audit_src = audit.read_text()
old_rev = "  'QA source revision coastal-v25',"
new_rev = """  'QA source revision coastal-v26',
  'QA visible RAF interval p50/p95 '+(typeof window!=='undefined'&&window.__bermudaQAPerf
    ?window.__bermudaQAPerf.pct('visibleRafInterval',.5)+' / '+window.__bermudaQAPerf.pct('visibleRafInterval',.95)
    :'off'),
  'QA actual frame interval p50/p95 '+(typeof window!=='undefined'&&window.__bermudaQAPerf
    ?window.__bermudaQAPerf.pct('renderInterval',.5)+' / '+window.__bermudaQAPerf.pct('renderInterval',.95)
    :'off'),
  'QA surf crest cadence '+(typeof window!=='undefined'&&window.__bermudaQASurfBudget
    ?window.__bermudaQASurfBudget.mode+' | runs '+window.__bermudaQASurfBudget.runs+
      ' | skips '+window.__bermudaQASurfBudget.skips
    :'full every frame')+' | spray integration remains every frame',"""
assert audit_src.count(old_rev)==1, "v26 QA revision anchor changed"
audit.write_text(audit_src.replace(old_rev,new_rev,1))



# Coastal v27: isolate the Kelvin wake independently from FFT, boat spray,
# the CPU wake mesh, player swimming and save data. The v26 iPhone test at
# 461x817 showed only +0.5fps in the surf A/B, so surf is unchanged by default.
# Opt in with wakeBudget=off for a controlled baseline-vs-no-Kelvin comparison.
qa_app=app_file.read_text()
old_wake_isolation="if (qs.has('noBreakers')) {"
new_wake_isolation="""if (mobileLite && qs.get('fx') === 'coastal-seven' &&
            (qs.get('perf') === '60' || qs.get('perf') === 'profile')) {
            const noKelvin = qs.get('wakeBudget') === 'off';
            window.__bermudaQAWakeAudit = {
                mode: noKelvin ? 'Kelvin OFF only' : 'Kelvin original',
                calls:0, simFrames:0, asleepFrames:0, peakSpeed:0,
                lastSpeed:0, lastThrottle:0, lastDriven:false,
                lastIdleSeconds:0, lastSleeping:true, lastPlayerMode:'',
                lastDistance:0
            };
            if (noKelvin) {
                // Test one factor only: switch off the GPU Kelvin wake, not
                // boat spray, surface FFT, physics, the mobile wake mesh, or FX.
                this.wake.update = () => {};
                this.surface.wake = null;
            }
        }
        if (qs.has('noBreakers')) {"""
assert qa_app.count(old_wake_isolation)==1, "v27 wake isolation setup changed"
qa_app=qa_app.replace(old_wake_isolation,new_wake_isolation,1)
old_wake_step="this.wake.update( dt );"
new_wake_step="""const wakeAudit = window.__bermudaQAWakeAudit;
            if (wakeAudit) {
                const b = this.boatCtl;
                const wakeSpeed = Math.hypot(b.velocity.x,b.velocity.z);
                const wakeBefore = this.wake.stepCount;
                this.wake.update( dt );
                wakeAudit.calls++;
                if (this.wake.stepCount > wakeBefore) wakeAudit.simFrames++;
                else wakeAudit.asleepFrames++;
                wakeAudit.peakSpeed = Math.max(wakeAudit.peakSpeed,wakeSpeed);
                wakeAudit.lastSpeed = wakeSpeed;
                wakeAudit.lastThrottle = b.throttle;
                wakeAudit.lastDriven = !!b.driven;
                wakeAudit.lastIdleSeconds = this.wake.idleTime;
                wakeAudit.lastSleeping = !!this.wake.sleeping;
                wakeAudit.lastPlayerMode = this.player.mode;
                wakeAudit.lastDistance = Math.hypot(
                    this.player.position.x-b.position.x,
                    this.player.position.z-b.position.z);
            } else this.wake.update( dt );"""
assert qa_app.count(old_wake_step)==1, "v27 wake frame stepping anchor changed"
qa_app=qa_app.replace(old_wake_step,new_wake_step,1)
app_file.write_text(qa_app)

audit_src=audit.read_text()
old_rev="  'QA source revision coastal-v26',"
new_rev="""  'QA source revision coastal-v27',
  'QA Kelvin wake A/B '+(typeof window!=='undefined'&&window.__bermudaQAWakeAudit
    ?window.__bermudaQAWakeAudit.mode+' | frames '+window.__bermudaQAWakeAudit.simFrames+
      '/'+window.__bermudaQAWakeAudit.calls+' | sleep '+window.__bermudaQAWakeAudit.lastSleeping+
      ' | calm '+window.__bermudaQAWakeAudit.lastIdleSeconds.toFixed(1)+'s'
    :'off'),
  'QA boat wake state '+(typeof window!=='undefined'&&window.__bermudaQAWakeAudit
    ?'speed '+window.__bermudaQAWakeAudit.lastSpeed.toFixed(2)+'m/s'+
      ' | peak '+window.__bermudaQAWakeAudit.peakSpeed.toFixed(2)+'m/s'+
      ' | throttle '+Number(window.__bermudaQAWakeAudit.lastThrottle||0).toFixed(2)+
      ' | driven '+window.__bermudaQAWakeAudit.lastDriven+
      ' | player '+window.__bermudaQAWakeAudit.lastPlayerMode+
      ' | distance '+window.__bermudaQAWakeAudit.lastDistance.toFixed(1)+'m'
    :'off'),"""
assert audit_src.count(old_rev)==1, "v27 report revision anchor changed"
audit.write_text(audit_src.replace(old_rev,new_rev,1))



# Coastal v28: actual iPhone screenshot fixes. Do NOT add new image assets,
# extra render passes, a forked site, or new save namespaces.
# 1) Mobile night air/spray is hidden; FFT, wakes, surface foam and water physics
#    remain unchanged. MarineSnow is allowed only when the camera is underwater.
# 2) SkyPro's 16-frame incremental panorama contains zero-filled texels until
#    all phases have run. Treat those as clear atmosphere instead of opaque
#    black and give dense overcast clouds a low blue-grey dawn radiance floor.
#    Do not add costly cloud samples or new GPU texture allocations.
# 3) QA mobile startup patch now primes 4 frames with no fixed time hold and
#    continues audio download asynchronously.
qa_app=app_file.read_text()
old_air_update="this.airMotes.update( dt, this.camera, this.cameraWaterHeight ?? 0 );"
new_air_update="""this.airMotes.update( dt, this.camera, this.cameraWaterHeight ?? 0 );
        // Atmospheric/underwater flakes must never resemble snow drifting through
        // the night air. Only hide the airborne particle geometry, not water foam,
        // FFT waves, physical boat wake or spray simulation resources.
        if (this.mobileLite && this.qs.get('fx') === 'coastal-seven') {
            const nightNoAirborne = G.night.value > 0.32;
            if (this.spray?.mesh && !this.qs.has('noSpray') && !this.qs.has('freezeFFT'))
                this.spray.mesh.visible = !nightNoAirborne;
            if (nightNoAirborne && this.airMotes?.mesh)
                this.airMotes.mesh.visible = false;
            // The existing near-waterline test can still draw some undersea
            // particles above water at the surface. Restrict them to submerged
            // cameras while retaining their underwater visibility.
            if (this.marineSnow?.mesh && G.cameraUnderwater.value < 0.5)
                this.marineSnow.mesh.visible = false;
            window.__bermudaQANightSpray = nightNoAirborne
                ? 'airborne spray/motes hidden; surface foam + FFT preserved'
                : 'daytime spray normal; underwater snow only';
        }"""
assert qa_app.count(old_air_update)==1, "v28 air mote frame anchor changed"
app_file.write_text(qa_app.replace(old_air_update,new_air_update,1))

clouds_src=clouds_file.read_text()
old_cloud_color="let cloudRadiance = mix( m.color, moonCloud, nocturnal );"
new_cloud_color="""var cloudRadiance = mix( m.color, moonCloud, nocturnal );
    // Dawn/overcast: the cloud lattice must not produce crushed-black masses.
    // Preserve storm coverage and silhouettes, but never use unlit black as
    // visible cloud radiance against a blue-grey twilight sky.
    let dawnSun = atmosphereParams.sunDir.y;
    let dawn = smoothstep( -0.23, -0.05, dawnSun ) *
        ( 1.0 - smoothstep( 0.08, 0.23, dawnSun ) );
    let skyAmbient = atmosphereSkyLuminance( dir );
    let coverage = clamp( m.alpha, 0.0, 1.0 );
    let ambientCloudFloor = ( skyAmbient * 0.22 +
        vec3f( 0.003, 0.006, 0.011 ) +
        vec3f( 0.022, 0.030, 0.043 ) * dawn ) * coverage;
    cloudRadiance = max( cloudRadiance, ambientCloudFloor );"""
assert clouds_src.count(old_cloud_color)==1, "v29 overcast cloud tone anchor changed"
assert "var cloudRadiance = mix(" in new_cloud_color, "WGSL clouds uses mutable var for later assignment"
assert "let cloudRadiance = mix(" not in new_cloud_color, "WGSL let cannot be reassigned"
clouds_src=clouds_src.replace(old_cloud_color,new_cloud_color,1)
old_panorama_sample="let s = textureSampleLevel( cloudsPanorama, smpLinearRepeat, vec2f( u, sqrt( t ) ), 0.0 );"
new_panorama_sample="""let raw = textureSampleLevel( cloudsPanorama, smpLinearRepeat, vec2f( u, sqrt( t ) ), 0.0 );
    // 16-phase mobile panorama: unwritten cells start transparent black. Using
    // them directly creates the black rectangular cloud holes in Safari.
    // Treat empty cells as clear sky until this section receives real cloud data.
    let empty = raw.a <= 0.0001 && all( raw.rgb <= vec3f( 0.0001 ) );
    let s = select( raw, vec4f( 0.0, 0.0, 0.0, 1.0 ), empty );"""
assert clouds_src.count(old_panorama_sample)==1, "v28 cloud sample anchor changed"
clouds_file.write_text(clouds_src.replace(old_panorama_sample,new_panorama_sample,1))

audit_src=audit.read_text()
old_rev="  'QA source revision coastal-v27',"
new_rev="""  'QA source revision coastal-v29',
  'QA shader repair Clouds Panorama mutable radiance (WGSL var)',
  'QA startup warmup '+(typeof window!=='undefined' && window.__bermudaQAWarmup
     ? (window.__bermudaQAWarmup.queueAcks+'/'+window.__bermudaQAWarmup.targetFrames+
        ' GPU-confirmed frames | spacing '+window.__bermudaQAWarmup.spacingMs+'ms | elapsed '+
        (window.__bermudaQAWarmup.elapsedMs??'in progress')+'ms | complete '+window.__bermudaQAWarmup.complete)
     : 'not started'),
  'QA sky overcast mobile cloud black-tile fallback + dawn radiance floor',
  'QA night airborne spray '+(typeof window!=='undefined'
    ?window.__bermudaQANightSpray||'waiting for first frame'
    :'not browser'),"""
assert audit_src.count(old_rev)==1, "v28 QA revision anchor changed"
audit.write_text(audit_src.replace(old_rev,new_rev,1))


out = src.read_text()
assert out.count("configureQAEffectTrial(url)") == 1
assert "const gpuTraceCase = getGpuTraceCase('fftcore')" in out
assert "getFftCoreVisualProfile('crisp')" in out
assert "window.__bermudaMobilePaceMs" in out
print("QA effects and runtime cloud diagnostics installed; opt-in MarineSnow compatibility path available")


# Coastal v30: remove camera-following white particulate meshes from the
# existing iPhone QA build, including when the player uses the bare QA URL
# (fx=baseline). v28 only hid airborne specks in coastal-seven at night and
# MarineSnow close to the surface, so the white flake meshes were still active.
# These are decorative particle systems, NOT the sea's foam/FFT/surf/boats.
# Do not add the meshes to the QA scene at all; also suppress their per-frame
# updates so they cannot be re-enabled by a later visibility calculation.
qa_app = app_file.read_text()
for attr, audit_flag in (
    ('marineSnow', '__bermudaQASnowCompatibility'),
    ('airMotes', '__bermudaQAAirMotesProfile'),
):
    old = f"scene.add( this.{attr}.mesh );"
    new = f"""if (!mobileLite) scene.add( this.{attr}.mesh );
        else {{
            this.{attr}.mesh.visible = false;
            this.{attr}.update = () => {{}};
            window.{audit_flag} = 'disabled-qa';
        }}"""
    assert qa_app.count(old) == 1, f"v30 {attr} scene attachment changed"
    qa_app = qa_app.replace(old, new, 1)
app_file.write_text(qa_app)

audit_src = audit.read_text()
old_rev = "  'QA source revision coastal-v29',"
new_rev = """  'QA source revision coastal-v30-particles-off',
  'QA AirMotes profile '+(typeof window!=='undefined'
    ?window.__bermudaQAAirMotesProfile||'original'
    :'not browser'),"""
assert audit_src.count(old_rev) == 1, 'v30 QA revision anchor changed'
audit.write_text(audit_src.replace(old_rev, new_rev, 1))

assert "if (!mobileLite) scene.add( this.marineSnow.mesh );" in qa_app
assert "if (!mobileLite) scene.add( this.airMotes.mesh );" in qa_app
assert "window.__bermudaQASnowCompatibility = 'disabled-qa'" in qa_app
assert "window.__bermudaQAAirMotesProfile = 'disabled-qa'" in qa_app
assert "coastal-v30-particles-off" in audit.read_text()
print("Coastal v30 iPhone QA: MarineSnow and AirMotes meshes absent from scene; updates disabled")


# Coastal v32: mobile vendor prefetch + high-contrast harbour notices.
# Preserve the v30 particle-free baseline and all game/save mechanics.
# Schedule full original Joe/Martha GLBs at 14m rather than 6m, but serialize
# the GPU-heavy character decodes so both do not upload in the same frame.
# Do not change GLB content or texture resolution; keep textures resident.
vendor_file = root / 'src/game/Vendor.js'
vendor_src = vendor_file.read_text()
old_radius = "const radius = QA_VENDOR_FOCUS ? Math.min(this.radius, 3.0) : 6;"
new_radius = "const radius = QA_VENDOR_FOCUS ? Math.min(this.radius, 3.0) : 14;"
assert vendor_src.count(old_radius) == 1, 'v32 vendor prefetch anchor changed'
vendor_src = vendor_src.replace(old_radius, new_radius, 1)
old_gate = "if (dx * dx + dz * dz < radius * radius) {"
new_gate = """if (dx * dx + dz * dz < radius * radius &&
                (QA_VENDOR_FOCUS || !window.__bermudaQAVendorLoadBusy)) {"""
assert vendor_src.count(old_gate) == 1, 'v32 mobile load gate changed'
vendor_src = vendor_src.replace(old_gate, new_gate, 1)
# Distinguish the update() loader from the constructor's eager desktop loader.
load_anchor = new_gate
old_load = "this.loadCharacter( character.url, character ).catch( ( e ) => console.warn( 'Vendor: character failed to load', e ) );"
assert vendor_src.count(load_anchor) == 1, 'v32 vendor update marker missing'
prefix, suffix = vendor_src.split(load_anchor, 1)
assert suffix.count(old_load) == 1, 'v32 vendor update loader anchor changed'
new_load = """if (!QA_VENDOR_FOCUS) window.__bermudaQAVendorLoadBusy = true;
                this.loadCharacter(character.url, character).catch((e) => {
                    this._qaCharacterError = String(e?.message || e);
                    console.warn('Vendor: original full-resolution GLB failed', this.name, e);
                }).finally(() => {
                    if (!QA_VENDOR_FOCUS) window.__bermudaQAVendorLoadBusy = false;
                });"""
vendor_src = prefix + load_anchor + suffix.replace(old_load, new_load, 1)
vendor_file.write_text(vendor_src)

# Two real-facing canvas-texture notice planes already exist; keep them,
# lighting and 1024x640 atlas unchanged. Make the textured paper readable
# under overcast/dawn/night without extra lights, GPU passes or materials.
notices_file = root / 'src/game/HarbourNotices.js'
notices = notices_file.read_text()
old_surface = """\ts.albedo = ink;
\t// A restrained readability floor complements the warm board light after dusk.
\ts.emissive = ink * 0.14 * smoothstep( 0.15, 0.75, frame.night );"""
new_surface = """\ts.albedo = ink * 0.72;
\t// Printed harbour notices must read in shade and at night on mobile.
\t// Single existing material, no additional light or GPU render pass.
\ts.emissive = ink * 0.78;"""
assert notices.count(old_surface) == 1, 'v32 board material anchor changed'
notices = notices.replace(old_surface, new_surface, 1)
assert notices.count("side: 'front',") == 1, 'v32 board face sidedness anchor changed'
notices = notices.replace("side: 'front',", "side: 'double',", 1)
assert notices.count("c.fillStyle = '#927650';") == 1, 'v32 board background anchor changed'
notices = notices.replace("c.fillStyle = '#927650';", "c.fillStyle = '#e2d5b8';", 1)
notices_file.write_text(notices)

audit_src = audit.read_text()
old_rev = "  'QA source revision coastal-v30-particles-off',"
new_rev = """  'QA source revision coastal-v34-paced-startup',
  'QA vendor load strategy original GLBs early 14m serialized (mobile)',
  'QA harbour notices contrast emissive-0.78 two-face',"""
assert audit_src.count(old_rev) == 1, 'v32 audit revision anchor changed'
audit.write_text(audit_src.replace(old_rev, new_rev, 1))

assert "const radius = QA_VENDOR_FOCUS ? Math.min(this.radius, 3.0) : 14;" in vendor_file.read_text()
assert "window.__bermudaQAVendorLoadBusy = true" in vendor_file.read_text()
assert "s.emissive = ink * 0.78;" in notices_file.read_text()
assert "side: 'double'" in notices_file.read_text()
assert "coastal-v34-paced-startup" in audit.read_text()
print("Coastal v34: seven FX preserved, particle-free, original vendors + readable board")


# Coastal v34: telemetry for actual pre-Explore GPU priming, not a wall-clock hold.
# The earlier four-frame instant-prime was too brief to compare meaningfully
# with the historical 30x2000ms sequence; use 30x700ms with real queue ACKs.
warm_main = src.read_text()
old_prelude = "\t\t\tawait preloadMobileStartup( {"
new_prelude = """            window.__bermudaQAWarmup = {
                targetFrames: 30, spacingMs: 700,
                queueAcks: 0, startMs: performance.now(),
                elapsedMs: null, complete: false
            };
            await preloadMobileStartup( {"""
assert warm_main.count(old_prelude) == 1, 'v34 startup call anchor changed'
warm_main = warm_main.replace(old_prelude, new_prelude, 1)
old_tail = "\t\t\t\tonQueueAck: () => gpuQueueAck( GPU.frame ),\n\t\t\t} );"
new_tail = """                onQueueAck: () => {
                    gpuQueueAck(GPU.frame);
                    if (window.__bermudaQAWarmup) window.__bermudaQAWarmup.queueAcks++;
                },
            } );
            window.__bermudaQAWarmup.complete = true;
            window.__bermudaQAWarmup.elapsedMs =
                Math.round(performance.now() - window.__bermudaQAWarmup.startMs);"""
assert warm_main.count(old_tail) == 1, 'v34 queue ack and warm-up completion anchor changed'
warm_main = warm_main.replace(old_tail, new_tail, 1)
assert "frameCount: 30" in warm_main, 'v34 expected 30 confirmed frames'
assert "frameWaitMs: 700" in warm_main, 'v34 expected 700 ms interval'
assert "const raw = url.searchParams.get('fx') || 'coastal-seven'" in (
    root / 'src/mobile/QAEffectTrial.js'
).read_text(), 'v34 seven-effects default regression'
src.write_text(warm_main)
assert "QA startup warmup '+(" in audit.read_text()
print("Coastal v34 startup: 30 paced, queue-confirmed GPU frames at 700ms, telemetry active")


# Coastal v35: opt-in corrected ocean visuals (oceanFix=1).
# Leave user-facing seven-effect default untouched until on-device evidence.
# Two issues: underwater caustics sample a frozen one-shot long-wave light map
# on mobile; storm cloud coverage is 0.88 but the panorama sky stays bright.
# No new shaders, textures, particles, rain geometry or GPU passes at startup.
fix_app = app_file.read_text()
old_storm = "storm: { coverage: 0.88, wind: 14, chop: 1.08, surf: 0.62 },"
new_storm = "storm: { coverage: this.qs.get('oceanFix') === '1' ? 0.97 : 0.88, wind: 14, chop: 1.08, surf: 0.62 },"
assert fix_app.count(old_storm) == 1, "v35 storm coverage anchor changed"
fix_app = fix_app.replace(old_storm, new_storm, 1)

old_atmo = "\t\tthis.applyAtmosphereReadback();"
new_atmo = """        this.applyAtmosphereReadback();
        if (this.mobileLite && this.qs.get('fx') === 'coastal-seven' &&
            this.qs.get('oceanFix') === '1') {
            const storm = this.settings.weatherMode === 'storm';
            // Reuse existing sky/cloud uniforms; no extra materials or passes.
            this.sky.sunDiskIntensity.value = storm ? 0.30 : 1.0;
            if (this.clouds?.S?.cloudLight?.value)
                this.clouds.S.cloudLight.value[2] = storm ? 0.42 : 0.70;
            if (storm) {
                G.sunColor.value.multiplyScalar(0.52);
                G.skyIrradiance.value.multiplyScalar(0.65);
                G.horizonColor.value.multiplyScalar(0.72);
            }
            window.__bermudaQAOceanVisual = window.__bermudaQAOceanVisual || {
                underwaterMapRuns:0, underwaterMapSkips:0,
                stormFrames:0, normalFrames:0
            };
            if (storm) window.__bermudaQAOceanVisual.stormFrames++;
            else window.__bermudaQAOceanVisual.normalFrames++;
        }"""
assert fix_app.count(old_atmo) == 1, "v35 atmosphere lighting anchor changed"
fix_app = fix_app.replace(old_atmo, new_atmo, 1)

old_map = "\t\t\tthis.underwaterLighting.update( this.camera );"
new_map = """            if (this.mobileLite && this.qs.get('fx') === 'coastal-seven' &&
                this.qs.get('oceanFix') === '1' &&
                window.__bermudaQAGameplay) {
                // Only after Explore: no extra 512px map kernels in startup.
                // Refresh the wave/foam/light map at <= 8 Hz near the sea,
                // keeping the existing 15 Hz caustic texture generation.
                const now = performance.now();
                const nearSurface = this.camera.position.y <
                    (this.cameraWaterHeight ?? 0) + 3.0;
                if (nearSurface && now - (this._qaOceanMapLast || 0) >= 125) {
                    window.__bermudaFreezeUnderwaterLight = false;
                    this.underwaterLighting.update(this.camera);
                    this._qaOceanMapLast = now;
                    window.__bermudaQAOceanVisual.underwaterMapRuns++;
                } else {
                    window.__bermudaQAOceanVisual.underwaterMapSkips++;
                }
            } else {
                this.underwaterLighting.update(this.camera);
            }"""
assert fix_app.count(old_map) == 1, "v35 underwater lighting dispatch anchor changed"
fix_app = fix_app.replace(old_map, new_map, 1)
app_file.write_text(fix_app)

# Compare 30 x 700ms (v34 default) against 30 x 1200ms without changing
# number of GPU-confirmed startup frames, visuals or memory allocations.
warm_main = src.read_text()
old_spacing = "frameWaitMs: 700,"
new_spacing = "frameWaitMs: new URLSearchParams(location.search).get('bootSpacing') === '1200' ? 1200 : 700,"
assert warm_main.count(old_spacing) == 1, "v35 preload spacing anchor changed"
warm_main = warm_main.replace(old_spacing, new_spacing, 1)
old_stat = "targetFrames: 30, spacingMs: 700,"
new_stat = "targetFrames: 30, spacingMs: new URLSearchParams(location.search).get('bootSpacing') === '1200' ? 1200 : 700,"
assert warm_main.count(old_stat) == 1, "v35 warmup report spacing anchor changed"
src.write_text(warm_main.replace(old_stat, new_stat, 1))

audit_src = audit.read_text()
old_revision = "  'QA source revision coastal-v34-paced-startup',"
new_revision = """  'QA source revision coastal-v35-ocean-experiment',
  'QA ocean visual tune '+(typeof window!=='undefined' && window.__bermudaQAOceanVisual
    ? 'storm frames '+window.__bermudaQAOceanVisual.stormFrames+
      ' | normal frames '+window.__bermudaQAOceanVisual.normalFrames+
      ' | underwater map refreshes '+window.__bermudaQAOceanVisual.underwaterMapRuns+
      ' | skipped '+window.__bermudaQAOceanVisual.underwaterMapSkips
    : 'off (use oceanFix=1)'),"""
assert audit_src.count(old_revision) == 1, "v35 diagnostic revision anchor changed"
audit.write_text(audit_src.replace(old_revision, new_revision, 1))
assert "underwaterMapRuns++" in app_file.read_text()
assert "bootSpacing') === '1200'" in src.read_text()
assert "coastal-v35-ocean-experiment" in audit.read_text()
print("Coastal v35 opt-in: 8Hz underwater wave-map refresh, darker storm uniforms, 1200ms startup A/B")


# Coastal v36: isolate audio prefetch/decode memory pressure during GPU startup.
# Prior traces lost the device ~1.3s AFTER 30/30 acknowledged warm frames
# and BEFORE Explore, with no GPU submissions waiting. The previous startup
# decoded 19 recordings concurrently using OfflineAudioContext. On iPhone
# avoid those parallel downloads/decodes; SoundScape.resume() still creates
# its AudioContext and loads CORE sounds normally on the Explore gesture.
# Explicit startupAudio=eager reenables the old prefetch for A/B testing.
mobile_main = src.read_text()
old_audio = """        const qaAudioReady = app.audio
            ? preloadQAStartupAudio(app.audio)
            : Promise.resolve({decoded:0,downloaded:0,total:0});"""
new_audio = """        const qaAudioPrefetchEnabled =
            new URLSearchParams(location.search).get('startupAudio') === 'eager';
        window.__bermudaQAStartupAudio = {
            mode: qaAudioPrefetchEnabled ? 'eager-19-offline-decodes' : 'deferred-until-explore',
            prefetchStarted: qaAudioPrefetchEnabled,
            soundOnExplore: true
        };
        const qaAudioReady = qaAudioPrefetchEnabled && app.audio
            ? preloadQAStartupAudio(app.audio)
            : Promise.resolve({decoded:0,downloaded:0,total:0});"""
assert mobile_main.count(old_audio) == 1, 'v36 audio preload hook changed'
src.write_text(mobile_main.replace(old_audio, new_audio, 1))

diag = audit.read_text()
old_rev = "  'QA source revision coastal-v35-ocean-experiment',"
new_rev = """  'QA source revision coastal-v36-startup-audio-isolation',
  'QA startup audio '+(typeof window!=='undefined'
    ?window.__bermudaQAStartupAudio?.mode||'not initialized'
    :'not browser')+' | SoundScape loads on Explore',"""
assert diag.count(old_rev) == 1, 'v36 diagnostic version hook changed'
audit.write_text(diag.replace(old_rev, new_rev, 1))
assert "get('startupAudio') === 'eager'" in src.read_text()
assert "preloadQAStartupAudio(app.audio)" in src.read_text()
assert "coastal-v36-startup-audio-isolation" in audit.read_text()
print("Coastal v36: parallel 19-recording audio preload deferred until Explore; seven ocean FX unchanged")


# Coastal v37: black waterline protection, opt-in ONLY (?waterFix=1).
# Root issue: simplified MobilePostFX bypasses the desktop underwater composite.
# A no-depth sky pixel below sea level can remain physically black when the
# underwater water surface clips out near the horizon. Guard the mobile final
# pass with a minimal water-colour-scattering fallback for those pixels.
# Separately prevent *pitch-black* shoreline wave faces in the water shader.
# Both guards use existing colour/depth buffers. They add no new draw passes,
# FFT kernels, weather particles, textures, or scene assets.
mobile_file = root / 'src/post/MobilePostFX.js'
mobile = mobile_file.read_text()
old_flag = """  const filmSharp75=typeof window!=='undefined' &&"""
new_flag = """  const qaWaterFix = typeof window !== 'undefined' &&
   new URLSearchParams(window.location.search).get('waterFix') === '1';
  if (typeof window !== 'undefined')
   window.__bermudaQAWaterVisual = qaWaterFix ? 'on: mobile sky-gap and shore face guards' : 'off';
  const waterGapShader = qaWaterFix ? `
 // A ray with no geometry hit is the sky, which the full Underwater composite
 // normally scatters through the water column. Mobile's one-pass post lacks it.
 let depthSize=vec2i(textureDimensions(mobileDepth));
 let depthPx=clamp(vec2i(uv*vec2f(depthSize)),vec2i(0),depthSize-1);
 let sceneDepth=textureLoad(mobileDepth,depthPx,0).x;
 let submerge=smoothstep(0.15,0.65,frame.seaLevel-frame.cameraPos.y);
 if (submerge>0.0 && sceneDepth<0.0000001) {
   let scatter=max(vec3f(0.05,0.16,0.19),frame.skyIrradiance*0.22);
   c=mix(c,max(c,scatter),submerge);
 }
` : '';
  const filmSharp75=typeof window!=='undefined' &&"""
assert mobile.count(old_flag) == 1, 'v37 mobile water toggle anchor moved'
mobile = mobile.replace(old_flag, new_flag, 1)
old_bind = "bindings:{mobileHDR:{texture:()=>this.sceneRenderer.sceneRT.texture}},"
new_bind = """bindings:{mobileHDR:{texture:()=>this.sceneRenderer.sceneRT.texture},
    ...(qaWaterFix?{mobileDepth:{texture:()=>this.sceneRenderer.sceneRT.depthTexture,
        sampleType:'unfilterable-float'}}:{})},"""
assert mobile.count(old_bind) == 1, 'v37 mobile depth binding anchor moved'
mobile = mobile.replace(old_bind, new_bind, 1)
old_hdr = """var c=textureSampleLevel(mobileHDR,smpLinearClamp,uv,0.0).rgb;\\n let neighbor="""
new_hdr = """var c=textureSampleLevel(mobileHDR,smpLinearClamp,uv,0.0).rgb;\\n"+waterGapShader+"\\n let neighbor="""
assert mobile.count(old_hdr) == 1, 'v37 mobile shader insert anchor moved'
mobile_file.write_text(mobile.replace(old_hdr, new_hdr, 1))

water_file = root / 'src/ocean/WaterMaterial.js'
water = water_file.read_text()
old_water = "var res = min( outCol, vec3f( 16000.0 ) );"
new_water = """var res = min( outCol, vec3f( 16000.0 ) );
${typeof window !== 'undefined' && new URLSearchParams(location.search).get('waterFix') === '1'
  ? `// Storm waves are dark but not solid-black masks. Preserve high dynamic
  // range, moving crests and foam, and add only a shallow-water radiance floor.
  if (mat.debugMode == 0 && vDepth < 26.0) {
      let seaFloor = vec3f(0.028, 0.067, 0.081) + frame.skyIrradiance * 0.06;
      res = max(res, seaFloor);
  }` : '' }"""
assert water.count(old_water) == 1, 'v37 water shader color anchor moved'
water_file.write_text(water.replace(old_water, new_water, 1))

diag = audit.read_text()
oldrev = "  'QA source revision coastal-v36-startup-audio-isolation',"
newrev = """  'QA source revision coastal-v37-water-visual-ab',
  'QA black-water guard '+(typeof window!=='undefined'
    ?window.__bermudaQAWaterVisual||'not initialized'
    :'not browser')+' | desktop underwater composite NOT yet mobile',"""
assert diag.count(oldrev) == 1, 'v37 diagnostic revision changed'
audit.write_text(diag.replace(oldrev,newrev,1))

assert "waterGapShader" in mobile_file.read_text()
assert "mobileDepth" in mobile_file.read_text()
assert "vDepth < 26.0" in water_file.read_text()
assert "coastal-v37-water-visual-ab" in audit.read_text()
print("Coastal v37: opt-in waterFix=1 protects black sky gaps underwater and shore-wave faces; GPU effects unchanged")


# Coastal v38: decouple storm sky from water. The v35 global sunlight and
# skylight multipliers made v37's turquoise breaking crests dark when
# oceanFix=1, yet did NOT darken the sky background shader. Keep v37 waterFix,
# preserve seven coastal FX and use an opt-in sky-only canopy (?stormSky=1).
app_v38 = app_file.read_text()
old_world_dim = """            if (storm) {
                G.sunColor.value.multiplyScalar(0.52);
                G.skyIrradiance.value.multiplyScalar(0.65);
                G.horizonColor.value.multiplyScalar(0.72);
            }
"""
assert app_v38.count(old_world_dim) == 1, "v38 old global lighting anchor changed"
app_v38 = app_v38.replace(old_world_dim, "", 1)

# v35 also raised coverage and lowered cloud ambient under oceanFix=1.
# Both impact water reflections/cloud shadows. Restore exact v37 weather.
old_coverage = "storm: { coverage: this.qs.get('oceanFix') === '1' ? 0.97 : 0.88, wind: 14, chop: 1.08, surf: 0.62 },"
new_coverage = "storm: { coverage: 0.88, wind: 14, chop: 1.08, surf: 0.62 },"
assert app_v38.count(old_coverage) == 1, "v38 old 0.97 coverage anchor changed"
app_v38 = app_v38.replace(old_coverage, new_coverage, 1)
old_ocean_sky = """            this.sky.sunDiskIntensity.value = storm ? 0.30 : 1.0;
            if (this.clouds?.S?.cloudLight?.value)
                this.clouds.S.cloudLight.value[2] = storm ? 0.42 : 0.70;
"""
assert app_v38.count(old_ocean_sky) == 1, "v38 old oceanFix cloud ambient anchor changed"
app_v38 = app_v38.replace(old_ocean_sky, "", 1)

sky_v38_file = root / "src/sky/Sky.js"
sky_v38 = sky_v38_file.read_text()
old_uniform = "\t\t\tstarIntensity: [ 'f32', 0 ],"
new_uniform = """\t\t\tstarIntensity: [ 'f32', 0 ],
            stormOverlay: [ 'f32', 0 ],"""
assert sky_v38.count(old_uniform) == 1, "v38 SkyParams uniform anchor changed"
sky_v38 = sky_v38.replace(old_uniform, new_uniform, 1)
old_handle = "\t\tthis.starIntensity = this.params.fields.starIntensity;"
new_handle = """\t\tthis.starIntensity = this.params.fields.starIntensity;
        this.stormOverlay = this.params.fields.stormOverlay;"""
assert sky_v38.count(old_handle) == 1, "v38 sky handle anchor changed"
sky_v38 = sky_v38.replace(old_handle, new_handle, 1)

# Modify camera sky only; skyReflectionRadiance used by the water is unchanged.
old_view = """\t${ clouds ? `let c = cloudsSampleView( dir );
\treturn base * c.a + sun * cloudsSunTransmittance( c.a ) + c.rgb;` : 'return base + sun;' }"""
new_view = """\t${ clouds ? `let c = cloudsSampleView( dir );
    let cloudComposed = base * c.a + sun * cloudsSunTransmittance( c.a ) + c.rgb;
    ${ typeof window !== 'undefined' &&
        new URLSearchParams(location.search).get('stormSky') === '1' ? `
    // Sky-only mobile storm deck. No new GPU textures, passes or particles.
    // Source panorama cloud radiance still contributes beneath this canopy.
    let storm = clamp( skyParams.stormOverlay, 0.0, 1.0 );
    let aboveHorizon = smoothstep( -0.055, 0.105, dir.y );
    let drift = frame.time * 0.014;
    let banks = sin( dir.x * 16.0 + dir.z * 12.0 + drift ) *
                sin( dir.x * 28.0 - dir.z * 19.0 + drift * 0.7 );
    let details = sin( dir.x * 46.0 + dir.z * 31.0 - drift * 1.5 );
    let bank = clamp( 0.56 + 0.25 * banks + 0.10 * details, 0.16, 0.90 );
    let overcastAlpha = storm * aboveHorizon * ( 0.78 + 0.17 * bank );
    let cloudGray = mix( vec3f( 0.071, 0.087, 0.105 ),
                         vec3f( 0.15, 0.167, 0.187 ), bank );
    return mix( cloudComposed, cloudGray, overcastAlpha );`
        : 'return cloudComposed;' }
    ` : 'return base + sun;' }"""
assert sky_v38.count(old_view) == 1, "v38 camera sky radiance anchor changed"
sky_v38_file.write_text(sky_v38.replace(old_view, new_view, 1))

# Smoothed per-frame weather state only for the camera-sky shader.
old_frame = """        this.applyAtmosphereReadback();
        if (this.mobileLite && this.qs.get('fx') === 'coastal-seven' &&"""
new_frame = """        this.applyAtmosphereReadback();
        if (this.mobileLite && this.qs.get('stormSky') === '1' &&
            this.qs.get('fx') === 'coastal-seven') {
            const target = this.settings.weatherMode === 'storm' ? 1 : 0;
            this.sky.sunDiskIntensity.value = target ? 0.30 : 1.0;
            const prev = this.sky.stormOverlay.value;
            this.sky.stormOverlay.value = prev + (target - prev) *
                Math.min(1, Math.max(0, dt) * 1.15);
            window.__bermudaQAStormSky = {
                mode: this.settings.weatherMode,
                overlay: Math.round(this.sky.stormOverlay.value * 100) / 100,
                sceneLighting: 'original-water-unchanged'
            };
        }
        if (this.mobileLite && this.qs.get('fx') === 'coastal-seven' &&"""
assert app_v38.count(old_frame) == 1, "v38 atmosphere insert anchor changed"
app_file.write_text(app_v38.replace(old_frame, new_frame, 1))

diag_v38 = audit.read_text()
old_diag = "  'QA source revision coastal-v37-water-visual-ab',"
new_diag = """  'QA source revision coastal-v38-storm-sky-isolated',
  'QA storm sky '+(typeof window!=='undefined' && window.__bermudaQAStormSky
    ? window.__bermudaQAStormSky.mode+' | canopy '+window.__bermudaQAStormSky.overlay+
      ' | world light '+window.__bermudaQAStormSky.sceneLighting
    : 'off (use stormSky=1)'),
  'QA oceanFix shared sun/sky light untouched',"""
assert diag_v38.count(old_diag) == 1, "v38 diagnostic version anchor changed"
audit.write_text(diag_v38.replace(old_diag, new_diag, 1))

assert "skyParams.stormOverlay" in sky_v38_file.read_text()
assert "window.__bermudaQAStormSky" in app_file.read_text()
assert "G.sunColor.value.multiplyScalar(0.52)" not in app_file.read_text()
assert "cloudLight.value[2] = storm" not in app_file.read_text()
assert "storm: { coverage: 0.88, wind: 14" in app_file.read_text()
assert "coastal-v38-storm-sky-isolated" in audit.read_text()
print("Coastal v38 sky-only storm QA; removed oceanFix global lighting regression; original full ocean FX")


# iPhone startup safety: no full-scene GPU submissions before Explore.
# The prior 30-frame/700ms preload repeatedly ran the full ocean/world workload
# before gameplay; the reported device loss occurred at frame 32. Defer the first
# complete scene frame to the paced gameplay loop and remove the artificial 60s hold.
qa_app = app_file.read_text()
old_warmup = """\t\tconst warmupFrames = this.mobileFullEffects ? 12 : ( mobileLite ? 1 : 2 );
\t\tfor ( let i = 0; i < warmupFrames; i ++ ) {
\t\t\tif ( GPU.fatalError ) throw GPU.fatalError;
\t\t\t// iOS lost the device at frame 18 after the first twelve shader
\t\t\t// warm-up frames ran in a burst. Allow the GPU process to settle.
\t\t\tif ( this.mobileFullEffects ) await new Promise( resolve => setTimeout( resolve, 750 ) );
\t\t\tif ( GPU.fatalError ) throw GPU.fatalError;
\t\t\tthis.frame( 1 / 60 );
\t\t\tawait GPU.queue.onSubmittedWorkDone();
\t\t\tgpuQueueAck(GPU.frame);
\t\t\tif ( this.mobileFullEffects ) await GPU.pipelinesReady();
\t\t\tif ( GPU.fatalError ) throw GPU.fatalError;
\t\t}
"""
new_warmup = """\t\t// Mobile submits no complete simulation frames behind the loader.
\t\t// First full scene frame is submitted after Explore by the paced gameplay loop.
\t\tif ( ! mobileLite ) {
\t\t\tfor ( let i = 0; i < 2; i ++ ) {
\t\t\t\tif ( GPU.fatalError ) throw GPU.fatalError;
\t\t\t\tthis.frame( 1 / 60 );
\t\t\t\tawait GPU.queue.onSubmittedWorkDone();
\t\t\t\tgpuQueueAck(GPU.frame);
\t\t\t\tif ( GPU.fatalError ) throw GPU.fatalError;
\t\t\t}
\t\t}
"""
assert qa_app.count(old_warmup) == 1, "Expected mobile App.init warm-up block not found"
qa_app = qa_app.replace(old_warmup, new_warmup, 1)

old_precompile = """\t\tconst sr = this.sceneRenderer, hm = sr.hullMaskRT;
\t\tif ( sr.hullMasks.length ) mr.render( sr.hullMaskScene, {
\t\t\tlabel: 'hull mask', kind: 'color', camera: this.camera, colorViews: [ hm.texture.view() ], colorFormats: hm.formats,
\t\t\tclearColors: [ [ 0, 0, 0, 0 ] ], depthView: hm.depthTexture.view(), depthFormat: DEPTH_FORMAT, clearDepth: 0, cull: false,
\t\t} );
\t\ttry {

\t\t\t// both water variants: with the hull-mask discard (a hull on screen) and without
\t\t\tfor ( const hull of [ 0, 1 ] ) {

\t\t\t\tthis.waterMaterial.hullOverride = hull;
\t\t\t\tthis.frame( 1 / 60 );

\t\t\t}

\t\t} catch ( e ) {

\t\t\tconsole.warn( 'precompile failed', e );

\t\t}

\t\tthis.waterMaterial.hullOverride = null;
"""
new_precompile = """\t\tconst sr = this.sceneRenderer, hm = sr.hullMaskRT;
\t\t// Full App.frame dispatches FFT, shoreline, caustics, spray, clouds and scene passes.
\t\t// Do not submit these extra precompile frames on iPhone before gameplay.
\t\tif ( ! this.mobileLite ) {
\t\t\tif ( sr.hullMasks.length ) mr.render( sr.hullMaskScene, {
\t\t\t\tlabel: 'hull mask', kind: 'color', camera: this.camera, colorViews: [ hm.texture.view() ], colorFormats: hm.formats,
\t\t\t\tclearColors: [ [ 0, 0, 0, 0 ] ], depthView: hm.depthTexture.view(), depthFormat: DEPTH_FORMAT, clearDepth: 0, cull: false,
\t\t\t} );
\t\t\ttry {

\t\t\t\t// both water variants: with the hull-mask discard (a hull on screen) and without
\t\t\t\tfor ( const hull of [ 0, 1 ] ) {

\t\t\t\t\tthis.waterMaterial.hullOverride = hull;
\t\t\t\t\tthis.frame( 1 / 60 );

\t\t\t\t}

\t\t\t} catch ( e ) {

\t\t\t\tconsole.warn( 'precompile failed', e );

\t\t\t}
\t\t}
\t\tthis.waterMaterial.hullOverride = null;
"""
assert qa_app.count(old_precompile) == 1, "Expected mobile precompile render block not found"
app_file.write_text(qa_app.replace(old_precompile, new_precompile, 1))

let main = src.read_text();
main = main.replace(
  "import { verifyMobileWorld, validateSpawn } from './mobile/WorldRenderGate.js';",
  "import { validateSpawn } from './mobile/WorldRenderGate.js';"
);
main = main.replace(
  "import { preloadMobileStartup, MOBILE_FULL_PRELOAD_FRAMES, MOBILE_FULL_PRELOAD_WAIT_MS } from './mobile/MobileStartupPreload.js';\n",
  ""
);
main = main.replace(
  "import { cacheStartupAssets, holdUntilMobileReady, isStartupCacheReady, markStartupCacheReady } from './mobile/StartupAssetCache.js';",
  "import { cacheStartupAssets, markStartupCacheReady } from './mobile/StartupAssetCache.js';"
);

const gateStart = main.indexOf("\t\tif (mobileRecovery || app.qs.has('renderTest')) {");
const cacheStart = main.indexOf("\t\tif ( !app.qs.has( 'renderTest' ) && !gpuTraceActive", gateStart);
assert(gateStart >= 0 && cacheStart > gateStart, "Mobile GPU verification/preload anchors not found");
main = main.slice(0, gateStart) + """\t\t// CPU-only spawn validation. First full scene render is deferred until Explore.
\t\tvalidateSpawn(app);
\t\twindow.__bermudaWorldGate = {status:'first-frame-deferred',tries:0};
\t\twindow.__bermudaQAWarmup = {
\t\t\ttargetFrames:0, spacingMs:0, queueAcks:0,
\t\t\tstartMs:performance.now(), elapsedMs:0, complete:true
\t\t};
\t\tgpuStage('First full scene frame deferred until Explore');
""" + main.slice(cacheStart);

const cacheEnd = main.indexOf("\n\t\tui.setLoading( 1, 'World ready' );", cacheStart);
assert(cacheEnd > cacheStart, "Startup cache block end anchor not found");
main = main.slice(0, cacheStart) + """\t\tif ( !app.qs.has( 'renderTest' ) && !gpuTraceActive && !app.qs.has( 'bench' ) ) {
\t\t\tconst baseUrl = new URL( import.meta.env.BASE_URL || './', location.href );
\t\t\twindow.__bermudaAssetCacheState = { pending:true, available:false, stored:0, reused:0, failed:0 };
\t\t\tvoid cacheStartupAssets( { baseUrl } ).then( state => {
\t\t\t\twindow.__bermudaAssetCacheState = state;
\t\t\t\tmarkStartupCacheReady( state, window.localStorage );
\t\t\t} ).catch( error => console.warn( 'Background startup asset cache skipped', error ) );
\t\t}
""" + main.slice(cacheEnd);
src.write_text(main);

let auditSource = audit.read_text();
const warmStart = auditSource.indexOf("  'QA startup warmup '+");
const warmEnd = auditSource.indexOf("  'QA sky overcast", warmStart);
assert(warmStart >= 0 && warmEnd > warmStart, "Startup warmup audit report anchors not found");
auditSource = auditSource.slice(0,warmStart) +
  "  'QA startup warmup disabled before Explore; first full frame deferred',\n" +
  auditSource.slice(warmEnd);
audit.write_text(auditSource);

assert(!src.read_text().includes("await preloadMobileStartup("), "Mobile preload call remains");
assert(!src.read_text().includes("await verifyMobileWorld("), "GPU world verification call remains");
assert(!src.read_text().includes("holdUntilMobileReady"), "60-second startup hold remains");
assert(app_file.read_text().includes("if ( ! this.mobileLite )"), "Mobile precompile guard missing");
print("iPhone startup fix: zero pre-Explore scene frames, no 30-frame warmup, no 60-second cache hold");
