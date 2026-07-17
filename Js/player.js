import * as THREE from 'three';

export class Player {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        
        // Use a hidden Euler object to track precise absolute rotation angles
        this.pitchEuler = new THREE.Euler(0, 0, 0, 'YXZ');

        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.speed = 6.0;
        this.jumpForce = 7.5;
        this.gravity = 22.0;
        this.isGrounded = true;

        this.playerGroup = new THREE.Group();
        this.createPlayerMesh();
        this.scene.add(this.playerGroup);

        this.camera.position.set(0, 2, 0);
        this.camera.rotation.set(0, 0, 0);
        this.pitchEuler.setFromQuaternion(this.camera.quaternion);
        
        this.playerGroup.position.copy(this.camera.position);

        this.keys = { w: false, a: false, s: false, d: false };
        this.setupKeyboardListeners();
        this.setupMouseLook();
    }

    createPlayerMesh() {
        const bodyGeo = new THREE.BoxGeometry(0.6, 1.8, 0.6);
        this.bodyMat = new THREE.MeshLambertMaterial({ color: 0x4f5b93 }); 
        this.mesh = new THREE.Mesh(bodyGeo, this.bodyMat);
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
    }

    setupMouseLook() {
        window.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement === document.getElementById('gameCanvas')) {
                this.pitchEuler.y -= e.movementX * 0.0025;
                this.pitchEuler.x -= e.movementY * 0.0025;
                
                // Absolute structural clamping bounds for neck looking rotation
                this.pitchEuler.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.pitchEuler.x));
                this.camera.quaternion.setFromEuler(this.pitchEuler);
            }
        });

        window.addEventListener('mousedown', (e) => {
            if (document.pointerLockElement === document.getElementById('gameCanvas')) {
                if (e.button === 0 || e.button === 2) {
                    this.placeBlock();
                }
            }
        });
    }

    handleTouchLook(movementX, movementY) {
        // Safe tracking calculations mapping drag scales to Euler angles
        this.pitchEuler.y -= movementX * 0.0045;
        this.pitchEuler.x -= movementY * 0.0045;
        
        this.pitchEuler.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.pitchEuler.x));
        this.camera.quaternion.setFromEuler(this.pitchEuler);
    }

    jump() {
        if (this.isGrounded) {
            this.velocity.y = this.jumpForce;
            this.isGrounded = false;
        }
    }

    placeBlock() {
        const raycaster = new THREE.Raycaster();
        const centerScreen = new THREE.Vector2(0, 0); 
        raycaster.setFromCamera(centerScreen, this.camera);

        const intersects = raycaster.intersectObjects(this.scene.children, true);

        if (intersects.length > 0) {
            const hit = intersects[0];
            if (hit.distance < 6) {
                const colorPicker = document.getElementById('blockColor');
                const selectedHex = colorPicker ? colorPicker.value : '#557a2b';

                const newBlockPos = new THREE.Vector3()
                    .copy(hit.point)
                    .add(hit.face.normal.clone().multiplyScalar(0.5))
                    .floor()
                    .addScalar(0.5); 

                const placedGeo = new THREE.BoxGeometry(1, 1, 1);
                const placedMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(selectedHex) });
                const newMesh = new THREE.Mesh(placedGeo, placedMat);
                
                newMesh.position.copy(newBlockPos);
                this.scene.add(newMesh);
            }
        }
    }

    setSkin(skinType, customUrl = null) {
        if (!this.bodyMat) return;
        const textureLoader = new THREE.TextureLoader();

        if (skinType === 'default') {
            this.bodyMat.map = null;
            this.bodyMat.color.setHex(0x4f5b93); 
            this.bodyMat.needsUpdate = true;
        } else if (skinType === 'red') {
            this.bodyMat.map = null;
            this.bodyMat.color.setHex(0xe57373); 
            this.bodyMat.needsUpdate = true;
        } else if (skinType === 'blue') {
            this.bodyMat.map = null;
            this.bodyMat.color.setHex(0x64b5f6); 
            this.bodyMat.needsUpdate = true;
        } else if (skinType === 'custom' && customUrl) {
            textureLoader.load(customUrl, (texture) => {
                this.bodyMat.color.setHex(0xffffff); 
                this.bodyMat.map = texture;
                this.bodyMat.needsUpdate = true;
            });
        }
    }

    update(delta, mobileMoveVector = null) {
        if (!delta) delta = 0.016;

        this.velocity.y -= this.gravity * delta;
        this.camera.position.y += this.velocity.y * delta;

        if (this.camera.position.y <= 2.0) {
            this.velocity.y = 0;
            this.camera.position.y = 2.0;
            this.isGrounded = true;
        }

        // Horizontal planar look direction matrices setup
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
        forward.y = 0; right.y = 0;
        forward.normalize(); right.normalize();

        if (mobileMoveVector) {
            // Process Mobile D-Pad vectors smoothly relative to camera view matrices
            this.camera.position.addScaledVector(right, mobileMoveVector.x * this.speed * delta);
            this.camera.position.addScaledVector(forward, -mobileMoveVector.z * this.speed * delta);
        } else {
            // Process Desktop fallbacks standard WASD key calculations
            this.direction.z = Number(this.keys.w) - Number(this.keys.s);
            this.direction.x = Number(this.keys.d) - Number(this.keys.a);
            this.direction.normalize();

            if (this.keys.w || this.keys.s) {
                this.camera.position.addScaledVector(forward, this.direction.z * this.speed * delta);
            }
            if (this.keys.a || this.keys.d) {
                this.camera.position.addScaledVector(right, this.direction.x * this.speed * delta);
            }
        }

        this.playerGroup.position.copy(this.camera.position);
        this.playerGroup.position.y -= 1.1; 
    }
}
