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
old_mobile_gate = "if ( this._gpuInFlight || ( this._mobileLastFrame && t - this._mobileLastFrame < 42 ) ) return;"
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


out = src.read_text()
assert out.count("configureQAEffectTrial(url)") == 1
assert "const gpuTraceCase = getGpuTraceCase('fftcore')" in out
assert "getFftCoreVisualProfile('crisp')" in out
assert "window.__bermudaMobilePaceMs" in out
print("QA effects and runtime cloud diagnostics installed; opt-in MarineSnow compatibility path available")
