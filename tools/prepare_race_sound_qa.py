#!/usr/bin/env python3
"""Enable Race the Sound only in the derived GitHub Pages race QA build.

Requires the pinned, GPU-stabilized fishing v4 source already assembled at
_qa/fftcore. The fish/FFT stable QA and root production builds stay unmodified.
"""
from pathlib import Path
R=Path("_qa/fftcore")
def once(relative,old,new):
    p=R/relative
    src=p.read_text()
    assert src.count(old)==1, f"{relative}: expected exactly one anchor, found {src.count(old)}: {old[:100]!r}"
    p.write_text(src.replace(old,new,1))

once("src/game/Game.js",
    "import { Spear } from './Spear.js';",
    "import { Spear } from './Spear.js';\nimport { RaceTheSoundMinigame } from './RaceTheSoundMinigame.js';")
once("src/game/Game.js",
    "this.vendors = [ this.stand.vendor, this.chandlery.vendor ];",
    """this.vendors = [ this.stand.vendor, this.chandlery.vendor ];
        // Additional lightweight pier marshal; no new GLB characters.
        this.raceSound = new RaceTheSoundMinigame( app, this );
        this.vendors.push( this.raceSound.marshal );""")
once("src/game/Game.js",
    """\t\tconst can = this.canFish;""",
    """        // Only the new race QA has this mode. During a race the existing
        // FFT renderer keeps running, but fishing/vendors do not compete for E.
        if ( this.raceSound ) {
            if ( this.raceSound.active ) return;
            this.raceSound.updateHarbour( dt );
        }
\t\tconst can = this.canFish;""")
once("src/game/Game.js",
    """\t\tif ( inp.hit( 'KeyE' ) ) {

\t\t\tif ( ! hud ) {""",
    """\t\tif ( inp.hit( 'KeyE' ) ) {

            if ( near.kind === 'race' ) {
                if ( hud && hud.standOpen ) hud.closeStand();
                this.raceSound.offer();
                return;
            }
\t\t\tif ( ! hud ) {""")
once("src/App.js",
    """\t\t\tif ( this.freeCam ) this.fly.update( dt );
\t\t\telse this.player.update( dt );""",
    """            // One scene and one WebGPU device, even during Race the Sound.
            // The supplied foil catamaran uses the already-running FFT ocean.
            if ( this.game?.raceSound?.active ) this.game.raceSound.step( dt );
\t\t\telse if ( this.freeCam ) this.fly.update( dt );
\t\t\telse this.player.update( dt );""")
game=(R/"src/game/Game.js").read_text()
app=(R/"src/App.js").read_text()
rules=(R/"src/game/RaceSoundRules.js").read_text()
race=(R/"src/game/RaceTheSoundMinigame.js").read_text()
assert "this.vendors.push( this.raceSound.marshal );" in game
assert "this.raceSound.offer();" in game
assert "this.game?.raceSound?.active" in app
assert "this.fft.update( dt )" in app
assert "this.player.update( dt )" in app
assert "SOUND_MARKS" in rules and "this.game.state.addMoney(reward)" in race
assert "new Vendor" in race and "app.query.allocate('race-sound-v1'" in race
assert "document.body.classList.add('rts-racing')" in race
print("Native Race the Sound: pier NPC, interactive qualifier, AI, parked/patrol boats, single FFT renderer")
