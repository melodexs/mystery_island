/* Mystery Island - illustrated point-and-click adventure: story data.
   Every scene is a full-screen painting. The survivor stands on a ground line and
   walks left/right (arrow keys, A/D, or tap to walk). Hotspots are things you can use.
   Coordinates are fractions of the scene (0..1) so they scale with any screen. */

const CHARACTERS = {
  castaway:  { title: "The Castaway",   energy: 5, speed: 0.24, tire: 1,    blurb: "Rugged and steady. No tricks, no weaknesses.", perk: "Balanced: 5 energy." },
  explorer:  { title: "The Explorer",   energy: 5, speed: 0.27, tire: 0.75, blurb: "Sharp-eyed and quick on her feet.",            perk: "Scout: walks faster and tires 25% slower." },
  sailor:    { title: "The Old Sailor", energy: 6, speed: 0.21, tire: 1,    blurb: "Tough and weathered, but slow on old planks.", perk: "Hardy: 6 energy. Slow: repairing the bridge costs 1." },
  scavenger: { title: "The Scavenger",  energy: 4, speed: 0.25, tire: 1,    blurb: "Small, clever, always finding something.",     perk: "Resourceful: picking up an item restores 1 energy. Only 4 energy." },
};

/* Walking drains energy: one point per this many scene-widths walked. The best route is about 3.9 widths, so the Castaway finishes with roughly 1.5 energy spare. */
const WIDTHS_PER_ENERGY = 1.1;

const SCENES = {
  beach: {
    name: "Beach", img: "img/scene_beach.jpg", ground: 0.84, scale: 0.52,
    text: "You wake on the black sand. Waves hammer the shore. Far away, a dark lighthouse waits.",
    exits: [
      { side: "right", to: "jungle", enter: 0.06, label: "Into the jungle" },
    ],
    hotspots: [],
  },
  jungle: {
    name: "Jungle", img: "img/scene_jungle.jpg", ground: 0.86, scale: 0.55,
    text: "The jungle is dense and full of mystery. A rope hangs from a thick branch.",
    exits: [
      { side: "left",  to: "beach", enter: 0.94, label: "Back to the beach" },
      { side: "right", to: "cave",  enter: 0.06, label: "Toward the cave" },
    ],
    hotspots: [
      { id: "rope", x: 0.74, y: 0.52, r: 0.11, kind: "pickup", item: "rope", label: "Take the rope" },
    ],
  },
  cave: {
    name: "Cave", img: "img/scene_cave.jpg", ground: 0.86, scale: 0.55,
    text: "A cold cave. Something glows softly on a crate in the shadows.",
    exits: [
      { side: "left",  to: "jungle", enter: 0.94, label: "Back to the jungle" },
      { side: "right", to: "bridge", enter: 0.06, label: "Out to the old bridge" },
    ],
    hotspots: [
      { id: "lantern", x: 0.72, y: 0.60, r: 0.11, kind: "pickup", item: "lantern", label: "Take the lantern" },
    ],
  },
  bridge: {
    name: "Old Bridge", img: "img/scene_bridge.jpg", ground: 0.80, scale: 0.50,
    text: "The old bridge hangs over the chasm. The middle planks are gone. The lighthouse is on the far side.",
    exits: [
      { side: "left", to: "cave", enter: 0.94, label: "Back to the cave" },
      // right side only opens once the bridge is repaired
      { side: "right", to: "lighthouse", enter: 0.10, label: "Cross to the lighthouse", needs: "bridgeRepaired" },
    ],
    hotspots: [
      { id: "bridge", x: 0.40, y: 0.74, r: 0.14, kind: "bridge", label: "Repair the bridge" },
    ],
    blockRight: 0.40,        // until repaired the gap stops you here (fraction of width)
  },
  lighthouse: {
    name: "Lighthouse", img: "img/scene_lighthouse.jpg", ground: 0.86, scale: 0.55,
    text: "The top of the lighthouse. The great beacon is dark.",
    exits: [
      { side: "left", to: "bridge", enter: 0.90, label: "Back across the bridge" },
    ],
    hotspots: [
      { id: "beacon", x: 0.50, y: 0.40, r: 0.16, kind: "beacon", label: "Light the beacon" },
    ],
  },
};

const START_SCENE = "beach";
const START_X = 0.30;

if (typeof module !== "undefined") {
  module.exports = { CHARACTERS, SCENES, START_SCENE, START_X, WIDTHS_PER_ENERGY };
}
