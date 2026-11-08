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

out = src.read_text()
assert out.count("configureQAEffectTrial(url)") == 1
assert "const gpuTraceCase = getGpuTraceCase('fftcore')" in out
assert "getFftCoreVisualProfile('crisp')" in out
assert "window.__bermudaMobilePaceMs" in out
print("QA effects and runtime cloud diagnostics installed; opt-in MarineSnow compatibility path available")
