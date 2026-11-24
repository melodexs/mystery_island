# Mystery Island: Stormbound

A single-player 3D survival exploration game. Non-combat: no weapons, no enemies. The hazards are the island itself: fall damage, cold storm gusts and stamina.

Play: restore the lighthouse. Find the rope in the jungle ruins, climb the cliff to the keeper's cabin for the Brass Key and Journal, fuel the generator with two cans, then light the beacon to clear the storm.

Controls: WASD or arrows to move, Shift sprint, Space jump, E interact, F flashlight, L Keeper's Log, M mute, Esc pause. Phones get an on-screen stick and buttons.

Survivors: Scout (sprint and jump), Radio Keeper (wider reach, slower stamina drain), Sailor (extra stamina and wind/fall endurance), Night Walker (fast crouch, strong flashlight).

Layout: `web/` is the game (Vercel serves this folder). `painted/` is the earlier painted side-scroller, kept for reference and not served.
Tests: `node web/tests/rules.test.js`, `terrain.test.js`, `player.test.js`.
