import { BoxGeometry, CylinderGeometry, InstancedMesh, Matrix4, Mesh } from '../engine/index.js';
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
