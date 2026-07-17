import * as THREE from 'three';

let currentWorldMesh = null;

function cyrb128(str) {
    let h1 = 1779033703, h2 = 3024738484, h3 = 3362625948, h4 = 502494843;
    for (let i = 0, k; i < str.length; i++) {
        k = str.charCodeAt(i);
        h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
        h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
        h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
        h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    return [(h1^h2^h3^h4)>>>0, (h2^h1)>>>0, (h3^h1)>>>0, (h4^h1)>>>0];
}

function pseudoRandom(seedNum) {
    let a = seedNum ^ 0xDEADBEEF;
    a = (a ^ (a >>> 16)) * 0x21f0aaad;
    a = (a ^ (a >>> 15)) * 0x735a2d97;
    a = a ^ (a >>> 15);
    return (a >>> 0) / 4294967296;
}

export function generateMap(scene, worldType, rawSeed = "") {
    if (currentWorldMesh) {
        scene.remove(currentWorldMesh);
        if (currentWorldMesh.geometry) currentWorldMesh.geometry.dispose();
        if (currentWorldMesh.material) currentWorldMesh.material.dispose();
        currentWorldMesh = null;
    }

    let seedValue = rawSeed.trim();
    if (seedValue === "") {
        seedValue = Math.random().toString();
    }
    
    const seedHashParts = cyrb128(seedValue);
    const deterministicOffset = pseudoRandom(seedHashParts[0]) * 100;

    const gridSizeX = 32;
    const gridSizeZ = 32;
    const blocksArray = [];

    for (let x = 0; x < gridSizeX; x++) {
        for (let z = 0; z < gridSizeZ; z++) {
            let height = 1; 

            if (worldType === 'hills') {
                height = Math.floor(
                    Math.sin((x + deterministicOffset) * 0.15) * 3 + 
                    Math.cos((z + deterministicOffset) * 0.15) * 3 + 5
                );
                if (height < 1) height = 1;
            }

            for (let y = 0; y < height; y++) {
                let colorHex = 0x557a2b; 

                if (worldType === 'hills') {
                    if (y === height - 1 && y > 5) {
                        colorHex = 0xffffff; 
                    } else if (y < height - 1 && y > 2) {
                        colorHex = 0x8b5a2b; 
                    } else if (y <= 2) {
                        colorHex = 0x708090; 
                    }
                } else {
                    if (y < height - 1) {
                        colorHex = 0x8b5a2b; 
                    }
                }

                blocksArray.push({
                    x: x - gridSizeX / 2, 
                    y: y,
                    z: z - gridSizeZ / 2,
                    color: new THREE.Color(colorHex)
                });
            }
        }
    }

    const blockGeometry = new THREE.BoxGeometry(1, 1, 1);
    const blockMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });

    const instancedMesh = new THREE.InstancedMesh(
        blockGeometry,
        blockMaterial,
        blocksArray.length
    );

    const tempObject = new THREE.Object3D();

    blocksArray.forEach((block, index) => {
        tempObject.position.set(block.x, block.y, block.z);
        tempObject.updateMatrix();
        
        instancedMesh.setMatrixAt(index, tempObject.matrix);
        instancedMesh.setColorAt(index, block.color);
    });

    instancedMesh.instanceMatrix.needsUpdate = true;
    if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;

    instancedMesh.castShadow = true;
    instancedMesh.receiveShadow = true;

    scene.add(instancedMesh);
    currentWorldMesh = instancedMesh;
    
    console.log(`Generated "${worldType}" world. Seed: "${seedValue}".`);
}
