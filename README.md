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
- Free-for-all and Gun Game (14 weapons, finish with the knife)
- Bots: the host adds up to five (Easy, Normal or Hard). They use the stairs, hunt, strafe and fill empty slots; one steps aside when a friend joins. Play offline to fight them without internet.
- 13 guns: assault rifle, burst rifle, SMG, LMG, marksman rifle, sniper, shotgun, crossbow, pistol, machine pistol, revolver, akimbo pistols, rocket launcher
- Optics on any gun: red dot, holographic or ACOG 3.5x, chosen per gun in create-a-class
- Crosshair tab: style your hip-fire crosshair and each optic's reticle (shape and colour), and set the gun's size and position on screen
- Five preset classes and three custom classes (primary + optic, secondary + optic, lethal, tactical, two perks)
- UAV (3 kills), Airstrike (5) and Nuke (15) killstreaks
- Match stats: after every match, awards (MVP, Sharpshooter, Headhunter, Rampage, Untouchable), everyone's kills, deaths, accuracy, headshots, best streak and favourite gun, plus your damage dealt, nemesis and favourite victim
- Emotes: Dab, Teabag and Hump on 7, 8 and 9 (slot 0 is free). Rebind keys and slots in Settings. Your camera swings out so you can watch yourself; moving, shooting or getting hit cancels. Everyone sees it, including your victim in their killcam.
- Killcams: when you die, replay the last few seconds from your killer's eyes (slow motion on the killing shot), then turn to face them for two seconds. Space skips and respawns you at once. The match-winning kill plays for everyone as the final killcam. Turn personal killcams off in Settings.
- Sliding, bunny-hopping, aim down sights, recoil, cooked grenades, knife
- Practice against mannequins

## Controls

WASD move · Mouse look, left click fire, right click aim · Shift sprint · Space jump · C crouch / slide · R reload · 1 / 2 / wheel switch weapon · V knife · G lethal (hold to cook a frag) · Q tactical · 4 / 5 / 6 killstreaks · 7 / 8 / 9 / 0 emotes · Tab scoreboard · Esc menu

## Credits

- [three.js](https://threejs.org) r128 (MIT), inlined.
- [PeerJS](https://peerjs.com) 1.5.5 (MIT), inlined.
- All models, textures and sounds are generated in code.
