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

export function clearStateForNewField(){
    // appState.
}