#!/usr/bin/env python3
"""Bermuda-specific fish roster and morphs, applied ONLY to pinned fishing QA."""
from pathlib import Path
R=Path("_qa/fftcore")
def change(path,old,new):
 p=R/path
 s=p.read_text()
 assert s.count(old)==1, f"{path}: expected anchor once, got {s.count(old)}: {old[:90]!r}"
 p.write_text(s.replace(old,new,1))

# Keep original inventory/species IDs so existing player saves and Joe's fish
# economy do not reset. Correct common/scientific names to Bermuda's checklist.
for before,after in {
 "name: 'Hardhead silverside', sci: 'Atherinomorus stipes'":"name: 'Reef silverside', sci: 'Hypoatherina harringtonensis'",
 "name: 'Striped mullet', sci: 'Mugil cephalus'":"name: 'White mullet', sci: 'Mugil curema'",
 "name: 'Houndfish', sci: 'Tylosurus crocodilus'":"name: 'Flat needlefish', sci: 'Ablennes hians'",
 "name: 'Queen angelfish', sci: 'Holacanthus ciliaris'":"name: 'French angelfish', sci: 'Pomacanthus paru'",
 "name: 'Crevalle jack', sci: 'Caranx hippos'":"name: 'Bar jack', sci: 'Caranx ruber'",
 "name: 'Red snapper', sci: 'Lutjanus campechanus'":"name: 'Silk snapper', sci: 'Lutjanus vivanus'",
}.items(): change("src/game/FishTable.js",before,after)
for before,after in {
 "model: 'wrasse', habitat: { reef: 0.8":"model: 'hogfish', habitat: { reef: 0.8",
 "model: 'barracuda', habitat: { deep: 1 }":"model: 'wahoo', habitat: { deep: 1 }",
 "model: 'tuna', habitat: { deep: 1 }, kg: [ 3.2, 45 ]":"model: 'yellowfin', habitat: { deep: 1 }, kg: [ 3.2, 45 ]",
 "model: 'grouper', habitat: { reef: 0.55":"model: 'blackGrouper', habitat: { reef: 0.55",
 "model: 'grouper', habitat: { reef: 0.9":"model: 'redHind', habitat: { reef: 0.9",
 "model: 'yellowtail', habitat: { reef: 0.8":"model: 'laneSnapper', habitat: { reef: 0.8",
 "model: 'redSnapper', habitat: { deep: 1, bay: 0.2 }":"model: 'redSnapper', habitat: { deep: 1 }",
 "kg: [ 0.4, 1.6 ], price: 12, fight:":"kg: [ 0.4, 1.6 ], price: 12, minCm: 30, fight:",
 "kg: [ 0.5, 4 ], price: 16, fight:":"kg: [ 0.5, 4 ], price: 16, minCm: 45, fight:",
}.items(): change("src/game/FishTable.js",before,after)

registry="""
// Bermuda occurrence audit. Keep IDs stable; reject accidental non-local additions.
// References: DENR environment.bm/fish, DENR inshore-bays, and October 2026
// Bermuda FishBase checklist. The lobster is an invertebrate/hand capture.
export const BERMUDA_CATCH_IDS = Object.freeze( [
 'silverside','mullet','needlefish','sergeant','grunt','yellowtail','chromis',
 'tang','wrasse','parrot','angel','jack','barracuda','grouper','redSnapper',
 'tuna','mahi','wahoo','yellowfin','blackGrouper','redHind','laneSnapper',
 'tarpon','spinyLobster'
] );
if ( FISH_IDS.length !== BERMUDA_CATCH_IDS.length ||
    FISH_IDS.some( id => ! BERMUDA_CATCH_IDS.includes( id ) ) )
    throw new Error( 'Unverified fish in Bermuda-only catch roster' );

// Fish lengths come from an estimated size-weight curve. Rules specify fork
// length, so convert total length with a species-tail estimate; never claim
// the result is a physically measured length or a complete legal audit.
export function fishForkLengthCm(id,kg) {
 return fishLengthCm(id,kg) * ( FISH[id].forkRatio ?? 0.91 );
}

"""
change("src/game/FishTable.js","// $ value of a fish; trophy-sized ones fetch a bit more per kg", registry+"// $ value of a fish; trophy-sized ones fetch a bit more per kg")
for id,ratio in [("yellowtail",0.86),("laneSnapper",0.91),("wrasse",0.97),("redHind",0.96),("blackGrouper",0.96)]:
 p=R/"src/game/FishTable.js"
 src=p.read_text()
 st=src.index("\t"+id+": {")
 en=src.index("\n",st)
 line=src[st:en]
 assert line.count("model:")==1 and "forkRatio" not in line,id
 p.write_text(src[:st]+line.replace("model:",f"forkRatio: {ratio}, model:",1)+src[en:])

change("src/world/fish/FishSpecies.js",
 "stingray: 18, eagleRay: 19, turtle: 20,",
 "stingray: 18, eagleRay: 19, turtle: 20,\n\thogfish: 21, wahoo: 22, yellowfin: 23, blackGrouper: 24, redHind: 25, laneSnapper: 26,")

# Separate geometry: no Wahoo/Barracuda, Hogfish/Bluehead or Lane/Yellowtail
# substitutions. Procedural fins, eyes, mouths, colours stay in existing shaders.
models="""
// Audited Bermuda fish anatomy variants; small memory cost; same batched draw.
const scaleProfile=(points,m)=>points.map(([u,v])=>[u,v*m]);
SPECIES.hogfish = {
 ...SPECIES.wrasse, pattern:PATTERN.hogfish, body:0.82, sec:2.25,
 top:scaleProfile(SPECIES.wrasse.top,1.68),
 bot:scaleProfile(SPECIES.wrasse.bot,1.60),
 wid:scaleProfile(SPECIES.wrasse.wid,1.75),
 mouth:{corner:0.17,y:-0.035,tip:-0.033,protrude:0.020},
 eye:{u:0.20,y:0.048,r:0.024}, opercle:0.32,
 dorsal:[spiny(0.28,0.53,14,[[0,0.19],[0.2,0.23],[0.4,0.11],[1,0.055]],[0.35,0.60]),
         soft(0.54,0.85,14,[[0,0.07],[0.55,0.11],[1,0.04]],[0.6,0.95])],
 caudal:{shape:'rounded',len:0.18,span:0.15,fork:0.95,rays:15},
};
SPECIES.wahoo = {
 ...SPECIES.tuna, pattern:PATTERN.wahoo, body:0.88,
 top:scaleProfile(SPECIES.tuna.top,0.67),
 bot:scaleProfile(SPECIES.tuna.bot,0.70),
 wid:scaleProfile(SPECIES.tuna.wid,0.67),
 mouth:{corner:0.115,y:-0.007,tip:-0.006,protrude:0.014},
 eye:{u:0.135,y:0.022,r:0.014}, opercle:0.27,
 dorsal:[spiny(0.27,0.57,22,[[0,0.065],[0.25,0.05],[1,0.022]],[0.45,0.8]),
         soft(0.59,0.67,10,[[0,0.054],[0.35,0.04],[1,0.02]],[0.65,1.0])],
 anal:[soft(0.61,0.69,10,[[0,0.05],[1,0.018]],[0.6,0.9])],
 pectoral:{...SPECIES.tuna.pectoral,u:0.3,len:0.10},
 caudal:{shape:'lunate',len:0.12,span:0.18,fork:0.35,rays:17},
 finlets:{from:0.69,to:0.95,dorsal:9,ventral:8},
};
SPECIES.yellowfin = {
 ...SPECIES.tuna, pattern:PATTERN.yellowfin,
 top:scaleProfile(SPECIES.tuna.top,1.16),
 bot:scaleProfile(SPECIES.tuna.bot,1.14),
 dorsal:[SPECIES.tuna.dorsal[0],
         soft(0.50,0.66,14,[[0,0.22],[0.2,0.25],[0.6,0.10],[1,0.035]],[0.45,1.05])],
 anal:[soft(0.55,0.68,13,[[0,0.22],[0.2,0.24],[0.6,0.09],[1,0.025]],[0.50,1.0])],
 pectoral:{...SPECIES.tuna.pectoral,len:0.23},
 finlets:{from:0.67,to:0.95,dorsal:8,ventral:8},
};
SPECIES.blackGrouper = {
 ...SPECIES.grouper, pattern:PATTERN.blackGrouper,
 top:scaleProfile(SPECIES.grouper.top,1.12),
 bot:scaleProfile(SPECIES.grouper.bot,1.07),
 mouth:{...SPECIES.grouper.mouth,protrude:0.015},
 caudal:{shape:'truncate',len:0.16,span:0.13,fork:0.91,rays:15},
};
SPECIES.redHind = {
 ...SPECIES.grouper, pattern:PATTERN.redHind,
 top:scaleProfile(SPECIES.grouper.top,0.82),
 bot:scaleProfile(SPECIES.grouper.bot,0.83),
 wid:scaleProfile(SPECIES.grouper.wid,0.83),
 eye:{...SPECIES.grouper.eye,u:0.13,r:0.021},
 caudal:{shape:'rounded',len:0.16,span:0.10,fork:0.96,rays:15},
};
SPECIES.laneSnapper = {
 ...SPECIES.redSnapper, pattern:PATTERN.laneSnapper,
 top:scaleProfile(SPECIES.redSnapper.top,0.82),
 bot:scaleProfile(SPECIES.redSnapper.bot,0.82),
 wid:scaleProfile(SPECIES.redSnapper.wid,0.82),
 caudal:{shape:'forked',len:0.18,span:0.14,fork:0.53,rays:17},
};
"""
change("src/world/fish/FishSpecies.js", "\n};\n\n// Skin colours (sRGB)", "\n};\n"+models+"\n// Skin colours (sRGB)")
skins="""\thogfish: {back:0x9d514a,flank:0xd9ab94,belly:0xf0c9ad,fin:0xac6a82,edge:0x6b384b,rough:0.34},
\twahoo: {back:0x142744,flank:0x7f9fb7,belly:0xe5eaf1,fin:0x416080,edge:0x1e2e4d,rough:0.28},
\tyellowfin: {back:0x132c4d,flank:0x96bac7,belly:0xe7eaeb,fin:0xf2c92e,edge:0xe7be21,rough:0.26},
\tblackGrouper: {back:0x293526,flank:0x5a6650,belly:0x9f9b70,fin:0x3c4d32,edge:0x1d281f,rough:0.43},
\tredHind: {back:0xb35b4f,flank:0xe3b5a0,belly:0xf0d2bd,fin:0xc37a65,edge:0x8c4b41,rough:0.39},
\tlaneSnapper: {back:0xbfa39b,flank:0xe7c5bf,belly:0xf1e3d8,fin:0xe7ba7b,edge:0xbd8558,rough:0.35},
"""
change("src/world/fish/FishSpecies.js","\tstingray: { back: 0x6c604c",skins+"\tstingray: { back: 0x6c604c")
print("Bermuda roster + six new geometries/skins prepared")
