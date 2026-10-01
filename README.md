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

- Three maps, picked by the host: **Cul-de-sac** (Nuketown-style: two houses with stairs and garages, a walk-through school bus, trampolines), **Depot** (an indoor warehouse with shelving aisles, catwalks, offices and a loading dock) and **Bungalow** (a small house, completely indoors: kitchens, bathrooms, bedrooms, hallways and a living room; very close quarters)
- Mantling: jump at a ledge, fence, car or window while holding W to climb onto or over it. Jump pads launch you onto the bus, the garage roofs and Depot's catwalks. The host can switch both off.
- Five modes:
  - **Free-for-all**: first to the kill limit wins.
  - **Gun Game**: 14 weapons; finish with the knife.
  - **Sharpshooter**: everyone gets the same random gun, and it changes every 45 seconds.
  - **One in the Chamber**: a one-bullet pistol that kills on any hit. Miss and you switch to your knife (also a one-hit kill); a kill earns a bullet and brings the pistol back out. Three lives; last one standing wins.
  - **Infected**: one player starts infected, with a knife and extra speed. Anyone they kill joins them. Survivors win if anyone lasts the clock.
- Party mutators, combine any of them: low gravity, big heads (bigger headshot targets too), explosive bullets, one-shot kills, hyper speed. The host can flip them mid-match.
- Bots: the host adds up to five (Easy, Normal or Hard). They use the stairs, hunt, strafe and fill empty slots; one steps aside when a friend joins. Play offline to fight them without internet.
- 13 guns: assault rifle, burst rifle, SMG, LMG, marksman rifle, sniper, shotgun, crossbow, pistol, machine pistol, revolver, akimbo pistols, rocket launcher
- Optics on any gun: red dot, holographic or ACOG 3.5x, chosen per gun in create-a-class
- Crosshair tab: style your hip-fire crosshair and each optic's reticle (shape and colour), and set the gun's size and position on screen
- Five preset classes and three custom classes (primary + optic, secondary + optic, lethal, tactical, two perks)
- Killstreaks on keys 3 to 6: UAV (3 kills), Airstrike (5), Minigun (8: 150 rounds, spins up before firing, no sprinting, gone when empty) and Nuke (15)
- Match stats: after every match, awards (MVP, Sharpshooter, Headhunter, Rampage, Untouchable), everyone's kills, deaths, accuracy, headshots, best streak and favourite gun, plus your damage dealt, nemesis and favourite victim
- Emotes: Dab, Teabag and Hump on 7, 8 and 9 (slot 0 is free). Rebind keys and slots in Settings. Your camera swings out so you can watch yourself; moving, shooting or getting hit cancels. Everyone sees it, including your victim in their killcam.
- Killcams: when you die, replay the last few seconds from your killer's eyes (slow motion on the killing shot), then turn to face them for two seconds. You can't skip it; you respawn when it ends. The match-winning kill plays for everyone as the final killcam.
- Sliding, bunny-hopping, aim down sights, recoil, cooked grenades, knife
- Practice against mannequins

## Controls

WASD move · Mouse look, left click fire, right click aim · Shift sprint · Space jump (hold W at a ledge to mantle) · C crouch / slide · R reload · 1 / 2 / wheel switch weapon · V knife · G lethal (hold to cook a frag) · Q tactical · 3 / 4 / 5 / 6 killstreaks · 7 / 8 / 9 / 0 emotes · Tab scoreboard · Esc menu

## Credits

- [three.js](https://threejs.org) r128 (MIT), inlined.
- [PeerJS](https://peerjs.com) 1.5.5 (MIT), inlined.
- All models, textures and sounds are generated in code.
