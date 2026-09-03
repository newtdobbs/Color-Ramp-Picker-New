import { appState } from "./store";

export function setActiveWidget(activeWidget){
    appState.activeWidget = activeWidget;
}

export function setServiceInfo(serviceInfo){
    appState.serviceInfo = serviceInfo;
}

export function setLayerVisibility(visibility){
    appState.layer.visibility = visibility;
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

export function setDefaultValues(defaultValues){
    appState.defaultValues = defaultValues;
}

export function setDefaultStops(defaultStops){
    appState.defaultStops = defaultStops;
}

export function setLastCustomStops(lastCustomStops){
    appState.lastCustomStops = lastCustomStops;
}

export function setLastCustomValues(lastCustomValues){
    appState.lastCustomValues = lastCustomValues;
}

export function setSymbologyMode(symbologyMode){
    appState.symbologyMode = symbologyMode;
}

export function setDescription(description){
    appState.description = description;
}

export function setProfile(profile){
    appState.profile = profile;
}

export function setActiveSliderValue(activeValue){
    appState.activeSliderValue = activeValue;
}

export function setButtons(buttons){
    appState.buttons = buttons;
}

export function setOutliersMode(outlierSide, isSelected){
    appState.outliers[outlierSide] = isSelected ? "Visible" : "Hidden";
}

export function setInputItemID(inputItemID){
    appState.inputItemID = inputItemID;
}

export function setInflectionPoints(inflectionPoints){
    appState.inflectionPoints = inflectionPoints;
}

export function setAlternateLayerToCopy(alternateLayerToCopy){
    appState.alternateLayerToCopy = alternateLayerToCopy; 
}

export function clearStateForNewField(){
    setLayerSelection(null);
    setLayer(null);
    setField(null);
    setStats(null);
    setDescription(null);
    setSliderValues(null);
    setColorStops(null);
    setButtons(null);
    setDefaultValues(null);
    setDefaultStops(null);
    setLastCustomValues(null);
    setLastCustomStops(null);
    setSymbologyMode("Custom"); // custom is default
    setOutliersMode("low", "Visible")
    setOutliersMode("high", "Visible")
    setInflectionPoints(null);
    setActiveSliderValue(null);
    setProfile("");
}