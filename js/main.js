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
    // Store data globally for use in the resize handler
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
 * Your GLBs are stored in `app/glb/`.
 * Your JSON currently provides paths like `app/the_name.glb`.
 * This function forces loading from `app/glb/<fileName>.glb` regardless of input path.
 */
function normalizeGlbSceneURL(nameOrPath) {
  if (!nameOrPath || typeof nameOrPath !== 'string') return '';

  // strip query/hash
  const raw = nameOrPath.trim().split('#')[0].split('?')[0].replaceAll('\\', '/');

  // take basename (last path segment)
  const parts = raw.split('/');
  let base = parts[parts.length - 1] || '';

  // if user passed just a name without extension, assume .glb
  if (base && !/\.(glb|gltf)$/i.test(base)) {
    base += '.glb';
  }

  // Force to app/glb/
  if (base) {
    return `app/glb/${base}`;
  }

  return '';
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

  if (!fsButton) {
    return null;
  }
  if (!useFullscreen) {
    fsButton.style.display = 'none';
    return null;
  }

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
    fsButton.classList.add(elem ? 'fullscreen-close' : 'fullscreen-open');
    fsButton.classList.remove(elem ? 'fullscreen-open' : 'fullscreen-close');

    // Update the visibility of the closeOverlay button
    const button = document.getElementById('closeOverlay');
    if (button) {
      button.style.display = elem ? 'none' : 'block';
    }

    // Manually trigger resize event
    window.dispatchEvent(new Event('resize'));
  };

  function fsButtonClick(event) {
    const button = document.getElementById('closeOverlay');
    event.stopPropagation();

    if (!container) return;

    if (fsElement()) {
      if (button) button.style.display = 'block';
      exitFs();
    } else {
      if (button) button.style.display = 'none';
      requestFs(container);
    }

    window.dispatchEvent(new Event('resize'));
  }

  if (fsEnabled()) {
    fsButton.style.display = 'inline';
  } else {
    const button = document.getElementById('closeOverlay');
    if (button) button.style.display = 'block';
  }

  fsButton.addEventListener('click', fsButtonClick);
  document.addEventListener('webkitfullscreenchange', changeFs);
  document.addEventListener('mozfullscreenchange', changeFs);
  document.addEventListener('msfullscreenchange', changeFs);
  document.addEventListener('fullscreenchange', changeFs);

  const disposeFullscreen = () => {
    fsButton.removeEventListener('click', fsButtonClick);
    document.removeEventListener('webkitfullscreenchange', changeFs);
    document.removeEventListener('mozfullscreenchange', changeFs);
    document.removeEventListener('msfullscreenchange', changeFs);
    document.removeEventListener('fullscreenchange', changeFs);
  };

  return disposeFullscreen;
}

function prepareExternalInterface(app) {
  // Keep empty unless you use ExternalInterface from Puzzles
}

function createCustomPreloader(updateCb, finishCb) {
  class CustomPreloader extends v3d.Preloader {
    constructor() {
      super();
    }
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
    if (app.renderer) {
      app.renderer.setClearColor(0x000000, 0);
    }
  }

  app.ExternalInterface = {};
  prepareExternalInterface(app);
  if (PE) PE.viewportUseAppInstance(app);

  return app;
}

/**
 * Create a "camera.controlSettings" object compatible with Verge3D's internal
 * `App.enableControls()` (it expects `assignToControls()` to exist).
 *
 * This fixes:
 * `TypeError: e.controlSettings.assignToControls is not a function`
 */
function createOrbitControlSettings() {
  return {
    type: 'ORBIT',

    // defaults (Puzzles will overwrite via setCameraParam)
    enablePan: false,
    enableZoom: true,
    enableCtrlZoom: true,
    enableKeys: false,

    rotateSpeed: 1.0,

    orbitMinDistance: 1.5,
    orbitMaxDistance: 10,

    // radians
    orbitMinPolarAngle: 0,
    orbitMaxPolarAngle: Math.PI,
    orbitMinAzimuthAngle: -Infinity,
    orbitMaxAzimuthAngle: Infinity,

    orbitEnableTurnover: false,
    screenSpacePanning: false,

    // Verge3D calls this from enableControls()
    assignToControls: function(controls) {
      if (!controls) return;

      // OrbitControls standard props
      if ('enablePan' in controls) controls.enablePan = !!this.enablePan;
      if ('enableZoom' in controls) controls.enableZoom = !!this.enableZoom;

      // v3d OrbitControls supports these like three.js
      if ('minDistance' in controls) controls.minDistance = this.orbitMinDistance;
      if ('maxDistance' in controls) controls.maxDistance = this.orbitMaxDistance;

      if ('minPolarAngle' in controls) controls.minPolarAngle = this.orbitMinPolarAngle;
      if ('maxPolarAngle' in controls) controls.maxPolarAngle = this.orbitMaxPolarAngle;

      if ('minAzimuthAngle' in controls) controls.minAzimuthAngle = this.orbitMinAzimuthAngle;
      if ('maxAzimuthAngle' in controls) controls.maxAzimuthAngle = this.orbitMaxAzimuthAngle;

      if ('screenSpacePanning' in controls) controls.screenSpacePanning = !!this.screenSpacePanning;

      if ('rotateSpeed' in controls) controls.rotateSpeed = this.rotateSpeed;
      if ('enableKeys' in controls) controls.enableKeys = !!this.enableKeys;

      // optional: some builds support ctrl zoom separately
      if ('enableCtrlZoom' in controls) controls.enableCtrlZoom = !!this.enableCtrlZoom;
    }
  };
}

/**
 * Ensure a camera named "Camera" exists in the scene graph, because your Puzzles
 * refer to "Camera" explicitly.
 *
 * IMPORTANT: we do NOT create an arbitrary camera with a plain object for controlSettings.
 * We either reuse the app's default camera, or create a camera and attach a compatible
 * controlSettings object with `assignToControls()`.
 */
function ensureNamedCamera(app) {
  if (!app || !app.scene) return null;

  // If there is already a camera named "Camera" in scene, use it.
  let cam = app.scene.getObjectByName('Camera');
  if (cam && cam.isCamera) {
    // Patch missing controlSettings if needed
    if (!cam.controlSettings || typeof cam.controlSettings.assignToControls !== 'function') {
      cam.controlSettings = createOrbitControlSettings();
    }
    return cam;
  }

  // Try to find any camera already in the scene
  let anySceneCam = null;
  app.scene.traverse(obj => {
    if (!anySceneCam && obj && obj.isCamera) anySceneCam = obj;
  });

  // Or take the app's default camera (often not in the scene graph)
  const defaultCam = (typeof app.getCamera === 'function') ? app.getCamera(true) : null;
  cam = anySceneCam || defaultCam;

  // Last resort: create one
  if (!cam) {
    cam = new v3d.PerspectiveCamera(45, 1, 0.1, 1000);
    cam.position.set(0, 0, 6);
    cam.lookAt(0, 0, 0);
  }

  cam.name = 'Camera';

  // Ensure it's reachable by PzLib.getObjectByName (scene traversal)
  if (!cam.parent) {
    app.scene.add(cam);
  }

  // Ensure controls settings are compatible with enableControls()
  if (!cam.controlSettings || typeof cam.controlSettings.assignToControls !== 'function') {
    cam.controlSettings = createOrbitControlSettings();
  }

  // Now safe to set as active camera (Puzzles will call setActiveCamera('Camera'))
  if (typeof app.setCamera === 'function') {
    try {
      app.setCamera(cam);
    } catch (e) {
      console.error(e);
    }
  }

  return cam;
}

/**
 * Force OrbitControls if for some reason a different controls type was created.
 * This is needed for your Puzzles "autorotate camera" which checks OrbitControls.
 */
function ensureOrbitControls(app) {
  if (!app) return;

  const camera = (typeof app.getCamera === 'function') ? app.getCamera(true) : null;
  const dom = app.renderer && app.renderer.domElement ? app.renderer.domElement : null;
  if (!camera || !dom) return;

  if (app.controls && (app.controls instanceof v3d.OrbitControls)) return;

  if (app.controls && typeof app.controls.dispose === 'function') {
    try { app.controls.dispose(); } catch (e) { /* ignore */ }
  }

  app.controls = new v3d.OrbitControls(camera, dom);
  app.controls.enableDamping = true;
  app.controls.dampingFactor = 0.08;
  app.controls.enablePan = false;
  app.controls.enableZoom = true;
}

/**
 * Robustly disposes a Verge3D app instance (renderer/context, controls, puzzles listeners).
 */
function disposeVerge3DInstance(instance) {
  if (!instance || !instance.app) return;

  // Dispose puzzles first to remove DOM/canvas listeners
  if (instance.PL && typeof instance.PL.dispose === 'function') {
    try { instance.PL.dispose(); } catch (e) { /* ignore */ }
  }

  // Dispose controls
  if (instance.app.controls && typeof instance.app.controls.dispose === 'function') {
    console.log('Disposing Verge3D controls...');
    try { instance.app.controls.dispose(); } catch (e) { /* ignore */ }
  }

  // Dispose renderer and force context loss (helps repeated launches)
  if (instance.app.renderer) {
    try { instance.app.renderer.dispose(); } catch (e) { /* ignore */ }
    if (typeof instance.app.renderer.forceContextLoss === 'function') {
      try { instance.app.renderer.forceContextLoss(); } catch (e) { /* ignore */ }
    }
  }

  // Dispose app
  try { instance.app.dispose(); } catch (e) { /* ignore */ }

  // Remove fullscreen listeners
  if (instance.disposeFullscreen) {
    try { instance.disposeFullscreen(); } catch (e) { /* ignore */ }
  }

  console.log('Verge3D application disposed successfully.');
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

  if (v3d.AppUtils.isXML(logicURL)) {
    const PUZZLES_DIR = '/puzzles/';
    const logicURLJS = logicURL.match(/(.*)\.xml$/)[1] + '.js';
    PL = await new v3d.PuzzlesLoader().loadEditorWithLogic(PUZZLES_DIR, logicURLJS);
    PE = v3d.PE;
  } else if (v3d.AppUtils.isJS(logicURL)) {
    PL = await new v3d.PuzzlesLoader().loadLogic(logicURL);
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

  // Load scene as a Promise to avoid race conditions on re-open
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

  // Ensure Puzzles can find a camera named "Camera" and enableControls() won't crash
  ensureNamedCamera(app);

  // Enable engine controls (now safe because camera has compatible controlSettings)
  try { app.enableControls(); } catch (e) { console.error(e); }

  // Ensure OrbitControls for auto-rotate puzzle
  ensureOrbitControls(app);

  // Run app
  try { app.run(); } catch (e) { console.error(e); }

  if (PE) PE.updateAppInstance(app);

  // Init Puzzles AFTER renderer/camera/controls exist
  if (PL) {
    try { PL.init(app, initOptions); } catch (e) { console.error(e); }
  }

  // Puzzles can still re-enable controls; enforce OrbitControls again
  ensureOrbitControls(app);

  removeSpecificElement();

  requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));

  return { app, PL, PE, disposeFullscreen };
}

async function openOverlay(ship_path) {
  v3dLaunchToken += 1;
  const launchToken = v3dLaunchToken;

  // Dispose previous app instance before starting a new one
  if (activeAppInstance) {
    closeOverlayAndDisposeApp({ keepOverlayOpen: true });
  }

  // ACTIVATE THE SHROUD
  const shroud = document.getElementById('calendar-shroud');
  if (shroud) shroud.style.display = 'block';

  const overlay_ship = document.getElementById('overlay_ship');

  if (overlay_ship) {
    overlay_ship.style.display = 'block';
    requestAnimationFrame(() => {
      overlay_ship.style.opacity = '1';
      hideCalendarHoverLabel();
      window.dispatchEvent(new Event('resize'));
    });
  }

  // Force loading from app/glb/
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
      // Failed -> remove shroud so page doesn't stay semi-opaque
      const shroudNow = document.getElementById('calendar-shroud');
      if (shroudNow) shroudNow.style.display = 'none';
    }
  } catch (err) {
    console.error(err);
    const shroudNow = document.getElementById('calendar-shroud');
    if (shroudNow) shroudNow.style.display = 'none';
  }
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
// === CALENDAR/BOOK FUNCTIONS (UNCHANGED)
// =====================================================================

function drawChart(json_obj) {

  // --- 1. Dynamic Height Calculation Logic ---

  // 1a. Count the unique years in the dataset
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
  // ---------------------------------------------

  var width = document.documentElement.clientWidth; // making chart responsive

  var dataTable = new google.visualization.DataTable();

  dataTable.addColumn({ type: 'date', id: 'Date' });
  dataTable.addColumn({ type: 'number', id: 'Capture' });
  dataTable.addColumn({ type: 'string', role: 'tooltip', p: { html: true } });
  dataTable.addColumn({ type: 'string', role: 'annotation' });


  // populate chart datatable
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

  let cellSize_ = width/56; // making chart responsive

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
