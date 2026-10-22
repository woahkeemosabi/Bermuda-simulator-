// Lightweight opening loop: earn money at the docks, then buy a first boat.
// No mission-world geometry or render operations are created by this module.
export const BOAT_MISSION = 'main-first-boat';
export const STARTER_BOAT_PRICE = 3200;
export const FIRST_BOAT_BACKUP = 'bermuda.firstboat.prior-missions.v1';

export function firstBoatModeEnabled(params, userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent) {
 const query=params||new URLSearchParams(typeof location==='undefined'?'':location.search);
 if(query.get('missions')==='full') return false;
 if(query.get('missions')==='boat') return true;
 return /iPhone|iPad|iPod|Android/.test(userAgent);
}

export function normalizeFirstBoatObjectives(state) {
 if(!state?.missions) return false;
 const missions=state.missions;
 const owned=!!state.boats?.owned?.some(b=>b?.id==='lobster-workboat' && Number.isFinite(Number(b.purchasedAt)) && Number(b.purchasedAt)>0);
 const before={
  available:Array.isArray(missions.available)?missions.available:[],
  active:Array.isArray(missions.active)?missions.active:[],
  completed:Array.isArray(missions.completed)?missions.completed:[]
 };
 const keepActive=!owned && before.active.includes(BOAT_MISSION);
 const after={
  available:owned||keepActive?[]:[BOAT_MISSION],
  active:keepActive?[BOAT_MISSION]:[],
  completed:owned&&!before.completed.includes(BOAT_MISSION)?
   [...before.completed,BOAT_MISSION]:before.completed
 };
 const changed=Object.keys(after).some(key=>
  JSON.stringify(before[key])!==JSON.stringify(after[key]));
 if(!changed)return false;
 // Preserve the pre-simplification mission state once; never erase completed
 // quests, money, inventory, or boats from the actual gameplay save.
 try {
  if(state.storage&&!state.storage.getItem(FIRST_BOAT_BACKUP)){
   const previous=typeof state.toJSON==='function'?state.toJSON():{missions:before};
   state.storage.setItem(FIRST_BOAT_BACKUP,JSON.stringify(previous));
  }
 } catch(_) {}
 missions.available=after.available;
 missions.active=after.active;
 missions.completed=after.completed;
 state.save?.();
 state.emit?.();
 return true;
}
