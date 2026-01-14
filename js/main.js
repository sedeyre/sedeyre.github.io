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
// === VERGE3D UTILITY FUNCTIONS ===
// =====================================================================

/**
 * Normalize GLB path to always load from app/glb/ directory
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
 * Setup fullscreen button handlers
 */
function prepareFullscreen(containerId, fsButtonId, useFullscreen) {
  const container = document.getElementById(containerId);
  const fsButton = document.getElementById(fsButtonId);

  if (!fsButton) return null;

  if (!useFullscreen) {
    fsButton.style.display = 'none';
    return null;
  }

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

    const closeX = document.getElementById('closeOverlay');
    if (closeX) closeX.style.display = elem ? 'none' : 'block';

    window.dispatchEvent(new Event('resize'));
  };

  function fsButtonClick(event) {
    event.stopPropagation();

    if (fsElement()) {
      closeOverlayAndDisposeApp();
      return;
    }

    if (fsTarget) {
      const closeX = document.getElementById('closeOverlay');
      if (closeX) closeX.style.display = 'none';
      requestFs(fsTarget);
    }
  }

  if (fsEnabled()) {
    fsButton.style.display = 'inline';
  } else {
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
// === CONTROL SETTINGS PATCHING ===
// =====================================================================

function toNum(v) {
  const n = (typeof v === 'string') ? parseFloat(v) : v;
  return (typeof n === 'number' && !Number.isNaN(n)) ? n : undefined;
}

/**
 * Creates controlSettings object with safe defaults and assignToControls method
 */
function patchOrbitControlSettings(existing = {}) {
  const cs = { ...existing };

  if (!cs.type) cs.type = 'ORBIT';

  if (cs.enableRotate === undefined) cs.enableRotate = true;
  if (cs.enablePan === undefined) cs.enablePan = false;
  if (cs.enableZoom === undefined) cs.enableZoom = true;
  if (cs.enableCtrlZoom === undefined) cs.enableCtrlZoom = true;
  if (cs.enableKeys === undefined) cs.enableKeys = false;
  if (cs.rotateSpeed === undefined) cs.rotateSpeed = 1.0;

  if (cs.orbitMinDistance === undefined && cs.orbitMinDistancePersp === undefined) cs.orbitMinDistance = 1.5;
  if (cs.orbitMaxDistance === undefined && cs.orbitMaxDistancePersp === undefined) cs.orbitMaxDistance = 10;

  if (cs.orbitMinPolarAngle === undefined) cs.orbitMinPolarAngle = 0;
  if (cs.orbitMaxPolarAngle === undefined) cs.orbitMaxPolarAngle = Math.PI;

  if (typeof cs.assignToControls !== 'function') {
    cs.assignToControls = function(controls) {
      if (!controls) return;

      if ('enableRotate' in controls) controls.enableRotate = !!cs.enableRotate;
      if ('enablePan' in controls) controls.enablePan = !!cs.enablePan;
      if ('enableZoom' in controls) controls.enableZoom = !!cs.enableZoom;
      if ('enableKeys' in controls) controls.enableKeys = !!cs.enableKeys;

      if ('rotateSpeed' in controls && toNum(cs.rotateSpeed) !== undefined) {
        controls.rotateSpeed = toNum(cs.rotateSpeed);
      }

      const minD = toNum(cs.orbitMinDistancePersp) ?? toNum(cs.orbitMinDistance);
      const maxD = toNum(cs.orbitMaxDistancePersp) ?? toNum(cs.orbitMaxDistance);

      if ('minDistance' in controls && minD !== undefined) controls.minDistance = minD;
      if ('maxDistance' in controls && maxD !== undefined) controls.maxDistance = maxD;

      const minP = toNum(cs.orbitMinPolarAngle);
      const maxP = toNum(cs.orbitMaxPolarAngle);
      if ('minPolarAngle' in controls && minP !== undefined) controls.minPolarAngle = minP;
      if ('maxPolarAngle' in controls && maxP !== undefined) controls.maxPolarAngle = maxP;

      const minA = toNum(cs.orbitMinAzimuthAngle);
      const maxA = toNum(cs.orbitMaxAzimuthAngle);
      if ('minAzimuthAngle' in controls && minA !== undefined) controls.minAzimuthAngle = minA;
      if ('maxAzimuthAngle' in controls && maxA !== undefined) controls.maxAzimuthAngle = maxA;

      if ('screenSpacePanning' in controls && cs.screenSpacePanning !== undefined) {
        controls.screenSpacePanning = !!cs.screenSpacePanning;
      }

      if ('enableCtrlZoom' in controls && cs.enableCtrlZoom !== undefined) {
        controls.enableCtrlZoom = !!cs.enableCtrlZoom;
      }
    };
  }

  return cs;
}

/**
 * Ensure a camera named "Camera" exists with proper controlSettings
 */
function ensureNamedCamera(app) {
  if (!app || !app.scene) return null;

  let cam = app.scene.getObjectByName('Camera');
  if (cam && cam.isCamera) {
    cam.controlSettings = patchOrbitControlSettings(cam.controlSettings || {});
    return cam;
  }

  let anySceneCam = null;
  app.scene.traverse(obj => {
    if (!anySceneCam && obj && obj.isCamera) anySceneCam = obj;
  });

  const defaultCam = (typeof app.getCamera === 'function') ? app.getCamera(true) : null;
  cam = anySceneCam || defaultCam;

  if (!cam) {
    cam = new v3d.PerspectiveCamera(45, 1, 0.1, 1000);
    cam.position.set(0, 0, 6);
    cam.lookAt(0, 0, 0);
  }

  cam.name = 'Camera';

  if (!cam.parent) app.scene.add(cam);

  cam.controlSettings = patchOrbitControlSettings(cam.controlSettings || {});

  if (typeof app.setCamera === 'function') {
    try { app.setCamera(cam); } catch (e) { console.error(e); }
  }

  return cam;
}

/**
 * Ensure OrbitControls exist and are properly configured
 */
function ensureOrbitControls(app) {
  if (!app) {
    console.warn('ensureOrbitControls: app is null');
    return false;
  }

  if (app.controls && (app.controls instanceof v3d.OrbitControls)) {
    if ('enableRotate' in app.controls) app.controls.enableRotate = true;
    return true;
  }

  const cam = (typeof app.getCamera === 'function') ? app.getCamera(true) : null;
  if (!cam) {
    console.warn('ensureOrbitControls: no camera available');
    return false;
  }

  if (!cam.controlSettings) {
    cam.controlSettings = patchOrbitControlSettings({});
  } else {
    cam.controlSettings = patchOrbitControlSettings(cam.controlSettings);
  }

  try {
    app.enableControls();
  } catch (e) {
    console.error('ensureOrbitControls: enableControls failed', e);
    return false;
  }

  if (app.controls && (app.controls instanceof v3d.OrbitControls)) {
    if ('enableRotate' in app.controls) app.controls.enableRotate = true;
    return true;
  }

  console.warn('ensureOrbitControls: controls not created or wrong type');
  return false;
}

/**
 * Apply orbit limits from camera.controlSettings to live OrbitControls
 */
function applyOrbitLimitsFromNamedCamera(app, camName = 'Camera') {
  if (!app || !app.scene) return;

  const controls = app.controls;
  if (!controls || !(controls instanceof v3d.OrbitControls)) return;

  const cam = app.scene.getObjectByName(camName);
  if (!cam || !cam.isCamera || !cam.controlSettings) return;

  cam.controlSettings = patchOrbitControlSettings(cam.controlSettings);

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
// === COMPLETE VERGE3D DISPOSAL ===
// =====================================================================

/**
 * COMPLETE disposal - PL.dispose() now handles timer cleanup
 */
function disposeVerge3DInstance(instance) {
  if (!instance || !instance.app) return;

  // 1. Stop render loop
  if (instance.app.frame) {
    try { instance.app.frame.dispose(); } catch (e) { /* ignore */ }
  }

  // 2. FULLY dispose puzzles (clears ALL tracked timers + sets _pGlob = null)
  if (instance.PL && typeof instance.PL.dispose === 'function') {
    try { 
      instance.PL.dispose(); // This clears all tracked timers!
    } catch (e) { 
      console.warn('PL.dispose error:', e); 
    }
  }

  // 3. Dispose controls
  if (instance.app.controls && typeof instance.app.controls.dispose === 'function') {
    try { instance.app.controls.dispose(); } catch (e) { /* ignore */ }
  }
  instance.app.controls = null;

  // 4. Dispose renderer
  if (instance.app.renderer) {
    try { instance.app.renderer.dispose(); } catch (e) { /* ignore */ }
    if (typeof instance.app.renderer.forceContextLoss === 'function') {
      try { instance.app.renderer.forceContextLoss(); } catch (e) { /* ignore */ }
    }
    instance.app.renderer = null;
  }

  // 5. Clear scene
  if (instance.app.scene) {
    instance.app.scene.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(mat => mat.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
  }

  // 6. Dispose app
  try { instance.app.dispose(); } catch (e) { /* ignore */ }

  // 7. Dispose fullscreen handler
  if (instance.disposeFullscreen) {
    try { instance.disposeFullscreen(); } catch (e) { /* ignore */ }
  }
}

/**
 * Lock orbit controls to prevent panning
 */
function lockOrbitMouseBindingsNoPan(app) {
  const controls = app?.controls;
  if (!controls || !(controls instanceof v3d.OrbitControls)) return;

  controls.enablePan = false;

  const MOUSE = v3d.MOUSE || { ROTATE: 0, DOLLY: 1, PAN: 2 };

  if (controls.mouseButtons) {
    controls.mouseButtons.LEFT = MOUSE.ROTATE;
    controls.mouseButtons.MIDDLE = MOUSE.DOLLY;
    controls.mouseButtons.RIGHT = MOUSE.ROTATE;
  }

  if (controls.touches) {
    const TOUCH = v3d.TOUCH || { ROTATE: 0, PAN: 1, DOLLY_PAN: 2, DOLLY_ROTATE: 3 };
    controls.touches.ONE = TOUCH.ROTATE;
    controls.touches.TWO = TOUCH.DOLLY_ROTATE;
  }

  controls.update();
}

// =====================================================================
// === VERGE3D LIFECYCLE MANAGEMENT ===
// =====================================================================

let activeAppInstance = null;
let v3dLaunchToken = 0;

/**
 * Create and initialize Verge3D app
 */
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

  // Force fresh module load
  v3d.Cache.enabled = false;

  let PL = null;
  let PE = null;

  // Cache-bust the logic URL
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

  // Check if superseded by newer launch
  if (launchToken !== v3dLaunchToken) {
    try { disposeVerge3DInstance({ app, PL, PE, disposeFullscreen }); } catch (e) { /* ignore */ }
    return null;
  }

  if (!loaded) {
    try { disposeVerge3DInstance({ app, PL, PE, disposeFullscreen }); } catch (e) { /* ignore */ }
    return null;
  }

  // Ensure camera exists
  ensureNamedCamera(app);
  
  // Wait for scene to settle
  await new Promise(resolve => setTimeout(resolve, 150));

  if (launchToken !== v3dLaunchToken) {
    try { disposeVerge3DInstance({ app, PL, PE, disposeFullscreen }); } catch (e) { /* ignore */ }
    return null;
  }

  // Create controls
  try { app.enableControls(); } catch (e) { console.error(e); }
  lockOrbitMouseBindingsNoPan(app);

  // Start render loop
  try { app.run(); } catch (e) { console.error(e); }

  if (PE) PE.updateAppInstance(app);

  // Wait for renderer/controls to stabilize
  await new Promise(resolve => setTimeout(resolve, 200));

  if (launchToken !== v3dLaunchToken) {
    try { disposeVerge3DInstance({ app, PL, PE, disposeFullscreen }); } catch (e) { /* ignore */ }
    return null;
  }

  // Init puzzles AFTER everything is ready
  if (PL) {
    try { 
      PL.init(app, initOptions); 
    } catch (e) { 
      console.error('PL.init failed:', e); 
    }
  }

  // Apply final overrides
  await new Promise(resolve => setTimeout(resolve, 100));
  
  if (launchToken !== v3dLaunchToken) {
    try { disposeVerge3DInstance({ app, PL, PE, disposeFullscreen }); } catch (e) { /* ignore */ }
    return null;
  }

  lockOrbitMouseBindingsNoPan(app);
  ensureOrbitControls(app);
  applyOrbitLimitsFromNamedCamera(app);

  removeSpecificElement();
  requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));

  return { app, PL, PE, disposeFullscreen };
}

/**
 * Open overlay and load Verge3D scene
 */
async function openOverlay(ship_path) {
  const instruct_element = document.getElementById('shroud_instruct');

  v3dLaunchToken += 1;
  const launchToken = v3dLaunchToken;

  if (activeAppInstance) {
    closeOverlayAndDisposeApp({ keepOverlayOpen: true });
    // Brief delay for disposal to complete
    await new Promise(resolve => setTimeout(resolve, 50));
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

function instruct_fadeIn_fadeOut(element) {
  setTimeout(() => {
    element.style.opacity = 1;
    setTimeout(() => {
      element.style.opacity = 0;
    }, 7000);
  }, 2000);
}

/**
 * Close overlay and completely dispose Verge3D instance
 */
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
// === CALENDAR/BOOK FUNCTIONS  ===
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

  let cellSize_ = width/56.5;

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

