// main.js

// =====================================================================
// === GLOBAL VARIABLES & INITIAL DATA FETCH ===
// =====================================================================
let global_json_data = null;
let resizeTimer;

const get_Json = fetch("json4datatable.json")
.then(function(response) {
    return response.json();
});

const make_charts = function() {
  get_Json.then(function(res) {
    global_json_data = res;

    google.charts.load('current', {
      callback: function () {
      drawChart(res);
    },
    packages: ["calendar"]
    });
  });
};

make_charts();

// =====================================================================
// === VERGE3D UTILITY FUNCTIONS (ONLY THE VERGE3D LAYER IS TOUCHED)
// =====================================================================

/**
 * JSON currently provides paths like `app/the_name.glb`.
 * This function forces loading from `app/glb/<fileName>.glb` regardless of input path.
 */
function normalizeGlbSceneURL(nameOrPath) {
  if (!nameOrPath || typeof nameOrPath !== 'string') return '';

  const raw = nameOrPath.trim().split('#')[0].split('?')[0].replaceAll('\\', '/');
  const parts = raw.split('/');
  let base = parts[parts.length - 1] || '';

  if (base && !/\.(glb|gltf)$/i.test(base)) {
    base += '.glb';
  }

  return base ? `app/glb/${base}` : '';
}

function stripQueryHash(url) {
  if (!url || typeof url !== 'string') return url;
  return url.split('#')[0].split('?')[0];
}

function addCacheBuster(url, token) {
  if (!url) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${encodeURIComponent(String(token))}`;
}

function safeFullscreenExit() {
  const exit = document.exitFullscreen
    || document.webkitExitFullscreen
    || document.mozCancelFullScreen
    || document.msExitFullscreen;

  const fsElem = document.fullscreenElement
    || document.webkitFullscreenElement
    || document.mozFullScreenElement
    || document.msFullscreenElement;

  if (fsElem && exit) {
    try { return exit.call(document); } catch (e) { /* ignore */ }
  }
  return null;
}

/**
 * Handles Fullscreen logic and returns a disposal function.
 */
function prepareFullscreen(containerId, fsButtonId, useFullscreen) {
  const container = document.getElementById(containerId);
  const fsButton = document.getElementById(fsButtonId);

  if (!fsButton) return null;

  if (!useFullscreen) {
    fsButton.style.display = 'none';
    return null;
  }

  // IMPORTANT: fullscreen the overlay wrapper so the button remains visible
  const overlay = document.getElementById('overlay_ship');
  const fsTarget = overlay || container;

  const fsEnabled = () => document.fullscreenEnabled
    || document.webkitFullscreenEnabled
    || document.mozFullScreenEnabled
    || document.msFullscreenEnabled;

  const fsElement = () => document.fullscreenElement
    || document.webkitFullscreenElement
    || document.mozFullScreenElement
    || document.msFullscreenElement;

  const requestFs = elem => (elem.requestFullscreen
    || elem.mozRequestFullScreen
    || elem.webkitRequestFullscreen
    || elem.msRequestFullscreen).call(elem);

  const exitFs = () => (document.exitFullscreen
    || document.mozCancelFullScreen
    || document.webkitExitFullscreen
    || document.msExitFullscreen).call(document);

  const changeFs = () => {
    const elem = fsElement();

    fsButton.classList.toggle('fullscreen-open', !elem);
    fsButton.classList.toggle('fullscreen-close', !!elem);

    // Keep your existing behavior: hide X while fullscreen
    const closeX = document.getElementById('closeOverlay');
    if (closeX) closeX.style.display = elem ? 'none' : 'block';

    window.dispatchEvent(new Event('resize'));
  };

  function fsButtonClick(event) {
    event.stopPropagation();

    // In fullscreen: clicking the fullscreen button should close the overlay
    // the same way as the X does (and it will also exit fullscreen).
    if (fsElement()) {
      closeOverlayAndDisposeApp();
      return;
    }

    // Not fullscreen: enter fullscreen
    if (fsTarget) {
      const closeX = document.getElementById('closeOverlay');
      if (closeX) closeX.style.display = 'none';
      requestFs(fsTarget);
    }
  }

  if (fsEnabled()) {
    fsButton.style.display = 'inline';
  } else {
    // no fullscreen support → just show the normal close
    const closeX = document.getElementById('closeOverlay');
    if (closeX) closeX.style.display = 'block';
  }

  fsButton.addEventListener('click', fsButtonClick);
  document.addEventListener('webkitfullscreenchange', changeFs);
  document.addEventListener('mozfullscreenchange', changeFs);
  document.addEventListener('msfullscreenchange', changeFs);
  document.addEventListener('fullscreenchange', changeFs);

  changeFs();

  return () => {
    fsButton.removeEventListener('click', fsButtonClick);
    document.removeEventListener('webkitfullscreenchange', changeFs);
    document.removeEventListener('mozfullscreenchange', changeFs);
    document.removeEventListener('msfullscreenchange', changeFs);
    document.removeEventListener('fullscreenchange', changeFs);
  };
}

function prepareExternalInterface(app) {
  // Keep empty unless you use ExternalInterface from Puzzles
}

function createCustomPreloader(updateCb, finishCb) {
  class CustomPreloader extends v3d.Preloader {
    constructor() { super(); }
    onUpdate(percentage) {
      super.onUpdate(percentage);
      if (updateCb) updateCb(percentage);
    }
    onFinish() {
      super.onFinish();
      if (finishCb) finishCb();
    }
  }
  return new CustomPreloader();
}

function puzzlesEditorPreparePreloader(preloader, PE) {
  const _onUpdate = preloader.onUpdate.bind(preloader);
  preloader.onUpdate = function(percentage) {
    _onUpdate(percentage);
    PE.loadingUpdateCb(percentage);
  };

  const _onFinish = preloader.onFinish.bind(preloader);
  preloader.onFinish = function() {
    _onFinish();
    PE.loadingFinishCb();
  };
}

function createPreloader(containerId, initOptions, PE) {
  const preloader = initOptions.useCustomPreloader
    ? createCustomPreloader(initOptions.preloaderProgressCb, initOptions.preloaderEndCb)
    : new v3d.SimplePreloader({ container: containerId });

  if (PE) puzzlesEditorPreparePreloader(preloader, PE);
  return preloader;
}

function createAppInstance(containerId, initOptions, preloader, PE) {
  const ctxSettings = {};
  if (initOptions.useBkgTransp) ctxSettings.alpha = true;
  if (initOptions.preserveDrawBuf) ctxSettings.preserveDrawingBuffer = true;

  const app = new v3d.App(containerId, ctxSettings, preloader);

  if (initOptions.useBkgTransp) {
    app.clearBkgOnLoad = true;
    if (app.renderer) app.renderer.setClearColor(0x000000, 0);
  }

  app.ExternalInterface = {};
  prepareExternalInterface(app);
  if (PE) PE.viewportUseAppInstance(app);

  return app;
}

// =====================================================================
// === CONTROL SETTINGS PATCHING (KEY FOR ORBIT + MIN/MAX DISTANCE) ===
// =====================================================================

function toNum(v) {
  const n = (typeof v === 'string') ? parseFloat(v) : v;
  return (typeof n === 'number' && !Number.isNaN(n)) ? n : undefined;
}

/**
 * Creates a controlSettings object that:
 * - preserves any existing fields (including those set by Puzzles)
 * - provides `assignToControls()` so `app.enableControls()` won't crash
 * - maps BOTH generic and *_PERSP naming variants to OrbitControls
 */
function patchOrbitControlSettings(existing = {}) {
  const cs = { ...existing };

  if (!cs.type) cs.type = 'ORBIT';

  // sensible defaults, only if missing
  if (cs.enableRotate === undefined) cs.enableRotate = true;
  if (cs.enablePan === undefined) cs.enablePan = false;
  if (cs.enableZoom === undefined) cs.enableZoom = true;
  if (cs.enableCtrlZoom === undefined) cs.enableCtrlZoom = true;
  if (cs.enableKeys === undefined) cs.enableKeys = false;
  if (cs.rotateSpeed === undefined) cs.rotateSpeed = 1.0;

  // defaults for distance if missing (puzzles may override later)
  if (cs.orbitMinDistance === undefined && cs.orbitMinDistancePersp === undefined) cs.orbitMinDistance = 1.5;
  if (cs.orbitMaxDistance === undefined && cs.orbitMaxDistancePersp === undefined) cs.orbitMaxDistance = 10;

  // Defaults for angles (puzzles may override)
  if (cs.orbitMinPolarAngle === undefined) cs.orbitMinPolarAngle = 0;
  if (cs.orbitMaxPolarAngle === undefined) cs.orbitMaxPolarAngle = Math.PI;

  if (typeof cs.assignToControls !== 'function') {
    cs.assignToControls = function(controls) {
      if (!controls) return;

      // enable flags
      if ('enableRotate' in controls) controls.enableRotate = !!cs.enableRotate;
      if ('enablePan' in controls) controls.enablePan = !!cs.enablePan;
      if ('enableZoom' in controls) controls.enableZoom = !!cs.enableZoom;
      if ('enableKeys' in controls) controls.enableKeys = !!cs.enableKeys;

      // rotate speed
      if ('rotateSpeed' in controls && toNum(cs.rotateSpeed) !== undefined) {
        controls.rotateSpeed = toNum(cs.rotateSpeed);
      }

      // Perspective distance limits:
      // Prefer fields that Puzzles likely writes for PERSP, fall back to generic ones.
      const minD = toNum(cs.orbitMinDistancePersp) ?? toNum(cs.orbitMinDistance);
      const maxD = toNum(cs.orbitMaxDistancePersp) ?? toNum(cs.orbitMaxDistance);

      if ('minDistance' in controls && minD !== undefined) controls.minDistance = minD;
      if ('maxDistance' in controls && maxD !== undefined) controls.maxDistance = maxD;

      // Polar / azimuth limits
      const minP = toNum(cs.orbitMinPolarAngle);
      const maxP = toNum(cs.orbitMaxPolarAngle);
      if ('minPolarAngle' in controls && minP !== undefined) controls.minPolarAngle = minP;
      if ('maxPolarAngle' in controls && maxP !== undefined) controls.maxPolarAngle = maxP;

      const minA = toNum(cs.orbitMinAzimuthAngle);
      const maxA = toNum(cs.orbitMaxAzimuthAngle);
      if ('minAzimuthAngle' in controls && minA !== undefined) controls.minAzimuthAngle = minA;
      if ('maxAzimuthAngle' in controls && maxA !== undefined) controls.maxAzimuthAngle = maxA;

      // screen space panning
      if ('screenSpacePanning' in controls && cs.screenSpacePanning !== undefined) {
        controls.screenSpacePanning = !!cs.screenSpacePanning;
      }

      // ctrl zoom (optional in some builds)
      if ('enableCtrlZoom' in controls && cs.enableCtrlZoom !== undefined) {
        controls.enableCtrlZoom = !!cs.enableCtrlZoom;
      }
    };
  }

  return cs;
}

/**
 * Ensure a camera named "Camera" exists in the scene graph and is compatible with Puzzles.
 */
function ensureNamedCamera(app) {
  if (!app || !app.scene) return null;

  let cam = app.scene.getObjectByName('Camera');
  if (cam && cam.isCamera) {
    cam.controlSettings = patchOrbitControlSettings(cam.controlSettings || {});
    return cam;
  }

  // Try to find any camera already in the scene
  let anySceneCam = null;
  app.scene.traverse(obj => {
    if (!anySceneCam && obj && obj.isCamera) anySceneCam = obj;
  });

  // Or use app's default camera (may not be in scene)
  const defaultCam = (typeof app.getCamera === 'function') ? app.getCamera(true) : null;
  cam = anySceneCam || defaultCam;

  // Last resort: create one
  if (!cam) {
    cam = new v3d.PerspectiveCamera(45, 1, 0.1, 1000);
    cam.position.set(0, 0, 6);
    cam.lookAt(0, 0, 0);
  }

  cam.name = 'Camera';

  // Add to scene so Puzzles can find it by name
  if (!cam.parent) app.scene.add(cam);

  cam.controlSettings = patchOrbitControlSettings(cam.controlSettings || {});

  // Make it the app's active camera (best-effort)
  if (typeof app.setCamera === 'function') {
    try { app.setCamera(cam); } catch (e) { console.error(e); }
  }

  return cam;
}

/**
 * IMPORTANT: do NOT manually create OrbitControls.
 * Let Verge3D manage controls via `app.enableControls()`.
 */
function ensureOrbitControls(app) {
  if (!app) return false;

  // If controls already exist and are orbit, just ensure rotate isn't blocked
  if (app.controls && (app.controls instanceof v3d.OrbitControls)) {
    if ('enableRotate' in app.controls) app.controls.enableRotate = true;
    return true;
  }

  // Ensure active camera has compatible orbit control settings
  const cam = (typeof app.getCamera === 'function') ? app.getCamera(true) : null;
  if (cam) cam.controlSettings = patchOrbitControlSettings(cam.controlSettings || {});

  try {
    app.enableControls(); // engine creates & updates controls per-frame
  } catch (e) {
    console.error(e);
    return false;
  }

  if (app.controls && (app.controls instanceof v3d.OrbitControls)) {
    if ('enableRotate' in app.controls) app.controls.enableRotate = true;
    return true;
  }

  return false;
}

/**
 * After Puzzles sets ORBIT_MIN_DISTANCE_PERSP / ORBIT_MAX_DISTANCE_PERSP
 * on the scene camera named "Camera", push them onto the live OrbitControls.
 */
function applyOrbitLimitsFromNamedCamera(app, camName = 'Camera') {
  if (!app || !app.scene) return;

  const controls = app.controls;
  if (!controls || !(controls instanceof v3d.OrbitControls)) return;

  const cam = app.scene.getObjectByName(camName);
  if (!cam || !cam.isCamera) return;

  cam.controlSettings = patchOrbitControlSettings(cam.controlSettings || {});

  // Prefer PERSP variants if present, otherwise generic orbitMin/MaxDistance
  const minD = toNum(cam.controlSettings.orbitMinDistancePersp) ?? toNum(cam.controlSettings.orbitMinDistance);
  const maxD = toNum(cam.controlSettings.orbitMaxDistancePersp) ?? toNum(cam.controlSettings.orbitMaxDistance);

  if (minD !== undefined) controls.minDistance = minD;
  if (maxD !== undefined) controls.maxDistance = maxD;

  const minP = toNum(cam.controlSettings.orbitMinPolarAngle);
  const maxP = toNum(cam.controlSettings.orbitMaxPolarAngle);
  if (minP !== undefined) controls.minPolarAngle = minP;
  if (maxP !== undefined) controls.maxPolarAngle = maxP;

  const minA = toNum(cam.controlSettings.orbitMinAzimuthAngle);
  const maxA = toNum(cam.controlSettings.orbitMaxAzimuthAngle);
  if (minA !== undefined) controls.minAzimuthAngle = minA;
  if (maxA !== undefined) controls.maxAzimuthAngle = maxA;

  if ('enableRotate' in controls) controls.enableRotate = true;
}

// =====================================================================
// === VERGE3D DISPOSAL (IMPORTANT: DO NOT CALL PL.dispose()) ===
// =====================================================================

/**
 * IMPORTANT:
 * Do NOT call `PL.dispose()` here. In generated puzzles logic it can set `_pGlob = null`,
 * and due to loader/module caching the next overlay open may reuse that module instance.
 */
function disposeVerge3DInstance(instance) {
  if (!instance || !instance.app) return;

  if (instance.PL) {
    if (typeof instance.PL.disposeListeners === 'function') {
      try { instance.PL.disposeListeners(); } catch (e) { /* ignore */ }
    }
    if (typeof instance.PL.disposeHTMLElements === 'function') {
      try { instance.PL.disposeHTMLElements(); } catch (e) { /* ignore */ }
    }
    if (typeof instance.PL.disposeMaterialsCache === 'function') {
      try { instance.PL.disposeMaterialsCache(); } catch (e) { /* ignore */ }
    }
  }

  if (instance.app.controls && typeof instance.app.controls.dispose === 'function') {
    try { instance.app.controls.dispose(); } catch (e) { /* ignore */ }
  }

  if (instance.app.renderer) {
    try { instance.app.renderer.dispose(); } catch (e) { /* ignore */ }
    if (typeof instance.app.renderer.forceContextLoss === 'function') {
      try { instance.app.renderer.forceContextLoss(); } catch (e) { /* ignore */ }
    }
  }

  try { instance.app.dispose(); } catch (e) { /* ignore */ }

  if (instance.disposeFullscreen) {
    try { instance.disposeFullscreen(); } catch (e) { /* ignore */ }
  }
}

function lockOrbitMouseBindingsNoPan(app) {
  const controls = app?.controls;
  if (!controls || !(controls instanceof v3d.OrbitControls)) return;

  // Hard-disable panning
  controls.enablePan = false;

  // Remap mouse buttons so middle button is NOT pan
  // three.js/Verge3D constants are usually v3d.MOUSE.{ROTATE,DOLLY,PAN}
  const MOUSE = v3d.MOUSE || { ROTATE: 0, DOLLY: 1, PAN: 2 };

  if (controls.mouseButtons) {
    // Typical desired mapping:
    // LEFT: rotate, MIDDLE: dolly/zoom, RIGHT: rotate (or disable right-pan)
    controls.mouseButtons.LEFT = MOUSE.ROTATE;
    controls.mouseButtons.MIDDLE = MOUSE.DOLLY;

    // If you also want to prevent right-button pan:
    // set RIGHT to ROTATE (or leave as PAN if you like right-pan)
    controls.mouseButtons.RIGHT = MOUSE.ROTATE;
  }

  // Touch bindings can also pan (2-finger). Disable if needed:
  if (controls.touches) {
    const TOUCH = v3d.TOUCH || { ROTATE: 0, PAN: 1, DOLLY_PAN: 2, DOLLY_ROTATE: 3 };
    // Choose one:
    // - disable panning gestures by avoiding PAN / DOLLY_PAN modes
    controls.touches.ONE = TOUCH.ROTATE;
    controls.touches.TWO = TOUCH.DOLLY_ROTATE; // zoom + rotate, no pan
  }

  controls.update();
}

// =====================================================================
// === VERGE3D LIFECYCLE MANAGEMENT
// =====================================================================

let activeAppInstance = null;
let v3dLaunchToken = 0;

async function createApp({ containerId, fsButtonId = null, sceneURL, logicURL = '', launchToken }) {
  if (!sceneURL) {
    console.log('No scene URL specified');
    return null;
  }

  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Verge3D container not found: ${containerId}`);
    return null;
  }

  v3d.Cache.enabled = false;

  let PL = null;
  let PE = null;

  // IMPORTANT:
  // In Verge3D 4.11, `isJS/isXML` may return false if the URL has `?v=...`.
  // So we detect type using a clean URL, but load using a cache-busted URL.
  const logicURLClean = stripQueryHash(logicURL || '');
  const logicURLToLoad = logicURLClean ? addCacheBuster(logicURLClean, launchToken) : logicURLClean;

  if (v3d.AppUtils.isXML(logicURLClean)) {
    const PUZZLES_DIR = '/puzzles/';
    const logicURLJS = logicURLClean.match(/(.*)\.xml$/)[1] + '.js';
    const logicURLJSToLoad = addCacheBuster(logicURLJS, launchToken);
    PL = await new v3d.PuzzlesLoader().loadEditorWithLogic(PUZZLES_DIR, logicURLJSToLoad);
    PE = v3d.PE;
  } else if (v3d.AppUtils.isJS(logicURLClean)) {
    PL = await new v3d.PuzzlesLoader().loadLogic(logicURLToLoad);
  }

  let initOptions = { useFullscreen: true };
  if (PL) {
    initOptions = PL.execInitPuzzles({ container: containerId }).initOptions;
  }

  const finalSceneURL = initOptions.useCompAssets ? `${sceneURL}.xz` : sceneURL;

  const disposeFullscreen = prepareFullscreen(containerId, fsButtonId, initOptions.useFullscreen);
  const preloader = createPreloader(containerId, initOptions, PE);
  const app = createAppInstance(containerId, initOptions, preloader, PE);

  if (initOptions.preloaderStartCb) initOptions.preloaderStartCb();

  const loaded = await new Promise((resolve, reject) => {
    app.loadScene(
      finalSceneURL,
      () => resolve(true),
      null,
      () => reject(new Error(`Can't load the scene ${finalSceneURL}`))
    );
  }).catch(err => {
    console.error(err);
    return false;
  });

  // If another overlay launch happened while this one was loading, dispose immediately
  if (launchToken !== v3dLaunchToken) {
    try { disposeVerge3DInstance({ app, PL, PE, disposeFullscreen }); } catch (e) { /* ignore */ }
    return null;
  }

  if (!loaded) {
    try { disposeVerge3DInstance({ app, PL, PE, disposeFullscreen }); } catch (e) { /* ignore */ }
    return null;
  }

  // Make sure Puzzles can find camera "Camera" and enableControls won't crash
  ensureNamedCamera(app);

  // Create controls via Verge3D
  try { app.enableControls(); } catch (e) { console.error(e); }
  lockOrbitMouseBindingsNoPan(app);

  // Ensure we end up with OrbitControls and rotation is allowed
  ensureOrbitControls(app);

  // Start render loop
  try { app.run(); } catch (e) { console.error(e); }

  if (PE) PE.updateAppInstance(app);

  // Init puzzles AFTER app is running
  if (PL) {
    try { PL.init(app, initOptions); } catch (e) { console.error(e); }
  }
  lockOrbitMouseBindingsNoPan(app);

  // Puzzles may call enableControls again; re-ensure orbit controls
  ensureOrbitControls(app);
  

  // Apply min/max distance from scene camera "Camera" onto the live OrbitControls
  applyOrbitLimitsFromNamedCamera(app);

  // Also apply once more shortly after init (covers async puzzle changes in some setups)
  window.setTimeout(() => {
    if (launchToken !== v3dLaunchToken) return;
    ensureOrbitControls(app);
    applyOrbitLimitsFromNamedCamera(app);
  }, 250);

  removeSpecificElement();

  requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));

  return { app, PL, PE, disposeFullscreen };
}

async function openOverlay(ship_path) {

  const instruct_element = document.getElementById('shroud_instruct');

  v3dLaunchToken += 1;
  const launchToken = v3dLaunchToken;

  if (activeAppInstance) {
    closeOverlayAndDisposeApp({ keepOverlayOpen: true });
  }

  const shroud = document.getElementById('calendar-shroud');
  if (shroud) shroud.style.display = 'block';

  const overlay_ship = document.getElementById('overlay_ship');

  if (overlay_ship) {
    overlay_ship.style.display = 'block';

    requestAnimationFrame(() => {
      overlay_ship.style.opacity = '1';
      hideCalendarHoverLabel();
      instruct_fadeIn_fadeOut(instruct_element);
      window.dispatchEvent(new Event('resize'));
    });
  }

  const sceneURL = normalizeGlbSceneURL(ship_path);

  const params = v3d.AppUtils.getPageParams();
  const logicURL = params.logic || 'app/visual_logic.js';

  try {
    const result = await createApp({
      containerId: 'v3d-container',
      fsButtonId: 'fullscreen-button',
      sceneURL: sceneURL,
      logicURL: logicURL,
      launchToken: launchToken,
    });

    if (launchToken !== v3dLaunchToken) {
      if (result && result.app) disposeVerge3DInstance(result);
      return;
    }

    if (result && result.app) {
      activeAppInstance = {
        app: result.app,
        PL: result.PL,
        PE: result.PE,
        disposeFullscreen: result.disposeFullscreen
      };
      setupCloseOverlayListener();
    } else {
      const shroudNow = document.getElementById('calendar-shroud');
      if (shroudNow) shroudNow.style.display = 'none';
    }
  } catch (err) {
    console.error(err);
    const shroudNow = document.getElementById('calendar-shroud');
    if (shroudNow) shroudNow.style.display = 'none';
  }
}

function instruct_fadeIn_fadeOut (element) {
   setTimeout(() => {
        // Fade in
        element.style.opacity = 1;

        setTimeout(() => {
            // Fade out after 7 seconds
            element.style.opacity = 0;
        }, 7000); // 7 seconds
    }, 2000); // 2 seconds
}

function closeOverlayAndDisposeApp({ keepOverlayOpen = false } = {}) {
  safeFullscreenExit();

  if (activeAppInstance && activeAppInstance.app) {
    disposeVerge3DInstance(activeAppInstance);
  }

  activeAppInstance = null;

  const container = document.getElementById('v3d-container');
  if (container) container.innerHTML = '';

  const overlay_ship = document.getElementById('overlay_ship');
  if (overlay_ship && !keepOverlayOpen) {
    overlay_ship.style.opacity = '0';
    setTimeout(() => {
      overlay_ship.style.display = 'none';
    }, 300);
  }

  const shroud = document.getElementById('calendar-shroud');
  if (shroud) shroud.style.display = 'none';
}

function setupCloseOverlayListener() {
  const button_closeoverlay = document.getElementById('closeOverlay');

  if (button_closeoverlay) {
    button_closeoverlay.onclick = () => closeOverlayAndDisposeApp();
  } else {
    console.error("Error: Could not find element with ID 'closeOverlay'.");
  }
}

// =====================================================================
// === CALENDAR/BOOK FUNCTIONS (UNCHANGED) ===
// =====================================================================

function drawChart(json_obj) {

  const years = new Set();
  json_obj.forEach(item => {
      if (item.date) {
          years.add(new Date(item.date).getFullYear());
      }
  });
  const numberOfYears = years.size;
  if (numberOfYears === 0) {
      console.warn('No data found to draw calendar chart.');
      return;
  }

  var width = document.documentElement.clientWidth;

  var dataTable = new google.visualization.DataTable();

  dataTable.addColumn({ type: 'date', id: 'Date' });
  dataTable.addColumn({ type: 'number', id: 'Capture' });
  dataTable.addColumn({ type: 'string', role: 'tooltip', p: { html: true } });
  dataTable.addColumn({ type: 'string', role: 'annotation' });

  for (let x in json_obj) {
    let d = new Date(json_obj[x].date);
    let date_options = {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',  hour: 'numeric', minute: 'numeric'};
    let date_ = d.toLocaleDateString('en-us', date_options);
    let number__ = parseInt(d.getDate());
    let number_mod = number__.addSuffix();
    let date_mod = date_.replace(number__, number_mod);

    let tooltipHTML = `<div style="padding: 8px 12px; white-space: nowrap;">
        <strong>${date_mod}</strong>
    </div>`;

    dataTable.addRows([
      [new Date(Date.parse(json_obj[x].date)), 1, tooltipHTML,
        createCustomHTMLContent(json_obj[x].img, date_mod, json_obj[x].name, json_obj[x].verse)]
    ]);
  }

  var chart = new google.visualization.Calendar(document.getElementById('calendar_basic'));

  let cellSize_ = width/56;

  const CALENDAR_HEIGHT_MULTIPLIER = 8.7;
  const underYearSpace = 12;

  const heightPerYearBlock = (CALENDAR_HEIGHT_MULTIPLIER * cellSize_) + underYearSpace;
  var estimatedHeight = (numberOfYears * heightPerYearBlock) + 20;

  var options = {

    legend: 'none',
    title: '',
    focusTarget: 'none',
    height: estimatedHeight,
    width: width,

    colorAxis: {
      colors:['#A3A2A1','#A3A2A1'],
      values: [1,0]
    },

    tooltip: { isHtml: true },

    noDataPattern: {
      backgroundColor: '#161B26',
      color:  '#161B26'
    },

    calendar: {
      backgroundColor:'black',
      cellSize: cellSize_,
      daysOfWeek: 'smtwtfs',
      underYearSpace: underYearSpace,
      dayOfWeekRightSpace: width/150,
      dayOfWeekLeftSpace: width/120,
      underMonthSpace: 10,

      monthOutlineColor: {
        stroke: '#080e1a',
        strokeOpacity: 1,
        strokeWidth: 1
      },

      unusedMonthOutlineColor: {
        stroke: '#080e1a',
        strokeOpacity: 1,
        strokeWidth: 2
      },

      focusedCellColor: {
        stroke: '#8cc0d0ff',
        strokeOpacity: 1,
        strokeWidth: 0
      },

      cellColor: {
        stroke: '#080e1a',
        strokeOpacity: 0,
        strokeWidth: cellSize_/3.5
      },

      dayOfWeekLabel: {
        fontName: 'Courier New',
        color: '#D1CDCA',
        bold: true,
        italic: false,
      },

      monthLabel: {
        fontName: 'Courier New',
        color: '#D1CDCA',
        bold: true,
        italic: false
      },

      yearLabel: {
        fontName: 'Courier New',
        fontSize: width/70,
        color: '#D1CDCA',
        bold: true,
        italic: false
      }
    }
  };

  google.visualization.events.addListener(chart, 'ready', function () {
    $($('#calendar_basic text')[0]).hide();
    $($('#calendar_basic text')[1]).hide();
    $($('#calendar_basic text')[2]).hide();
    $('#calendar_basic linearGradient').hide();
    $('#calendar_basic')
      .find('[fill-opacity="1"]').hide();
  });

  chart.draw(dataTable, options);

  google.visualization.events.addListener(chart, 'select', () => {
    let sel = chart.getSelection();
    if (!sel.length) return;

    let row = sel[0].row;
    if (row == null) return;

    if (json_obj[row] && json_obj[row].ship) {
      openOverlay(json_obj[row].ship);
      return;
    }

    let html = dataTable.getValue(row, 3);
    if (html) {
      openOverlay_regular(html);
    }
  });

}

Number.prototype.addSuffix = function() {
  var n = this.toString().split('.')[0];
  var lastDigits = n.substring(n.length - 2);
  if(lastDigits==='11' || lastDigits==='12' || lastDigits==='13'){
      return this+'<sup>th</sup>';
  }
  switch(n.substring(n.length - 1)) {
      case '1': return this+'<sup>st</sup>';
      case '2': return this+'<sup>nd</sup>';
      case '3': return this+'<sup>rd</sup>';
      default : return this+'<sup>th</sup>';
  }
};

function fadeOut(element) {
  element.style.opacity = '0';
  setTimeout(() => {
      element.style.display = 'none';
  }, 500);
}

function createCustomHTMLContent(imgURL, event_time, event, verse) {
  return '<div class="container">' +
    '<div class="image">' + '<img src="' + imgURL + '">' +
    '</div>' +
      '<div class="text">'+'<p>'+verse+'</p>'+'<p id="event_">'+'Sky object '+event+'<br/>'+event_time+'</p>'+
      '</div>' +
  '</div>';
}

function removeSpecificElement() {
  if (document.querySelector('a[href="https://www.soft8soft.com/verge3d-trial/"]')) {
    var element = document.querySelector('a[href="https://www.soft8soft.com/verge3d-trial/"]');
    element.parentNode.removeChild(element);
    element.classList.remove('hidden-by-script');
    return;
  }
}

function openOverlay_regular(html) {
  const overlay = document.getElementById('overlay_regular');
  const content = document.getElementById('overlay_regular_content');

  if (!overlay || !content) {
    console.error('Overlay elements not found in openOverlay_regular.');
    return;
  }

  content.innerHTML = html;

  overlay.style.display = 'block';
  requestAnimationFrame(() => {
    overlay.style.opacity = '1';
    hideCalendarHoverLabel();
  });

  content.onmouseleave = null;

  content.addEventListener('mouseleave', () => {
    overlay.style.opacity = '0';
    setTimeout(() => {
      overlay.style.display = 'none';
      showCalendarHoverLabel();
    }, 200);
  }, { once: true });
}

function hideCalendarHoverLabel() {
  const labels = document.querySelectorAll('#calendar_basic .google-visualization-tooltip');
  labels.forEach(el => {
    el.style.display = 'none';
  });
}

function showCalendarHoverLabel() {
  const labels = document.querySelectorAll('#calendar_basic .google-visualization-tooltip');
  labels.forEach(el => {
    el.style.display = '';
  });
}

window.addEventListener('resize', function (e) {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(function() {
      var chart = document.getElementById("calendar_basic");

      if (chart && chart.style.display !== "none" && global_json_data) {
          drawChart(global_json_data);
      }
  }, 250);
});

