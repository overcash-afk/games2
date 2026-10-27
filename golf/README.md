# Tipsy Links

First-person party golf for up to four friends. The more you drink, the farther you hit the ball. Funnel a beer on the tee for a golf cart, then run your friends over on the way to your ball.

**Play:** https://overcash-afk.github.io/games2/golf/

## Playing with friends

1. One person opens the page, enters a name and clicks **Host a game**.
2. In the clubhouse, they click **Share invite link** (or **Copy link**) and send it to up to three friends. Friends can also type the six-character code under **Join a friend**.
3. Friends open the link, enter a name and click **Join**.
4. The host picks **Stroke play** or **Time trial**, 3, 9 or 18 holes, the **wind** (Calm, Light, Normal up to about 16 mph, Strong 13–29 mph, or Hurricane 31–55 mph; changeable mid-round from ☰), the side games, sets the house rules, rolls a new course if they like, and clicks **Tee off**. Everyone picks their own tolerance (see Drinking).

**Time trial:** a clock runs on every hole from tee-off until you hole out, and strokes don't count. The lowest total time wins. A hole times out at 5 minutes (and **Pick up** takes the 5:00), so nobody holds up the round. Once everyone else has finished a hole, the last player out gets a 15-second countdown. If they haven't holed out when it ends, their time for the hole is the clock so far plus a 30-second penalty (never more than 5:00), and the hole ends.

Everyone plays their own ball at the same time; you see your friends' golfers, balls and ball flights on the course. When everyone has holed out, the scorecard shows for a few seconds and the next hole starts. After the last hole there's a final scorecard with awards.

Players find each other through the free public PeerJS server, then connect directly (WebRTC). The host's browser keeps the scorecard, so if the host leaves the game ends. Some work or school networks block direct connections; switching to mobile data usually fixes that. Works on phones (touch) and computers.

## Drinking

- Tap **🍺 Sip** whenever you take a sip and **🥃 Shot** when you take a shot. It's on the honor system, and everyone sees a message when you drink.
- Each sip adds +15% distance to every club, and a shot counts as three sips, up to ×4 (putts get half the boost).
- It's built for chaos. As you drink, your aim sways harder, the swing needle speeds up and shakes, and random hooks and slices creep in. Shanks become more likely (up to a 30% chance), and past five drinks you get hiccups that jolt your aim between swings (never the needle mid-swing). The screen also blurs, tilts and doubles. You can turn the visual effects off in the menu; the gameplay effects stay.
- **Your tolerance** (clubhouse, or ☰ mid-round) sets how much drinking gets to your swing needle. Everyone sees each other's pick next to their name, and a change mid-round is announced. Drinks add the same power whichever you pick.
  - 🪶 **Light Weight**: the needle gets up to 50% faster and shakes the most.
  - 🍻 **Weekend Drinker** (the default): up to 30% faster, with less shake.
  - 🏋️ **Heavy Weight**: up to 15% faster, with barely any shake.
- Your buzz wears off at one sip every four minutes, so keep sipping to keep the power.
- Your *drunk level* (wobble, blur, shanks, hiccups) is your buzz plus any funnels. A funnel adds +3 drunk level but no power.

### House rules

The host sets the drinking rules in the clubhouse, and can change them from the ☰ menu mid-round. Each rule is *when this happens* → *who drinks* (that player, everyone else or everyone) → *sip or shot*, plus optional custom words that show up in the prompt ("waterfall", "chug while singing"…). Triggers: ball in the water, out of bounds, bunker, hitting a tree, shanks, three-putts, double bogey or worse, birdie or better, hole in one, worst or best score on a hole, longest drive on a hole, getting run over, running someone over, driving a cart into water, running into water, tripping, funneling a beer, getting hit by an attack ball, hitting someone with one, winning Closest to the Pin or the Long Drive, and the start of every hole. When a rule fires, the right people get a prompt with a **Done** button that logs the drink. Rules are saved in the host's browser for next time; **Defaults** restores the starter set.

For adults of legal drinking age. Pace yourself, drink some water, and nobody drives home.

## Side games

The host turns them on in the clubhouse: **Both** (the default), **Closest to the Pin**, **Long Drive** or **Off**.

- **Closest to the Pin** runs on every par 3. Your tee shot has to finish on the green, and the closest one wins (an ace beats everything).
- **Long Drive** runs on every par 5. Your drive has to finish in the fairway, and the longest one wins.
- On contest holes the hole banner and the info card name the contest and show the current leader. The feed announces each new leader and the winner. Winners appear on the scorecard and in the final awards, and the default house rules make everyone else take a sip (*Wins Closest to the Pin*, *Wins the Long Drive contest*).
- **Bets:** on the tee, tap **🤝** to bet a friend a sip or a shot that you beat them on this hole (lower score, or faster time in a time trial). They get **Accept** or **Decline**; an offer nobody answers within 25 seconds is declined. An offer expires when either of you tees off. Accepted bets show on your info card. When the hole ends, the loser gets a prompt to drink, and on a tie you both do. One bet per pair per hole. Settled bets appear on the scorecard, and the final awards name the Hustler (most bets won).

## Getting to your ball: funnel or run

After every shot you travel to your ball yourself, in first person. You can get moving one second after you hit, while the ball is still in the air; until you touch the controls, your view keeps following it. The shot is scored when the ball stops, and **⛳ Play shot** appears once it has. A pop-up marker and a beam of light show where your ball is (following it while it flies); when it's off screen, the marker sits on the edge of the screen and points the way.

- **Funnel for a cart:** on each tee box you're offered a golf cart for that hole. To get it you funnel a beer: hold **Hold while you funnel** for the whole chug and let go when it's empty (anything under 2 seconds doesn't count). Everyone sees your time, and the final awards include Fastest Funnel. The funnel adds **no shot power**, only the cart, but it does make you drunker (+3 wobble and blur, like a shot). The offer lasts until your tee shot.
- **With a cart** you drive to your shots (▲ ▼ ◀ ▶ or W/A/S/D, 📯 / G to honk; steering gets loose when you're drunk) and can **run people over**: hit a friend standing at their ball or running to it and they go flying. It's just for show: it doesn't touch their swing, aim or score, and nobody has to drink unless the host adds a *Gets run over* or *Runs someone over* house rule. Trees and other carts stop you. Drive into a pond and the cart sinks: you're on foot for the rest of the hole. Get out whenever you like (**🚶 Get out** or E): the cart stays where you left it, and **🚗 Get in** (or E) appears when you walk back to it. After a shot you start in the cart only if it's parked nearby.
- **Without a cart** you run, at about half a cart's speed. You can't hit anyone, but carts can hit you. Running drunk is messy: your line wanders, you lurch sideways and sometimes trip. Running into a pond counts as a swim.
- When you're close to your ball, press **⛳ Play shot** (or F). **⏭ Skip** jumps you straight to your ball, but costs a sip. That sip counts toward your drink totals but adds no shot power.
- After you hole out you can keep driving or running around the course (🚗 / 🏃 button) while the others finish.

## Attack balls

Every player gets five attack balls per hole, in either mode, and they never count as strokes. Tap **🎯** (or X) to drop one at your feet. Line up the crosshair (drag or A/D), then hit it with a quick two-tap swing: tap **SWING** (or Space) to start the backswing and tap again to hit; the needle (which bounces until you tap) sets how fast it flies. It goes straight at whoever is under the crosshair (no slice), and the hit zone is generous. A hit knocks the player down for a moment, wrecks their swing if they're mid-backswing, and jolts their cart if they're driving. You can hit one from your ball, on foot, after you've holed out, or from the cart (🎯 hops you out first). Tap ✕ to put it away. House-rule triggers: *Gets hit by an attack ball* and *Hits someone with an attack ball*.

## How to swing

- **Aim:** drag on the screen (or A/D, arrow keys; hold Shift for fine aim). Drag up and down to look. The dotted line and ring show where a full-power shot lands with your current club and buzz, before wind.
- **Club:** the game picks one for you each shot; change it with ◀ ▶, Q/E or the mouse wheel.
- **Swing:** press SWING (or Space) three times: once to start the backswing, once to set power, and once when the needle comes back to the white line. The white zone is generous and the needle is fairly slow when you're sober. Too early pushes or slices right, too late pulls or hooks left. Way off tops the ball. The swing never moves on without you: the power needle bounces until you press, and if the needle passes the white line without a press, the swing is called off (no stroke) and you swing again. The needle runs on real time and is read at the instant you press, so it's the same on a fast computer and a slow one.
- **Putting:** the putter's full stroke scales to the putt (about 1.6 times the distance to the hole), and a blue tick on the meter marks the power that gets the ball to the hole, allowing for uphill and downhill. A dotted line shows how the first half of a putt at that power breaks. Greens are gentle, the cup is generous, and anything inside 3 feet is tapped in automatically.
- Rough costs 18% distance, and bunkers cost 40% (12% with the sand wedge). Water is a one-stroke penalty with a drop beside the hazard; out of bounds is stroke and distance. A hole ends for you at par + 4.
- **Graphics:** ☰ → Graphics switches between High (sun shadows, full resolution), Medium (the default on phones) and Low (no shadows, grass or color grading, lower resolution) if the game stutters. High and Medium run the picture through a film-style color grade: warm sunlight, cool shade and a soft vignette.
- **Shot tracers:** every ball in the air draws a glowing TV-style tracer in its player's color, which fades a few seconds after the ball stops. Putts get a fainter one.
- **Golfers:** your friends' golfers stand beside their balls and swing when they do. You see their backswing as it happens, then the strike and follow-through as their ball takes off. They run to their balls, sit at the wheel when driving, and react when they hole out: a jump for birdie or better, a fist pump for par, hands on head for worse. Carts have spinning, steering wheels, a windshield and a bag on the back.
- On a computer, buttons show their keyboard keys and the on-screen driving pedals are hidden: drive or run with W/A/S/D or the arrow keys.
- 🚗 / 🏃 leaves your ball to drive or run around, 🔭 zooms, 🎥 switches between your own eyes and a ball cam during flight, 📋 shows the scorecard, 🍻 sends a cheers to everyone, and ☰ has the invite link, settings and **Pick up**.

## Files

- `index.html`: page layout and styles
- `game.js`: course generator, ball physics, rendering, networking and game rules
- `vendor/`: [three.js](https://threejs.org) r128 and [PeerJS](https://peerjs.com) 1.5.5 (both MIT), the same builds Fragtown uses

Courses are generated from a random seed, so every **New course** is different, and all players build the same holes from the seed the host shares.
