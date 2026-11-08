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

out = src.read_text()
assert out.count("configureQAEffectTrial(url)") == 1
assert "const gpuTraceCase = getGpuTraceCase('fftcore')" in out
assert "getFftCoreVisualProfile('crisp')" in out
assert "window.__bermudaMobilePaceMs" in out
print("QA effects and runtime cloud diagnostics installed; opt-in MarineSnow compatibility path available")
