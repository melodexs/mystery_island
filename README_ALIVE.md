# Alive world upgrade

Motion, physics feel and animation only. No painting, figure, colour, layout or UI was changed.

- `web/alive.js`: wind sway of the existing painting (sub-pixel to ~2px, ~6px in gusts), drifting mist, wind-blown leaves, ground ripple under footsteps. `ALIVE.enabled = false` restores the original drawing exactly.
- `web/pose.js`: pose blender for the painted figure: idle breathing, walk, run, sprint, rise, apex, fall, land, crouch, crouch-walk, slide, wall-cling, turn, interact, hurt. Slew-limited so transitions never snap.
- `web/world.js`: ordinary jumps now register a landing (squash, dust, sound, camera kick). Before, only falls above 500 u/s did.
- `web/main.js`: routes drawing through the two modules, hooks footsteps and landings to the ripple.

Not possible without changing the art: opening doors, searching containers, swimming, entering buildings, independently moving trees. Those are paint, not objects.
