#!/usr/bin/env python3
"""Low-cost, species-specific shader markings for six Bermuda fish morphs."""
from pathlib import Path
p=Path("_qa/fftcore/src/world/fish/FishMaterial.js")
s=p.read_text()
def change(before,after):
 global s
 assert s.count(before)==1, f"fish shader anchor {s.count(before)}: {before[:90]!r}"
 s=s.replace(before,after,1)

# Distinct pigment patterns, but SAME single fish material, bindings and
# batch rendering. Fish shader uses procedural colours, no bitmap textures.
marks="""
    } else if ( pat == ${ PT( 'hogfish' ) } ) {
        let muzzle=smoothstep(0.17,0.38,z)*bodyK;
        c=mix(c,vec3f(0.68,0.31,0.44),muzzle*0.55);
        let purple=fishBand(y-0.012-z*0.09,0.0,0.014,0.004)*bodyK;
        c=mix(c,vec3f(0.39,0.12,0.29),purple*0.75);
    } else if ( pat == ${ PT( 'wahoo' ) } ) {
        // Narrow navy-blue irregular vertical bars over iridescent silver.
        let bars=smoothstep(0.52,0.82,sin(z*118.0+y*21.0+n1*1.2))*bodyK;
        c=mix(c,vec3f(0.09,0.17,0.32),bars*0.78);
    } else if ( pat == ${ PT( 'yellowfin' ) } ) {
        let gold=fishBand(h,0.1,0.20,fwH+0.03)*bodyK;
        c=mix(c,vec3f(0.85,0.68,0.16),gold*0.47);
        c=mix(c,vec3f(0.93,0.76,0.11),
            select(0.0,0.95,P == ${ PA( 'FINLET' ) }));
    } else if ( pat == ${ PT( 'blackGrouper' ) } ) {
        let marbled=fishVnoise(vec2f(z,y)*31.0+seed*2.0);
        let spots=smoothstep(0.43,0.71,marbled)*bodyK;
        c=mix(c,vec3f(0.08,0.18,0.12),spots*0.65);
        let pale=smoothstep(0.68,0.83,fishVnoise(vec2f(z,y)*95.0))*bodyK;
        c=mix(c,vec3f(0.67,0.71,0.46),pale*0.35);
    } else if ( pat == ${ PT( 'redHind' ) } ) {
        let dot=vec2f(z,y)*105.0;
        let cell=floor(dot); let q=fract(dot)-0.5;
        let jitter=vec2f(fishHash(cell+3.9),fishHash(cell+8.2))-0.5;
        let spots=1.0-smoothstep(0.11,0.23,length(q-jitter*0.5));
        c=mix(c,vec3f(0.69,0.12,0.11),spots*bodyK*0.95);
    } else if ( pat == ${ PT( 'laneSnapper' ) } ) {
        // Golden lateral stripes, pink body and black shoulder spot.
        let lines=smoothstep(0.60,0.90,sin(y*105.0+z*2.0))*bodyK;
        c=mix(c,vec3f(0.87,0.63,0.23),lines*0.55);
        let spot=1.0-smoothstep(0.028,0.050,length(vec2f(z+0.045,y-0.025)));
        c=mix(c,vec3f(0.13,0.12,0.17),spot*bodyK*0.9);
"""
change("\t} else if ( pat == ${ PT( 'tarpon' ) } ) {",marks+"\t} else if ( pat == ${ PT( 'tarpon' ) } ) {")
change("""\t\tc *= 1.0 - rows;
\t} else if ( pat == ${ PT( 'grouper' ) } ) {""",
       """\t\tc *= 1.0 - rows;
        // Silk snapper (L. vivanus) has fine light gold lateral lines.
        let silk=smoothstep(0.77,0.95,sin(y*123.0+z*25.0))*bodyK*(1.0-tBelly);
        c=mix(c,vec3f(0.94,0.73,0.38),silk*0.17);
\t} else if ( pat == ${ PT( 'grouper' ) } ) {""")
# Catch labels must not randomly shade the fish as the opposite species.
change("let blue = fract( seed * 3.7 ) < 0.4;",
       "let blue = true; // dedicated Bluestriped grunt")
change("let queen = fract( seed * 4.3 ) < 0.4;",
       "let queen = false; // dedicated Stoplight parrotfish")
p.write_text(s)
for id in ['hogfish','wahoo','yellowfin','blackGrouper','redHind','laneSnapper']:
 assert "PT( '"+id+"' )" in s,id
assert "fishVnoise" in s and "s.clearcoat = coat" in s
print("Bermuda six distinct fish patterns; no extra material/pipeline/texture.")
