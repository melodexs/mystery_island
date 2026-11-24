/* Stormbound interactions: which objects exist, when they can be used, and what they do. Rules stay in rules.js. */
import * as THREE from "three";
const T = window.SBT, POI = T.POI;
/* Each interactable: pos (x,z), reach (m), label (prompt), can(game)->bool, act(game, ctx)->message. */
export function buildInteractables(L, game, ctx) {
  const at = (k) => POI[k];
  const list = [
    { id: "rope", pos: at("ruins"), reach: 3.6, label: "TAKE ROPE", can: () => !game.inv.rope, act: () => { const m = game.pickRope(); L.items.ropePickup.visible = false; ctx.sfx("pickup"); ctx.notePage("p5", "A page of the Keeper's Log was wrapped inside the rope. Press L to read it."); return m; } },
    { id: "anchor", pos: at("anchor"), reach: 3.4, label: () => (game.flags.ropeAnchored ? "CLIMB THE ROPE" : "SECURE ROPE"), can: () => true,
      act: () => { if (!game.flags.ropeAnchored) { const m = game.useAnchor(); if (game.flags.ropeAnchored) { L.items.hangingRope.visible = true; ctx.sfx("rope"); } else ctx.sfx("deny"); return m; } ctx.startClimb(); ctx.sfx("rope"); return game.say("You haul yourself up the cliff."); } },
    { id: "cabin", pos: { x: at("cabin").x + 1.4, z: at("cabin").z + 1 }, reach: 4.2, label: "SEARCH THE CABIN", can: () => !game.flags.cabinSearched, act: () => { const m = game.searchCabin(); if (game.flags.cabinSearched) { L.items.keyObj.visible = false; L.items.journalObj.visible = false; ctx.sfx("pickup"); ctx.showJournal(); } else ctx.sfx("deny"); return m; } },
    { id: "fuel1", pos: { x: at("wreck").x - 3.4, z: at("wreck").z + 2.3 }, reach: 3.2, label: "TAKE FUEL", can: () => !game.fuelFound.beach, act: () => { const m = game.pickFuel("beach"); L.items.fuel1.visible = false; ctx.sfx("pickup"); ctx.notePage("p4", "A water-stained page was tucked under the can. Keeper's Log updated (press L)."); return m; } },
    { id: "fuel2", pos: at("cabinFuel"), reach: 3.2, label: "TAKE FUEL", can: () => !game.fuelFound.cabin, act: () => { const m = game.pickFuel("cabin"); L.items.fuel2.visible = false; ctx.sfx("pickup"); return m; } },
    { id: "generator", pos: { x: at("shed").x, z: at("shed").z + 4.3 }, reach: 3.6, label: () => (game.flags.generatorOn ? "GENERATOR RUNNING" : "REFUEL GENERATOR"), can: () => !game.flags.generatorOn,
      act: () => { const m = game.useGenerator(); if (game.flags.generatorOn) { ctx.generatorOn(); ctx.sfx("gen"); } else ctx.sfx("deny"); return m; } },
    { id: "lhdoor", pos: { x: at("lighthouse").x, z: at("lighthouse").z + 5 }, reach: 4, label: () => (game.flags.lighthouseOpen ? "ENTER THE LIGHTHOUSE" : "UNLOCK THE DOOR"), can: () => true,
      act: () => { if (!game.flags.lighthouseOpen) { const m = game.useLighthouseDoor(); if (game.flags.lighthouseOpen) { L.items.lhDoor.rotation.y = -1.7; L.items.lhDoor.position.x += 0.7; L.items.lhDoor.position.z += 0.5; ctx.sfx("door"); } else ctx.sfx("deny"); return m; } ctx.startTower(); ctx.sfx("door"); return game.say("You climb the spiral stair to the lamp room."); } },
    { id: "beacon", pos: { x: at("lighthouse").x, z: at("lighthouse").z }, topOnly: true, reach: 4.5, label: "LIGHT THE BEACON", can: () => true, act: () => { const m = game.useBeacon(); if (game.flags.beaconOn) { ctx.beaconOn(); ctx.sfx("beam"); } else ctx.sfx("deny"); return m; } }
  ];
  return list;
}
/* nearest usable interactable to the player within its reach (reach is scaled by the Radio Keeper's wider scanner) */
export function nearest(list, p, scan, inTower) {
  let best = null, bd = 1e9;
  for (const it of list) {
    if (!!it.topOnly !== !!inTower) continue;           // up in the lamp room only the beacon is usable; everywhere else, everything but the beacon
    const d = Math.hypot(p.x - it.pos.x, p.z - it.pos.z); if (d > it.reach * scan) continue;
    if (it.id !== "anchor" && it.id !== "lhdoor" && !it.can()) continue;
    if (d < bd) { bd = d; best = it; }
  }
  return best;
}
