import * as THREE from 'three';

export class Player {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        
        // Movement properties
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.speed = 5.0;
        this.jumpForce = 7.0;
        this.gravity = 22.0;
        this.isGrounded = true;

        // Visual player mesh structure (for skins)
        this.playerGroup = new THREE.Group();
        this.createPlayerMesh();
        this.scene.add(this.playerGroup);

        // Position camera inside player boundary coordinates
        this.camera.position.set(0, 2, 0);
        this.playerGroup.position.copy(this.camera.position);

        // Keyboard tracking states (for Desktop fallback)
        this.keys = { w: false, a: false, s: false, d: false };
        this.setupKeyboardListeners();
    }

    createPlayerMesh() {
        // Simple human-shaped box model representation for reflection visibility
        const bodyGeo = new THREE.BoxGeometry(0.6, 1.8, 0.6);
        this.bodyMat = new THREE.MeshLambertMaterial({ color: 0x4f5b93 }); // Match friendly UI primary blue
        this.mesh = new THREE.Mesh(bodyGeo, this.bodyMat);
        
        // Offset mesh origin so it rests perfectly on ground
        this.mesh.position.y = 0.9;
        this.playerGroup.add(this.mesh);
    }

    setupKeyboardListeners() {
        window.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'w') this.keys.w = true;
            if (e.key.toLowerCase() === 'a') this.keys.a = true;
            if (e.key.toLowerCase() === 's') this.keys.s = true;
            if (e.key.toLowerCase() === 'd') this.keys.d = true;
            if (e.key === ' ') this.jump();
        });

        window.addEventListener('keyup', (e) => {
            if (e.key.toLowerCase() === 'w') this.keys.w = false;
            if (e.key.toLowerCase() === 'a') this.keys.a = false;
            if (e.key.toLowerCase() === 's') this.keys.s = false;
            if (e.key.toLowerCase() === 'd') this.keys.d = false;
        });

        // Block placing trigger loop listener
        window.addEventListener('mousedown', (e) => {
            // Right-click or left-click with pointer-lock active can place blocks
            if (document.pointerLockElement === document.getElementById('gameCanvas')) {
                if (e.button === 0 || e.button === 2) {
                    this.placeBlock();
                }
            }
        });
    }

    jump() {
        if (this.isGrounded) {
            this.velocity.y = this.jumpForce;
            this.isGrounded = false;
        }
    }

    placeBlock() {
        // Calculate raycast forward vector matching camera viewing matrix
        const raycaster = new THREE.Raycaster();
        const centerScreen = new THREE.Vector2(0, 0); // Raycast dead center forward
        raycaster.setFromCamera(centerScreen, this.camera);

        const intersects = raycaster.intersectObjects(this.scene.children, true);

        if (intersects.length > 0) {
            const hit = intersects[0];
            // Only act if target hit distance is within building reach (e.g. 6 blocks)
            if (hit.distance < 6) {
                // Read chosen hex value dynamically from HUD palette input picker elements
                const colorPicker = document.getElementById('blockColor');
                const selectedHex = colorPicker ? colorPicker.value : '#557a2b';

                // Determine precise block placement alignment position by reading surface normal face vector
                const newBlockPos = new THREE.Vector3()
                    .copy(hit.point)
                    .add(hit.face.normal.clone().multiplyScalar(0.5))
                    .floor()
                    .addScalar(0.5); // Snap perfectly grid center aligned

                const placedGeo = new THREE.BoxGeometry(1, 1, 1);
                const placedMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(selectedHex) });
                const newMesh = new THREE.Mesh(placedGeo, placedMat);
                
                newMesh.position.copy(newBlockPos);
                this.scene.add(newMesh);
                console.log(`Placed creative element block structural node at grid array: X: ${newBlockPos.x}, Y: ${newBlockPos.y}, Z: ${newBlockPos.z}`);
            }
        }
    }

    setSkin(skinType, customUrl = null) {
        if (!this.bodyMat) return;

        const textureLoader = new THREE.TextureLoader();

        if (skinType === 'default') {
            this.bodyMat.map = null;
            this.bodyMat.color.setHex(0x4f5b93); // Soft theme primary color blue
            this.bodyMat.needsUpdate = true;
        } else if (skinType === 'red') {
            this.bodyMat.map = null;
            this.bodyMat.color.setHex(0xe57373); // Soft pinkish red team skin color
            this.bodyMat.needsUpdate = true;
        } else if (skinType === 'blue') {
            this.bodyMat.map = null;
            this.bodyMat.color.setHex(0x64b5f6); // Soft bright blue sky team skin color
            this.bodyMat.needsUpdate = true;
        } else if (skinType === 'custom' && customUrl) {
            textureLoader.load(customUrl, 
                (texture) => {
                    this.bodyMat.color.setHex(0xffffff); // Clear base filter colors
                    this.bodyMat.map = texture;
                    this.bodyMat.needsUpdate = true;
                }, 
                undefined, 
                (err) => { console.error("Could not load external network domain image skin asset:", err); }
            );
        }
    }

    update(delta) {
        if (!delta) delta = 0.016; // Safety backup interval frames standard speed bounds

        // Apply constant directional gravitational acceleration parameters
        this.velocity.y -= this.gravity * delta;
        this.camera.position.y += this.velocity.y * delta;

        // Simulated flat world basic solid floor checks bounds configuration
        if (this.camera.position.y <= 2.0) {
            this.velocity.y = 0;
            this.camera.position.y = 2.0;
            this.isGrounded = true;
        }

        // Apply keyboard desktop movement tracking variables if active
        this.direction.z = Number(this.keys.w) - Number(this.keys.s);
        this.direction.x = Number(this.keys.d) - Number(this.keys.a);
        this.direction.normalize();

        // Calculate horizontal plane vectors ignoring height profiles pitch indexes
        const camForward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
        camForward.y = 0; camRight.y = 0;
        camForward.normalize(); camRight.normalize();

        if (this.keys.w || this.keys.s) {
            this.camera.position.addScaledVector(camForward, this.direction.z * this.speed * delta);
        }
        if (this.keys.a || this.keys.d) {
            this.camera.position.addScaledVector(camRight, this.direction.x * this.speed * delta);
        }

        // Keep player body avatar geometry locked underneath player eye target point tracking locations
        this.playerGroup.position.copy(this.camera.position);
        this.playerGroup.position.y -= 1.1; // Offset avatar down below vision line
    }
}
