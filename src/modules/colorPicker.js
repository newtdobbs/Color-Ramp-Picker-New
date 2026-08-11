import * as ui from "./ui";
import { appState } from "../state/store";
import * as hf from "../helperFunctions";
import { sliderHandler } from "./slider";
import * as actions from "../state/actions"

// Role: color picker behavior.
export function attachColorPickerListener(){
    if (!ui.colorPicker || !ui.sliderElement) {
        return;
    }

    ui.colorPicker.removeEventListener("calciteColorPickerChange", applyPickerColorToActiveStop);
    ui.sliderElement.removeEventListener("arcgisActiveValueChange", syncPickerFromActiveStop);

    ui.colorPicker.addEventListener("calciteColorPickerChange", applyPickerColorToActiveStop);
    ui.sliderElement.addEventListener("arcgisActiveValueChange", syncPickerFromActiveStop);
}
export function syncPickerFromActiveStop(){
    const sliderFocus = ui.sliderElement.activeValue ? "Yes, active slider thumb" : "There is NOT AN active slider thumb"
    console.log(sliderFocus, appState.activeSliderValue)
    if (typeof ui.sliderElement.activeValue === "number") {
        const correspondingSliderThumb = ui.sliderElement.values.findIndex(value => value === ui.sliderElement.activeValue);
        console.log('slider element active value', ui.sliderElement.activeValue, 'corresponding to color stop', correspondingSliderThumb)
        // populating the color picker with the slider's value
        ui.colorPicker.value = {
            'r': appState.colorStops[correspondingSliderThumb].color[0],
            'g': appState.colorStops[correspondingSliderThumb].color[1],
            'b': appState.colorStops[correspondingSliderThumb].color[2],
            'a': appState.colorStops[correspondingSliderThumb].color[3] // this ensures the color's transparency is used by the picker
        }
    }
}

export function applyPickerColorToActiveStop(){

    if(typeof appState.activeSliderValue !== "number"){ // if there's no active slider thumb we'll warn the user & make no change
        hf.warnUser('no active slider value')
    } else {
        // hf.warnUser('active slider value is', appState.activeSliderValue);
        console.log('COLOR CHANGE: slider element active value', appState.activeSliderValue, 'color stops', appState.colorStops)
        const correspondingColorStopIndex = appState.colorStops.findIndex(stop => stop.value === appState.activeSliderValue)
        const correspondingColorStop = appState.colorStops[correspondingColorStopIndex]
        console.log('Assiging', ui.colorPicker.value,' to stop ', correspondingColorStopIndex);
        appState.colorStops[correspondingColorStopIndex].color = [
            ui.colorPicker.value.r, // red
            ui.colorPicker.value.g, // green 
            ui.colorPicker.value.b, // blue
            ui.colorPicker.value.a // alpha
        ] 
        console.log('Color stops after change', appState.colorStops)
        
        sliderHandler();
        // appState.activeSliderValue = null;
    }
}