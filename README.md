# Fragtown

A fast, blocky multiplayer arena shooter for you and up to three friends, in a single HTML file.

**Play:** https://overcash-afk.github.io/games2/

## How to play with friends

1. One person opens the page, enters a name and clicks **Host game**.
2. They share the six-character code shown at the top of the screen (or press **Esc → Copy** for an invite link).
3. Friends open the same page, type the code under **Join a friend** and click **Join**.
4. The host presses **Esc → Start match** when everyone is in.

Players find each other through the free public PeerJS server, then connect directly (WebRTC). The host's browser runs the match, so the host's internet connection matters most. Some school or work networks block direct connections; switching networks usually fixes that. Needs a mouse and keyboard.

## Features

- Nuketown-style cul-de-sac: two houses with stairs and garages, a walk-through school bus, trampolines
- Free-for-all and Gun Game
- Five preset classes and three custom classes (primary, secondary, lethal, tactical, two perks)
- UAV (3 kills), Airstrike (5) and Nuke (15) killstreaks
- Sliding, bunny-hopping, aim down sights, recoil, cooked grenades, knife
- Solo practice against mannequins

## Controls

WASD move · Mouse look, left click fire, right click aim · Shift sprint · Space jump · C crouch / slide · R reload · 1 / 2 / wheel switch weapon · V knife · G lethal (hold to cook a frag) · Q tactical · 4 / 5 / 6 killstreaks · Tab scoreboard · Esc menu

## Credits

- [three.js](https://threejs.org) r128 (MIT), inlined.
- [PeerJS](https://peerjs.com) 1.5.5 (MIT), inlined.
- All models, textures and sounds are generated in code.
