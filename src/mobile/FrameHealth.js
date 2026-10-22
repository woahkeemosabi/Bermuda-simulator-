// Pure frame-health classifier. Samples are decoded RGB channel triples (0..255).
export function assessFramePixels(samples, minimum = 9) {
  if (!samples.length) return {valid:false, reason:'no-samples'};
  const lit = rgb => rgb.some(v => Number.isFinite(v) && v > minimum);
  const bright = samples.filter(lit).length;
  const lowerBright = samples.slice(6).filter(lit).length;
  return {valid:bright>=4&&lowerBright>=1, bright, lowerBright,
    reason:bright<4?'black-frame':lowerBright<1?'black-lower-scene':'ok'};
}
