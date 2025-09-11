// TLK Hero 3D (Shopify-safe, multi-canvas)
const THREE_SRC = 'https://unpkg.com/three@0.160.0/build/three.module.js';
const GLTF_LOADER_SRC = 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
const DRACO_LOADER_SRC = 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/DRACOLoader.js';
const RGBE_LOADER_SRC  = 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/RGBELoader.js';
const ORBIT_CTRL_SRC   = 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';

(async function initAll(){
  const canvases = document.querySelectorAll('canvas[data-hero3d]');
  if (!canvases.length) return;

  const THREE = await import(THREE_SRC);
  const { GLTFLoader }  = await import(GLTF_LOADER_SRC);
  const { DRACOLoader } = await import(DRACO_LOADER_SRC);
  const { RGBELoader }  = await import(RGBE_LOADER_SRC);
  const { OrbitControls } = await import(ORBIT_CTRL_SRC);

  for (const canvas of canvases) initOne(canvas, { THREE, GLTFLoader, DRACOLoader, RGBELoader, OrbitControls });
})();

function initOne(canvas, libs){
  const { THREE, GLTFLoader, DRACOLoader, RGBELoader, OrbitControls } = libs;

  const modelURL   = canvas.dataset.model || '';
  const envURL     = canvas.dataset.env || '';
  const exposure   = parseFloat(canvas.dataset.exposure || '1');
  const autorotate = canvas.dataset.autorotate === 'true';
  const speed      = parseFloat(canvas.dataset.speed || '0.4');

  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure;

  const camera = new THREE.PerspectiveCamera(60, 16/9, 0.1, 100);
  camera.position.set(0, 0, 3);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.autoRotate = autorotate && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  controls.autoRotateSpeed = speed;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  if (envURL) {
    new RGBELoader().load(envURL, (hdrTex)=>{
      const envMap = pmrem.fromEquirectangular(hdrTex).texture;
      scene.environment = envMap;
      hdrTex.dispose(); pmrem.dispose();
    }, undefined, ()=>{
      addBasicLights();
    });
  } else {
    addBasicLights();
  }

  const gltfLoader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
  gltfLoader.setDRACOLoader(draco);

  if (modelURL) {
    gltfLoader.load(modelURL, (gltf)=>{
      const root = gltf.scene || gltf.scenes?.[0];
      root?.traverse(o=>{
        if (o.isMesh) {
          o.castShadow = false; o.receiveShadow = false;
          if (o.material?.map) o.material.map.colorSpace = THREE.SRGBColorSpace;
        }
      });
      centerAndFrame(root, camera, controls, THREE);
      scene.add(root);
    }, undefined, (e)=>{
      console.error('Model load failed — demo cube used.', e);
      addDemoCube(scene, THREE);
    });
  } else {
    addDemoCube(scene, THREE);
  }

  function addBasicLights(){
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(2,3,4);
    scene.add(dir);
  }

  function addDemoCube(scene, THREE){
    const geo = new THREE.BoxGeometry(1,1,1);
    const mat = new THREE.MeshStandardMaterial({ metalness: 0.4, roughness: 0.2 });
    const cube = new THREE.Mesh(geo, mat); scene.add(cube);
    let t = 0; (function spin(){ t+=0.01; cube.rotation.x=t*0.6; cube.rotation.y=t*0.8; requestAnimationFrame(spin); })();
  }

  function centerAndFrame(obj, camera, controls, THREE){
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    obj.position.sub(center);
    const maxDim = Math.max(size.x, size.y, size.z);
    const dist = Math.max(2, maxDim * 1.4);
    camera.position.set(0,0,dist);
    controls.target.set(0,0,0);
    controls.update();
  }

  function resize(){
    const w = canvas.clientWidth || 1200;
    const h = canvas.clientHeight || 600;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize(); window.addEventListener('resize', resize, { passive: true });

  (function animate(){
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  })();
}
