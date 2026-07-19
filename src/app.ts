import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { SVGLoader } from "three/examples/jsm/Addons.js";
import * as TWEEN from "@tweenjs/tween.js";


class ThreeJSContainer {
    private scene!: THREE.Scene;
    private light!: THREE.Light;
    private clouds: THREE.Points[] = [];

    constructor() {

    }

    // 画面部分の作成(表示する枠ごとに)*
    public createRendererDOM = (width: number, height: number, cameraPos: THREE.Vector3) => {
        const renderer = new THREE.WebGLRenderer();
        renderer.setSize(width, height);
        renderer.setClearColor(new THREE.Color(0x000000));
        renderer.shadowMap.enabled = true; //シャドウマップを有効にする

        //カメラの設定
        const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        camera.position.copy(cameraPos);
        camera.lookAt(new THREE.Vector3(0, 0, 0));

        const orbitControls = new OrbitControls(camera, renderer.domElement);

        this.createScene();
        // 毎フレームのupdateを呼んで，render
        // reqestAnimationFrame により次フレームを呼ぶ
        const render: FrameRequestCallback = (_time) => {
            orbitControls.update();

            renderer.render(this.scene, camera);
            requestAnimationFrame(render);
        }
        requestAnimationFrame(render);

        renderer.domElement.style.cssFloat = "left";
        renderer.domElement.style.margin = "10px";
        return renderer.domElement;
    }

    // シーンの作成(全体で1回)
    private createScene = async () => {
        this.scene = new THREE.Scene();
        
        //ライトの設定
        this.light = new THREE.DirectionalLight(0xffffff);
        const lvec = new THREE.Vector3(1, 1, 1).normalize();
        this.light.position.set(lvec.x, lvec.y, lvec.z);
        this.scene.add(this.light);

        const svgGeometries: THREE.ExtrudeGeometry[][] = []; // SVGファイルから作成したgeometryをまとめる

        const generateSVGGeometry = async (img: string, scale: number, x: number, y: number, z: number) => {
            const svgGeometry: THREE.ExtrudeGeometry[] = [];
            const loader = new SVGLoader();

            try {
                const data = await loader.loadAsync(`./${img}`); // ファイル読み込みを終えてから進むようにする

                // 読み込んだファイルのdataのパスそれぞれに対し処理
                data.paths.forEach((path) => {
                    const shapes = SVGLoader.createShapes(path);
                    shapes.forEach((shape) => {
                        const geometry = new THREE.ExtrudeGeometry(shape, {
                            depth: 10,
                            bevelEnabled: true,
                            bevelThickness: 1,
                            bevelSize: 0.5,
                            bevelSegments: 3
                        });

                        // geometryの位置を調整
                        geometry.rotateY(Math.PI);
                        geometry.rotateZ(Math.PI);
                        geometry.scale(scale, scale, scale);
                        geometry.translate(x, y, z);
                        svgGeometry.push(geometry);
                    });
                });
                return svgGeometry; // 実質resolve

            } catch(error) { //ファイルが読み込めなかった場合
                console.error("SVG読み込みエラー:", error);
                throw error; // 実質reject
            }
        }

        svgGeometries.push(await generateSVGGeometry('ERROR.svg', 0.05, -5.5, 1.8, 0));
        svgGeometries.push(await generateSVGGeometry('SUCCESS.svg', 0.05, -7.7, 1.8, 0));

        // テクスチャの作成
        const generateSprite = (colorOption: number) =>{
            const canvas = document.createElement('canvas');
            canvas.width = 16;
            canvas.height = 16;

            const context = canvas.getContext('2d')!;
            const gradient = context.createRadialGradient(canvas.width / 2, canvas.height / 2, 0, canvas.width / 2, canvas.height / 2, canvas.width / 2);

            // colorOptionの値によって生成するテクスチャを切り替え
            if(colorOption == 0) {
                gradient.addColorStop(0, 'rgba(255,255,255,1)');
                gradient.addColorStop(0.2, 'rgba(255,0,0,1)');
                gradient.addColorStop(0.4, 'rgba(64, 0,0,1)');
                gradient.addColorStop(1, 'rgba(0,0,0,1)');
            } else if(colorOption == 1) {
                gradient.addColorStop(0, 'rgba(255,255,255,1)');
                gradient.addColorStop(0.2, 'rgba(0,255,0,1)');
                gradient.addColorStop(0.4, 'rgba(0, 64,0,1)');
                gradient.addColorStop(1, 'rgba(0,0,0,1)');
            }

            context.fillStyle = gradient;
            context.fillRect(0, 0, canvas.width, canvas.height);
            
            const texture = new THREE.Texture(canvas);
            texture.needsUpdate = true;
            return texture;
        }
        
        const particleNum = 10000; // パーティクル数

        const createParticles = (cloudIndex: number, svgGeomIndex: number, colorOption: number) => {
        //ジオメトリの作成
            const geometry = new THREE.BufferGeometry();
        //マテリアルの作成
            let material = new THREE.Material();
            // svgGeometriesのどのgeometryを対象とするかによってmaterialの仕様（今回はopacity）を変更
            // ERROR.svg
            if(svgGeomIndex == 0) {
                material = new THREE.PointsMaterial({ size: 0.05, map: generateSprite(colorOption), blending: THREE.AdditiveBlending, color: 0xFFFFFF, depthWrite: false, transparent: true, opacity: 0.8 });
            // SUCCESS.svg
            } else if(svgGeomIndex == 1) {
                material = new THREE.PointsMaterial({ size: 0.05, map: generateSprite(colorOption), blending: THREE.AdditiveBlending, color: 0xFFFFFF, depthWrite: false, transparent: true, opacity: 0 });
            }
        //particleの作成
            const particlePositions = new Float32Array(particleNum * 3);
            let   particleIndex = 0;

            // svgのどのgeometryを対象とするかによって対応させるパーティクルの初期位置を変更
            // ERROR.svg
            if(svgGeomIndex == 0) {
                for(let i = 0; i < particleNum; i++) {
                    particlePositions[particleIndex++] = Math.random() * 20 - 10; // x座標
                    particlePositions[particleIndex++] = Math.random() * 20 - 10; // y座標
                    particlePositions[particleIndex++] = Math.random() * 20 - 10; // z座標
                }
            // SUCCESS.svg SUCCESSの文字の各頂点位置にパーティクルをマッピングする
            } else if(svgGeomIndex == 1) {
                const svgGeometry: THREE.ExtrudeGeometry[] = svgGeometries[svgGeomIndex];
                const particleNumOfChar = particleNum / svgGeometry.length; // 1文字あたりにあてるパーティクル数

                for(let i = 0; i < svgGeometry.length; i++) {
                    const charGeometry = svgGeometry[i] as THREE.BufferGeometry; // svgGeometryの内の1つ（今回は1文字）のgeometry
                    const charPositions = charGeometry.getAttribute("position");
                    for (let j = i * particleNumOfChar; j < (i + 1) * particleNumOfChar; j++) {
                        let charIndex = Math.floor(Math.random() * charPositions.count); // なるべく少ないパーティクル数でまんべんなくパーティクルを配置させるため、charPositions内ののランダムな位置を抽出
                        // アニメーションの演出のため頂点位置から少しずらして配置
                        particlePositions[particleIndex++] = charPositions.getX(charIndex) + Math.random() * 1 - 0.5; // x座標
                        particlePositions[particleIndex++] = charPositions.getY(charIndex) + Math.random() * 1 - 0.5; // y座標
                        particlePositions[particleIndex++] = charPositions.getZ(charIndex) + Math.random() * 1 - 0.5; // z座標
                    }
                }
            }
            geometry.setAttribute('position', new THREE.BufferAttribute(particlePositions,3));
        //THREE.Pointsの作成
            this.clouds.push(new THREE.Points(geometry, material));
        //シーンへの追加
            this.scene.add(this.clouds[cloudIndex]);
        }

        createParticles(0, 0, 0);
        createParticles(1, 1, 1);

        // パーティクルの位置へのアクセサ
        const particlePositions: (THREE.BufferAttribute | THREE.InterleavedBufferAttribute)[] = [];
        for(let i = 0; i < this.clouds.length; i++) {
            const particleGeometry = this.clouds[i].geometry as THREE.BufferGeometry;
            particlePositions.push(particleGeometry.getAttribute('position'));
        }

        const group = new TWEEN.Group();
        const generateTweenAnimation = () => {
            const particleMaterials: THREE.PointsMaterial[] = [];
            // 各パーティクルのmaterialを抽出
            for(let i = 0; i < this.clouds.length; i++) {
                particleMaterials.push(this.clouds[i].material as THREE.PointsMaterial);
            }

            // パーティクル1つ1つに対し処理を行う
            for(let i = 0; i < particleNum; i++) {
                const tweenInfo = {x: 0, y: 0, z: 0, opacity: 0.8, index: i};
                const tweens: TWEEN.Tween[][] = [];
                const updatePositions = [];

                // 各svgGeometryに対応するパーティクルに対し処理を行う
                for(let j = 0; j < svgGeometries.length; j++) {
                    tweens[j] = [];
                    updatePositions[j] = () => {
                        particlePositions[j].setX(tweenInfo.index, tweenInfo.x);
                        particlePositions[j].setY(tweenInfo.index, tweenInfo.y);
                        particlePositions[j].setZ(tweenInfo.index, tweenInfo.z);
                        // SUCCESSのアニメーション内でERRORのopacityを0にする
                        if(j == 1) {
                            particleMaterials[0].opacity = 0;
                        }
                        particleMaterials[j].opacity = tweenInfo.opacity;
                        particlePositions[j].needsUpdate = true;
                    }

                    // createParticle内でのSUCCESSの初期位置設定のロジックと同様、nextX, Y, Zに各SVGGeometryの頂点位置を設定する
                    const svgGeometry: THREE.ExtrudeGeometry[] = svgGeometries[j];
                    const particleNumOfChar = particleNum / svgGeometry.length;
                    const geomIndex = Math.floor(i / particleNumOfChar);
                    const charGeometry = svgGeometry[geomIndex] as THREE.BufferGeometry;
                    const charPositions = charGeometry.getAttribute("position");
                    const charIndex = Math.floor(Math.random() * charPositions.count);
                    const nextX = charPositions.getX(charIndex);
                    const nextY = charPositions.getY(charIndex);
                    const nextZ = charPositions.getZ(charIndex);

                    const delay = (i / particleNum) * 1000; // アニメーション用のディレイ 一文字ずつずれてアニメーションするようになる
                    if(j == 0) {
                        tweens[j].push(new TWEEN.Tween(tweenInfo).delay(delay).to({x: nextX, y: nextY, z: nextZ}, 1000).easing(TWEEN.Easing.Quintic.InOut).onUpdate(updatePositions[j]));
                        tweens[j].push(new TWEEN.Tween(tweenInfo).delay(1000).to({x: nextX + Math.random() * 1 - 0.5, y: nextY + Math.random() * 1 - 0.5, z: nextZ + Math.random() * 1 - 0.5}, 1000).easing(TWEEN.Easing.Quintic.InOut).onUpdate(updatePositions[j]));
                        tweens[j].push(new TWEEN.Tween(tweenInfo).to({opacity: 0.2}).easing(TWEEN.Easing.Quintic.Out).onUpdate(updatePositions[j]));
                    } else if(j == 1) {
                        tweens[j].push(new TWEEN.Tween(tweenInfo).to({opacity: 0.8}).easing(TWEEN.Easing.Quintic.In).onUpdate(updatePositions[j]));
                        tweens[j].push(new TWEEN.Tween(tweenInfo).delay(1000).to({x: nextX, y: nextY, z: nextZ, opacity: 0.8}).easing(TWEEN.Easing.Quintic.InOut).onUpdate(updatePositions[j]));
                        tweens[j].push(new TWEEN.Tween(tweenInfo).delay(1000).to({x: Math.random() * 20 - 10, y: Math.random() * 20 - 10, z: Math.random() * 20 - 10}, 1000).easing(TWEEN.Easing.Quintic.InOut).onUpdate(updatePositions[j]));
                    }
                    for(let k = 0; k < tweens[j].length-1; k++) {
                        tweens[j][k].chain(tweens[j][k+1]);
                    }
                }
                for(let j = 0; j < tweens.length; j++) {
                    for(let k = 0; k < tweens[j].length; k++) {
                        group.add(tweens[j][k]);
                    }
                }
                tweens[0][2].chain(tweens[1][0]);
                
                tweens[0][0].start();
            }
        }

        generateTweenAnimation();
    
        // 毎フレームのupdateを呼んで，更新
        // reqestAnimationFrame により次フレームを呼ぶ
        const update: FrameRequestCallback = (_time) => {
            requestAnimationFrame(update);
            group.update(_time);
        }
        requestAnimationFrame(update);
    }
}

window.addEventListener("DOMContentLoaded", init);

function init() {
    const container = new ThreeJSContainer();

    const viewport = container.createRendererDOM(640, 480, new THREE.Vector3(0, 0, 10));
    document.body.appendChild(viewport);
}
