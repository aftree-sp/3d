import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const BED_SIZE = 256;
const BODY_COLOR = 0xe4eaf0;
const ACCENT = 0x2ee88a;

export function createViewer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.98;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 4000);
  camera.up.set(0, 0, 1);
  camera.position.set(160, -190, 130);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 30;
  controls.maxDistance = 1200;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.target.set(0, 0, 22);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.06).texture;
  scene.environment = envTexture;

  const hemi = new THREE.HemisphereLight(0xdff1ff, 0x1b2430, 0.55);
  scene.add(hemi);

  const keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
  keyLight.position.set(120, -90, 200);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.left = -180;
  keyLight.shadow.camera.right = 180;
  keyLight.shadow.camera.top = 180;
  keyLight.shadow.camera.bottom = -180;
  keyLight.shadow.camera.near = 10;
  keyLight.shadow.camera.far = 700;
  keyLight.shadow.bias = -0.0008;
  keyLight.shadow.normalBias = 0.6;
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x88c9ff, 1.1);
  rimLight.position.set(-160, 120, 90);
  scene.add(rimLight);

  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(BED_SIZE * 3, BED_SIZE * 3),
    new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.4 })
  );
  shadowPlane.position.z = -0.06;
  shadowPlane.receiveShadow = true;
  scene.add(shadowPlane);

  const bedGroup = new THREE.Group();
  const grid = new THREE.GridHelper(BED_SIZE, 32, 0x2c3a46, 0x1a232b);
  grid.rotation.x = Math.PI / 2;
  grid.material.transparent = true;
  grid.material.opacity = 0.9;
  bedGroup.add(grid);

  const bedPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(BED_SIZE, BED_SIZE),
    new THREE.MeshBasicMaterial({ color: 0x0f151a, transparent: true, opacity: 0.55 })
  );
  bedPlane.position.z = -0.04;
  bedGroup.add(bedPlane);

  const outlinePoints = [
    new THREE.Vector3(-BED_SIZE / 2, -BED_SIZE / 2, 0),
    new THREE.Vector3(BED_SIZE / 2, -BED_SIZE / 2, 0),
    new THREE.Vector3(BED_SIZE / 2, BED_SIZE / 2, 0),
    new THREE.Vector3(-BED_SIZE / 2, BED_SIZE / 2, 0),
    new THREE.Vector3(-BED_SIZE / 2, -BED_SIZE / 2, 0),
  ];
  const outline = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(outlinePoints),
    new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.45 })
  );
  bedGroup.add(outline);
  scene.add(bedGroup);

  const modelGroup = new THREE.Group();
  scene.add(modelGroup);

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: BODY_COLOR,
    roughness: 0.42,
    metalness: 0.12,
    envMapIntensity: 0.85,
    flatShading: true,
  });
  const edgeMaterial = new THREE.LineBasicMaterial({
    color: 0x22303a,
    transparent: true,
    opacity: 0.55,
  });

  let mesh = null;
  let edges = null;
  let modelSize = new THREE.Vector3(30, 30, 30);
  let hasFramed = false;
  let showEdges = true;
  let camAnim = null;

  function disposeModel() {
    if (mesh) {
      modelGroup.remove(mesh);
      mesh.geometry.dispose();
      mesh = null;
    }
    if (edges) {
      modelGroup.remove(edges);
      edges.geometry.dispose();
      edges = null;
    }
  }

  function frameModel(instant = false) {
    const radius = Math.max(modelSize.length() * 0.5, 1);
    const vFov = (camera.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov * 0.5) * Math.max(camera.aspect, 0.5));
    const fitFov = Math.min(vFov, hFov);
    const dist = (radius / Math.sin(fitFov * 0.5)) * 1.12;
    const dir = new THREE.Vector3(0.74, -0.9, 0.6).normalize();
    const center = new THREE.Vector3(0, 0, modelSize.z * 0.46);
    const targetPos = center.clone().addScaledVector(dir, dist);
    if (instant) {
      camAnim = null;
      camera.position.copy(targetPos);
      controls.target.copy(center);
      controls.update();
    } else {
      camAnim = {
        fromPos: camera.position.clone(),
        toPos: targetPos,
        fromTarget: controls.target.clone(),
        toTarget: center,
        start: performance.now(),
        duration: 460,
      };
    }
  }

  function setMesh(data, size, options = {}) {
    disposeModel();
    modelSize.set(size[0], size[1], size[2]);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
    geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
    geometry.computeBoundingSphere();

    mesh = new THREE.Mesh(geometry, bodyMaterial);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    modelGroup.add(mesh);

    edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 22), edgeMaterial);
    edges.visible = showEdges;
    modelGroup.add(edges);

    if (!hasFramed) {
      frameModel(true);
      hasFramed = true;
    } else if (options.refit) {
      frameModel(false);
    }
  }

  function setEdgesVisible(value) {
    showEdges = value;
    if (edges) edges.visible = value;
  }

  function resetView() {
    frameModel(false);
  }

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  controls.addEventListener('start', () => {
    camAnim = null;
  });

  let raf = 0;
  function animate() {
    raf = requestAnimationFrame(animate);
    if (camAnim) {
      const k = Math.min(1, (performance.now() - camAnim.start) / camAnim.duration);
      const ease = 1 - Math.pow(1 - k, 3);
      camera.position.lerpVectors(camAnim.fromPos, camAnim.toPos, ease);
      controls.target.lerpVectors(camAnim.fromTarget, camAnim.toTarget, ease);
      if (k >= 1) camAnim = null;
    }
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  return {
    setMesh,
    setEdgesVisible,
    resetView,
    get edgesVisible() {
      return showEdges;
    },
    dispose() {
      cancelAnimationFrame(raf);
      observer.disconnect();
      disposeModel();
      renderer.dispose();
      pmrem.dispose();
      envTexture.dispose();
    },
  };
}


