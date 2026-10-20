# Tipsy Links

First-person party golf for up to four friends. The more you drink, the farther you hit the ball.

**Play:** https://overcash-afk.github.io/games2/golf/

## Playing with friends

1. One person opens the page, enters a name and clicks **Host a game**.
2. In the clubhouse, they click **Share invite link** (or **Copy link**) and send it to up to three friends. Friends can also type the six-character code under **Join a friend**.
3. Friends open the link, enter a name and click **Join**.
4. The host picks 3, 9 or 18 holes, turns drinking prompts on or off, rolls a new course if they like, and clicks **Tee off**.

Everyone plays their own ball at the same time; you see your friends' golfers, balls and ball flights on the course. When everyone has holed out, the scorecard shows for a few seconds and the next hole starts. After the last hole there's a final scorecard with awards.

Players find each other through the free public PeerJS server, then connect directly (WebRTC). The host's browser keeps the scorecard, so if the host leaves the game ends. Some work or school networks block direct connections; switching to mobile data usually fixes that. Works on phones (touch) and computers.

## Drinking

- Tap **🍺 Sip** whenever you take a sip and **🥃 Shot** when you take a shot. It's on the honor system, and everyone sees a message when you drink.
- Each sip adds +10% distance to every club, and a shot counts as three sips, up to ×3 (putts get half the boost).
- Drinking also costs you control. Your aim sways, the swing meter speeds up and jitters, your shots pick up random hook or slice, and the screen blurs and doubles. The visual effects can be turned off in the menu; the gameplay effects stay.
- Your buzz wears off at one sip every four minutes, so keep sipping to keep the power.
- With **drinking prompts** on, the game tells you to drink when you go in the water, go out of bounds, three-putt, make double bogey or worse, or have the worst score on a hole. A birdie makes everyone else sip, and an eagle or hole-in-one makes everyone else take a shot.

For adults of legal drinking age. Pace yourself, drink some water, and nobody drives home.

## How to swing

- **Aim:** drag on the screen (or A/D, arrow keys; hold Shift for fine aim). Drag up and down to look. The dotted line and ring show where a full-power shot lands with your current club and buzz, before wind.
- **Club:** the game picks one for you each shot; change it with ◀ ▶, Q/E or the mouse wheel.
- **Swing:** press SWING (or Space) three times: once to start the backswing, once to set power, and once when the needle comes back to the white line. Too early pushes or slices right, too late pulls or hooks left. Way off tops the ball.
- Rough costs 18% distance, and bunkers cost 40% (12% with the sand wedge). Water is a one-stroke penalty with a drop beside the hazard; out of bounds is stroke and distance. Putts inside 2 feet are tapped in automatically, and a hole ends for you at par + 4.
- 🔭 zooms, 🎥 switches between your own eyes and a ball cam during flight, 📋 shows the scorecard, 🍻 sends a cheers to everyone, and ☰ has the invite link, settings and **Pick up**.

## Files

- `index.html`: page layout and styles
- `game.js`: course generator, ball physics, rendering, networking and game rules
- `vendor/`: [three.js](https://threejs.org) r128 and [PeerJS](https://peerjs.com) 1.5.5 (both MIT), the same builds Fragtown uses

Courses are generated from a random seed, so every **New course** is different, and all players build the same holes from the seed the host shares.
