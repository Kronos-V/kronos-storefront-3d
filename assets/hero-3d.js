// TLK Hero 3D — local-first imports with CDN fallback + visible debug
window.__TLKHero3DLoaded = false;

const CDN = {
  three: 'https://unpkg.com/three@0.160.0/build/three.module.js',
  gltf:  'https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js',
  draco: 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/DRACOLoader.js',
  rgbe:  'https://unpkg.com/three@0.160.0/examples/jsm/loaders/RGBELoader.js',
  orbit: 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js'
};

const LIBS = (window.__TLK3D_LIBS || CDN);

(async function initAll(){
  const canvases = document.querySelectorAll('canvas[data-hero3d]');
  if (!canvases.length) return;

  // Try local assets first; if they fail, try CDN
  let THREE, GLTFLoader, DRACOLoader, RGBELoader, OrbitControls;
  try {
    THREE = await import(LIBS.three);
    ({ GLTFLoader }  = await import(LIBS.gltf));
    ({ DRACOLoader } = await import(LIBS.draco));
    ({ RGBELoader }  = await import(LIBS.rgbe));
    ({ OrbitControls } = await import(LIBS.orbit));
  } catch (e) {
    console.warn('Local imports failed; trying CDN…', e);
    THREE = await import(CDN.three);
    ({ GLTFLoader }  = await import(CDN.gltf));
    ({ DRACOLoader } = await import(CDN.draco));
    ({ RGBELoader }  = await import(CDN.rgbe));
    ({ OrbitControls } = await import(CDN.orbit));
  }

  for (const canvas of canvases) {
    try { await initOne(canvas, { THREE, GLTFLoader, DRACOLoader, RGBELoader, OrbitControls }); }
    catch (e){ console.error('Hero3D init error:', e); }
  }
  window.__TLKHero3DLoaded = true;
})();

async function initOne(canvas, libs){
  const { THREE, GLTFLoader, DRACOLoader, RGBELoader, OrbitControls } = libs;

  // Visible “running” badge in bottom-left (auto-hides after 2s)
  badge(canvas, '3D starting…');

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
    try {
      const hdrTex = await new RGBELoader().loadAsync(envURL);
      scene.environment = pmrem.fromEquirectangular(hdrTex).texture;
      hdrTex.dispose(); pmrem.dispose();
    } catch { addLights(scene, THREE); }
  } else {
    addLights(scene, THREE);
  }

  const gltfLoader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
  gltfLoader.setDRACOLoader(draco);

  if (modelURL) {
    try {
      const gltf = await gltfLoader.loadAsync(modelURL);
      const root = gltf.scene || gltf.scenes?.[0];
      root?.traverse(o=>{
        if (o.isMesh) {
          o.castShadow = false; o.receiveShadow = false;
          if (o.material?.map) o.material.map.colorSpace = THREE.SRGBColorSpace;
        }
      });
      centerAndFrame(root, camera, controls, THREE);
      scene.add(root);
    } catch (e) {
      console.warn('GLB failed; using demo cube.', e);
      addCube(scene, THREE);
    }
  } else {
    addCube(scene, THREE);
  }

  function resize(){
    const w = canvas.clientWidth || 1200;
    const h = canvas.clientHeight || 600;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize(); addEventListener('resize', resize, { passive: true });

  (function animate(){
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  })();

  setTimeout(()=>badge(canvas, ''), 2000); // hide badge
}

function addLights(scene, THREE){
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(2,3,4); scene.add(dir);
}
function addCube(scene, THREE){
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
function badge(canvas, text){
  let el = canvas.parentElement.querySelector('.tlk-3d-badge');
  if (!el){
    el = document.createElement('div');
    el.className='tlk-3d-badge';
    el.style.cssText='position:absolute;left:10px;bottom:10px;font-size:12px;padding:6px 8px;border-radius:999px;background:rgba(0,0,0,.5);color:#fff;pointer-events:none;';
    canvas.parentElement.appendChild(el);
  }
  el.textContent = text;
  el.style.display = text ? 'inline-block' : 'none';
}
