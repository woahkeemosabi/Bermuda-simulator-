import { BoxGeometry, CylinderGeometry, Group, InstancedMesh, Matrix4, SphereGeometry, Vector3 } from '../engine/index.js';
import { Material } from '../engine/render/Material.js';

// iPhone-only visual pass for the waterfront reference. The previous version created well over one
// hundred individual Mesh objects and also let several of them participate in cascaded shadows. On
// Safari/WebGPU that was enough to push the page over the edge after Explore. This version keeps the
// same authored composition but batches repeated geometry into a small number of InstancedMesh draws.
// GPU-recovery launches skip this decorative pass entirely so the recovery URL is genuinely lighter.

function mat(name, color, roughness = 0.9, metalness = 0) {
    return new Material({
        name: `mobile-reference-${name}`,
        color,
        roughness,
        metalness,
        underwaterLighting: 'lite',
        localLightsCheap: true,
        receiveShadows: true,
    });
}

export function installMobileReferenceCorridor(app) {
    if (!app?.scene || !app?.terrainData || app.mobileReferenceCorridor) return app?.mobileReferenceCorridor;

    const safeLevel = typeof location !== 'undefined' ? Number(new URLSearchParams(location.search).get('gpuSafe') || 0) : 0;
    if (safeLevel > 0) {
        app.mobileReferenceCorridor = { root: null, skippedForRecovery: true };
        if (typeof window !== 'undefined') window.__bermudaMobileReference = 'recovery-skip';
        return app.mobileReferenceCorridor;
    }

    const terrain = app.terrainData;
    const root = new Group();
    root.name = 'MobileReferenceCorridor';
    app.scene.add(root);

    const M = {
        pink: mat('pink', 0xd9919f, 0.84),
        blue: mat('blue', 0xa9d6df, 0.84),
        mint: mat('mint', 0xa9cdb9, 0.86),
        cream: mat('cream', 0xe4d9b6, 0.88),
        white: mat('white', 0xf5f2e8, 0.88),
        shutter: mat('shutter', 0x4f3144, 0.82),
        glass: mat('glass', 0x193844, 0.30, 0.05),
        wood: mat('wood', 0x8e6e50, 0.93),
        woodDark: mat('wood-dark', 0x574231, 0.96),
        leaf: mat('leaf', 0x3d6f45, 0.95),
        leaf2: mat('leaf-2', 0x648758, 0.95),
        flower: mat('flower', 0xb93666, 0.94),
        trunk: mat('trunk', 0x7f6546, 1.0),
        cooler: mat('cooler', 0x2b70a8, 0.55),
        yellow: mat('yellow', 0xe9cc55, 0.84),
        dark: mat('dark', 0x203640, 0.82),
    };

    const G = {
        box: new BoxGeometry(1, 1, 1),
        cyl: new CylinderGeometry(1, 1, 1, 8),
        sphere: new SphereGeometry(1, 8, 6),
    };

    const batches = new Map();
    const push = (shape, materialName, x, y, z, sx, sy, sz, ry = 0) => {
        const key = `${shape}:${materialName}`;
        if (!batches.has(key)) batches.set(key, []);
        batches.get(key).push({ x, y, z, sx, sy, sz, ry });
    };
    const box = (m, x, y, z, sx, sy, sz, ry = 0) => push('box', m, x, y, z, sx, sy, sz, ry);
    const cyl = (m, x, y, z, r, h) => push('cyl', m, x, y, z, r, h, r, 0);
    const sphere = (m, x, y, z, sx, sy = sx, sz = sx) => push('sphere', m, x, y, z, sx, sy, sz, 0);

    const roof = (x, y, z, w, d) => {
        for (let i = 0; i < 4; i++) {
            const inset = i * 0.38;
            box('white', x, y + i * 0.18, z, Math.max(2.4, w - inset), 0.16, Math.max(2.2, d - inset * 0.8));
        }
    };

    const house = ({x, z, w, d, h, material, front = 1}) => {
        const gy = Math.max(1.45, terrain.heightAt(x, z));
        box(material, x, gy + h * 0.5, z, w, h, d);
        roof(x, gy + h + 0.16, z, w + 0.5, d + 0.45);
        const fz = z + front * (d * 0.5 + 0.035);
        const wy = gy + 1.55;
        for (const side of [-1, 1]) {
            const wx = x + side * w * 0.24;
            box('white', wx, wy, fz, 1.05, 1.25, 0.06);
            box('glass', wx, wy, fz + front * 0.04, 0.76, 0.96, 0.035);
            box('shutter', wx - 0.58, wy, fz + front * 0.05, 0.16, 1.04, 0.04);
            box('shutter', wx + 0.58, wy, fz + front * 0.05, 0.16, 1.04, 0.04);
        }
        box('white', x, gy + 0.35, fz + front * 0.15, 2.8, 0.16, 0.55);
    };

    house({x:-76.5,z:-56.5,w:8.2,d:6.0,h:4.3,material:'pink'});
    house({x:-65.5,z:-62.5,w:7.2,d:5.6,h:4.0,material:'blue'});
    house({x:-54.5,z:-57.5,w:7.8,d:5.8,h:4.2,material:'mint'});
    house({x:-83.5,z:-68.5,w:7.0,d:5.4,h:3.9,material:'cream'});
    house({x:-69.5,z:-72.5,w:7.4,d:5.8,h:4.1,material:'pink'});
    house({x:-50.5,z:-69.0,w:7.2,d:5.5,h:4.0,material:'blue'});

    for (const [x,z,w] of [[-73,-50,10],[-60,-52,8],[-67,-59,9]]) {
        const gy = Math.max(1.5, terrain.heightAt(x,z));
        box('white',x,gy+0.28,z,w,0.55,0.48);
    }

    const palm = (x, z, h = 6.3) => {
        const gy = Math.max(1.48, terrain.heightAt(x, z));
        cyl('trunk', x, gy + h * 0.48, z, 0.16, h);
        const crownY = gy + h;
        for (let i = 0; i < 6; i++) {
            const a = i * Math.PI / 3;
            box(i % 2 ? 'leaf' : 'leaf2', x + Math.sin(a) * 1.5, crownY, z + Math.cos(a) * 1.5, 0.34, 0.08, 2.8, a);
        }
    };
    for (const p of [
        [-79,-50,6.8],[-73,-53,6.0],[-61,-54,6.6],[-55,-52,6.2],[-47,-56,6.8],
        [-72,-65,7.0],[-58,-65,6.3],[-48,-66,6.6]
    ]) palm(...p);

    for (const [x,z,s] of [
        [-77,-51,1.8],[-71,-51,1.5],[-63,-55,1.8],[-58,-54,1.4],[-53,-55,1.7],
        [-69,-63,1.6],[-61,-63,1.7],[-51,-63,1.5],[-75,-68,1.5]
    ]) {
        const gy = Math.max(1.48, terrain.heightAt(x,z));
        sphere('leaf',x,gy+0.42,z,s,0.45,s*0.8);
        sphere('flower',x+0.25,gy+0.62,z-0.10,s*0.72,0.30,s*0.55);
        sphere('flower',x-0.30,gy+0.52,z+0.18,s*0.60,0.28,s*0.48);
    }

    for (let z=-35; z<=-17; z+=3.0) {
        for (const x of [-69.1,-60.9]) {
            cyl('woodDark',x,1.05,z,0.18,1.9);
            cyl('white',x,2.00,z,0.20,0.12);
        }
    }

    box('wood',-60.8,1.36,-21.0,1.0,0.72,0.62);
    box('wood',-60.8,1.78,-21.0,1.04,0.10,0.66);
    box('cooler',-61.4,1.32,-20.2,0.72,0.46,0.46);
    box('white',-61.4,1.57,-20.2,0.76,0.05,0.50);
    for (const x of [-59.9,-60.5]) box('yellow',x,1.30,-20.0,0.34,0.30,0.34);

    cyl('woodDark',-60.0,2.0,-22.4,0.045,2.1);
    box('white',-60.0,3.08,-22.4,2.4,0.10,2.4);
    box('white',-60.0,3.20,-22.4,1.85,0.09,1.85);

    for (const [x,z] of [[-72.7,-53.3],[-61.8,-59.6],[-54.9,-54.6]]) {
        box('dark',x,2.65,z,0.20,0.30,0.14);
        box('cream',x,2.65,z+0.08,0.15,0.22,0.05);
    }

    const matrix = new Matrix4();
    const scale = new Vector3();
    for (const [key, transforms] of batches) {
        const [shape, materialName] = key.split(':');
        const mesh = new InstancedMesh(G[shape], M[materialName], transforms.length);
        mesh.name = `MobileReferenceBatch-${shape}-${materialName}`;
        for (let i = 0; i < transforms.length; i++) {
            const t = transforms[i];
            matrix.makeRotationY(t.ry || 0);
            scale.set(t.sx, t.sy, t.sz);
            matrix.scale(scale);
            matrix.setPosition(t.x, t.y, t.z);
            mesh.setMatrixAt(i, matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        root.add(mesh);
    }

    app.mobileReferenceCorridor = { root, batches: batches.size };
    if (typeof window !== 'undefined') window.__bermudaMobileReference = 'corridor-instanced-v2';
    return app.mobileReferenceCorridor;
}
