# Tipsy Links

First-person party golf for up to four friends. The more you drink, the farther you hit the ball. There are golf carts, and you can run your friends over.

**Play:** https://overcash-afk.github.io/games2/golf/

## Playing with friends

1. One person opens the page, enters a name and clicks **Host a game**.
2. In the clubhouse, they click **Share invite link** (or **Copy link**) and send it to up to three friends. Friends can also type the six-character code under **Join a friend**.
3. Friends open the link, enter a name and click **Join**.
4. The host picks 3, 9 or 18 holes, sets the house rules, rolls a new course if they like, and clicks **Tee off**.

Everyone plays their own ball at the same time; you see your friends' golfers, balls and ball flights on the course. When everyone has holed out, the scorecard shows for a few seconds and the next hole starts. After the last hole there's a final scorecard with awards.

Players find each other through the free public PeerJS server, then connect directly (WebRTC). The host's browser keeps the scorecard, so if the host leaves the game ends. Some work or school networks block direct connections; switching to mobile data usually fixes that. Works on phones (touch) and computers.

## Drinking

- Tap **🍺 Sip** whenever you take a sip and **🥃 Shot** when you take a shot. It's on the honor system, and everyone sees a message when you drink.
- Each sip adds +15% distance to every club, and a shot counts as three sips, up to ×4 (putts get half the boost).
- It's built for chaos. As you drink, your aim sways harder, the swing meter speeds up and shakes, and random hooks and slices creep in. Shanks become more likely (up to a 30% chance), and past five drinks you get hiccups that jolt your aim mid-swing. The screen also blurs, tilts and doubles. You can turn the visual effects off in the menu; the gameplay effects stay.
- Your buzz wears off at one sip every four minutes, so keep sipping to keep the power.

### House rules

The host sets the drinking rules in the clubhouse, and can change them from the ☰ menu mid-round. Each rule is *when this happens* → *who drinks* (that player, everyone else or everyone) → *sip or shot*, plus optional custom words that show up in the prompt ("waterfall", "chug while singing"…). Triggers: ball in the water, out of bounds, bunker, hitting a tree, shanks, three-putts, double bogey or worse, birdie or better, hole in one, worst or best score on a hole, longest drive on a hole, getting run over, running someone over, driving a cart into water, and the start of every hole. When a rule fires, the right people get a prompt with a **Done** button that logs the drink. Rules are saved in the host's browser for next time; **Defaults** restores the starter set.

For adults of legal drinking age. Pace yourself, drink some water, and nobody drives home.

## Golf carts

Tap **🚗** (or press F) any time you're lining up a shot or waiting for others: you're in the driver's seat of your cart. Drive with ▲ ▼ ◀ ▶ (or W/A/S/D), honk with 📯 (G). Steering gets loose when you've been drinking. Drive into a friend standing at their ball to **run them over**: they go flying, their swing gets knocked off line, and your house rules decide who drinks. Trees and other carts stop you, and a pond swallows the cart. **⛳ Back to ball** puts you back at your ball. No drinking while driving.

## How to swing

- **Aim:** drag on the screen (or A/D, arrow keys; hold Shift for fine aim). Drag up and down to look. The dotted line and ring show where a full-power shot lands with your current club and buzz, before wind.
- **Club:** the game picks one for you each shot; change it with ◀ ▶, Q/E or the mouse wheel.
- **Swing:** press SWING (or Space) three times: once to start the backswing, once to set power, and once when the needle comes back to the white line. Too early pushes or slices right, too late pulls or hooks left. Way off tops the ball.
- Rough costs 18% distance, and bunkers cost 40% (12% with the sand wedge). Water is a one-stroke penalty with a drop beside the hazard; out of bounds is stroke and distance. Putts inside 2 feet are tapped in automatically, and a hole ends for you at par + 4.
- 🚗 jumps in your golf cart, 🔭 zooms, 🎥 switches between your own eyes and a ball cam during flight, 📋 shows the scorecard, 🍻 sends a cheers to everyone, and ☰ has the invite link, settings and **Pick up**.

## Files

- `index.html`: page layout and styles
- `game.js`: course generator, ball physics, rendering, networking and game rules
- `vendor/`: [three.js](https://threejs.org) r128 and [PeerJS](https://peerjs.com) 1.5.5 (both MIT), the same builds Fragtown uses

Courses are generated from a random seed, so every **New course** is different, and all players build the same holes from the seed the host shares.
