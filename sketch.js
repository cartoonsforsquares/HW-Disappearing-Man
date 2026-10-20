let haystay, haybeat, disappear;
let scoreFont;

const grid = 3; // 3x3 grid of holes
const moleUpMin = 700;  // Ms a mole stays up before it's missed, minimum
const moleUpMax = 2000; // Ms a mole stays up before it's missed, maximum
const spawnInterval = 850; // Ms between spawn attempts
const whackRadius = 100; // How close a click/tap needs to be to a mole to hit it
const beatDuration = 150; // Ms hayley shows her hammer-down pose after a hit
const maxMissed = 10; // Game stops once this many moles have gone unhit
const LEVEL_EVERY = 20; // Game speeds up every 20 hits (see hud.js)
const moleUpFloor = 450; // Ms a mole always stays up, however fast the game gets, so it can still be hit
const moleFadeDuration = 200; // Ms the mole takes to fade in when it appears and fade out when it hides

let holes = []; // Each hole tracks { x, y, active, appearedAt, hideAt }
let score = 0;
let missed = 0;
let gameOver = false;
let isMobile = false; // True on touch devices (phones/tablets); detected once in setup()
let lastSpawnTime = 0;
let beatUntil = 0; // Timestamp until which hayley shows her hammer-down pose

let holeSize, hayleySize, moleSize;
const hayleyAspect = 2462 / 3208; // Hayley's real width-to-height ratio, so she never looks squished

// index.html loads p5.js v1.9, where preload waits for every load call on its own
// before setup() runs, so no async/await is needed here.

function preload() {
  haystay = loadImage("assets/Hay_Stay.png");
  haybeat = loadImage("assets/Hay_Beat.png");
  disappear = loadImage("assets/Disappear.png");
  scoreFont = loadFont("assets/GeistMono-Bold.ttf");
}

function setup() {
  // Detect touch devices once, so layout and hit detection can adapt to fingers vs a cursor
  isMobile = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;

  createCanvas(windowWidth, windowHeight);
  // Match the device's actual pixel density so sprites render crisp, not blurry, on retina phones
  pixelDensity(displayDensity());
  imageMode(CENTER);
  noCursor(); // Hayley replaces the system cursor

  // Stop the page from scrolling/zooming while the player drags a finger
  const c = document.querySelector('canvas');
  if (c) c.style.touchAction = 'none';

  layout();
  lastSpawnTime = millis();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  layout();
}

// Recomputes the 3x3 grid of hole positions and every sprite's size to fit the current canvas.
function layout() {
  // The grid fits in the space between the headline and the scoreboard
  const hud = hudLayout();
  const areaTop = hud.headBottom + hud.ts * 0.5;
  const availH = hud.scoreTop - hud.ts * 0.5 - areaTop;
  const gridSize = min(width * 0.85, availH * 0.85);
  const cell = gridSize / grid;

  const left = width / 2 - gridSize / 2;
  const top  = areaTop + (availH - gridSize) / 2;

  holeSize   = cell * 0.7;
  moleSize   = cell * 0.5;
  // Hayley is a little bigger on mobile so she stays easy to see and aim with a finger
  hayleySize = cell * (isMobile ? 1.0 : 0.85);

  // Preserve which holes are already active/hiding when the layout is recalculated (e.g. rotation)
  const prevHoles = holes;
  holes = [];
  for (let row = 0; row < grid; row++) {
    for (let col = 0; col < grid; col++) {
      const i = row * grid + col;
      const x = left + cell * (col + 0.5);
      const y = top + cell * (row + 0.5);
      const prev = prevHoles[i];
      holes.push({
        x, y,
        active: prev ? prev.active : false,
        appearedAt: prev ? prev.appearedAt : 0,
        hideAt: prev ? prev.hideAt : 0
      });
    }
  }
}

function draw() {
  background(CREAM); // Same background as every game (see hud.js)

  if (gameOver) {
    drawHoles();
    drawHUD();
    drawRetryScreen();
    drawHayley();
    return;
  }

  checkLevelUp();

  // Moles pop up more often as the game speeds up, and from level 3 several can pop up at once
  if (millis() - lastSpawnTime > spawnInterval / chaos()) {
    const molesAtOnce = 1 + floor(level() / 3);
    for (let i = 0; i < molesAtOnce; i++) trySpawnMole();
    lastSpawnTime = millis();
  }

  updateMoles();
  drawHoles();
  drawHUD();
  drawLevelBanner();
  drawHayley();
}

function drawHUD() {
  drawHeadline("Help Hayley whack\nthe disappearing man!");
  drawScoreboard(`Hit: ${score}   Missed: ${missed}`);
}

// Draws every hole, and the mole fading in/out of it if that hole is active.
function drawHoles() {
  noStroke();
  for (const h of holes) {
    fill(FONT_PINK); // Same pink as the headline font (see hud.js)
    ellipse(h.x, h.y, holeSize, holeSize * 0.55);
    if (h.active) {
      // Fade in just after appearing, fade out just before hiding — whichever is smaller wins
      const fadeIn = constrain((millis() - h.appearedAt) / moleFadeDuration, 0, 1);
      const fadeOut = constrain((h.hideAt - millis()) / moleFadeDuration, 0, 1);
      const alpha = min(fadeIn, fadeOut) * 255;

      tint(255, alpha);
      image(disappear, h.x, h.y - moleSize * 0.35, moleSize, moleSize);
      noTint();
    }
  }
}

// Activates a random empty hole, unless every hole is already occupied.
function trySpawnMole() {
  const empty = holes.filter(h => !h.active);
  if (empty.length === 0) return;

  const h = random(empty);
  h.active = true;
  h.appearedAt = millis();
  // Moles hide sooner as the game speeds up, but never quicker than moleUpFloor
  h.hideAt = millis() + max(moleUpFloor, random(moleUpMin, moleUpMax) / chaos());
}

// Hides any mole that has been up too long and counts it as missed.
function updateMoles() {
  for (const h of holes) {
    if (h.active && millis() > h.hideAt) {
      h.active = false;
      missed++;
      if (missed >= maxMissed) gameOver = true;
    }
  }
}

// Hayley follows the cursor/finger, showing her hammer-down pose briefly after a hit.
// hayleySize is treated as her height; her width is derived from the real image
// aspect ratio so she is never stretched into a square.
function drawHayley() {
  const pose = millis() < beatUntil ? haybeat : haystay;
  image(pose, mouseX, mouseY, hayleySize * hayleyAspect, hayleySize);
}

// The headline, scoreboard, retry screen, and speed-ups live in hud.js, shared by every game

// Shared whack/retry handling for both mouse clicks and touch taps.
function handleWhack(px, py) {
  if (gameOver) {
    attemptRetry();
    return;
  }

  // Hayley slams the hammer wherever the player taps/clicks, not just near a hole
  beatUntil = millis() + beatDuration;

  for (const h of holes) {
    if (h.active && dist(px, py, h.x, h.y) < whackRadius) {
      h.active = false;
      score++;
      return;
    }
  }
}

// Resets the game back to its starting state.
function attemptRetry() {
  score = 0;
  missed = 0;
  gameOver = false;
  resetLevels();
  for (const h of holes) h.active = false;
  lastSpawnTime = millis();
}

function mousePressed() {
  handleWhack(mouseX, mouseY);
}

function touchStarted() {
  // P5 does not auto-simulate mousePressed once touchStarted exists, so the
  // whack/retry logic needs to be triggered from here directly on phones
  handleWhack(mouseX, mouseY);
  return false; // Block scrolling/zooming while tapping
}

function touchMoved() {
  // Block the default touch behaviour so dragging does not scroll the page
  return false;
}
