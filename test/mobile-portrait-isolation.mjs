import assert from 'node:assert/strict';
import { isMobileCatchModal, isolateMobilePortraitFrame } from '../src/mobile/PortraitIsolation.js';

const app = { mobileLite: true, game: { hud: { catchOpen: false, portrait: { renderedThisFrame: false } } } };
assert.equal(isolateMobilePortraitFrame(app), false);
app.game.hud.portrait.renderedThisFrame = true;
assert.equal(isolateMobilePortraitFrame(app), true, 'thumbnail frame must not overlap ocean rendering');
app.game.hud.portrait.renderedThisFrame = false;
app.game.hud.catchOpen = true;
assert.equal(isMobileCatchModal(app), true);
assert.equal(isolateMobilePortraitFrame(app), true, 'card stays isolated between 12fps fish updates');
app.mobileLite = false;
assert.equal(isolateMobilePortraitFrame(app), false, 'desktop retains original rendering');
assert.equal(isMobileCatchModal(app), false);

console.log('mobile fish portrait frames never share world GPU submissions');
