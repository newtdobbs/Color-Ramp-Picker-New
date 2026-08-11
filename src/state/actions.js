import * as ui from "../modules/ui";
import { appState } from "./store";

export function setActiveWidget(activeWidget){
    appState.activeWidget = activeWidget;
}

export function setInputItemID(inputItemID){
    appState.inputItemID = inputItemID;
}

export function setServiceInfo(serviceInfo){
    appState.serviceInfo = serviceInfo;
}

export function setLayerSelection(layerSelection){
    appState.layerSelection = layerSelection;
}

export function setLayer(layer){
    appState.layer = layer;
}

export function setField(field){
    appState.field = field;
}

export function setStats(stats){
    appState.stats = stats;
}

export function setSliderValues(sliderValues){
    appState.sliderValues = sliderValues;
}

export function setColorStops(colorStops){
    appState.colorStops = colorStops;
}

export function setDefaultStops(defaultStops){
    appState.defaultStops = defaultStops;
}

export function setLastCustomStops(lastCustomStops){
    appState.lastCustomStops = lastCustomStops;
}

export function setSymbologyMode(symbologyMode){
    appState.symbologyMode = symbologyMode;
}

export function resetFieldState(){
    appState.field = null;
    appState.stats = null;
    appState.description = null;
    appState.fieldsList = null;
}

export function setActiveSliderValue(activeValue){
    appState.activeSliderValue = activeValue;
}

export function resetRampState(){
    appState.sliderValues = null;
    appState.colorStops = null;
    appState.buttons = [];
    appState.defaultValues = null;
    appState.defaultStops = null;
    appState.lastCustomValues = null;
    appState.lastCustomStops = null;
    appState.activeSliderValue = null;
    appState.colorHistory = [];
    appState.symbologyMode = "Custom";

    if (ui.description) {
        ui.description.textContent = "";
    }
    if (ui.swatch) {
        ui.swatch.innerHTML = "";
        ui.swatch.style.background = "";
    }
    if (ui.resetButton) {
        ui.resetButton.disabled = true;
        ui.resetButton.textContent = "Default";
        ui.resetButton.label = "Default";
    }
    if (ui.jsonCopy) {
        ui.jsonCopy.disabled = true;
    }
    if (ui.histogramElement) {
        ui.histogramElement.colorStops = [];
        ui.histogramElement.bins = [];
    }
} 

export function resetAppState(){
    appState.stats = null;
    appState.description = null;
    appState.sliderValues = null;
    appState.colorStops = null;
    appState.buttons = [];
    appState.switchValue = "static";
    appState.defaultValues = null;
    appState.defaultStops = null;
    appState.lastCustomStops = [];
    appState.lastCustomValues = [];
    appState.offsetBase = null
    appState.symbologyMode = "Custom"
    appState.outliersVisibility = "Hide Outliers"
    appState.inflectionPoints = null 
    ui.resetButton.textContent = "Default";
    ui.resetButton.label = "Default";
}