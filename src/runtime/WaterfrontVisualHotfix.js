import { BoxGeometry, CylinderGeometry, Mesh } from '../engine/index.js';
import { Material } from '../engine/render/Material.js';
import { installReferenceDetailUpgrade } from '../world/ReferenceDetailUpgrade.js';
import { WATERFRONT_DECK } from '../world/bermuda/HarbourLayout.js';

// Surgical visual repair for the iPhone waterfront QA build.
// Keeps the stable gameplay/memory path, but removes the accidental enclosed Martha shell,
// repairs the malformed horizontal job board, restores low-cost reference detail, and makes the
// large dock apron read as timber rather than a flat tan placeholder slab.

function mobileHardware() {
    if (typeof navigator === 'undefined') return false;
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
        (navigator.maxTouchPoints > 1 && typeof screen !== 'undefined' && Math.min(screen.width, screen.height) < 1024);
}

function material(name, color, roughness = 0.9, metalness = 0) {
    return new Material({
        name: `waterfront-hotfix-${name}`,
        color,
        roughness,
        metalness,
        underwaterLighting: 'lite',
        localLightsCheap: true,
        receiveShadows: true,
    });
}

function removeAccidentalMarthaShell(app) {
    const shop = app?.marthaShop;
    if (!shop || shop.__openAirShellRemoved) return !!shop;

    // Martha is an OPEN-AIR dock shop in this build. MarthaShopInterior was retained only for its
    // physical stock/purchase logic; its white back/side walls were accidentally left rendered,
    // producing the large featureless white cube seen in iPhone QA.
    shop.group?.parent?.remove?.(shop.group);

    // The door/sign objects are already detached by WaterfrontRepair; keep every enclosed-shop
    // collider non-solid as well so there are no invisible walls around the open stall.
    for (const box of app.colliders?.boxes || []) {
        if (['marthaShopDoor', 'marthaShopBack', 'marthaShopSide'].includes(box.tag)) {
            box.solid = false;
            box.walkable = false;
        }
    }

    shop.__openAirShellRemoved = true;
    return true;
}

function repairJobBoard(app) {
    const jobs = app?.harbourJobBoard;
    if (!jobs?.board || jobs.board.__waterfrontBoardRepaired) return !!jobs?.board;

    const board = jobs.board;
    while (board.children.length) board.remove(board.children[board.children.length - 1]);

    const wood = material('job-board-frame', 0x574331, 0.92);
    const notice = material('job-board-notice', 0xd7c49b, 0.96);
    const trim = material('job-board-trim', 0x8b6e4e, 0.9);

    const panel = new Mesh(new BoxGeometry(1.62, 1.06, 0.10), wood);
    panel.position.set(0, 1.48, 0);
    panel.castShadow = true;
    panel.receiveShadow = true;
    board.add(panel);

    const paper = new Mesh(new BoxGeometry(1.42, 0.84, 0.035), notice);
    paper.position.set(0, 1.48, -0.068);
    paper.castShadow = false;
    paper.receiveShadow = true;
    board.add(paper);

    const header = new Mesh(new BoxGeometry(1.48, 0.13, 0.055), trim);
    header.position.set(0, 1.90, -0.075);
    board.add(header);

    for (const x of [-0.62, 0.62]) {
        const post = new Mesh(new CylinderGeometry(0.055, 0.065, 1.95, 8), wood);
        post.position.set(x, 0.975, 0);
        post.castShadow = true;
        board.add(post);
    }

    // Put the board at the opposite EDGE of the apron from the shops, near the landward end.
    // It faces inward toward the walking corridor instead of floating beside the boat/water route.
    board.position.set(
        WATERFRONT_DECK.x - WATERFRONT_DECK.width * 0.5 + 0.58,
        WATERFRONT_DECK.baseY,
        WATERFRONT_DECK.z - WATERFRONT_DECK.depth * 0.5 + 2.0,
    );
    board.rotation.y = Math.PI / 2;
    board.__waterfrontBoardRepaired = true;
    return true;
}

function repairDockSurface(app) {
    const blockout = app?.bermudaBlockout;
    if (!blockout?.group || blockout.__dockSurfaceRepaired) return !!blockout?.group;

    const baseMat = material('dock-base', 0x5f4936, 0.98);
    const plankMat = material('dock-planks', 0x987858, 0.93);

    // The base slab and 120 plank instances were exactly coplanar at y=1.0, so the plank pattern
    // disappeared and the whole apron read as one enormous tan polygon. Darken the structural slab
    // and lift the plank layer 3.5 cm so its seams/gaps remain visible on the mobile renderer.
    for (const mesh of blockout.visuals?.['shop-apron'] || []) mesh.material = baseMat;
    for (const child of blockout.group.children || []) {
        if (child?.isInstancedMesh && child.count === 120) {
            child.material = plankMat;
            child.position.y += 0.035;
        }
    }

    blockout.__dockSurfaceRepaired = true;
    return true;
}

function restoreBalancedMobileDetail(app) {
    if (!mobileHardware() || !app?.scene || !app?.terrainData || !app?.colliders) return true;
    if (app.__balancedReferenceDetail) return true;

    // ReferenceDetailUpgrade is the deliberately inexpensive authored pass (trim, windows, reef
    // readability, dock composition). Re-enable ONLY this pass on iPhone; heavy street-life,
    // production character packs and exact-video stacks remain disabled by the core-stable profile.
    installReferenceDetailUpgrade(app);
    app.__balancedReferenceDetail = true;
    if (typeof window !== 'undefined') window.__bermudaMobileWorldMode = 'balanced-detail-v3';
    return true;
}

function tick() {
    const app = typeof window !== 'undefined' ? window.__app : null;
    if (!app) return false;

    const detail = restoreBalancedMobileDetail(app);
    const dock = repairDockSurface(app);
    const martha = app.__waterfrontRepair ? removeAccidentalMarthaShell(app) : false;
    const board = repairJobBoard(app);
    return detail && dock && martha && board;
}

if (typeof window !== 'undefined') {
    let tries = 0;
    const timer = window.setInterval(() => {
        tries++;
        const complete = tick();
        if (complete || tries > 600) window.clearInterval(timer);
    }, 80);
    window.addEventListener('pagehide', () => window.clearInterval(timer), { once: true });
}
