
//Shared look and difficulty for every game (headline, scoreboard, retry screen, speed-ups)
//This exact file is copied into each game, so copy any change here to the other games too
//Each game's sketch.js provides: isMobile, score, scoreFont, and LEVEL_EVERY

//Colors taken from the Ms.Williams Shadow font's own palette
const CREAM       = '#FBF5E6';
const FONT_PINK   = '#F49AC1';
const FONT_SHADOW = '#2B2727';

//Ms.Williams Shadow is a color font, so it is loaded with CSS (see css/style.css) instead of
//loadFont(), which would flatten it to one color. p5 can still use it by its CSS name.
const HEADLINE_FONT = 'MsWilliamsShadow';
document.fonts.load(`40px ${HEADLINE_FONT}`);

//The longest headline line across all the games. Every game sizes its headline to fit this line,
//so headlines are the same size (and line up) in every game. Update it if a new game has a longer line.
const LONGEST_HEADLINE_LINE = "the disappearing man!";

//Every LEVEL_EVERY points the game gets LEVEL_SPEEDUP faster, until it reaches MAX_CHAOS
const LEVEL_SPEEDUP   = 0.25;
const MAX_CHAOS       = 2.5;
const LEVEL_BANNER_MS = 1200; //how long the "Faster!" banner stays on screen

let lastChaos = 1;
let levelBannerUntil = 0;

//Text size and positions, worked out from the screen size so every game lines up the same way
function hudLayout() {
  //Bigger on mobile since phones are viewed from closer up
  const ts = isMobile ? constrain(width * 0.075, 26, 46) : constrain(width * 0.045, 16, 35);
  //Space between the text and the edge of the screen (the scoreboard sits a little closer)
  const edge = ts * 1.5;
  const scoreEdge = ts * 1.0;
  //Scoreboard text is smaller than the headline
  const scoreSize = ts * 0.7;
  return {
    ts,
    edge,
    scoreSize,
    headTop:     edge,
    headBottom:  edge + ts * 1.25 * 2,                    //headline is two lines tall
    scoreBottom: height - scoreEdge,
    scoreTop:    height - scoreEdge - scoreSize * 1.25
  };
}

function drawHeadline(words) {
  const hud = hudLayout();
  push();
  textFont(HEADLINE_FONT); noStroke(); fill(FONT_PINK); textAlign(CENTER, TOP);
  textSize(hud.ts);
  //Shrink the headline so the longest line of any game never sits closer to the sides than
  //to the top. Every game measures the same longest line, so all headlines end up the same size.
  const widest = max([LONGEST_HEADLINE_LINE, ...words.split('\n')].map(line => textWidth(line)));
  const room = width - hud.edge * 2;
  if (widest > room) textSize(hud.ts * room / widest);
  text(words, width / 2, hud.headTop);
  pop();
}

function drawScoreboard(words) {
  const hud = hudLayout();
  push();
  textFont(scoreFont); noStroke(); fill('black'); textSize(hud.scoreSize); textAlign(CENTER, BOTTOM);
  text(words.toUpperCase(), width / 2, hud.scoreBottom);
  pop();
}

//Each game waits on a "Tap to play" screen first. Browsers keep sound off until the player taps
//or clicks, so this first tap is what turns the sound on (moving the mouse does not count).
let started = false;

function drawStartScreen() {
  const hud = hudLayout();
  push();
  textFont(HEADLINE_FONT); noStroke(); fill(FONT_PINK); textSize(hud.ts * 2); textAlign(CENTER, CENTER);
  const words = isMobile ? "Tap to play" : "Click to play";
  //Shrink it if needed so it keeps the same side space as the headline
  const room = width - hud.edge * 2;
  if (textWidth(words) > room) textSize(hud.ts * 2 * room / textWidth(words));
  text(words, width / 2, height / 2);
  pop();
}

//Call at the top of each game's tap/click handler. On the very first tap it starts the game
//(running onStart to reset the timers) and returns true, so that tap does nothing else.
function handleStartTap(onStart) {
  if (started) return false;
  started = true;
  unlockSound();
  onStart();
  return true;
}

//Sound effects use the browser's Web Audio API directly, so no extra sound library is needed
const soundContext = new (window.AudioContext || window.webkitAudioContext)();

function unlockSound() {
  if (soundContext.state !== 'running') soundContext.resume();
  //Older iPhones also need a sound to be started during the tap itself, so play a silent one
  const silence = soundContext.createBufferSource();
  silence.buffer = soundContext.createBuffer(1, 1, 22050);
  silence.connect(soundContext.destination);
  silence.start(0);
}
//Any tap, click, or key press unlocks sound, even before the game's own handlers run
for (const type of ['pointerdown', 'touchend', 'mousedown', 'keydown']) {
  window.addEventListener(type, unlockSound, { capture: true, passive: true });
}

//Starts loading a sound file and returns an object that holds it once it is ready
function loadSoundEffect(path) {
  const sound = { buffer: null };
  fetch(path)
    .then(response => response.arrayBuffer())
    .then(data => soundContext.decodeAudioData(data))
    .then(buffer => { sound.buffer = buffer; })
    .catch(() => {}); //a missing sound should never stop the game
  return sound;
}

//Plays a sound once. rate changes the pitch slightly (1 = normal) so repeats do not sound robotic.
function playSoundEffect(sound, volume = 1, rate = 1) {
  if (!sound.buffer || soundContext.state !== 'running') return;
  const source = soundContext.createBufferSource();
  source.buffer = sound.buffer;
  source.playbackRate.value = rate;
  const gain = soundContext.createGain();
  gain.gain.value = volume;
  source.connect(gain).connect(soundContext.destination);
  source.start();
}

//Shown once the player has missed too many. Click or tap anywhere to retry.
function drawRetryScreen() {
  const hud = hudLayout();
  push();
  textFont(HEADLINE_FONT); noStroke(); fill(FONT_PINK); textSize(hud.ts * 2); textAlign(CENTER, CENTER);
  text("Retry?", width / 2, height / 2);
  pop();
}

//Level 0 for the first LEVEL_EVERY points, level 1 for the next, and so on
function level() {
  return floor(score / LEVEL_EVERY);
}

//How much faster the game is than at the start: 1 = normal speed, MAX_CHAOS = fastest
function chaos() {
  return min(1 + level() * LEVEL_SPEEDUP, MAX_CHAOS);
}

//Call once per frame; starts the banner whenever the game gets faster
function checkLevelUp() {
  if (chaos() > lastChaos) levelBannerUntil = millis() + LEVEL_BANNER_MS;
  lastChaos = chaos();
}

function drawLevelBanner() {
  if (millis() > levelBannerUntil) return;
  const hud = hudLayout();
  push();
  textFont(HEADLINE_FONT); noStroke(); fill(FONT_PINK); textSize(hud.ts * 1.6); textAlign(CENTER, CENTER);
  text(chaos() >= MAX_CHAOS ? "Max chaos!" : "Faster!", width / 2, height / 2);
  pop();
}

//Call from each game's retry so the next round starts at normal speed
function resetLevels() {
  lastChaos = 1;
  levelBannerUntil = 0;
}
