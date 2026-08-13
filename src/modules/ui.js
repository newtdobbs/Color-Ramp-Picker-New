/* 
DOM ELEMENTS
*/
export const mapContainer = document.getElementById("main-map")
export const panelEls = document.querySelectorAll("calcite-panel"); // this grabs all panels from the actionbar(layers, basemap, legend)
export const fieldBlock = document.getElementById("field-block"); // the panel for the service layers 
export const basemapGallery = document.querySelector("arcgis-basemap-gallery"); // the basemap gallery to bind it to the map view
export const inputBox = document.getElementById("input"); // the dialog box for users to type their input item ID
export const layerSelector = document.getElementById("layer-selector") // the dropdown for users to select a sublayer of the AGOL service
export const fieldsLabel = document.getElementById("fields-label");
export const generateButton = document.getElementById("generate-btn"); // the button that says 'Generate Histogram'
export const bottomShell = document.getElementById("bottom-shell"); // the bottom dialog, which is hidden by default
export const bottomPanel = document.getElementById("bottom-panel"); // the bottom dialog, which is hidden by default
export const rampBlock = document.getElementById("ramp-block");
export const description = document.getElementById("description")
export const desc = document.getElementById("dialog-description");
export const sliderElement = document.getElementById("color-slider");
export const swatch = document.getElementById("color-swatch");
export const histogramElement = document.getElementById("histogram");
// const updateSwitch = document.getElementById("update-switch");
export const resetButton = document.getElementById("reset-button");
export const lowOutliersChip = document.getElementById("low-outliers-chip");
export const highOutliersChip = document.getElementById("high-outliers-chip");
export const applyColorButton = document.getElementById("apply-button")
export const sliderStopDropdown = document.getElementById("slider-stop-dropdown")
export const jsonCopy = document.getElementById("copy-json");
export const colorPicker = document.getElementById("color-picker");
export const actionBar = document.getElementById("action-bar");
export const innerPanel = document.getElementById("inner-panel");