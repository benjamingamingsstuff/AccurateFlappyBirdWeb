const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// Game Constants
const FPS = 60;
const GRAVITY = 0.3; // 0.3 from smali
const JUMP = -5.0;   // -5.0 from smali
const SPEED = 2;     // 2.0 from smali
const PIPE_SPAWN_RATE = 79; // 157px / 2px/frame ~= 78.5 frames
const PIPE_GAP = 96; // 0x60 from smali
const GROUND_Y = 400; // 512 - 112

// Assets
const img = new Image();
img.src = 'assets/atlas.png';
const splashImg = new Image();
splashImg.src = 'assets/splash.png';

// Web Audio API for low latency on iOS
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();
const buffers = {};

function loadSound(name, url) {
    fetch(url)
        .then(res => res.arrayBuffer())
        .then(arrayBuffer => audioCtx.decodeAudioData(arrayBuffer))
        .then(audioBuffer => {
            buffers[name] = audioBuffer;
        })
        .catch(e => console.error(e));
}

loadSound('wing', 'assets/sounds/sfx_wing.ogg');
loadSound('hit', 'assets/sounds/sfx_hit.ogg');
loadSound('die', 'assets/sounds/sfx_die.ogg');
loadSound('point', 'assets/sounds/sfx_point.ogg');
loadSound('swooshing', 'assets/sounds/sfx_swooshing.ogg');

function playSound(name) {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    if (buffers[name]) {
        const source = audioCtx.createBufferSource();
        source.buffer = buffers[name];
        source.connect(audioCtx.destination);
        source.start(0);
    }
}

// Game State
let state = {
    current: 0,
    splash: 0,
    getReady: 1,
    game: 2,
    over: 3,
    menu: 4
};

let frames = 0;
let score = 0;
let bestScore = localStorage.getItem('flappy_best') || 0;
let bgType = 0; // 0: day, 1: night
let birdColor = 0; // 0: yellow, 1: blue, 2: red
let flashOpacity = 0; // For flash effect
let fadeOpacity = 0; // For fade transition
let fadeState = 0; // 0: None, 1: Out (to black), 2: In (from black)
let nextState = 0; // State to switch to after fade out

// Button Helper
const buttons = {
    play: { name: 'button_play', x: 0, y: 0, w: 116, h: 70 },
    score: { name: 'button_score', x: 0, y: 0, w: 116, h: 70 },
    rate: { name: 'button_rate', x: 0, y: 0, w: 74, h: 48 },
    menu: { name: 'button_menu', x: 0, y: 0, w: 80, h: 28 },
    ok: { name: 'button_ok', x: 0, y: 0, w: 80, h: 28 }
};

// Controls
function handleInput(x, y) {
    // Resume Audio Context on first interaction
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    // Block input during fade
    if (fadeState !== 0) return;

    switch (state.current) {
        case state.splash:
            startFade(state.menu);
            break;
        case state.menu:
            if (checkButton(buttons.play, x, y)) {
                playSound('swooshing');
                startFade(state.getReady);
            } else if (checkButton(buttons.score, x, y)) {
                alert("Leaderboard cant really be added, it will stay here though to keep things accurate");
            }
            break;
        case state.getReady:
            state.current = state.game;
            bird.flap();
            break;
        case state.game:
            bird.flap();
            break;
        case state.over:
            // Wait for UI to appear (frames > 60)
            if (frames > 60) {
                if (checkButton(buttons.play, x, y)) {
                    playSound('swooshing');
                    startFade(state.getReady);
                } else if (checkButton(buttons.score, x, y)) {
                    alert("Leaderboard cant really be added, it will stay here though to keep things accurate");
                }
            }
            break;
    }
}

// Touch Event (Instant response)
canvas.addEventListener('touchstart', function (evt) {
    evt.preventDefault(); // Prevent scrolling/zooming
    let rect = canvas.getBoundingClientRect();
    let touch = evt.touches[0];
    let clickX = touch.clientX - rect.left;
    let clickY = touch.clientY - rect.top;

    let scaleX = canvas.width / rect.width;
    let scaleY = canvas.height / rect.height;
    handleInput(clickX * scaleX, clickY * scaleY);
}, { passive: false });

// Mouse Event (Fallback)
canvas.addEventListener('mousedown', function (evt) {
    let rect = canvas.getBoundingClientRect();
    let clickX = evt.clientX - rect.left;
    let clickY = evt.clientY - rect.top;

    let scaleX = canvas.width / rect.width;
    let scaleY = canvas.height / rect.height;
    handleInput(clickX * scaleX, clickY * scaleY);
});

function startFade(targetState) {
    fadeState = 1; // Fade Out
    nextState = targetState;
}

function checkButton(btn, x, y) {
    // Buttons are drawn centered in my drawSprite
    // So bounds are btn.x - w/2 to btn.x + w/2
    return x >= btn.x - btn.w / 2 &&
        x <= btn.x + btn.w / 2 &&
        y >= btn.y - btn.h / 2 &&
        y <= btn.y + btn.h / 2;
}

// Optimized Draw Sprite Helper
function drawSprite(name, x, y, w, h, rot) {
    const s = sprites[name];
    if (!s) return;

    // Use integer coordinates for performance
    const dx = Math.floor(x);
    const dy = Math.floor(y);
    const width = w || s.width;
    const height = h || s.height;

    if (rot) {
        ctx.save();
        ctx.translate(dx, dy);
        ctx.rotate(rot);
        ctx.drawImage(img, s.x, s.y, s.width, s.height, -width / 2, -height / 2, width, height);
        ctx.restore();
    } else {
        // Fast path without save/restore/rotate
        ctx.drawImage(img, s.x, s.y, s.width, s.height, Math.floor(dx - width / 2), Math.floor(dy - height / 2), width, height);
    }
}

// Optimized Draw Sprite Top-Left Helper (for background/ground)
function drawSpriteTL(name, x, y, w, h) {
    const s = sprites[name];
    if (!s) return;
    const width = w || s.width;
    const height = h || s.height;
    ctx.drawImage(img, s.x, s.y, s.width, s.height, Math.floor(x), Math.floor(y), width, height);
}

const bg = {
    draw: function () {
        const name = bgType === 0 ? 'bg_day' : 'bg_night';
        drawSpriteTL(name, 0, canvas.height - 512); // Align bottom
    }
};

const fg = {
    x: 0,
    draw: function () {
        drawSpriteTL('land', this.x, canvas.height - 112);
        drawSpriteTL('land', this.x + 336, canvas.height - 112); // Repeat
    },
    update: function () {
        if (state.current === state.game || state.current === state.getReady || state.current === state.menu || state.current === state.splash) {
            if (state.current !== state.splash) {
                this.x -= SPEED;
                if (this.x <= -336 + 288) this.x = 0;
            }
        }
    }
};

const bird = {
    animation: [0, 1, 2, 1],
    x: 80,
    y: 246,
    speed: 0,
    rotation: 0, // Degrees
    rotSpeed: 0,
    rotAccel: 0,
    radius: 7,
    frame: 0,

    draw: function () {
        let birdName = `bird${birdColor}_${this.animation[this.frame]}`;
        const s = sprites[birdName];
        // Scale by 1.15x
        const w = s.width * 1.15;
        const h = s.height * 1.15;
        // Convert degrees to radians for canvas
        drawSprite(birdName, this.x, this.y, w, h, this.rotation * Math.PI / 180);
    },

    flap: function () {
        this.speed = -5.0; // JUMP
        this.rotSpeed = -10.0; // Smali -10.0f
        this.rotAccel = 0.4;   // Smali 0.4f
        playSound('wing');
    },

    update: function () {
        const groundY = canvas.height - 112;
        const onGround = this.y + this.radius >= groundY;

        // Animation speed
        if (!onGround) {
            const period = (state.current === state.getReady || state.current === state.menu) ? 10 : 5;
            this.frame += frames % period === 0 ? 1 : 0;
            this.frame = this.frame % this.animation.length;
        }

        if (state.current === state.getReady || state.current === state.menu) {
            this.y = 246;
            this.y += Math.cos(frames / 15) * 1.5;
            this.rotation = 0;
            this.x = 80;
        } else if (state.current === state.game || state.current === state.over) {
            // Position Physics
            if (state.current === state.game || (state.current === state.over && !onGround)) {
                this.speed += 0.3; // GRAVITY
                if (this.speed > 8.0) this.speed = 8.0; // Terminal Velocity
                this.y += this.speed;
            }

            // Rotation Physics (Always run)
            this.rotSpeed += this.rotAccel;
            this.rotation += this.rotSpeed;

            // Clamp Rotation
            if (this.rotation < -20) {
                this.rotation = -20;
            }
            if (this.rotation > 90) {
                this.rotation = 90;
            }

            // Floor collision
            if (this.y + this.radius >= groundY) {
                this.y = groundY - this.radius;
                if (state.current === state.game) {
                    this.gameOver();
                }
            }
        }
    },

    gameOver: function () {
        if (state.current === state.game) {
            state.current = state.over;
            playSound('hit');
            setTimeout(() => playSound('die'), 500);
            flashOpacity = 1.0;
            frames = 0;

            // Force beak down
            this.rotSpeed = 30; // Rotate quickly to 90
            this.speed = 0; // Stop upward momentum
        }
    },

    reset: function () {
        this.speed = 0;
        this.rotation = 0;
        this.rotSpeed = 0;
        this.rotAccel = 0;
        this.y = 246;
        this.x = 80;
        birdColor = Math.floor(Math.random() * 3);
        bgType = Math.floor(Math.random() * 2);
    }
};

const pipes = {
    position: [],

    draw: function () {
        for (let i = 0; i < this.position.length; i++) {
            let p = this.position[i];
            let topY = p.y;
            let bottomY = p.y + PIPE_GAP;

            // Top pipe (facing down)
            drawSpriteTL('pipe_down', p.x, topY - 320); // 320 is pipe height

            // Bottom pipe (facing up)
            drawSpriteTL('pipe_up', p.x, bottomY);
        }
    },

    update: function () {
        if (state.current !== state.game) return;

        if (frames % PIPE_SPAWN_RATE === 0) {
            const minGapY = 84;
            const maxGapY = 264;
            const y = Math.floor(Math.random() * (maxGapY - minGapY + 1)) + minGapY;

            this.position.push({
                x: canvas.width,
                y: y,
                passed: false // Track if passed
            });
        }

        for (let i = 0; i < this.position.length; i++) {
            let p = this.position[i];

            p.x -= SPEED;

            // Collision
            if (bird.x + bird.radius > p.x && bird.x - bird.radius < p.x + 52) {
                if (bird.y - bird.radius < p.y || bird.y + bird.radius > p.y + PIPE_GAP) {
                    bird.gameOver();
                }
            }

            // Score Counting
            if (!p.passed && p.x + 52 < bird.x) {
                score++;
                playSound('point');
                bestScore = Math.max(score, bestScore);
                localStorage.setItem('flappy_best', bestScore);
                p.passed = true;
            }

            // Remove passed pipes (off screen)
            if (p.x + 52 < -50) {
                this.position.shift();
                i--;
            }
        }
    },

    reset: function () {
        this.position = [];
    }
};

// UI
const ui = {
    draw: function () {
        if (state.current === state.splash) {
            // Draw Splash
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            if (splashImg.complete) {
                const w = splashImg.width;
                const h = splashImg.height;
                let scale = 1;
                if (w > canvas.width) scale = canvas.width / w;

                const dw = w * scale;
                const dh = h * scale;

                ctx.drawImage(splashImg, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
            }

            // Auto transition if no click
            if (frames > 120 && fadeState === 0) {
                startFade(state.menu);
            }

        } else if (state.current === state.menu) {
            // Title
            drawSprite('title', canvas.width / 2, 100);

            buttons.play.x = 78;
            buttons.play.y = 340;
            buttons.score.x = 210;
            buttons.score.y = 340;

            drawSprite('button_play', buttons.play.x, buttons.play.y);
            drawSprite('button_score', buttons.score.x, buttons.score.y);

            // Copyright
            drawSprite('brand_copyright', canvas.width / 2, 400);

        } else if (state.current === state.getReady) {
            drawSprite('text_ready', canvas.width / 2, 150);
            drawSprite('tutorial', canvas.width / 2, 250);
            drawScore(score, canvas.width / 2, 50); // Show score 0
        } else if (state.current === state.over) {
            drawSprite('text_game_over', canvas.width / 2, 150);

            // Delay Score Panel
            if (frames > 60) {
                // Score Panel
                const panelX = canvas.width / 2;
                const panelY = 250;
                drawSprite('score_panel', panelX, panelY);

                // Medals REMOVED

                // Score on board (Right Aligned)
                drawScore(score, 235, 231, true);

                // Best Score
                drawScore(bestScore, 235, 273, true);

                // New Label
                if (score > bestScore) {
                    drawSprite('new', 167, 250);
                }

                buttons.play.x = 78;
                buttons.play.y = 340;
                buttons.score.x = 210;
                buttons.score.y = 340;

                drawSprite('button_play', buttons.play.x, buttons.play.y);
                drawSprite('button_score', buttons.score.x, buttons.score.y);
            }
        } else {
            // Live Score
            drawScore(score, canvas.width / 2, 50);
        }

        // Flash Effect
        if (flashOpacity > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${flashOpacity})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            flashOpacity -= 0.1;
        }

        // Fade Transition
        if (fadeState !== 0) {
            if (fadeState === 1) { // Fade Out
                fadeOpacity += 0.05;
                if (fadeOpacity >= 1) {
                    fadeOpacity = 1;
                    fadeState = 2; // Switch to Fade In

                    // Change State
                    if (nextState === state.getReady) {
                        resetGame();
                    } else {
                        state.current = nextState;
                    }
                }
            } else if (fadeState === 2) { // Fade In
                fadeOpacity -= 0.05;
                if (fadeOpacity <= 0) {
                    fadeOpacity = 0;
                    fadeState = 0;
                }
            }

            ctx.fillStyle = `rgba(0, 0, 0, ${fadeOpacity})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    }
};

function drawScore(val, x, y, small) {
    const s = val.toString();
    let totalWidth = 0;
    const widths = [];

    for (let char of s) {
        let name = small ? `number_score_0${char}` : `font_0${48 + parseInt(char)}`;
        let w = sprites[name].width;
        widths.push(w);
        totalWidth += w;
    }

    let currentX = x;
    if (!small) {
        currentX = x - totalWidth / 2; // Center
    } else {
        currentX = x - totalWidth; // Right align
    }

    for (let i = 0; i < s.length; i++) {
        let char = s[i];
        let name = small ? `number_score_0${char}` : `font_0${48 + parseInt(char)}`;
        let w = widths[i];
        drawSpriteTL(name, currentX, y - sprites[name].height / 2); // y is center
        currentX += w;
    }
}

function resetGame() {
    bird.reset();
    pipes.reset();
    score = 0;
    frames = 0;
    state.current = state.getReady;
}

// Initial Start
function init() {
    bird.reset();
    pipes.reset();
    score = 0;
    frames = 0;
    state.current = state.splash; // Start at Splash
}

function loop() {
    // Update
    bird.update();
    fg.update();
    pipes.update();

    // Draw
    if (state.current === state.splash) {
        ui.draw();
    } else {
        ctx.fillStyle = '#70c5ce'; // Default sky color (day)
        if (bgType === 1) ctx.fillStyle = '#008793'; // Night approx
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        bg.draw();
        pipes.draw();
        fg.draw(); // Ground over pipes
        bird.draw();
        ui.draw();
    }

    frames++;
    requestAnimationFrame(loop);
}

// Init
init();
img.onload = loop;

// DevTools Command
window.resethighscore = function () {
    bestScore = 0;
    localStorage.setItem('flappy_best', 0);
    console.log("High score reset to 0!");
};
