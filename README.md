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

## Illustrated adventure (web)

The web version is a painted point-and-click adventure. It opens on a boat in a storm, then you land on the beach and walk the island as your chosen survivor.

- **Walk:** A / D or arrow keys, the on-screen arrows on a phone, or tap the painting to walk there.
- **Use:** E or Space, the Use button, or tap the glowing object.
- **Goal:** take the rope (jungle) and the lantern (cave), repair the old bridge, then light the beacon at the lighthouse.
- **Energy:** walking tires you. The best route costs about 3 energy, so a short detour is fine but wandering loses.

Files: `story.js` (scenes and survivors), `rules.js` (game rules, no browser code), `main.js` (drawing, input, sound).
