#!/usr/bin/env python3
"""Apply physically irregular fish struggle + estimated fork length to fishing QA only."""
from pathlib import Path
R=Path("_qa/fftcore")
def change(path,old,new):
 p=R/path
 src=p.read_text()
 assert src.count(old)==1, f"{path}: anchor appeared {src.count(old)} times: {old[:100]!r}"
 p.write_text(src.replace(old,new,1))

change("src/game/CatchDisplay.js",
 "import { Matrix4, Quaternion, Vector3 } from '../engine/index.js';",
 "import { Matrix4, Quaternion, Vector3 } from '../engine/index.js';\n"
 "import { fishLandingMotion } from './FishLandingMotion.js';")
change("src/game/CatchDisplay.js",
 "const _m = new Matrix4(), _f = new Matrix4(), _q = new Quaternion(), _p = new Vector3(), _s = new Vector3(), _a = new Vector3();",
 "const _m = new Matrix4(), _f = new Matrix4(), _q = new Quaternion(), _roll = new Quaternion(), _p = new Vector3(), _s = new Vector3(), _a = new Vector3();")
change("src/game/CatchDisplay.js",
 """\t\t// struggling: the body curls side to side, the jaw works, the whole fish swings on the line
\t\tconst flap = Math.sin( this.t * 11 ) * 0.9 * Math.exp( - this.t * 0.5 );
\t\tconst swing = Math.sin( this.t * 2.6 ) * 0.25 * Math.exp( - this.t * 0.4 );
\t\t_q.setFromAxisAngle( _a.set( 0, 1, 0 ), faceYaw + swing );
\t\t_f.makeRotationFromQuaternion( _q ).setPosition( mouth );
\t\tthis.place( i, _f, GILL, L, FishProps.gillAnchor( model ), flap, 0, 0.4 + 0.4 * Math.max( 0, Math.sin( this.t * 7 ) ) );""",
 """        // Irregular tail flicks, gill motion and fatigue while the head stays
        // attached to the same line. Pure CPU math feeds existing fish batch.
        const motion = fishLandingMotion( this.t, kg );
        _q.setFromAxisAngle( _a.set( 0, 1, 0 ), faceYaw + motion.yaw );
        _roll.setFromAxisAngle( _a.set( 0, 0, 1 ), motion.roll );
        _q.multiply( _roll );
        _f.makeRotationFromQuaternion( _q ).setPosition( mouth );
        this.place( i, _f, GILL, L, FishProps.gillAnchor( model ), motion.curl, motion.sag, motion.jaw );""")
change("src/game/CatchDisplay.js",
 "\t\t_p.sub( _a.set( anchor[ 0 ], anchor[ 1 ], anchor[ 2 ] ).multiplyScalar( L ).applyQuaternion( _q ) );",
 """        // Mirror FishProps/propVertex bendPoint precisely to pin the fish
        // at its gill rather than slide it on the hook during a strong kick.
        const x = anchor[0], y = anchor[1], z = anchor[2];
        const k1 = curl + (curl >= 0 ? 1e-4 : -1e-4);
        const t1 = k1*z, h1 = Math.sin(t1*0.5);
        const x1 = 2*h1*h1/k1 + x*Math.cos(t1);
        const z1 = Math.sin(t1)/k1 - x*Math.sin(t1);
        const k2 = sag + (sag >= 0 ? 1e-4 : -1e-4);
        const t2 = k2*z1, h2 = Math.sin(t2*0.5);
        const y2 = 2*h2*h2/k2 + y*Math.cos(t2);
        const z2 = Math.sin(t2)/k2 - y*Math.sin(t2);
        _p.sub( _a.set(x1,y2,z2).multiplyScalar(L).applyQuaternion(_q) );""")
change("src/game/GameState.js",
 "import { FISH, fishValue, fishLengthCm } from './FishTable.js';",
 "import { FISH, fishValue, fishLengthCm, fishForkLengthCm } from './FishTable.js';")
change("src/game/GameState.js",
 "const legalSize = ( ! rule.minKg || kg >= rule.minKg ) && ( ! rule.minCm || cm >= rule.minCm );",
 """const forkCm = Math.round(fishForkLengthCm(species,kg));
        const legalSize = ( ! rule.minKg || kg >= rule.minKg ) && ( ! rule.minCm || forkCm >= rule.minCm );""")
change("src/game/GameState.js",
 "this.lastCatch = { species, kg, cm, value, newSpecies, record, prevBestKg, prevBestCm, kept, protectedSpecies, legalSize };",
 "this.lastCatch = { species, kg, cm, forkCm, value, newSpecies, record, prevBestKg, prevBestCm, kept, protectedSpecies, legalSize };")
change("src/game/GameHUD.js",
 "const detail = '≈' + ( info.forkCm || info.cm ) + ' cm fork · ' + info.kg.toFixed( 2 ) + ' kg';" if False else "const detail = info.cm + ' cm · ' + info.kg.toFixed( 2 ) + ' kg';",
 "const detail = '≈' + ( info.forkCm || info.cm ) + ' cm fork · ' + info.kg.toFixed( 2 ) + ' kg';")

assert "fishLandingMotion" in (R/"src/game/CatchDisplay.js").read_text()
assert "const LANDING_SECONDS = 8.0;" in (R/"src/game/Game.js").read_text()
assert "forkCm >= rule.minCm" in (R/"src/game/GameState.js").read_text()
print("Fish v4 landing: eight-second head-pinned 3D tail struggle and species fork length.")
