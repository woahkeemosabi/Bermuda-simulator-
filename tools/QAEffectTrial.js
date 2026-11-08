// Optional isolated iPhone FFT-core QA: individual effect trials plus one locked six-effect coastal stack.
// Runs AFTER configureGpuTraceUrl(), which installs all isolation flags.
// Never changes the default URL or production code. No persistent game state.
export const QA_EFFECT_TRIALS = Object.freeze({
  caustics: Object.freeze({ disableFlag: 'noCaustics', label: 'Underwater caustics' }),
  shadows: Object.freeze({ disableFlag: 'noShadows', label: 'Sun shadow cascades (512)' }),
  shore: Object.freeze({ disableFlag: 'noSim', label: 'Shoreline foam simulation' }),
  breakers: Object.freeze({ disableFlag: 'noBreakers', label: 'Surf breaking crests' }),
  spray: Object.freeze({ disableFlag: 'noSpray', label: 'Ocean spray particles' }),
  wake: Object.freeze({ disableFlag: 'noWake', label: 'Boat Kelvin wake' }),
  clouds: Object.freeze({ disableFlag: 'noClouds', label: 'Panorama clouds only' }),
  reflections: Object.freeze({ disableFlag: null, label: '64px reflection bake (freeze)' }),
});

// Explicitly supported combination: the six individually validated effects together.
// This is a fixed preset, NOT a general-purpose comma-separated switch parser.
// Clouds, haze and environment reflection bakes stay isolated for the next test.
export const QA_EFFECT_STACKS = Object.freeze({
  'coastal-six': Object.freeze({
    disableFlags: Object.freeze(['noCaustics', 'noShadows', 'noSim', 'noBreakers', 'noSpray', 'noWake']),
    label: 'Caustics + shadows + shore + breakers + spray + wake (clouds off)',
  }),
});

// Aerial haze is intentionally omitted: MobilePostFX does not render its
// separate AirHaze pass. Removing noHaze would allocate effects but not add
// the visual effect to this iPhone one-pass renderer.
export function configureQAEffectTrial(url) {
  const raw = url.searchParams.get('fx');
  if (!raw) return 'baseline';
  if (Object.prototype.hasOwnProperty.call(QA_EFFECT_STACKS, raw)) {
    const trial = QA_EFFECT_STACKS[raw];
    for (const flag of trial.disableFlags) url.searchParams.delete(flag);
    // The next step is a separately controlled clouds experiment.
    url.searchParams.set('noClouds', '1');
    url.searchParams.delete('cloudtest');
    url.searchParams.set('fx', raw);
    return raw;
  }
  if (!Object.prototype.hasOwnProperty.call(QA_EFFECT_TRIALS, raw)) {
    url.searchParams.delete('fx');
    return 'baseline';
  }
  const test = QA_EFFECT_TRIALS[raw];
  if (test.disableFlag) url.searchParams.delete(test.disableFlag);
  if (raw === 'clouds') url.searchParams.set('cloudtest', 'panorama');
  if (raw === 'reflections') url.searchParams.set('envtest', 'freeze');
  // Keep arbitrary/unapproved combinations rejected by the safety trial.
  url.searchParams.set('fx', raw);
  return raw;
}
