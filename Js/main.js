import * as THREE from 'three';

let generateMap = null;
let Player = null;

// Safe loading wrapper prevents missing file exceptions from locking menus
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
const canvas = document.getElementById('gameCanvas');
const clock = new THREE.Clock();

async function init() {
    await safelyLoadModules();

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); 

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    if (canvas) {
        renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(12, 24, 8);
    scene.add(dirLight);

    if (Player) {
        try { player = new Player(scene, camera); } catch(e) { console.error(e); }
    }

    setupMenuEvents();
    setupPointerLock();

    window.addEventListener('resize', onWindowResize);
    animate();
}

function setupPointerLock() {
    const escMenu = document.getElementById('escMenu');
    const hud = document.getElementById('hud');
    if (!canvas) return;

    canvas.addEventListener('click', () => {
        if (gameRunning) canvas.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
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
    const escMenu = document.getElementById('escMenu');
    const hud = document.getElementById('hud');
    const seedInput = document.getElementById('worldSeed');
    const hudGamemodeDisplay = document.getElementById('hudGamemodeDisplay');

    let selectedGamemode = 'creative';

    const safeBindClick = (id, callback) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', callback);
    };

    // Main Menu Switching Logic
    safeBindClick('btnWorlds', () => {
        if (mainMenu) mainMenu.classList.add('hidden');
        if (worldsMenu) {
            worldsMenu.classList.remove('hidden');
            worldsMenu.style.setProperty('display', 'flex', 'important'); 
        }
    });

    safeBindClick('btnSkins', () => {
        if (mainMenu) mainMenu.classList.add('hidden');
        if (skinsMenu) {
            skinsMenu.classList.remove('hidden');
            skinsMenu.style.setProperty('display', 'flex', 'important');
        }
    });

    // Back Buttons
    document.querySelectorAll('.btnBack').forEach(btn => {
        btn.addEventListener('click', () => {
            if (worldsMenu) { worldsMenu.classList.add('hidden'); worldsMenu.style.display = 'none'; }
            if (skinsMenu) { skinsMenu.classList.add('hidden'); skinsMenu.style.display = 'none'; }
            if (mainMenu) mainMenu.classList.remove('hidden');
        });
    });

    // Mode Buttons
    const btnCreative = document.getElementById('modeCreative');
    const btnSurvival = document.getElementById('modeSurvival');

    if (btnCreative && btnSurvival) {
        btnCreative.addEventListener('click', () => {
            selectedGamemode = 'creative';
            btnCreative.style.backgroundColor = "#4caf50";
            btnCreative.style.color = "black";
            btnCreative.style.opacity = "1";
            btnSurvival.style.backgroundColor = "#333";
            btnSurvival.style.color = "white";
            btnSurvival.style.opacity = "0.5";
        });

        btnSurvival.addEventListener('click', () => {
            selectedGamemode = 'survival';
            btnSurvival.style.backgroundColor = "#f44336";
            btnSurvival.style.color = "white";
            btnSurvival.style.opacity = "1";
            btnCreative.style.backgroundColor = "#333";
            btnCreative.style.color = "white";
            btnCreative.style.opacity = "0.5";
        });
    }

    // World Selection Launchers
    document.querySelectorAll('.world-select').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const worldSlot = e.currentTarget.getAttribute('data-world');
            if (generateMap) {
                try { generateMap(scene, 'flat', worldSlot); } catch (err) { console.error(err); }
            }
            if (hudGamemodeDisplay) {
                hudGamemodeDisplay.innerText = "CREATIVE MODE";
                hudGamemodeDisplay.style.backgroundColor = '#4caf50';
            }
            launchGame();
        });
    });

    // Custom Hilly seed generator builder button
    safeBindClick('btnCreateWorld', () => {
        const rawSeedValue = seedInput ? seedInput.value : "";
        if (generateMap) {
            try { generateMap(scene, 'hills', rawSeedValue); } catch (err) { console.error(err); }
        }
        if (hudGamemodeDisplay) {
            hudGamemodeDisplay.innerText = `${selectedGamemode} mode`;
            hudGamemodeDisplay.style.backgroundColor = selectedGamemode === 'survival' ? '#f44336' : '#4caf50';
        }
        launchGame();
    });

    function launchGame() {
        if (worldsMenu) { worldsMenu.classList.add('hidden'); worldsMenu.style.display = 'none'; }
        if (hud) hud.classList.remove('hidden');
        gameRunning = true; 
        if (canvas) canvas.requestPointerLock(); 
    }

    // Skins Configuration listeners
    document.querySelectorAll('.skin-select').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const skinName = e.currentTarget.getAttribute('data-skin');
            if (player && typeof player.setSkin === 'function') {
                player.setSkin(skinName);
            }
            if (skinsMenu) { skinsMenu.classList.add('hidden'); skinsMenu.style.display = 'none'; }
            if (mainMenu) mainMenu.classList.remove('hidden');
        });
    });

    safeBindClick('btnCustomSkin', () => {
        const url = prompt("Enter skin URL:", "https://i.imgur.com/yourImage.png");
        if (url && player && typeof player.setSkin === 'function') {
            player.setSkin('custom', url);
            if (skinsMenu) { skinsMenu.classList.add('hidden'); skinsMenu.style.display = 'none'; }
            if (mainMenu) mainMenu.classList.remove('hidden');
        }
    });

    safeBindClick('btnResume', () => {
        if (canvas) canvas.requestPointerLock();
    });

    safeBindClick('btnQuit', () => {
        gameRunning = false;
        if (document.pointerLockElement === canvas) document.exitPointerLock();
        if (escMenu) { escMenu.classList.add('hidden'); escMenu.style.display = 'none'; }
        if (hud) hud.classList.add('hidden');
        if (mainMenu) mainMenu.classList.remove('hidden');
    });
}

function onWindowResize() {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();

    if (gameRunning && player && typeof player.update === 'function') {
        player.update();
    }
    
    if (scene) {
        scene.traverse((child) => {
            if (child.isMesh && child.material && child.material.uniforms) {
                if (child.material.uniforms.uTime) child.material.uniforms.uTime.value = elapsedTime;
                if (child.material.uniforms.uCameraPosition && camera) child.material.uniforms.uCameraPosition.value.copy(camera.position);
            }
        });
    }
    
    if (renderer && scene && camera) renderer.render(scene, camera);
}

init();
