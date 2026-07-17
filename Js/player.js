import * as THREE from 'three';

let generateMap = null;
let Player = null;

// Safe dynamic module loading system
async function safelyLoadModules() {
    try {
        const mapMod = await import('../Map/mapGenerator.js');
        generateMap = mapMod.generateMap;
    } catch (e) { console.error("Could not load Map/mapGenerator.js", e); }

    try {
        const playerMod = await import('./player.js');
        Player = playerMod.Player;
    } catch (e) { console.error("Could not load Js/player.js", e); }
}

let scene, camera, renderer, player;
let gameRunning = false;
let currentProfile = 'desktop'; 
const canvas = document.getElementById('gameCanvas');
const clock = new THREE.Clock();

// Mobile Input Tracker Loops
let touchLookActive = false;
let prevTouchX = 0, prevTouchY = 0;
let joystickActive = false;
let joyStartX = 0, joyStartY = 0;
let mobileMoveVector = { x: 0, z: 0 };

async function init() {
    await safelyLoadModules();

    // Smart profile fallback check
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
        currentProfile = 'mobile';
    }

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xa5d6a7); // Soft friendly edition background green

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    if (canvas) {
        renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    if (Player) {
        try { player = new Player(scene, camera); } catch(e) { console.error(e); }
    }

    setupMenuEvents();
    setupPointerLock();
    setupMobileTouchSystem();

    window.addEventListener('resize', onWindowResize);
    animate();
}

function setupPointerLock() {
    const escMenu = document.getElementById('escMenu');
    const hud = document.getElementById('hud');
    if (!canvas) return;

    canvas.addEventListener('click', () => {
        if (gameRunning && currentProfile === 'desktop') {
            canvas.requestPointerLock();
        }
    });

    document.addEventListener('pointerlockchange', () => {
        if (currentProfile !== 'desktop') return;
        
        if (document.pointerLockElement === canvas) {
            if (escMenu) { escMenu.classList.add('hidden'); escMenu.style.display = 'none'; }
            if (hud) hud.classList.remove('hidden');
            gameRunning = true;
        } else {
            if (gameRunning) {
                if (escMenu) { escMenu.classList.remove('hidden'); escMenu.style.display = 'flex'; }
                if (hud) hud.classList.add('hidden');
            }
        }
    });
}

function setupMenuEvents() {
    const mainMenu = document.getElementById('mainMenu');
    const worldsMenu = document.getElementById('worldsMenu');
    const skinsMenu = document.getElementById('skinsMenu');
    const settingsMenu = document.getElementById('settingsMenu');
    const escMenu = document.getElementById('escMenu');
    const hud = document.getElementById('hud');
    const mobileControls = document.getElementById('mobileTouchControls');
    const seedInput = document.getElementById('worldSeed');
    const hudGamemodeDisplay = document.getElementById('hudGamemodeDisplay');

    let selectedGamemode = 'creative';

    const safeBindClick = (id, callback) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', callback);
    };

    // Navigation Switches
    safeBindClick('btnWorlds', () => {
        if (mainMenu) mainMenu.classList.add('hidden');
        if (worldsMenu) { worldsMenu.classList.remove('hidden'); worldsMenu.style.setProperty('display', 'flex', 'important'); }
    });

    safeBindClick('btnSkins', () => {
        if (mainMenu) mainMenu.classList.add('hidden');
        if (skinsMenu) { skinsMenu.classList.remove('hidden'); skinsMenu.style.setProperty('display', 'flex', 'important'); }
    });

    safeBindClick('btnSettingsMenu', () => {
        if (mainMenu) mainMenu.classList.add('hidden');
        if (settingsMenu) { settingsMenu.classList.remove('hidden'); settingsMenu.style.setProperty('display', 'flex', 'important'); }
        updateSettingsVisuals();
    });

    const btnDeskProf = document.getElementById('toggleDesktopProfile');
    const btnMobProf = document.getElementById('toggleMobileProfile');

    function updateSettingsVisuals() {
        if (!btnDeskProf || !btnMobProf) return;
        if (currentProfile === 'desktop') {
            btnDeskProf.style.backgroundColor = '#81c784'; btnDeskProf.style.opacity = '1';
            btnMobProf.style.backgroundColor = '#333'; btnMobProf.style.opacity = '0.6';
        } else {
            btnMobProf.style.backgroundColor = '#81c784'; btnMobProf.style.opacity = '1';
            btnDeskProf.style.backgroundColor = '#333'; btnDeskProf.style.opacity = '0.6';
        }
    }

    if (btnDeskProf && btnMobProf) {
        btnDeskProf.addEventListener('click', () => { currentProfile = 'desktop'; updateSettingsVisuals(); });
        btnMobProf.addEventListener('click', () => { currentProfile = 'mobile'; updateSettingsVisuals(); });
    }

    document.querySelectorAll('.btnBack').forEach(btn => {
        btn.addEventListener('click', () => {
            if (worldsMenu) { worldsMenu.classList.add('hidden'); worldsMenu.style.display = 'none'; }
            if (skinsMenu) { skinsMenu.classList.add('hidden'); skinsMenu.style.display = 'none'; }
            if (settingsMenu) { settingsMenu.classList.add('hidden'); settingsMenu.style.display = 'none'; }
            if (mainMenu) mainMenu.classList.remove('hidden');
        });
    });

    const btnCreative = document.getElementById('modeCreative');
    const btnSurvival = document.getElementById('modeSurvival');

    if (btnCreative && btnSurvival) {
        btnCreative.addEventListener('click', () => {
            selectedGamemode = 'creative';
            btnCreative.style.backgroundColor = "#81c784"; btnCreative.style.color = "#1c1d31"; btnCreative.style.opacity = "1";
            btnSurvival.style.backgroundColor = "#333"; btnSurvival.style.color = "white"; btnSurvival.style.opacity = "0.5";
        });

        btnSurvival.addEventListener('click', () => {
            selectedGamemode = 'survival';
            btnSurvival.style.backgroundColor = "#e57373"; btnSurvival.style.color = "white"; btnSurvival.style.opacity = "1";
            btnCreative.style.backgroundColor = "#333"; btnCreative.style.color = "white"; btnCreative.style.opacity = "0.5";
        });
    }

    document.querySelectorAll('.world-select').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const worldSlot = e.currentTarget.getAttribute('data-world');
            if (generateMap) {
                try { generateMap(scene, 'flat', worldSlot); } catch (err) { console.error(err); }
            }
            if (hudGamemodeDisplay) {
                hudGamemodeDisplay.innerText = "CREATIVE MODE";
                hudGamemodeDisplay.style.backgroundColor = '#81c784';
            }
            launchGame();
        });
    });

    safeBindClick('btnCreateWorld', () => {
        const rawSeedValue = seedInput ? seedInput.value : "";
        if (generateMap) {
            try { generateMap(scene, 'hills', rawSeedValue); } catch (err) { console.error(err); }
        }
        if (hudGamemodeDisplay) {
            hudGamemodeDisplay.innerText = `${selectedGamemode} mode`;
            hudGamemodeDisplay.style.backgroundColor = selectedGamemode === 'survival' ? '#e57373' : '#81c784';
        }
        launchGame();
    });

    function launchGame() {
        if (worldsMenu) { worldsMenu.classList.add('hidden'); worldsMenu.style.display = 'none'; }
        if (hud) hud.classList.remove('hidden');
        
        const dInstr = document.getElementById('desktopInstructions');
        const mInstr = document.getElementById('mobileInstructions');

        if (currentProfile === 'mobile') {
            if (mobileControls) {
                mobileControls.classList.remove('hidden');
                mobileControls.style.setProperty('display', 'block', 'important'); 
            }
            if (mInstr) mInstr.classList.remove('hidden');
            if (dInstr) dInstr.classList.add('hidden');
        } else {
            if (mobileControls) {
                mobileControls.classList.add('hidden');
                mobileControls.style.display = 'none';
            }
            if (dInstr) dInstr.classList.remove('hidden');
            if (mInstr) mInstr.classList.add('hidden');
        }

        gameRunning = true; 
        if (currentProfile === 'desktop' && canvas) canvas.requestPointerLock(); 
    }

    safeBindClick('btnMobilePause', () => {
        gameRunning = false;
        if (mobileControls) {
            mobileControls.classList.add('hidden');
            mobileControls.style.setProperty('display', 'none', 'important');
        }
        if (hud) hud.classList.add('hidden');
        if (escMenu) { escMenu.classList.remove('hidden'); escMenu.style.display = 'flex'; }
    });

    safeBindClick('btnResume', () => {
        if (escMenu) { escMenu.classList.add('hidden'); escMenu.style.display = 'none'; }
        if (hud) hud.classList.remove('hidden');
        if (currentProfile === 'mobile') {
            if (mobileControls) {
                mobileControls.classList.remove('hidden');
                mobileControls.style.setProperty('display', 'block', 'important');
            }
        } else {
            if (canvas) canvas.requestPointerLock();
        }
        gameRunning = true;
    });

    safeBindClick('btnQuit', () => {
        gameRunning = false;
        if (document.pointerLockElement === canvas) document.exitPointerLock();
        if (escMenu) { escMenu.classList.add('hidden'); escMenu.style.display = 'none'; }
        if (mobileControls) { 
            mobileControls.classList.add('hidden'); 
            mobileControls.style.setProperty('display', 'none', 'important'); 
        }
        if (hud) hud.classList.add('hidden');
        if (mainMenu) mainMenu.classList.remove('hidden');
    });
}

function setupMobileTouchSystem() {
    const joyContainer = document.getElementById('joystickContainer');
    const joyKnob = document.getElementById('joystickKnob');

    if (!joyContainer || !joyKnob) return;

    joyContainer.addEventListener('touchstart', (e) => {
        joystickActive = true;
        const touch = e.touches[0];
        joyStartX = touch.clientX;
        joyStartY = touch.clientY;
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
        if (!gameRunning || currentProfile !== 'mobile') return;

        let activeJoystickTouch = null;
        if (joystickActive) {
            for (let i = 0; i < e.touches.length; i++) {
                let t = e.touches[i];
                if (t.target === joyContainer || joyContainer.contains(t.target)) {
                    activeJoystickTouch = t;
                    break;
                }
            }
        }

        if (activeJoystickTouch) {
            let deltaX = activeJoystickTouch.clientX - joyStartX;
            let deltaY = activeJoystickTouch.clientY - joyStartY;
            let distance = Math.min(Math.sqrt(deltaX*deltaX + deltaY*deltaY), 40);
            let angle = Math.atan2(deltaY, deltaX);

            let moveX = Math.cos(angle) * distance;
            let moveY = Math.sin(angle) * distance;

            joyKnob.style.transform = `translate(${moveX}px, ${moveY}px)`;
            mobileMoveVector.x = moveX / 40;
            mobileMoveVector.z = moveY / 40;
        } else {
            // Screen swipe looking
            const touch = e.touches[0];
            if (!touchLookActive) {
                touchLookActive = true;
                prevTouchX = touch.clientX;
                prevTouchY = touch.clientY;
            } else {
                let movementX = touch.clientX - prevTouchX;
                let movementY = touch.clientY - prevTouchY;

                if (player && typeof player.handleTouchLook === 'function') {
                    player.handleTouchLook(movementX, movementY);
                }

                prevTouchX = touch.clientX;
                prevTouchY = touch.clientY;
            }
        }
    }, { passive: false });

    const resetJoystick = () => {
        joystickActive = false;
        touchLookActive = false;
        mobileMoveVector = { x: 0, z: 0 };
        joyKnob.style.transform = 'translate(0px, 0px)';
    };

    joyContainer.addEventListener('touchend', resetJoystick);
    joyContainer.addEventListener('touchcancel', resetJoystick);
    window.addEventListener('touchend', () => { touchLookActive = false; });

    const btnMobJump = document.getElementById('btnMobileJump');
    const btnMobPlace = document.getElementById('btnMobilePlace');

    if (btnMobJump) {
        btnMobJump.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (gameRunning && player && typeof player.jump === 'function') player.jump();
        });
    }

    if (btnMobPlace) {
        btnMobPlace.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (gameRunning && player && typeof player.placeBlock === 'function') player.placeBlock();
        });
    }
}

function onWindowResize() {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const elapsedTime = clock.getElapsedTime();

    if (gameRunning && player && typeof player.update === 'function') {
        player.update(delta, currentProfile === 'mobile' ? mobileMoveVector : null);
    }
    
    if (scene) {
        scene.traverse((child) => {
            if (child.isMesh && child.material && child.material.uniforms) {
                if (child.material.uniforms.uTime) child.material.uniforms.uTime.value = elapsedTime;
            }
        });
    }
    
    if (renderer && scene && camera) renderer.render(scene, camera);
}

init();
