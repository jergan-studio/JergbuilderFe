import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class Player {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.model = null;
        this.speed = 0.12;
        this.keys = { w: false, a: false, s: false, d: false, ' ': false }; 
        
        this.cameraMode = 'third'; 
        this.rotation = new THREE.Euler(0, 0, 0, 'YXZ'); 
        this.mouseSensitivity = 0.002;

        // Physics variables
        this.velocity = new THREE.Vector3();
        this.gravity = -0.015;
        this.jumpForce = 0.35;
        this.isGrounded = false;
        this.playerHeight = 1.2;

        // Build localized proxy fallback geometry immediately to ensure the engine doesn't softlock
        this.createFallbackMesh();
        
        this.initInput();
        this.loadModel();
    }

    loadModel() {
        const loader = new GLTFLoader();
        loader.load('../jergplr.glb', (gltf) => {
            if (this.model) this.scene.remove(this.model);
            
            this.model = gltf.scene;
            
            // Scaled down by half to fit 1x1x1 map block proportions beautifully
            this.model.scale.set(0.5, 0.5, 0.5); 
            this.model.position.set(5, 5, 5);
            
            this.scene.add(this.model);
            console.log("Player model jergplr.glb loaded and downscaled successfully!");
        }, undefined, (error) => {
            console.warn("Could not find jergplr.glb in root directory. Maintaining fallback box configuration.", error);
        });
    }

    createFallbackMesh() {
        const geo = new THREE.BoxGeometry(0.5, this.playerHeight, 0.5);
        const mat = new THREE.MeshLambertMaterial({ color: 0x00a8ff });
        this.model = new THREE.Mesh(geo, mat);
        this.model.position.set(5, 5, 5);
        this.scene.add(this.model);
    }

    // Custom multi-mode skin setter accepts both folder keys or raw web URLs
    setSkin(skinName, customUrl = null) {
        if (!this.model) return;
        let targetColor = 0xffffff;
        let texturePath = null;

        if (skinName === 'red') targetColor = 0xff3333;
        if (skinName === 'blue') targetColor = 0x3333ff;

        // Check text signature parameters to determine asset address location route
        if (skinName !== 'default' && skinName !== 'custom') {
            texturePath = `../assets/PreSkins/${skinName}.png`;
        } else if (skinName === 'custom' && customUrl) {
            texturePath = customUrl;
        }

        this.model.traverse((child) => {
            if (child.isMesh) {
                if (texturePath) {
                    const loader = new THREE.TextureLoader();
                    // CrossOrigin declaration keeps web image loads running cleanly without security warnings
                    loader.setCrossOrigin('anonymous');
                    child.material.map = loader.load(texturePath);
                } else {
                    child.material.map = null;
                }
                child.material.color.setHex(targetColor);
                child.material.needsUpdate = true;
            }
        });
    }

    initInput() {
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (key in this.keys) this.keys[key] = true;
            if (e.key === ' ') this.keys[' '] = true;
            if (e.key === ']') {
                this.cameraMode = this.cameraMode === 'third' ? 'first' : 'third';
            }
        });

        window.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            if (key in this.keys) this.keys[key] = false;
            if (e.key === ' ') this.keys[' '] = false;
        });

        window.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement !== document.getElementById('gameCanvas')) return;
            this.rotation.y -= e.movementX * this.mouseSensitivity;
            this.rotation.x -= e.movementY * this.mouseSensitivity;
            this.rotation.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.rotation.x));
        });

        window.addEventListener('mousedown', (e) => {
            if (document.pointerLockElement !== document.getElementById('gameCanvas')) return;
            if (e.button === 0) { // Left-click handles block creation logic
                this.placeBlock();
            }
        });
    }

    placeBlock() {
        const raycaster = new THREE.Raycaster();
        const centerScreen = new THREE.Vector2(0, 0); 
        raycaster.setFromCamera(centerScreen, this.camera);

        const intersects = raycaster.intersectObjects(this.scene.children);
        // Clean out checks hitting the player's own mesh elements
        const targets = intersects.filter(intersect => intersect.object !== this.model && intersect.object.type === "Mesh");

        if (targets.length > 0) {
            const hit = targets[0];
            if (hit.distance > 8) return; // Build reach limit check

            const targetBlock = hit.object;
            const normal = hit.face.normal; 

            // Offset the target coordinate values by exactly 1 grid index out from the impacted face normal vector
            const newPos = new THREE.Vector3()
                .copy(targetBlock.position)
                .add(normal);

            const chosenHexColor = document.getElementById('blockColor').value;

            const blockGeo = new THREE.BoxGeometry(1, 1, 1);
            const blockMat = new THREE.MeshLambertMaterial({ color: chosenHexColor });
            const newBlock = new THREE.Mesh(blockGeo, blockMat);
            
            newBlock.position.copy(newPos);
            this.scene.add(newBlock);
        }
    }

    checkGroundCollision() {
        const raycaster = new THREE.Raycaster(
            new THREE.Vector3(this.model.position.x, this.model.position.y, this.model.position.z),
            new THREE.Vector3(0, -1, 0)
        );
        const intersects = raycaster.intersectObjects(this.scene.children);
        const targets = intersects.filter(intersect => intersect.object !== this.model);

        if (targets.length > 0) {
            const closestObject = targets[0];
            const groundDistance = closestObject.distance;
            const separationLimit = this.playerHeight / 2;

            if (groundDistance <= separationLimit) {
                this.model.position.y += (separationLimit - groundDistance);
                this.velocity.y = 0;
                this.isGrounded = true;
                return;
            }
        }
        this.isGrounded = false;
    }

    update() {
        if (!this.model) return;

        this.model.rotation.y = this.rotation.y;

        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.model.quaternion).normalize();
        const side = new THREE.Vector3(1, 0, 0).applyQuaternion(this.model.quaternion).normalize();

        if (this.keys.w) this.model.position.addScaledVector(forward, this.speed);
        if (this.keys.s) this.model.position.addScaledVector(forward, -this.speed);
        if (this.keys.d) this.model.position.addScaledVector(side, this.speed);
        if (this.keys.a) this.model.position.addScaledVector(side, -this.speed);

        // Apply gravitational physics forces
        this.velocity.y += this.gravity;
        if (this.keys[' '] && this.isGrounded) {
            this.velocity.y = this.jumpForce;
            this.isGrounded = false;
        }
        this.model.position.y += this.velocity.y;

        this.checkGroundCollision();

        // Void reset boundary wrap point
        if (this.model.position.y < -20) {
            this.model.position.set(5, 10, 5);
            this.velocity.y = 0;
        }

        // Perspective camera tracking loops
        if (this.cameraMode === 'first') {
            this.camera.position.set(this.model.position.x, this.model.position.y + 0.4, this.model.position.z);
            const lookTarget = new THREE.Vector3(0, 0, -1).applyEuler(this.rotation).add(this.camera.position);
            this.camera.lookAt(lookTarget);
            this.model.visible = false;
        } else {
            const offset = new THREE.Vector3(0, 2.5, 4.5).applyEuler(new THREE.Euler(0, this.rotation.y, 0));
            this.camera.position.copy(this.model.position).add(offset);
            this.camera.lookAt(this.model.position.x, this.model.position.y + 0.2, this.model.position.z);
            this.model.visible = true;
        }
    }
}
