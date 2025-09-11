// Hero 3D — TLK
const THREE_SRC = 'https://unpkg.com/three@0.160.0/build/three.module.js';
const GLTF_LOADER_SRC = 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
const DRACO_LOADER_SRC = 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/DRACOLoader.js';
const RGBE_LOADER_SRC  = 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/RGBELoader.js';
const ORBIT_CTRL_SRC   = 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';

(async () => {
  const canvas = document.getElementById('hero3d');
  if (!canvas) return;

  const modelURL   = canvas.dataset.model || '';
  const envURL     = canvas.dataset.env || '';
  const exposure   = parseFloat(canvas.dataset.exposure || '1');
  const autorotate = canvas.dataset.autorotate === 'true';
  const speed      = parseFloat(canvas.dataset.speed || '0.4');

  const THREE = await import(THREE_SRC);
  const { GLTFLoader }  = await import(GLTF_LOADER_SRC);
  const { DRACOLoader } = await import(DRACO_LOADER_SRC);
  const { RGBELoader }  = await import(RGBE_LOADER_SRC);
  const { OrbitControls } = await import(ORBIT_CTRL_SRC);

  // Scene & renderer
  const scene = new THREE.Scene();

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  function size() {
    const w = canvas.clientWidth || 1200;
    const h = canvas.clientHeight || 600;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure;

  const camera = new THREE.PerspectiveCamera(60, 16/9, 0.1, 100);
  camera.position.set(0, 0, 3);

  // Controls (with reduced-motion respect)
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.autoRotate = autorotate && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  controls.autoRotateSpeed = speed; // 0.4 default

  // Environment or lights
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  if (envURL) {
    try {
      const hdrTex = await new RGBELoader().loadAsync(envURL);
      const envMap = pmrem.fromEquirectangular(hdrTex).texture;
      scene.environment = envMap;
      // Keep the CSS background color; set scene.background = null for transparent
      hdrTex.dispose(); pmrem.dispose();
    } catch (e) {
      console.warn('HDR load failed, falling back to lights.', e);
      addBasicLights();
    }
  } else {
    addBasicLights();
  }

  function addBasicLights() {
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(2, 3, 4);
    dir.castShadow = false;
    scene.add(dir);
  }

  // Load GLB (with Draco support)
  const gltfLoader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
  gltfLoader.setDRACOLoader(draco);

  // Fallback demo if no model provided
  if (!modelURL) {
    addDemoCube();
    start();
    return;
  }

  try {
    const gltf = await gltfLoader.loadAsync(modelURL);
    const root = gltf.scene || gltf.scenes?.[0];
    root.traverse(o => {
      if (o.isMesh) {
        o.castShadow = false;
        o.receiveShadow = false;
        // Ensure proper color space for embedded textures
        if (o.material && o.material.map) o.material.map.colorSpace = THREE.SRGBColorSpace;
      }
    });
    // Center & fit to view
    centerAndFrame(root);
    scene.add(root);
  } catch (e) {
    console.error('Model load failed, showing demo cube instead.', e);
    addDemoCube();
  }

  start();

  // ---- helpers ----
  function addDemoCube() {
    const geo = new THREE.BoxGeometry(1,1,1);
    const mat = new THREE.MeshStandardMaterial({ metalness: 0.4, roughness: 0.2 });
    const cube = new THREE.Mesh(geo, mat);
    scene.add(cube);
    // gentle spin even without controls autoRotate
    const spin = { t: 0 };
    (function rotate(){
      spin.t += 0.01;
      cube.rotation.x = spin.t * 0.6;
      cube.rotation.y = spin.t * 0.8;
      requestAnimationFrame(rotate);
    })();
  }

  function centerAndFrame(obj) {
    // Compute bounding box & center
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    obj.position.sub(center); // center it at origin

    // Distance so model fits nicely in view
    const maxDim = Math.max(size.x, size.y, size.z);
    const dist = Math.max(2, maxDim * 1.4);
    camera.position.set(0, 0, dist);
    controls.target.set(0, 0, 0);
    controls.update();
  }

  function start() {
    size(); window.addEventListener('resize', size, { passive: true });
    (function animate(){
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    })();
  }
})();
