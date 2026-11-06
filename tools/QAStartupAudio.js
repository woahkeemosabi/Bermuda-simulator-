// Prepared only for the existing GitHub Pages iPhone FFT-core QA build.
// Download and decode familiar ambient sounds during the world preload.
// Keep the live AudioContext locked until a genuine Tap to Explore gesture.
import { BANK } from '../audio/soundBank.js';

const ESSENTIAL = Object.freeze([
  'surf_far', 'wind', 'surf_crash', 'surf_wash', 'surf_backwash',
  'pier_lap', 'palms', 'step_sand', 'step_wetsand', 'step_wood',
  'step_water', 'step_grass', 'splash', 'swim',
  'plop', 'reel_wind', 'reel_drag', 'bail_click', 'coins'
]);

export function preloadQAStartupAudio(audio, { onProgress = () => {} } = {}) {
  if (!audio) return Promise.resolve({ decoded: 0, downloaded: 0, total: 0 });
  if (audio._qaAudioPreload) return audio._qaAudioPreload;

  const Offline = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  let decoder = null;
  try {
    if (Offline) decoder = new Offline(1, 1, 44100);
  } catch (_) { /* Some browsers only allow decoding after a gesture. */ }

  audio._preloadedAudioBytes ||= new Map();
  const result = { decoded: 0, downloaded: 0, failed: 0, total: ESSENTIAL.length };
  let next = 0;
  let finished = 0;

  async function worker() {
    while (next < ESSENTIAL.length) {
      const name = ESSENTIAL[next++];
      try {
        if (audio._buffers.has(name)) {
          result.decoded++;
        } else {
          const file = BANK[name]?.file;
          if (!file) throw new Error('No sound file for ' + name);
          // HTTP cache can serve repeat sessions without re-downloading.
          const response = await fetch(audio.baseUrl + file, { cache: 'force-cache' });
          if (!response.ok) throw new Error('Audio ' + name + ' HTTP ' + response.status);
          const bytes = await response.arrayBuffer();
          // Preserve the download in memory even if Safari rejects offline decode.
          audio._preloadedAudioBytes.set(name, bytes);
          result.downloaded++;
          if (decoder) {
            try {
              const buffer = await decoder.decodeAudioData(bytes.slice(0));
              audio._buffers.set(name, buffer);
              result.decoded++;
              audio._preloadedAudioBytes.delete(name);
            } catch (_) { /* Playback context can decode these bytes on Explore. */ }
          }
        }
      } catch (error) {
        result.failed++;
        console.warn('[Bermuda sound preload]', name, error);
      } finally {
        finished++;
        onProgress(finished, ESSENTIAL.length, name);
      }
    }
  }

  // Two workers avoid competing with expensive WebGPU shader compilation.
  audio._qaAudioPreload = Promise.all([worker(), worker()]).then(() => result);
  return audio._qaAudioPreload;
}
