import { BoxGeometry, CylinderGeometry, Mesh } from '../engine/index.js';
import { Material } from '../engine/render/Material.js';
import { App } from '../App.js';
import { installBermudaDockHudFix } from '../mobile/BermudaDockHudFix.js';
import { installReferenceDetailUpgrade } from '../world/ReferenceDetailUpgrade.js';
import { WATERFRONT_DECK } from '../world/bermuda/HarbourLayout.js';

// Surgical visual/HUD repair for the iPhone waterfront QA build.
// This module is loaded before main.js, so expose the App instance as soon as App.init runs. The
// previous version waited for window.__app even though main.js never assigned it, meaning the entire
// repair (shop shell removal, job-board relocation, dock planks and detail pass) silently never ran.
if ( ! App.prototype.__bermudaWaterfrontExposePatched ) {
    App.prototype.__bermudaWaterfrontExposePatched = true;
    const originalInit = App.prototype.init;
    App.prototype.init = async function bermudaWaterfrontInit( ...args ) {
        if ( typeof window !== 'undefined' ) window.__app = this;
        return originalInit.apply( this, args );
    };
}

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

    // Martha is an OPEN-AIR dock shop in this build. MarthaShopInterior is retained for stock and
    // purchasing logic only; its white back/side walls created the featureless white cube seen in QA.
    shop.group?.parent?.remove?.(shop.group);

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

    // Move it completely off the beach/water sight-line and onto the landward dock edge. The board
    // faces the pedestrian corridor and does not obstruct either Martha, Joe or the boat route.
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

    // The structural slab and 120 plank instances were coplanar, so the planking disappeared and the
    // dock looked like a single tan polygon. Separate them enough for mobile depth precision.
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

    // Restore the authored low-cost detail pass: house trim/windows, waterfront composition, shallow
    // reef cues, dock furniture and vegetation accents. Heavy street-life/character packs remain off.
    installReferenceDetailUpgrade(app);
    app.__balancedReferenceDetail = true;
    if (typeof window !== 'undefined') window.__bermudaMobileWorldMode = 'balanced-detail-v4';
    return true;
}

function restoreMobileHud(app) {
    if (!mobileHardware() || !app) return true;
    // This reuses the live GameHUD money node, labels TIME/WEATHER clearly and keeps the minimap clear
    // of action buttons. Its internal sync timer waits for AppUI if this runs before the HUD is mounted.
    return !!installBermudaDockHudFix(app);
}

function tick() {
    const app = typeof window !== 'undefined' ? window.__app : null;
    if (!app) return false;

    const detail = restoreBalancedMobileDetail(app);
    const dock = repairDockSurface(app);
    const martha = app.__waterfrontRepair ? removeAccidentalMarthaShell(app) : false;
    const board = repairJobBoard(app);
    const hud = restoreMobileHud(app);
    return detail && dock && martha && board && hud;
}

if (typeof window !== 'undefined') {
    let tries = 0;
    const timer = window.setInterval(() => {
        tries++;
        const complete = tick();
        if (complete || tries > 900) window.clearInterval(timer);
    }, 80);
    window.addEventListener('pagehide', () => window.clearInterval(timer), { once: true });
}
