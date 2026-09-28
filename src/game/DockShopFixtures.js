import {BoxGeometry, CylinderGeometry, Mesh} from '../engine/index.js';
import {Material} from '../engine/render/Material.js';
// Fixtures stay in shop-local coordinates when its temporary visual is replaced.
export function addDockShopFixtures(group, layout, fishMarket = false) {
    const frame = new Material({name:'dock-lamp-frame',color:0x243e40,roughness:.75,receiveShadows:false});
    const glass = new Material({name:'dock-lamp-glass',color:0xffda92,roughness:.35,receiveShadows:false});
    const [x,y,z] = layout.lamp;
    for(const [dy,r,h,m] of [[0,.085,.22,glass],[-.13,.11,.05,frame],[.13,.11,.05,frame]]) {
        const lamp = new Mesh(new CylinderGeometry(r,r,h,8),m);
        lamp.position.set(x,y+dy,z);group.add(lamp);
    }
    if(fishMarket) {
        const tray=new Mesh(new BoxGeometry(.94,.12,.52),new Material({name:'fish-ice-tray',color:0xe5f5f4,roughness:.4,receiveShadows:false}));
        tray.position.set(-.55,1.21,.87); group.add(tray);
    }
}
