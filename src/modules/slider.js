import * as ui from "./ui";
import { appState } from "../state/store";
import * as actions from "../state/actions"
import * as hf from "../helperFunctions";
import { hideAddStopButtons, showAddStopButtons } from "./renderButtons";
import { updateRampUI } from "../app/rampWorkflow";

let pendingActiveValueResetId = null;

function clearPendingActiveValueReset() {
    if (pendingActiveValueResetId !== null) {
        clearTimeout(pendingActiveValueResetId);
        pendingActiveValueResetId = null;
    }
}

function commitActiveSliderValue(value) {
    actions.setActiveSliderValue(value);
    appState.sliderActive = typeof value === "number";
}

function handleActiveSliderThumb() {
    const activeValue = ui.sliderElement.activeValue;

    if (typeof activeValue === "number") {
        clearPendingActiveValueReset();
        commitActiveSliderValue(activeValue);
        console.log("UI slider active value is:", activeValue);
        return;
    }

    // ArcGIS slider briefly reports undefined while handing off between thumbs.
    // Only treat undefined as a real deselection if it persists briefly.
    clearPendingActiveValueReset();
    pendingActiveValueResetId = setTimeout(() => {
        pendingActiveValueResetId = null;
        if (typeof ui.sliderElement.activeValue === "number") {
            commitActiveSliderValue(ui.sliderElement.activeValue);
            console.log("Recovered active slider value after transient undefined:", ui.sliderElement.activeValue);
            return;
        }

        commitActiveSliderValue(null);
        console.log("Slider thumb deselected; active value cleared.");
    }, 50);
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
    actions.setSliderValues([...ui.sliderElement.values]);
    if (!Array.isArray(appState.colorStops)) {
        actions.setColorStops(appState.sliderValues.map(value => ({ color: [0, 0, 0], value })));
        return;
    }

    actions.setColorStops(appState.sliderValues.map((value, index) => {
        const existing = appState.colorStops[Math.min(index, appState.colorStops.length - 1)];
        const color = existing && Array.isArray(existing.color) ? [...existing.color] : [0, 0, 0];
        return { color, value };
    }));
}

/**
 * 
 * @param {number} newValue the value at which to add the color stop
 * @param {color} newColor specfic color to use at the stop, by default will just interpolate surrounding stops 
 * @returns 
 */
export function addStopAtValue(newValue, newColor=null){
    // guard against erroneous input
    if (typeof newValue !== "number" || Number.isNaN(newValue)) {
        return false;
    }

    // if there's no slider values, or less than 2 color stops we don't do anything
    const values = [...(appState.sliderValues || [])];
    const stops = [...(appState.colorStops || [])];
    if (!values.length || stops.length < 2) {
        return false;
    }

    // determining WHERE to insert the new value
    let insertIndex = values.findIndex(value => value > newValue); // we find the slider thumb which was above the button that was clicked
    if (insertIndex === -1) { // if no slider values were greater than the button, we insert at the end using the .length as the index 
        insertIndex = values.length;
    }

    const lowerStop = stops[Math.max(0, insertIndex - 1)] || stops[0];
    const upperStop = stops[Math.min(insertIndex, stops.length - 1)] || stops[stops.length - 1];
    const denom = (upperStop.value - lowerStop.value) || 1;
    const fraction = (newValue - lowerStop.value) / denom; // the proportion of the new stop's location between lower and upper stop
    
    let color;
    if(newColor) { // if there is a color provided we'll use it
        color = newColor;
    }
    else { // otherwise we'll interpolate the new stop's color using the fraction
        color = [
            Math.round(lowerStop.color[0] + fraction * (upperStop.color[0] - lowerStop.color[0])),
            Math.round(lowerStop.color[1] + fraction * (upperStop.color[1] - lowerStop.color[1])),
            Math.round(lowerStop.color[2] + fraction * (upperStop.color[2] - lowerStop.color[2]))
        ];
    }

    values.splice(insertIndex, 0, newValue);
    stops.splice(insertIndex, 0, { color, value: newValue });

    actions.setSliderValues([...values])
    actions.setColorStops(stops);
    ui.sliderElement.values = [...values];
    updateRampUI();
    return true;
}

/**
 * 
 * @param {event} event the right click event 
 * @param {number} removeIndex 
 * @returns 
 */
export function sliderStopRemove(removeIndex=null){

    if (typeof ui.sliderElement.activeValue === "number") {
        // preventing user from removing a stop if theres only 2 sliders
        if (ui.sliderElement.values.length <= 2){
            hf.warnUser('Must have at least 2 sliders before removing one')
            return
        } else {
            // right click on yields no removeIndex 
            if (!removeIndex){
                ui.sliderElement.min = appState.sliderValues[1] // we'll reassign the slider UI element's min to the next stop up
                
            }
            // injecting black at the 0th index 
            // if (removeIndex === 0){
            //     ui.sliderElement.min =  
            // }
            
            // determining WHICH slider handle to remove
            if(removeIndex){
            } else{
                removeIndex = ui.sliderElement.values.findIndex(value => value === ui.sliderElement.activeValue);
            }
            
            // building new arrays
            const nextSliderValues = [...appState.sliderValues]; // copying the slidervalues
            nextSliderValues.splice(removeIndex, 1); // removing the right-clicked slider
            
            const nextColorStops = [...appState.colorStops];
            nextColorStops.splice(removeIndex, 1); // and removing stop associated with the right-clicked slider
            

            actions.setSliderValues(nextSliderValues);
            actions.setColorStops(nextColorStops);

            // then updating DOM elements form the state 
            ui.sliderElement.values = [...nextSliderValues];
            ui.histogramElement.colorStops = [...nextColorStops];

            // updating UI
            updateRampUI();

            // clearing the color picker
            ui.colorPicker.value = {
                'r': 255,
                'g': 255,
                'b': 255,
                'a': 1 
            }
        }
    }
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

    // finally calling updateRampUI, which should only be using state variables
    updateRampUI(); 

    // updating the last custom stops to use the current slider values
    actions.setLastCustomValues([...appState.sliderValues]);
    actions.setLastCustomStops([...appState.colorStops]);
}
