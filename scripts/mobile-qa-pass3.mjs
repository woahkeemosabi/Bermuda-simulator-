import fs from 'node:fs';

function replaceOnce(path, oldText, newText, label) {
  const text = fs.readFileSync(path, 'utf8');
  if (!text.includes(oldText)) throw new Error(`patch anchor missing: ${label}`);
  fs.writeFileSync(path, text.replace(oldText, newText));
}

// Staff remain inside their establishments but sit clearly in the service opening.
replaceOnce(
  'src/game/FishStand.js',
  "\t\tconst local = new Vector3( 0.45, 0, 0.52 ).applyAxisAngle( new Vector3( 0, 1, 0 ), STAND.yaw );",
  "\t\t// Joe stays behind the counter but is brought forward into the service opening.\n\t\tconst local = new Vector3( 0.45, 0, 0.84 ).applyAxisAngle( new Vector3( 0, 1, 0 ), STAND.yaw );",
  'Joe service-window placement'
);
replaceOnce(
  'src/game/FishStand.js',
  "character: { url: ( ( import.meta.env && import.meta.env.BASE_URL ) || '/' ) + 'models/characters/joe.glb', idle: 'idle_neutral_01', talk: 'gestic_talk_relaxed_01', greet: 'wave_01' },",
  "character: { url: ( ( import.meta.env && import.meta.env.BASE_URL ) || '/' ) + 'models/characters/joe.glb', idle: 'idle_neutral_01', talk: 'gestic_talk_relaxed_01', greet: 'wave_01', yaw: Math.PI },",
  'Joe character facing'
);
replaceOnce(
  'src/game/Chandlery.js',
  "\t\tconst local = new Vector3( 0.4, 0, 0.5 ).applyAxisAngle( new Vector3( 0, 1, 0 ), CHANDLERY.yaw );",
  "\t\t// Martha stays inside but stands directly behind the service opening.\n\t\tconst local = new Vector3( 0.4, 0, 0.84 ).applyAxisAngle( new Vector3( 0, 1, 0 ), CHANDLERY.yaw );",
  'Martha service-window placement'
);
replaceOnce(
  'src/game/Chandlery.js',
  "character: { url: ( ( import.meta.env && import.meta.env.BASE_URL ) || '/' ) + 'models/characters/marta.glb', idle: 'idle_neutral_01', talk: 'gestic_talk_neutral_01', greet: 'wave_01' },",
  "character: { url: ( ( import.meta.env && import.meta.env.BASE_URL ) || '/' ) + 'models/characters/marta.glb', idle: 'idle_neutral_01', talk: 'gestic_talk_neutral_01', greet: 'wave_01', yaw: Math.PI },",
  'Martha character facing'
);

// Rocketbox avatars need an independent base yaw because Vendor.update continuously applies the
// small look-at yaw offset every frame.
replaceOnce(
  'src/game/Vendor.js',
  "\tasync loadCharacter( url, { idle = 'idle_neutral_01', talk = 'gestic_talk_relaxed_01', greet = 'wave_01', listen = null } = {} ) {",
  "\tasync loadCharacter( url, { idle = 'idle_neutral_01', talk = 'gestic_talk_relaxed_01', greet = 'wave_01', listen = null, yaw = 0 } = {} ) {",
  'vendor character yaw option'
);
replaceOnce(
  'src/game/Vendor.js',
  "\t\tthis.character = model;\n\t\tthis.setModel( model.group );",
  "\t\tthis.character = model;\n\t\tthis.characterYaw = yaw;\n\t\tthis.setModel( model.group );",
  'store vendor character yaw'
);
replaceOnce(
  'src/game/Vendor.js',
  "\t\t\tf.rotation.y = this._yawOff;\n\t\t\tc.update( dt );",
  "\t\t\tf.rotation.y = ( this.characterYaw || 0 ) + this._yawOff;\n\t\t\tc.update( dt );",
  'apply vendor base yaw during animation'
);

// Add actual building names with a small physical block-letter sign. No font or texture download is
// needed, and the sign stays shop-local when the richer static storefront replaces the fallback.
fs.writeFileSync('src/game/DockShopFixtures.js', String.raw`import { BoxGeometry, CylinderGeometry, InstancedMesh, Matrix4, Mesh } from '../engine/index.js';
import { Material } from '../engine/render/Material.js';

const FONT = {
 A:['01110','10001','10001','11111','10001','10001','10001'],
 B:['11110','10001','10001','11110','10001','10001','11110'],
 C:['01111','10000','10000','10000','10000','10000','01111'],
 E:['11111','10000','10000','11110','10000','10000','11111'],
 F:['11111','10000','10000','11110','10000','10000','10000'],
 H:['10001','10001','10001','11111','10001','10001','10001'],
 I:['11111','00100','00100','00100','00100','00100','11111'],
 J:['00111','00010','00010','00010','10010','10010','01100'],
 K:['10001','10010','10100','11000','10100','10010','10001'],
 L:['10000','10000','10000','10000','10000','10000','11111'],
 M:['10001','11011','10101','10101','10001','10001','10001'],
 O:['01110','10001','10001','10001','10001','10001','01110'],
 R:['11110','10001','10001','11110','10100','10010','10001'],
 S:['01111','10000','10000','01110','00001','00001','11110'],
 T:['11111','00100','00100','00100','00100','00100','00100'],
 '+':['00000','00100','00100','11111','00100','00100','00000'],
 "'":['00100','00100','00000','00000','00000','00000','00000'],
};

function addPixelSign(group, lines) {
 const boardMat = new Material({name:'shop-sign-board',color:0x12313d,roughness:.82,receiveShadows:false});
 const typeMat = new Material({name:'shop-sign-type',color:0xf4f1df,roughness:.55,receiveShadows:false});
 const board = new Mesh(new BoxGeometry(2.9,.58,.07),boardMat);
 board.position.set(0,2.22,1.31); group.add(board);
 const px=.029, gap=.008, cell=px+gap, placements=[];
 lines.forEach((line,row)=>{
  const chars=[...line.toUpperCase()];
  const width=Math.max(0,chars.length*6-1)*cell;
  const x0=-width*.5, y0=row===0?2.32:2.10;
  chars.forEach((ch,ci)=>{
   if(ch===' ') return;
   const glyph=FONT[ch]; if(!glyph) return;
   glyph.forEach((bits,gy)=>[...bits].forEach((on,gx)=>{
    if(on==='1') placements.push([x0+(ci*6+gx)*cell,y0+(3-gy)*cell,1.355]);
   }));
  });
 });
 const dots=new InstancedMesh(new BoxGeometry(px,px,.026),typeMat,placements.length), m=new Matrix4();
 placements.forEach((p,i)=>{m.makeTranslation(p[0],p[1],p[2]);dots.setMatrixAt(i,m);});
 dots.instanceMatrix.needsUpdate=true; dots.computeBoundingSphere(); group.add(dots);
}

// Fixtures stay in shop-local coordinates when its temporary visual is replaced.
export function addDockShopFixtures(group, layout, fishMarket = false) {
 const frame = new Material({name:'dock-lamp-frame',color:0x243e40,roughness:.75,receiveShadows:false});
 const glass = new Material({name:'dock-lamp-glass',color:0xffda92,roughness:.35,receiveShadows:false});
 const [x,y,z] = layout.lamp;
 for(const [dy,r,h,m] of [[0,.085,.22,glass],[-.13,.11,.05,frame],[.13,.11,.05,frame]]) {
  const lamp = new Mesh(new CylinderGeometry(r,r,h,8),m);
  lamp.position.set(x,y+dy,z);group.add(lamp);
 }
 addPixelSign(group, fishMarket ? ["JOE'S",'FISH MARKET'] : ["MARTHA'S",'BAIT + TACKLE']);
 if(fishMarket) {
  const tray=new Mesh(new BoxGeometry(.94,.12,.52),new Material({name:'fish-ice-tray',color:0xe5f5f4,roughness:.4,receiveShadows:false}));
  tray.position.set(-.55,1.21,.87); group.add(tray);
 }
}
`);

// Make the temporary lobster read as a Caribbean spiny lobster instead of an oversized insect.
replaceOnce(
  'src/game/Lobsters.js',
  "const BODY = 0x9a3e24;\nconst SHELL = 0xb85c32;\nconst JOINT = 0x6f2e1f;\nconst CREAM = 0xd9b98d;",
  "const BODY = 0x6b3826;\nconst SHELL = 0xa85a32;\nconst JOINT = 0x3b241d;\nconst CREAM = 0xe1c68d;",
  'lobster shell palette'
);
replaceOnce(
  'src/game/Lobsters.js',
  "\tadd( sphere( 0.22, 18, 11 ), BODY, 0.5, mat4( 0, 0.17, 0.08, 0, 0, 0, 1.0, 0.58, 1.45 ) );\n\tfor ( let i = 0; i < 5; i ++ ) {\n\n\t\tconst z = - 0.19 - i * 0.105;\n\t\tconst r = 0.18 - i * 0.014;\n\t\tadd( sphere( r, 14, 8 ), i % 2 ? BODY : SHELL, 0.56, mat4( 0, 0.14 - i * 0.006, z, 0, 0, 0, 1.0, 0.52, 0.62 ) );\n\n\t}",
  "\tadd( sphere( 0.23, 20, 12 ), BODY, 0.5, mat4( 0, 0.15, 0.08, 0, 0, 0, 1.05, 0.48, 1.22 ) );\n\tfor ( let i = 0; i < 4; i ++ ) {\n\n\t\tconst z = - 0.17 - i * 0.12;\n\t\tconst r = 0.17 - i * 0.018;\n\t\tadd( sphere( r, 16, 8 ), i % 2 ? BODY : SHELL, 0.56, mat4( 0, 0.12 - i * 0.004, z, 0, 0, 0, 1.05, 0.42, 0.72 ) );\n\n\t}",
  'lobster adult body proportions'
);
replaceOnce(
  'src/game/Lobsters.js',
  "\t\t\tconst size = 0.82 + this.rng() * 0.34;",
  "\t\t\tconst size = 0.58 + this.rng() * 0.18;",
  'lobster visual scale'
);
replaceOnce(
  'src/game/Lobsters.js',
  "\t\t\t\tsize, bodyCm: Math.round( ( 44 + this.rng() * 18 ) * size ),\n\t\t\t\tkg: Math.round( ( 0.75 + this.rng() * 2.0 ) * size * 100 ) / 100,",
  "\t\t\t\tsize, bodyCm: Math.round( 30 + this.rng() * 20 ),\n\t\t\t\tkg: Math.round( ( 0.7 + this.rng() * 1.9 ) * ( 0.78 + size * 0.3 ) * 100 ) / 100,",
  'lobster catch scale'
);

// Lobsters are hand-captured with ACT. A spear aimed at one gets physical feedback, but never enters
// the fish-only spear/display pipeline that caused the iPhone QA crash.
replaceOnce(
  'src/game/Game.js',
  "\tfireSpear() {\n\n\t\tthis._spearCooldown = 0.7;\n\t\tif ( this.spear ) this.spear.fire();\n\t\tconst app = this.app, schools = app.reef && app.reef.fish;\n\t\tif ( ! schools || ! schools.spearHit ) return;\n\t\tapp.player.getViewDir( this._spearDir ).normalize();",
  "\tfireSpear() {\n\n\t\tthis._spearCooldown = 0.7;\n\t\tconst app = this.app;\n\t\tapp.player.getViewDir( this._spearDir ).normalize();\n\t\tconst lobsterAim = this.lobsters && this.lobsters.target( app.camera.position, this._spearDir, 4.0 );\n\t\tif ( this.spear ) this.spear.fire();\n\t\tif ( lobsterAim ) {\n\n\t\t\tif ( this.spear ) this.spear.impact( lobsterAim.position, 0.45 );\n\t\t\tthis.toast( 'Caribbean spiny lobster · move close and use ACT to grab', 1900 );\n\t\t\treturn;\n\n\t\t}\n\t\tconst schools = app.reef && app.reef.fish;\n\t\tif ( ! schools || ! schools.spearHit ) return;",
  'lobster-safe spear path'
);
replaceOnce(
  'src/game/Game.js',
  "\t\tconst kept = this.state.addFish( 'spinyLobster', hit.kg, app.settings?.timeOfDay ?? 12, hit.cm );",
  "\t\tlet kept;\n\t\ttry {\n\n\t\t\tkept = this.state.addFish( 'spinyLobster', hit.kg, app.settings?.timeOfDay ?? 12, hit.cm );\n\n\t\t} catch ( error ) {\n\n\t\t\tconsole.error( 'lobster capture recovered', error );\n\t\t\tthis.lobsters.restore( hit.id );\n\t\t\tthis.toast( 'Lobster capture recovered · try again', 1800 );\n\t\t\treturn false;\n\n\t\t}",
  'defensive lobster capture'
);

// Spend more of the loading phase on real pipeline preparation. This is a maximum wait: it still
// proceeds immediately if the pipelines are ready sooner.
replaceOnce(
  'src/main.js',
  "\t\t\tnew Promise( ( resolve ) => setTimeout( resolve, 6500 ) ),",
  "\t\t\tnew Promise( ( resolve ) => setTimeout( resolve, 25000 ) ),",
  'mobile pipeline preparation window'
);

// Load the already-optimized mobile waterfront tiers before gameplay instead of streaming them while
// the first interactive frames are competing for the iPhone GPU. The function is idempotent, so the
// existing post-start call becomes a no-op.
replaceOnce(
  'src/main.js',
  "    const waterfront = await applyBermudaRuntimeLook( app );\n    if ( ! waterfront?.ready ) {\n        const details = waterfront?.errors.map( e => e.id + ': ' + e.message ).join( '; ' );\n        throw new Error( 'Waterfront failed to load: ' + ( details || 'scene unavailable' ) );\n    }\n\tapp.ui = new AppUI( app, ui );",
  "    const waterfront = await applyBermudaRuntimeLook( app );\n    if ( ! waterfront?.ready ) {\n        const details = waterfront?.errors.map( e => e.id + ': ' + e.message ).join( '; ' );\n        throw new Error( 'Waterfront failed to load: ' + ( details || 'scene unavailable' ) );\n    }\n    if ( mobileDevice ) {\n        ui.setLoading( 0.992, 'Preparing Bermuda scenery', 0.998 );\n        await startDeferredWaterfront( app );\n    }\n\tapp.ui = new AppUI( app, ui );",
  'preload optimized waterfront before mobile play'
);

// The mobile start overlay must be opaque: before the first frame, the WebGPU canvas can legitimately
// contain unrendered black regions. Do not expose them as part of the loading experience.
replaceOnce(
  'src/mobile/BermudaMobileStable.js',
  "\t\tbody.bm-mobile .tw-depth{display:none!important}\n\t\t@media (max-width:700px){body.bm-mobile .gm-map{width:102px;height:102px;right:15px;bottom:230px;opacity:.84}}",
  "\t\tbody.bm-mobile .tw-depth{display:none!important}\n\t\tbody.bm-mobile .tw-start{background:radial-gradient(90% 55% at 50% 18%,rgba(40,132,181,.96),rgba(9,52,76,.98) 62%,#04151f 100%)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}\n\t\tbody.bm-mobile .tw-start-inner{background:rgba(3,22,32,.34);border:1px solid rgba(150,242,234,.18);border-radius:24px;padding:24px 22px;box-shadow:0 22px 70px rgba(0,0,0,.28)}\n\t\t@media (max-width:700px){body.bm-mobile .gm-map{width:102px;height:102px;right:15px;bottom:230px;opacity:.84}}",
  'opaque mobile start overlay'
);

console.log('mobile QA pass 3 patches applied');
