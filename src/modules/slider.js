import * as ui from "./ui";
import { appState } from "../state/store";
import * as hf from "../helperFunctions";
import { hideAddStopButtons, showAddStopButtons } from "./renderButtons";
import { updateRampUI } from "../app/rampWorkflow";

function handleActiveSliderThumb() {
    appState.activeSliderValue = ui.sliderElement.activeValue;
}

// Role: slider behavior and stop-index integrity.
export function attachSliderListeners(){
    // reattaching event listeners
    ui.sliderElement.addEventListener("arcgisInput", hideAddStopButtons); // fires when a slider is clicked/dragged
    ui.sliderElement.addEventListener("arcgisInput", sliderHandler);
    ui.sliderElement.addEventListener("arcgisChange", showAddStopButtons); // fires when a slider is released
    ui.sliderElement.addEventListener("arcgisActiveValueChange",  handleActiveSliderThumb)
}

export function detachSliderListeners(){
    // Remove any existing listeners to avoid duplicates
    ui.sliderElement.removeEventListener("arcgisChange", sliderHandler);
    ui.sliderElement.removeEventListener("arcgisInput", sliderHandler);
    ui.sliderElement.removeEventListener("arcgisInput", hideAddStopButtons);
    ui.sliderElement.removeEventListener("arcgisChange", showAddStopButtons); 
    ui.sliderElement.removeEventListener("arcgisActiveValueChange", handleActiveSliderThumb) // changing the selected slider thumb
}

export function syncStopsFromSlider(){
    appState.sliderValues = [...ui.sliderElement.values];
    if (!Array.isArray(appState.colorStops)) {
        appState.colorStops = appState.sliderValues.map(value => ({ color: [0, 0, 0], value }));
        return;
    }

    appState.colorStops = appState.sliderValues.map((value, index) => {
        const existing = appState.colorStops[Math.min(index, appState.colorStops.length - 1)];
        const color = existing && Array.isArray(existing.color) ? [...existing.color] : [0, 0, 0];
        return { color, value };
    });
}

export function addStopAtValue(newValue){
    if (typeof newValue !== "number" || Number.isNaN(newValue)) {
        return false;
    }

    const values = [...(appState.sliderValues || [])];
    const stops = [...(appState.colorStops || [])];
    if (!values.length || stops.length < 2) {
        return false;
    }

    let insertIndex = values.findIndex(value => value > newValue);
    if (insertIndex === -1) {
        insertIndex = values.length;
    }

    const lowerStop = stops[Math.max(0, insertIndex - 1)] || stops[0];
    const upperStop = stops[Math.min(insertIndex, stops.length - 1)] || stops[stops.length - 1];
    const denom = (upperStop.value - lowerStop.value) || 1;
    const fraction = (newValue - lowerStop.value) / denom;
    const color = [
        Math.round(lowerStop.color[0] + fraction * (upperStop.color[0] - lowerStop.color[0])),
        Math.round(lowerStop.color[1] + fraction * (upperStop.color[1] - lowerStop.color[1])),
        Math.round(lowerStop.color[2] + fraction * (upperStop.color[2] - lowerStop.color[2]))
    ];

    values.splice(insertIndex, 0, newValue);
    stops.splice(insertIndex, 0, { color, value: newValue });

    appState.sliderValues = values;
    appState.colorStops = stops;
    ui.sliderElement.values = [...values];
    updateRampUI();
    return true;
}

export function removeSliderStop(){
    
    //  removing a slider
    ui.sliderElement.addEventListener('contextmenu', (event) => {
        // 1. Prevent the default browser context menu from appearing
        event.preventDefault(); 
    
        if (typeof ui.sliderElement.activeValue === "number") {
            if (ui.sliderElement.values.length == 2){
                hf.warnUser('Must have at least 2 sliders before removing one')
            } else {
                // determining WHICH slider handle to remove
                let removeIndex = ui.sliderElement.values.findIndex(value => value === ui.sliderElement.activeValue);
    
                // // Building new arrays.
                const nextSliderValues = [...appState.sliderValues]; // copying the slidervalues
                nextSliderValues.splice(removeIndex, 1); // and removing the right-clicked slider
    
                const nextColorStops = [...appState.colorStops];
                nextColorStops.splice(removeIndex, 1); // and removing the right-clicked slider
    
                appState.sliderValues = nextSliderValues;
                appState.colorStops = nextColorStops;
    
                // then updating DOM elements form the state 
                ui.sliderElement.values = [...nextSliderValues];
                ui.histogramElement.colorStops = [...nextColorStops];
    
                // updating UI
                updateUI();
    
            }
    
        }
    });
}

export function removeActiveStop(){
    const removeIndex = getActiveStopIndex();
    if (removeIndex === -1) {
        return false;
    }

    if (appState.sliderValues.length <= 2) {
        hf.warnUser("Must have at least 2 sliders before removing one");
        return false;
    }

    appState.sliderValues = appState.sliderValues.filter((_, index) => index !== removeIndex);
    appState.colorStops = appState.colorStops.filter((_, index) => index !== removeIndex);
    ui.sliderElement.values = [...appState.sliderValues];
    ui.histogramElement.colorStops = [...appState.colorStops];
    updateRampUI();
    return true;
}
export function getActiveStopIndex(){
    const activeValue = ui.sliderElement.activeValue;
    if (typeof activeValue !== "number") {
        return -1;
    }
    return (appState.sliderValues || []).findIndex(value => value === activeValue);
}

export function sliderHandler() {
    // if a slider moves, we'll provide the option to reset defaults
    // console.log(`Current state of reset is ${resetButton.textContent}`) // log for debug

    syncStopsFromSlider();
    // appState.sliderValues = [...ui.sliderElement.values]; // updating the global state so we can just pull from there 

    // finally calling updateUI, which should only be using state variables
    updateRampUI(); 

    // updating the last custom stops to use the current slider values
    appState.lastCustomValues = [...appState.sliderValues];
    appState.lastCustomStops = [...appState.colorStops];
}
