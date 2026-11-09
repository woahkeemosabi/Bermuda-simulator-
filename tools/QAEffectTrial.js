// Coastal v33: restore the user-tested seven-effect iPhone profile as the default.
// Configure AFTER FFT-core normalization; keep ?fx=baseline for explicit GPU isolation.
// Only the two unwanted particle systems (MarineSnow/AirMotes) stay disabled.
// This module does not change game progression or stored player data.
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

// Locked coastal stacks: one proven six-effect comparison and the same six
// plus panorama-only clouds. No arbitrary multi-flag combinations are accepted.
// Haze and reflection bake remain isolated from this experiment.
export const QA_EFFECT_STACKS = Object.freeze({
  'coastal-six': Object.freeze({
    disableFlags: Object.freeze(['noCaustics', 'noShadows', 'noSim', 'noBreakers', 'noSpray', 'noWake']),
    label: 'Caustics + shadows + shore + breakers + spray + wake (clouds off)',
    panoramaClouds: false,
  }),
  'coastal-seven': Object.freeze({
    disableFlags: Object.freeze(['noCaustics', 'noShadows', 'noSim', 'noBreakers', 'noSpray', 'noWake', 'noClouds']),
    label: 'Caustics + shadows + shore + breakers + spray + wake + panorama clouds',
    panoramaClouds: true,
  }),
});

// Aerial haze is intentionally omitted: MobilePostFX does not render its
// separate AirHaze pass. Removing noHaze would allocate effects but not add
// the visual effect to this iPhone one-pass renderer.
export const COASTAL_DEFAULT_PARAMS = Object.freeze({
  perf: '60',
  resCap: '462',
  simBudget: 'balanced',
  cloudBudget: 'lattice',
});

export function configureQAEffectTrial(url) {
  const raw = url.searchParams.get('fx') || 'coastal-seven';
  // The tested full ocean/sky is the main and QA default. Isolation is opt-in.
  if (raw === 'baseline') {
    url.searchParams.set('fx', 'baseline');
    return 'baseline';
  }
  if (Object.prototype.hasOwnProperty.call(QA_EFFECT_STACKS, raw)) {
    const trial = QA_EFFECT_STACKS[raw];
    for (const flag of trial.disableFlags) url.searchParams.delete(flag);
    // Coastal-seven adds ONLY panorama clouds to the successful six-effect QA.
    // Full volumetric clouds remain excluded to avoid unrelated GPU load.
    if (trial.panoramaClouds) {
      url.searchParams.delete('noClouds');
      url.searchParams.set('cloudtest', 'panorama');
    } else {
      url.searchParams.set('noClouds', '1');
      url.searchParams.delete('cloudtest');
    }
    if (raw === 'coastal-seven') {
      // Match the measured 41.5 FPS Coastal v29 test configuration.
      // Defaults are overridable for diagnostic A/B runs.
      for (const [name, value] of Object.entries(COASTAL_DEFAULT_PARAMS)) {
        if (!url.searchParams.has(name)) url.searchParams.set(name, value);
      }
    }
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
