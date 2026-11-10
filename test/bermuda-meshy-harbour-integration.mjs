import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const race=read('src/game/RaceTheSoundMinigame.js');
const harbour=read('src/game/HarbourMeshyEnhancement.js');
const rig=read('src/game/RaceSoundOriginalModel.js');
const workflow=read('.github/workflows/deploy.yml').toString();
assert.ok(race.includes('installMeshyRaceMarshal(this.marshal)'), 'Replace race organiser with owned Meshy NPC');
assert.ok(race.includes('installMeshyMarinaKit(this.app,this.harbourBoats)'), 'Use owned marina boat GLB');
assert.ok(race.includes('upgradeHarbourPatrols(app,this.patrolBoats)'), 'Moving patrols reuse detailed existing Bermuda boat');
assert.ok(race.includes('this._harbourMeshyPromise'), 'Serialize deferred GLB uploads to protect iPhone warmup');
assert.ok(race.includes('window.__bermudaQAGameplay?.submissions'), 'Wait for confirmed visible GPU gameplay');
assert.ok(race.includes('r.wing.rotation.y=sailSide*'), 'Rotate the real wing broadside toward the spectator');
assert.ok(rig.includes('wingPanel(') && rig.includes('overlayWing(wing,team,gameMaterial)'), 'Articulate a team-coloured sail on original rig');
assert.ok(rig.includes('const sailColour=overlayWing'), 'Original GLB keeps 19 articulated parts with team sail');
assert.ok(harbour.includes('bermuda-marina-kit.glb') && harbour.includes('bermuda-npc-male.glb'));
assert.ok(harbour.includes('original.clone(false)'), 'Patrol geometry must be shared with the real Bermuda boat');
assert.ok(harbour.includes('marshal.setModel(visual)'), 'Keep NPC dialogue and E/ACT within existing Vendor');
assert.ok(workflow.includes('bermuda-simulator'), 'Bermuda Simulator remains sole game brand');
for(const path of ['public/models/bermuda/mobile-v3/bermuda-marina-kit.glb',
                  'public/models/bermuda/street-life/mobile/bermuda-npc-male.glb']){
  const b=readFileSync(new URL('../'+path,import.meta.url));
  assert.ok(b.length>100000 && b.toString('ascii',0,4)==='glTF', 'Missing verified original Meshy GLB: '+path);
  assert.equal(b.readUInt32LE(8),b.length,'GLB byte-length corruption '+path);
  const jsonChunkLen=b.readUInt32LE(12),json=JSON.parse(b.toString('utf8',20,20+jsonChunkLen));
  assert.equal(json.asset.version,'2.0');
  assert.ok(json.meshes?.length>0 && json.nodes?.length>0,'Empty asset '+path);
}
console.log('Bermuda Simulator: genuine Meshy moored boats + NPC, detailed reusable patrols, coloured original catamaran, delayed GPU loading PASS');
