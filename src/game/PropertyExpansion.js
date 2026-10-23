import { Group, Mesh, Vector3 } from '../engine/index.js';
import { prepare, mergePrepared, box, cylinder, rod, mat4 } from '../world/boat/GeoKit.js';
import { createPropMaterial, PAT } from './GameMaterials.js';

const COTTAGE = Object.freeze({
	id: 'harbour-cottage',
	name: 'Harbour Cottage',
	exterior: Object.freeze({ x: -57, z: -58.2 }),
	interior: Object.freeze({ x: 360, y: 34, z: -360 }),
	garagePrice: 3500,
	freezerKg: 35,
});

const WATERFRONT = Object.freeze({
	id: 'waterfront-home',
	name: 'Waterfront Home',
	price: 28000,
	// Existing house-c at roughly (-84,-54), with the entrance facing the harbour.
	exterior: Object.freeze({ x: -84, z: -51.3 }),
	interior: Object.freeze({ x: 390, y: 34, z: -360 }),
	berthPrice: 6500,
	freezerKg: 120,
});

const WATERFRONT_ROOM = Object.freeze({ width: 10.2, depth: 7.8, height: 3.05 });
const TMP = new Vector3();

function money(n) { return '$' + Math.max(0, Math.round(Number(n) || 0)).toLocaleString(); }
function distXZ(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
function kg(items = []) { return items.reduce((sum, item) => sum + (Number(item?.kg) || 0), 0); }

function signGeometry() {
	const P = [];
	const add = (g, o) => P.push(prepare(g, o));
	const wood = { color: 0x6d513b, rough: 0.9, pattern: PAT.woodX };
	add(rod(new Vector3(0, 0, 0), new Vector3(0, 1.35, 0), 0.035, 7), wood);
	add(box(1.05, 0.58, 0.06), { color: 0xf4efe4, rough: 0.82, matrix: mat4(0, 1.1, 0) });
	add(box(0.76, 0.05, 0.014), { color: 0x1f6470, rough: 0.45, matrix: mat4(0, 1.22, 0.038) });
	add(box(0.62, 0.05, 0.014), { color: 0xc89c43, rough: 0.45, matrix: mat4(0, 1.06, 0.038) });
	add(box(0.82, 0.05, 0.014), { color: 0x1f6470, rough: 0.45, matrix: mat4(0, 0.9, 0.038) });
	return mergePrepared(P);
}

function garageGeometry() {
	const P = [];
	const add = (g, o) => P.push(prepare(g, o));
	const white = { color: 0xf3f2ec, rough: 0.8 };
	const roof = { color: 0xfafafa, rough: 0.7 };
	const slab = { color: 0xb9b7ae, rough: 0.94 };
	const dark = { color: 0x283337, rough: 0.54, metal: 0.22 };
	add(box(4.2, 0.12, 5.0), { ...slab, matrix: mat4(0, 0.06, 0) });
	for (const sx of [-1, 1]) add(box(0.18, 2.65, 5.0), { ...white, matrix: mat4(sx * 2.01, 1.32, 0) });
	add(box(4.2, 0.16, 5.2), { ...roof, matrix: mat4(0, 2.78, 0, 0.04) });
	add(box(3.55, 2.25, 0.1), { ...dark, matrix: mat4(0, 1.2, 2.47) });
	for (let i = -1; i <= 1; i++) add(box(3.25, 0.035, 0.03), { color: 0x89979a, rough: 0.4, metal: 0.5, matrix: mat4(0, 1.2 + i * 0.42, 2.41) });
	return mergePrepared(P);
}

function berthGeometry() {
	const P = [];
	const add = (g, o) => P.push(prepare(g, o));
	const timber = { color: 0x7a6149, rough: 0.86, pattern: PAT.woodX };
	const metal = { color: 0xa5b0b1, rough: 0.28, metal: 0.9 };
	for (const x of [-1.2, 1.2]) add(box(0.18, 0.18, 3.7), { ...timber, matrix: mat4(x, 0, 0) });
	for (const x of [-1.2, 1.2]) add(cylinder(0.09, 0.09, 0.3, 12), { ...metal, matrix: mat4(x, 0.21, -1.45) });
	add(box(1.55, 0.1, 0.38), { color: 0xf0eee6, rough: 0.74, matrix: mat4(0, 0.12, -1.7) });
	return mergePrepared(P);
}

function waterfrontInteriorGeometry() {
	const P = [];
	const add = (g, o) => P.push(prepare(g, o));
	const { width: w, depth: d, height: h } = WATERFRONT_ROOM;
	const plaster = { color: 0xf2eee4, rough: 0.92 };
	const white = { color: 0xffffff, rough: 0.7 };
	const cedar = { color: 0x8d6848, rough: 0.84, pattern: PAT.woodX };
	const dark = { color: 0x5e4534, rough: 0.88, pattern: PAT.woodX };
	const glass = { color: 0xaed8df, rough: 0.1, metal: 0.04 };

	add(box(w, 0.1, d), { ...cedar, matrix: mat4(0, 0.05, 0) });
	add(box(w, 0.08, d), { ...white, matrix: mat4(0, h, 0) });
	add(box(w, h, 0.1), { ...plaster, matrix: mat4(0, h / 2, -d / 2) });
	for (const sx of [-1, 1]) add(box(0.1, h, d), { ...plaster, matrix: mat4(sx * w / 2, h / 2, 0) });
	add(box(w, h, 0.1), { ...plaster, matrix: mat4(0, h / 2, d / 2) });

	// Large harbour-facing windows.
	for (const x of [-3.2, -1.1, 1.1, 3.2]) {
		add(box(1.55, 1.45, 0.04), { ...glass, matrix: mat4(x, 1.75, d / 2 - 0.055) });
		add(box(1.7, 0.06, 0.07), { ...white, matrix: mat4(x, 0.99, d / 2 - 0.08) });
	}

	// Queen bed, sofa, dining table, wardrobe and proper cold-storage freezer.
	add(box(2.45, 0.4, 1.7), { ...dark, matrix: mat4(-3.45, 0.26, -2.15) });
	add(box(2.34, 0.3, 1.58), { color: 0xe4ded4, rough: 0.94, pattern: PAT.cloth, matrix: mat4(-3.45, 0.58, -2.15) });
	add(box(2.8, 0.64, 0.95), { color: 0x557a7c, rough: 0.91, pattern: PAT.cloth, matrix: mat4(-2.55, 0.36, 1.35) });
	add(box(1.75, 0.09, 1.05), { ...cedar, matrix: mat4(0.5, 0.84, -2.15) });
	for (const x of [-0.63, 0.63]) for (const z of [-0.35, 0.35]) add(box(0.07, 0.82, 0.07), { ...dark, matrix: mat4(0.5 + x, 0.41, -2.15 + z) });
	add(box(1.45, 2.28, 0.68), { ...cedar, matrix: mat4(4.15, 1.14, -2.25) });
	add(box(1.35, 0.82, 0.82), { color: 0xe6eeee, rough: 0.34, matrix: mat4(3.95, 0.41, 1.95) });
	add(box(1.27, 0.07, 0.74), { color: 0xb9d9df, rough: 0.14, matrix: mat4(3.95, 0.85, 1.95) });
	return mergePrepared(P);
}

export class PropertyExpansion {
	constructor(app) {
		this.app = app;
		this.game = app.game;
		this.state = app.game.state;
		this.player = app.player;
		this.input = app.input;
		this.insideWaterfront = false;
		this.installState();
		this.buildCottageBenefits();
		this.buildWaterfrontHome();
		this.buildPrivateBerth();

		const originalUpdate = this.player.update.bind(this.player);
		this.player.update = (dt) => {
			originalUpdate(dt);
			this.update(dt);
		};
		app.propertyExpansion = this;
	}

	installState() {
		const p = this.state.properties;
		p.upgrades = p.upgrades || {};
		p.storage = p.storage || {};
		for (const home of [COTTAGE, WATERFRONT]) {
			p.upgrades[home.id] = p.upgrades[home.id] || {};
			p.storage[home.id] = p.storage[home.id] || { catch: [] };
			if (!Array.isArray(p.storage[home.id].catch)) p.storage[home.id].catch = [];
		}
		this.state.save();
	}

	owns(id) { return !!this.state.ownsProperty?.(id); }
	hasUpgrade(id, key) { return !!this.state.properties?.upgrades?.[id]?.[key]; }

	buildCottageBenefits() {
		const terrain = this.app.terrainData;
		const gy = terrain?.heightAt?.(-53.9, -59.2) ?? 0;
		this.cottageGarage = new Mesh(garageGeometry(), createPropMaterial('harbourCottageGarage'));
		this.cottageGarage.position.set(-53.9, gy + 0.02, -59.2);
		this.cottageGarage.rotation.y = 0.04;
		this.cottageGarage.castShadow = true;
		this.app.scene.add(this.cottageGarage);

		this.garagePoint = new Vector3(-53.9, gy + 0.05, -57.0);
		this.cottageUpgradeSign = new Mesh(signGeometry(), createPropMaterial('cottageGarageUpgradeSign'));
		this.cottageUpgradeSign.position.set(-55.2, gy + 0.02, -57.0);
		this.app.scene.add(this.cottageUpgradeSign);

		// Functional freezer in the existing cottage interior. This is deliberately separate from the
		// decorative chest so catch storage is a real gameplay action, not a placeholder toast.
		const c = COTTAGE.interior;
		this.cottageFreezer = new Mesh(box(1.08, 0.78, 0.78), createPropMaterial('cottageFreezer'));
		this.cottageFreezer.position.set(c.x + 1.15, c.y + 0.39, c.z + 1.72);
		this.app.scene.add(this.cottageFreezer);
		this.cottageFreezerPoint = new Vector3(c.x + 1.15, c.y + 0.1, c.z + 1.25);
		this.cottageDresserPoint = new Vector3(c.x + 1.0, c.y + 0.1, c.z - 1.55);
		this.refreshCottage();
	}

	refreshCottage() {
		const built = this.hasUpgrade(COTTAGE.id, 'garageWorkshop');
		this.cottageGarage.visible = this.owns(COTTAGE.id) && built;
		this.cottageUpgradeSign.visible = this.owns(COTTAGE.id) && !built;
		if (built) this.state.properties.garage = COTTAGE.id;
	}

	buildWaterfrontHome() {
		const e = WATERFRONT.exterior;
		this.waterfrontY = this.app.terrainData?.heightAt?.(e.x, e.z) ?? 0;
		this.waterfrontDoor = new Mesh(box(1.18, 2.18, 0.1), createPropMaterial('waterfrontHomeDoor'));
		this.waterfrontDoor.position.set(e.x, this.waterfrontY + 1.09, e.z);
		this.waterfrontDoor.castShadow = true;
		this.app.scene.add(this.waterfrontDoor);
		this.waterfrontSale = new Mesh(signGeometry(), createPropMaterial('waterfrontHomeSaleSign'));
		this.waterfrontSale.position.set(e.x + 1.75, this.waterfrontY + 0.02, e.z + 0.35);
		this.app.scene.add(this.waterfrontSale);

		const c = WATERFRONT.interior;
		this.waterfrontInterior = new Group();
		this.waterfrontInterior.name = 'WaterfrontHomeInterior';
		const room = new Mesh(waterfrontInteriorGeometry(), createPropMaterial('waterfrontHomeInterior'));
		room.castShadow = true; room.receiveShadow = true;
		this.waterfrontInterior.add(room);
		this.waterfrontInterior.position.set(c.x, c.y, c.z);
		this.app.scene.add(this.waterfrontInterior);

		const { width: w, depth: d, height: h } = WATERFRONT_ROOM;
		const col = this.app.colliders;
		if (col) {
			col.addBox(new Vector3(c.x, c.y + 0.05, c.z), new Vector3(w / 2, 0.05, d / 2), 0, { walkable: true, solid: false, tag: 'waterfrontHomeFloor' });
			col.addBox(new Vector3(c.x, c.y + h / 2, c.z - d / 2), new Vector3(w / 2, h / 2, 0.08), 0, { tag: 'waterfrontHomeWall' });
			col.addBox(new Vector3(c.x, c.y + h / 2, c.z + d / 2), new Vector3(w / 2, h / 2, 0.08), 0, { tag: 'waterfrontHomeWall' });
			for (const sx of [-1, 1]) col.addBox(new Vector3(c.x + sx * w / 2, c.y + h / 2, c.z), new Vector3(0.08, h / 2, d / 2), 0, { tag: 'waterfrontHomeWall' });
		}

		this.waterfrontPoints = {
			exit: new Vector3(c.x, c.y + 0.1, c.z + d / 2 - 0.75),
			bed: new Vector3(c.x - 3.4, c.y + 0.1, c.z - 1.65),
			freezer: new Vector3(c.x + 3.95, c.y + 0.1, c.z + 1.45),
			wardrobe: new Vector3(c.x + 4.0, c.y + 0.1, c.z - 1.7),
		};
		this.refreshWaterfront();
	}

	refreshWaterfront() {
		const owned = this.owns(WATERFRONT.id);
		this.waterfrontSale.visible = !owned && this.owns(COTTAGE.id);
	}

	buildPrivateBerth() {
		// The private berth sits on the near-shore waterline, close enough to the waterfront house to
		// feel like part of the property without replacing the original public lobster-boat berth.
		this.berthPoint = new Vector3(-88.8, 0.05, -37.2);
		this.berth = new Mesh(berthGeometry(), createPropMaterial('privateBerth'));
		this.berth.position.copy(this.berthPoint);
		this.berth.position.y = 0.88;
		this.berth.castShadow = true;
		this.app.scene.add(this.berth);
		this.berthSign = new Mesh(signGeometry(), createPropMaterial('privateBerthSaleSign'));
		this.berthSign.position.set(-87.1, 0.94, -39.0);
		this.app.scene.add(this.berthSign);
		this.refreshBerth();
	}

	refreshBerth() {
		const ownedHome = this.owns(WATERFRONT.id);
		const hasBerth = this.hasUpgrade(WATERFRONT.id, 'privateBerth');
		this.berth.visible = ownedHome && hasBerth;
		this.berthSign.visible = ownedHome && !hasBerth;
		if (hasBerth) this.state.properties.marinaBerth = WATERFRONT.id;
	}

	buyUpgrade(homeId, key, cost, label) {
		if (!this.owns(homeId) || this.hasUpgrade(homeId, key)) return false;
		if (this.state.money < cost) {
			this.game.toast(`${label} costs ${money(cost)} · need ${money(cost - this.state.money)} more`, 2400);
			return false;
		}
		if (!this.state.spend(cost)) return false;
		this.state.properties.upgrades[homeId][key] = true;
		this.state.save(); this.state.emit();
		this.game.toast(`${label} purchased · ${money(cost)}`, 2600);
		this.refreshCottage(); this.refreshBerth();
		return true;
	}

	buyWaterfront() {
		if (this.owns(WATERFRONT.id) || !this.owns(COTTAGE.id)) return false;
		if (this.state.money < WATERFRONT.price) {
			this.game.toast(`${WATERFRONT.name} costs ${money(WATERFRONT.price)} · need ${money(WATERFRONT.price - this.state.money)} more`, 2800);
			return false;
		}
		if (!this.state.spend(WATERFRONT.price)) return false;
		if (!this.state.ownProperty({ id: WATERFRONT.id, name: WATERFRONT.name, price: WATERFRONT.price, garage: true, waterfront: true, purchasedAt: Date.now() })) {
			this.state.addMoney(WATERFRONT.price);
			return false;
		}
		this.state.properties.home = WATERFRONT.id;
		this.state.properties.garage = WATERFRONT.id;
		this.state.storyFlags.waterfrontHomePurchased = true;
		this.state.save(); this.state.emit();
		this.refreshWaterfront(); this.refreshBerth();
		this.game.toast(`${WATERFRONT.name} purchased · private berth now available`, 3400);
		return true;
	}

	enterWaterfront() {
		if (!this.owns(WATERFRONT.id)) return false;
		const c = WATERFRONT.interior;
		this.insideWaterfront = true;
		this.player.position.set(c.x, c.y + 0.11, c.z + 2.25);
		this.player.velocity.set(0, 0, 0);
		this.player.yaw = Math.PI;
		this.player.pitch = -0.04;
		this.player._camY = null;
		this.game.toast(WATERFRONT.name, 1300);
		return true;
	}

	exitWaterfront() {
		this.insideWaterfront = false;
		this.player.position.set(WATERFRONT.exterior.x, this.waterfrontY + 0.05, WATERFRONT.exterior.z + 1.55);
		this.player.velocity.set(0, 0, 0);
		this.player.yaw = 0;
		this.player.pitch = -0.04;
		this.player._camY = null;
		return true;
	}

	useFreezer(home) {
		const store = this.state.properties.storage[home.id];
		const capacity = home.freezerKg;
		const storedKg = kg(store.catch);
		if (this.state.inventory.length) {
			let room = Math.max(0, capacity - storedKg);
			if (room <= 0.01) { this.game.toast(`Home freezer full · ${storedKg.toFixed(1)}/${capacity} kg`, 1900); return; }
			const keep = [], moved = [];
			for (const item of this.state.inventory) {
				if ((item.kg || 0) <= room + 1e-6) { moved.push(item); room -= item.kg || 0; }
				else keep.push(item);
			}
			if (!moved.length) { this.game.toast('No catch fits in the remaining freezer space.', 1800); return; }
			store.catch.push(...moved);
			this.state.inventory = keep;
			this.state.save(); this.state.emit();
			this.game.toast(`Stored ${moved.length} catch · freezer ${kg(store.catch).toFixed(1)}/${capacity} kg`, 2200);
			return;
		}
		if (!store.catch.length) { this.game.toast(`Freezer empty · capacity ${capacity} kg`, 1600); return; }
		let room = Math.max(0, this.state.stats.holdKg - this.state.holdKg);
		const remain = [], moved = [];
		for (const item of store.catch) {
			if ((item.kg || 0) <= room + 1e-6) { moved.push(item); room -= item.kg || 0; }
			else remain.push(item);
		}
		if (!moved.length) { this.game.toast('Cooler is full.', 1600); return; }
		this.state.inventory.push(...moved);
		store.catch = remain;
		this.state.save(); this.state.emit();
		this.game.toast(`Retrieved ${moved.length} catch · cooler ${this.state.holdKg.toFixed(1)}/${this.state.stats.holdKg} kg`, 2200);
	}

	cycleWardrobe() {
		const styles = ['island-casual', 'workwear', 'marine', 'evening'];
		const current = this.state.equipment.outfit || styles[0];
		const next = styles[(styles.indexOf(current) + 1) % styles.length];
		this.state.equipment.outfit = next;
		this.state.save(); this.state.emit();
		this.game.toast(`Wardrobe · ${next.replace('-', ' ')}`, 1700);
	}

	storeNearbyBicycle() {
		if (!this.hasUpgrade(COTTAGE.id, 'garageWorkshop')) return false;
		const bike = this.app.bicycle;
		if (!bike || bike.riding || bike.distanceToPlayer() > 6.5) return false;
		bike.group.position.set(this.garagePoint.x, this.garagePoint.y, this.garagePoint.z + 0.4);
		bike.yaw = Math.PI / 2;
		bike.group.rotation.y = bike.yaw;
		bike.snapToGround?.();
		bike.persistParking?.();
		this.game.toast('Bicycle stored in the Harbour Cottage garage.', 1900);
		return true;
	}

	sleepWaterfront() {
		this.app.settings.timeOfDay = 7;
		this.state.world.time = 7;
		this.state.save(); this.state.emit();
		this.game.toast('Rested at Waterfront Home · 07:00 · progress saved', 2200);
	}

	update() {
		const p = this.player;
		if (p.mode !== 'walk' || p.busy) return;

		this.refreshCottage(); this.refreshWaterfront(); this.refreshBerth();

		// Cottage garage/workshop progression and vehicle storage.
		if (!this.app.propertySystem?.insideHome && distXZ(p.position, this.garagePoint) < 2.4 && this.owns(COTTAGE.id)) {
			if (!this.hasUpgrade(COTTAGE.id, 'garageWorkshop')) {
				p.prompt = { key: 'E', text: `Build garage/workshop · ${money(COTTAGE.garagePrice)}` };
				if (this.input.hit('KeyE')) this.buyUpgrade(COTTAGE.id, 'garageWorkshop', COTTAGE.garagePrice, 'Garage/workshop');
				return;
			}
			const bike = this.app.bicycle;
			if (bike && !bike.riding && bike.distanceToPlayer() < 6.5) {
				p.prompt = { key: 'E', text: 'Store bicycle in garage' };
				if (this.input.hit('KeyE')) this.storeNearbyBicycle();
				return;
			}
		}

		// Functional additions inside the existing Harbour Cottage.
		if (this.app.propertySystem?.insideHome) {
			if (distXZ(p.position, this.cottageFreezerPoint) < 1.25) {
				const stored = kg(this.state.properties.storage[COTTAGE.id].catch);
				p.prompt = { key: 'E', text: `Home freezer · ${stored.toFixed(1)}/${COTTAGE.freezerKg} kg · store/retrieve catch` };
				if (this.input.hit('KeyE')) this.useFreezer(COTTAGE);
				return;
			}
			if (distXZ(p.position, this.cottageDresserPoint) < 1.2) {
				p.prompt = { key: 'E', text: `Wardrobe · ${this.state.equipment.outfit || 'island-casual'} · change outfit` };
				if (this.input.hit('KeyE')) this.cycleWardrobe();
				return;
			}
		}

		// Waterfront-home purchase and entry.
		if (!this.insideWaterfront && distXZ(p.position, WATERFRONT.exterior) < 1.8) {
			if (!this.owns(COTTAGE.id)) {
				p.prompt = { key: '—', text: `${WATERFRONT.name} · progression locked · own Harbour Cottage first` };
				return;
			}
			if (!this.owns(WATERFRONT.id)) {
				p.prompt = { key: 'E', text: `${WATERFRONT.name} · ${money(WATERFRONT.price)} · buy` };
				if (this.input.hit('KeyE')) this.buyWaterfront();
				return;
			}
			p.prompt = { key: 'E', text: `Enter ${WATERFRONT.name}` };
			if (this.input.hit('KeyE')) this.enterWaterfront();
			return;
		}

		if (this.insideWaterfront) {
			const actions = [
				{ point: this.waterfrontPoints.exit, text: `Leave ${WATERFRONT.name}`, run: () => this.exitWaterfront() },
				{ point: this.waterfrontPoints.bed, text: 'Sleep until morning · save progress', run: () => this.sleepWaterfront() },
				{ point: this.waterfrontPoints.freezer, text: `Large freezer · ${kg(this.state.properties.storage[WATERFRONT.id].catch).toFixed(1)}/${WATERFRONT.freezerKg} kg`, run: () => this.useFreezer(WATERFRONT) },
				{ point: this.waterfrontPoints.wardrobe, text: `Wardrobe · ${this.state.equipment.outfit || 'island-casual'} · change outfit`, run: () => this.cycleWardrobe() },
			];
			let best = null, bestD = 1.35;
			for (const action of actions) {
				const d = distXZ(p.position, action.point);
				if (d < bestD) { bestD = d; best = action; }
			}
			if (best) {
				p.prompt = { key: 'E', text: best.text };
				if (this.input.hit('KeyE')) best.run();
				return;
			}
		}

		// Private berth is the final upgrade in this property tier.
		if (!this.insideWaterfront && this.owns(WATERFRONT.id) && distXZ(p.position, this.berthSign.position) < 2.2) {
			if (!this.hasUpgrade(WATERFRONT.id, 'privateBerth')) {
				p.prompt = { key: 'E', text: `Build private berth · ${money(WATERFRONT.berthPrice)}` };
				if (this.input.hit('KeyE')) {
					if (this.buyUpgrade(WATERFRONT.id, 'privateBerth', WATERFRONT.berthPrice, 'Private marina berth')) {
						this.state.properties.marinaBerth = WATERFRONT.id;
						this.state.storyFlags.privateBerthOwned = true;
						this.state.save(); this.state.emit();
					}
				}
			}
		}
	}
}
