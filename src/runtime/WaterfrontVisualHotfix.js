import { BoxGeometry, CylinderGeometry, Mesh } from '../engine/index.js';
import { Material } from '../engine/render/Material.js';
import { App } from '../App.js';
import { installBermudaDockHudFix } from '../mobile/BermudaDockHudFix.js';
import { installMobileReferenceCorridor } from '../world/MobileReferenceCorridor.js';
import { WATERFRONT_DECK } from '../world/bermuda/HarbourLayout.js';

// Surgical visual/HUD repair for the iPhone waterfront QA build.
// This module is loaded before main.js, so expose the App instance as soon as App.init runs.
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
    if (!mobileHardware() || !app?.scene || !app?.terrainData) return true;
    if (app.__balancedReferenceDetail) return true;

    // IMPORTANT: do not reinstall ReferenceDetailUpgrade on iPhone. It was deliberately removed from
    // the core-stable phone path and, combined with clouds/haze, caused the immediate Explore restart.
    // Use the much smaller hero-corridor pass instead.
    installMobileReferenceCorridor(app);
    app.__balancedReferenceDetail = true;
    if (typeof window !== 'undefined') window.__bermudaMobileWorldMode = 'stable-reference-corridor-v1';
    return true;
}

function restoreMobileHud(app) {
    if (!mobileHardware() || !app) return true;
    return !!installBermudaDockHudFix(app);
}

function installDiveLightVisibilityFix(app) {
    if (!mobileHardware() || !app || typeof document === 'undefined') return true;
    if (app.__bermudaDiveLightVisibilityFix) return true;

    const styleId = 'bermuda-dive-light-visibility-fix';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            body.bm-mobile.bm-dive-light-visible #bm-touch-stable button[data-role="light"].bm-hidden{
                display:block!important;
            }
        `;
        document.head.appendChild(style);
    }

    const sync = () => {
        const p = app.player;
        const underwater = p?.mode === 'swim' && (p.diveDepth || 0) > 0.18;
        document.body.classList.toggle('bm-dive-light-visible', !!underwater);
    };

    sync();
    const timer = window.setInterval(sync, 100);
    window.addEventListener('pagehide', () => window.clearInterval(timer), { once: true });
    app.__bermudaDiveLightVisibilityFix = { sync, timer };
    return true;
}

function tick() {
    const app = typeof window !== 'undefined' ? window.__app : null;
    if (!app) return false;

    const detail = restoreBalancedMobileDetail(app);
    const dock = repairDockSurface(app);
    const martha = app.__waterfrontRepair ? removeAccidentalMarthaShell(app) : false;
    const board = repairJobBoard(app);
    const hud = restoreMobileHud(app);
    const diveLight = installDiveLightVisibilityFix(app);
    return detail && dock && martha && board && hud && diveLight;
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
