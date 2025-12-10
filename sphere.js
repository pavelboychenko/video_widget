import * as THREE from "./three.module.min.js";

/**
 * Упрощённая сфера с шумом и «дыханием».
 */

const POINTS_COUNT = 12000;
const BASE_RADIUS = 3.4;
const COLOR_CORE = new THREE.Color(1.0, 0.75, 0.5);
const COLOR_EDGE = new THREE.Color(1.0, 0.35, 0.05);

const isMobileWidget = () => window.innerWidth < 992;

const getSvhWidget = () => {
  const testElement = document.createElement("div");
  testElement.style.height = "100lvh";
  testElement.style.position = "fixed";
  testElement.style.top = "0";
  testElement.style.visibility = "hidden";
  document.body.appendChild(testElement);
  const svhHeight = testElement.offsetHeight || window.innerHeight;
  document.body.removeChild(testElement);
  return svhHeight;
};

function generateSpherePoints(count, radius) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.sin(phi) * Math.sin(theta);
    const z = radius * Math.cos(phi);
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
  }
  return positions;
}

function initSphereWidget() {
  const canvas = document.querySelector("#canvas");
  if (!canvas) return;

  const parentRect = canvas.parentElement?.getBoundingClientRect();
  const width = parentRect?.width || window.innerWidth;
  const height = parentRect?.height || getSvhWidget();

  canvas.width = width * 2;
  canvas.height = height * 2;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const dpr = Math.min(window.devicePixelRatio * 1.5, 3);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setSize(width, height);
  renderer.setPixelRatio(dpr);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
  camera.position.set(0, 0, 10);

  // Геометрия точек
  const geometry = new THREE.BufferGeometry();
  const positions = generateSpherePoints(POINTS_COUNT, BASE_RADIUS);
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  // Цвета: ближе к центру — светлее
  const colors = new Float32Array(POINTS_COUNT * 3);
  for (let i = 0; i < POINTS_COUNT; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    const r = Math.sqrt(x * x + y * y + z * z);
    const t = THREE.MathUtils.clamp((r - BASE_RADIUS * 0.7) / (BASE_RADIUS * 0.5), 0, 1);
    const c = COLOR_CORE.clone().lerp(COLOR_EDGE, t);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: isMobileWidget() ? 16 : 12,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);

  // Анимация дыхания + лёгкий шум
  const clock = new THREE.Clock();
  function animate() {
    const t = clock.getElapsedTime();
    const breathe = 1 + Math.sin(t * 1.6) * 0.05;
    points.scale.setScalar(breathe);

    // Шумовое покачивание камеры
    camera.position.x = Math.sin(t * 0.4) * 0.2;
    camera.position.y = Math.cos(t * 0.5) * 0.2;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  animate();

  window.addEventListener("resize", () => {
    const pr = canvas.parentElement?.getBoundingClientRect();
    const w = pr?.width || window.innerWidth;
    const h = pr?.height || getSvhWidget();
    canvas.width = w * 2;
    canvas.height = h * 2;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
}

document.addEventListener("DOMContentLoaded", initSphereWidget);

const isMobile = () => window.innerWidth < 992;

const getSvh = () => {
  const testElement = document.createElement("div");
  testElement.style.height = "100lvh";
  testElement.style.position = "fixed";
  testElement.style.top = "0";
  testElement.style.visibility = "hidden";
  document.body.appendChild(testElement);
  const svhHeight = testElement.offsetHeight || window.innerHeight;
  document.body.removeChild(testElement);
  return svhHeight;
};

const init3dApp = () => {
  const POINTS_COUNT = 10000;
  const svhHeight = getSvh();
  const canvas = document.querySelector("#canvas");
  if (!canvas) return;

  const parentRect = canvas.parentElement?.getBoundingClientRect();
  const width = parentRect?.width || window.innerWidth;
  const height = parentRect?.height || svhHeight;

  canvas.width = width * 2;
  canvas.height = height * 2;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.style.transform = "translateY(0)";
  canvas.style.transition = "transform 1s ease-in-out";

  const dpr = Math.min(window.devicePixelRatio * 2, 4);

  // Требуется WebGL2 из-за использования gl_VertexID в шейдере
  let gl = canvas.getContext("webgl2", { antialias: true, alpha: true });
  if (!gl) {
    console.warn("WebGL2 недоступен: сфера не будет отображаться");
    return;
  }

  const renderer = new THREE.WebGLRenderer({
    canvas,
    context: gl,
    alpha: true,
    powerPreference: "high-performance"
  });

  renderer.setClearColor(0x000000, 0);
  renderer.setSize(width, height);
  renderer.autoClear = true;
  renderer.setPixelRatio(dpr);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x300504, 3, 12);

  const gu = {
    time: { value: 0 },
    planeToSphereMorph: { value: 9.5 }, // держим морф внутри диапазона ветки sphere
    mouse: { value: [0, 0] },
    mouseAnimated: { value: [0, 0] },
    light: { value: [0, 0, 0] },
    pointSize: { value: 10 },      // увеличено в 20 раз
    maxPointSize: { value: 240 },  // увеличено в 20 раз
    fresnelColor: { value: [1.2, 0.35, 0.08] }, // ярче
    lightColor: { value: [1.1, 0.3, 0.05] },    // ярче
    mouseLightColor: { value: [0.885, 0.528, 0.44] },
    sphereColor1: { value: [0.48, 0.095, 0] },
    sphereColor2: { value: [0.96, 0.645, 0.545] },
    sphereScale: { value: 1.32 },
    sphereScaleMobile: { value: 1.05 },
    sphereRotationLimit: { value: 0.1 },
    noiseAmplitude: { value: 0.16 },
    noiseDensity: { value: 3.3 },
    timeScale: { value: 0.5 },
    blurPower: { value: 0.5 }
  };

  const waveSettings = {
    color: { value: [0.945, 0.23, 0.052] },
    pointSize: { value: 0.04 },
    noiseAmplitude: { value: 0.9 },
    noiseDensity: { value: 2.6 },
    timeScale: { value: 2.24 }
  };

  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  camera.position.set(0, 0, 7.5);

  scene.add(new THREE.AmbientLight(0x222222, 0.5));

  const mouseLight = new THREE.PointLight(
    new THREE.Color(...gu.mouseLightColor.value),
    1.2,
    0
  );
  mouseLight.position.set(3, -3, 3);
  scene.add(mouseLight);

  // ---------- Geometry ----------
  const getSphereGeometry = () => {
    // Строим плоскость/сферу с совпадающим количеством вершин ~POINTS_COUNT
    const seg = Math.max(8, Math.ceil(Math.sqrt(POINTS_COUNT)) - 1); // 99 при 10k
    const totalVerts = (seg + 1) * (seg + 1);
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(totalVerts * 3).fill(0);
    const indexes = new Float32Array(totalVerts).fill(0);
    for (let i = 0; i < totalVerts; i++) indexes[i] = i;
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("index", new THREE.BufferAttribute(indexes, 1));
    return { geometry, seg };
  };

  class WobblingSphere extends THREE.Points {
    constructor() {
      const { geometry: sphereGeometry, seg } = getSphereGeometry();

      const pointsMaterial = new THREE.PointsMaterial({
        size: 120.0, // увеличено в 20 раз
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending
      });

      super(sphereGeometry, pointsMaterial);

      const objectDimensions = [25, 1, 7];
      // Выравниваем сегменты под количество вершин
      const heightSegments = seg;
      const widthSegments = seg;

      const planeGeometry = new THREE.PlaneGeometry(
        objectDimensions[0],
        objectDimensions[2],
        Math.floor(heightSegments),
        Math.floor(widthSegments)
      )
        .rotateX(-Math.PI * 0.65)
        .translate(0, 1.8, 0);

      planeGeometry.computeTangents();
      planeGeometry.computeVertexNormals();

      sphereGeometry.setAttribute(
        "planePosition",
        planeGeometry.attributes.position
      );
      sphereGeometry.setAttribute("tangent", planeGeometry.attributes.tangent);
      sphereGeometry.setAttribute("normal", planeGeometry.attributes.normal);

      const animStops = {
        // фиксированные точки анимации (чтобы попасть в ветку sphere: morph 8..10)
        value: new Float32Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
      };

      this.uniforms = {
        fadeOutMaxSize: gu.maxPointSize,
        colorIn: gu.sphereColor1,
        colorCenter: gu.sphereColor2,
        colorOut: gu.fresnelColor,
        morph: gu.planeToSphereMorph,
        modelScale: { value: this.getScale() },
        mouse: gu.mouse,
        mouseAnimated: gu.mouseAnimated,
        light: gu.light,
        mouseLightColor: gu.mouseLightColor,
        radius: { value: 2 },
        noiseAmplitude: gu.noiseAmplitude,
        noiseDensity: gu.noiseDensity,
        objectSize: { value: objectDimensions },
        waveColor: waveSettings.color,
        waveNoiseAmplitude: waveSettings.noiseAmplitude,
        waveTimeScale: waveSettings.timeScale,
        timeScale: gu.timeScale,
        blurPower: gu.blurPower,
        subdivision: { value: [widthSegments, heightSegments] },
        animStops
      };

      this.material.onBeforeCompile = (shader) => {
        shader.uniforms.time = gu.time;
        shader.defines = {
          USE_TANGENT: "",
          SAMPLES: `${POINTS_COUNT}.0`
        };
        for (let key in this.uniforms) {
          shader.uniforms[key] = this.uniforms[key];
        }
        shader.vertexShader = vertexShaderSource;
        shader.fragmentShader = `
          varying vec3 vColor;
          varying float fadeOut;
          varying vec3 vNormal;

          void main() {
            float uvLen = length(gl_PointCoord.xy - 0.5);
            if (fadeOut < 0.0 || uvLen > 0.5) discard;
            vec4 diffuseColor = vec4( vColor, 1.0 );
            
            float fa = 1. - smoothstep(0.55, 1.0, uvLen);
            float distanceFactor = 1. - smoothstep(0.989, 0.991, gl_FragCoord.z);

            float alpha = fa * (0.25 + 0.75 * pow(fadeOut, 4.)) * distanceFactor;

            diffuseColor *= alpha;
            diffuseColor.a = distanceFactor;
        
            gl_FragColor = diffuseColor;
          }
        `;
      };
    }

    getScale() {
      return isMobile() ? gu.sphereScaleMobile.value : gu.sphereScale.value;
    }
  }

  const spheres = [];

  const updateSpheresRotation = () => {
    const { clamp } = THREE.MathUtils;
    spheres.forEach(({ sphere }) => {
      const mouseX = gu.mouseAnimated.value[0] / 10;
      const mouseY = -(gu.mouseAnimated.value[1] / 10);
      const ratio = width / height;
      const rotationLimit = gu.sphereRotationLimit.value;
      const maxAngle = Math.PI * rotationLimit;
      const targetRotationX = clamp(mouseY, -1, 1) * maxAngle;
      const targetRotationY = clamp(mouseX * ratio, -1, 1) * maxAngle;
      sphere.rotation.x += (targetRotationX - sphere.rotation.x) * 0.2;
      sphere.rotation.y += (targetRotationY - sphere.rotation.y) * 0.2;
    });
  };

  window.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 10;
    const y = -(((e.clientY - rect.top) / rect.height) - 0.5) * 10;
    gu.mouse.value = [x, y];
  });

  window.addEventListener("resize", () => {
    const pr = canvas.parentElement?.getBoundingClientRect();
    const w = pr?.width || window.innerWidth;
    const h = pr?.height || svhHeight;
    canvas.width = w * 2;
    canvas.height = h * 2;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  const updateMorph = () => {
    gu.planeToSphereMorph.value = svhHeight * 2;
    spheres.forEach(({ sphere }) => {
      const scale = sphere.getScale();
      sphere.scale.set(scale, scale, scale);
    });
    updateSpheresRotation();
  };

  // создаём сферу
  const sphere = new WobblingSphere();
  scene.add(sphere);
  spheres.push({ sphere });
  updateMorph();

  let renderIsPaused = false;
  const clock = new THREE.Clock();

  function animate() {
    const delta = clock.getDelta();
    gu.time.value += delta;
    requestAnimationFrame(animate);
    if (renderIsPaused) return;

    const maxDelta = 10 * delta;
    for (let i = 0; i < 2; i++) {
      const diff = gu.mouse.value[i] - gu.mouseAnimated.value[i];
      if (Math.abs(diff) > maxDelta) {
        gu.mouseAnimated.value[i] += Math.sign(diff) * maxDelta;
      } else {
        gu.mouseAnimated.value[i] = gu.mouse.value[i];
      }
    }

    const lightZ = -3.5;
    mouseLight.position.set(...gu.mouseAnimated.value, lightZ);
    gu.light.value = [...gu.mouseAnimated.value, lightZ];

    updateSpheresRotation();
    renderer.render(scene, camera);
  }

  renderer.compileAsync(scene, camera).then(() => {
    animate();
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        renderIsPaused = !entry.isIntersecting;
        canvas.style.display = renderIsPaused ? "none" : "block";
      });
    },
    { threshold: 0.05 }
  );

  const widget = canvas.closest(".video-widget");
  if (widget) observer.observe(widget);
};

window.requestIdleCallback = window.requestIdleCallback || setTimeout;

setTimeout(() => {
  window.requestIdleCallback(
    () => {
      init3dApp();
    },
    { timeout: 5000 }
  );
}, 500);


