// Single startup entry for Safari/iPhone.
// Keep the runtime patches ahead of main.js, but make them static dependencies of one Vite entry
// so mobile startup does not depend on three separate top-level dynamic-import requests.
import './runtime/MobileVehicleHandling.js';
import './runtime/ProgressionQAMode.js';
import './runtime/WaterfrontVisualHotfix.js';
import './main.js';
