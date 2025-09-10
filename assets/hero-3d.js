// Lazy Three.js loader to keep Atelier fast
const THREE_SRC = 'https://unpkg.com/three@0.160.0/build/three.module.js';

async function loadThree() {
  return await import(THREE_SRC);
}

(async () => {
  const canvas = document.getElementById('hero3d');
  if (!canvas) return;
  const { Scene, PerspectiveCamera, WebGLRenderer, Color, BoxGeometry, MeshStandardMaterial, Mesh, AmbientLight, DirectionalLight, sRGBEncoding } = await loadThree();

  const scene = new Scene();
  scene.background = new Color(0x000000);

  const camera = new PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
  camera.position.set(0, 0, 3);

  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.outputEncoding = sRGBEncoding;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight || 600;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  resize(); window.addEventListener('resize', resize);

  const geo = new BoxGeometry(1, 1, 1);
  const mat = new MeshStandardMaterial({ metalness: 0.4, roughness: 0.2 });
  const cube = new Mesh(geo, mat);
  scene.add(cube);

  scene.add(new AmbientLight(0xffffff, 0.6));
  const dir = new DirectionalLight(0xffffff, 0.8); dir.position.set(2, 3, 4); scene.add(dir);

  let t = 0;
  function tick() {
    t += 0.01;
    cube.rotation.x = t * 0.6;
    cube.rotation.y = t * 0.8;
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  tick();
})();
