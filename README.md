# Mystery Island

Mystery Island is a small Python text adventure where the player wakes up on an island with a dark lighthouse, a broken bridge, and a rescue boat that can only arrive if the beacon is restored.

## How to run

1. Open a terminal in the project folder.
2. Run:
   python3 main.py

## Game rules

- Start with 5 energy points.
- You begin at the Beach.
- You can move between Beach, Jungle, Cave, Old Bridge, and Lighthouse.
- Collect the rope in the Jungle and the lantern in the Cave.
- You must have the rope to cross the bridge.
- You must have the lantern at the Lighthouse to light the beacon.
- If energy reaches 0, the game ends in a loss.
- Invalid commands are rejected without changing the game state.
- You can replay the game after a win or loss.

## Controls

Use commands like:
- move jungle
- move cave
- collect rope
- collect lantern
- cross bridge
- light beacon
- inventory
- quit

The menu also accepts common aliases like `q` or `exit` for quitting.

## Known limits

- This is a single-player text adventure built with the Python standard library.
- It does not include a graphical interface or external libraries.
- The game loop is designed for a beginner-friendly CLI experience rather than a large open-world system.

## Testing

Run the unit tests with:

python3 -m unittest discover -s tests -v

## Learning notes

This project uses a dictionary-based player state and simple functions to separate game rules from terminal input. This keeps the game logic easy to test.

## Web version

A graphical browser version lives in `web/`. It uses the same rules as `main.py` with scene art for each location.

Run it:

    cd web
    python3 -m http.server 8000

Then open http://localhost:8000. One rule change from the terminal game: the Lighthouse can only be entered by crossing the bridge (the `move lighthouse` shortcut is closed in the web version).

### Characters (web version)

Pick one of four survivors before you start:

| Survivor | Energy | Perk |
|---|---|---|
| The Castaway | 5 | Balanced |
| The Explorer | 5 | First visit to each new place is free |
| The Old Sailor | 6 | Hardy, but crossing the bridge costs 1 energy |
| The Scavenger | 4 | Picking up an item restores 1 energy |

## Animated painted side-scroller (web)

The web version is a side-scrolling adventure through one long painted island, from the beach to the lighthouse. You run, jump and climb, and the camera follows you.

- **Move:** A / D or arrow keys. **Jump:** W, Up or Space (hold longer to jump higher). **Use:** E.
- **Phone:** drag the stick on the left to run, tap Jump and Use on the right.
- **Goal:** take the rope in the jungle, climb the crates in the cave for the lantern, repair the old bridge, then light the beacon at the lighthouse.
- **Danger:** the chasm has no floor until the bridge is repaired. Falling costs 1 energy and sends you back to the last checkpoint. Running also tires you.

Survivors: Castaway (balanced), Explorer (faster, jumps higher, tires slower), Old Sailor (6 energy, bridge repair costs 1), Scavenger (4 energy, pickups restore 1).

Files: `web/world.js` (physics, level and rules, no browser code), `web/main.js` (drawing, animation, input, sound).


## Third-person 3D rebuild

The browser build is an exploration-first, third-person 3D experience. The current overhaul adds rigged operator characters with idle, walk and run animation clips, a closer over-the-shoulder camera, higher-quality real-time shadows, denser island foliage, storm rain and lightning, and a refreshed field-operations interface.

The operator GLB files are supplied by the Gobkit Free Character Pack Vol.22 and are released under CC0 1.0. They are game-ready stylized/low-poly characters, not photorealistic scans or Call of Duty assets. The browser loads these models from the provider's public asset URLs at runtime.

Run the web version from the `web/` folder with a local HTTP server. A modern browser with WebGL support and an internet connection is required for the Three.js modules and external operator models.
