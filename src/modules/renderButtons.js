import * as ui from "./ui";
import { appState } from "../state/store";
import { addStopAtValue, sliderHandler } from "./slider";
import { setButtons } from "../state/actions";

export function renderAddStopButtons(){
    if (!Array.isArray(appState.sliderValues) || appState.sliderValues.length < 2) {
        clearAddStopButtons();
        return;
    }

    updateButtons();
}

// this will hide stop buttons while a slider is being dragged
export function hideAddStopButtons(){
    appState.buttons.forEach(b => {b.style.visibility = 'hidden'});
    
}

// this will show the add stop buttons after a slider thumb is released
export function showAddStopButtons(){
    appState.buttons.forEach(b => {b.style.visibility = 'visible'});
    
    // if the slider moves while we were DEFAULT state
    if (appState.symbologyMode === "Default") {
        // we've moved away from the SM defaults now entered CUSTOM mode
        appState.symbologyMode = "Custom";
    
        // and we need to offer the a return to default mode in the button's label
        ui.resetButton.textContent = "Default";
        ui.resetButton.label = "Default";
       }
    console.log(`WE'RE CURRENTLY IN ${appState.symbologyMode} SYMBOLOGY MODE.`);
}

export function clearAddStopButtons(){
    if (!ui.swatch) {
        return;
    }

    appState.buttons.forEach(button => button.remove());
    appState.buttons = [];
}

/**
 * 
 * @param {number} buttonValue the numeric value at which to place the new button 
 * @param {*} customColor 
 */
export function createButton(buttonValue, customColor=null){
    const button = document.createElement('calcite-button'); // creating the calcite button
    button.iconStart = "plus";
    button.label = "Add color stop";
    button.kind = "neutral";
    button.round = true;
    button.scale = "s";
    button.appearance = "outline";

    // event listener for hover
    button.addEventListener("mouseenter", (event) => {
        event.target.style.backgroundColor = "white"; //
        // console.log("Mouse entered button #", i); // log for debug
    });

    // event listener when mouse leaves
    button.addEventListener("mouseleave", (event) => {
        event.target.style.backgroundColor = ""; 
        // console.log("Mouse left button #", i); // log for debug
    });

    // event listener for click to add a color stop at the button's location
    button.addEventListener("click", () => {
        addStopAtValue(buttonValue);
    });

    // button.style.left = `${percentAlongSwatch}%` // the button's position will be determined in updateButtons() 
    ui.swatch.appendChild(button); // adding the button to the swatch div
    appState.buttons.push(button); // adding the to the app app state
}

export function updateButtons(){

    if (!ui.swatch) {
        return;
    }

    ui.swatch.innerHTML = "";
    setButtons([]); // clearing the buttons

    const sliderValues = (appState.sliderValues || []).filter((value) => Number.isFinite(value));
    if (sliderValues.length < 2 || !appState.stats) {
        return;
    }

    const range = appState.stats.max - appState.stats.min;
    const safeRange = Number.isFinite(range) && range !== 0 ? range : 1;

    for(let i = 1; i < sliderValues.length; i++){
        // shifting the buttons 
        const midpoint = ((sliderValues[i] - sliderValues[i-1]) / 2) + sliderValues[i-1]; // midpoint value of the current division of the color ramp 
        const midpointPercent = ((midpoint - appState.stats.min) / safeRange) * 100; // percentge of the color ramp's width
        // console.log(`shifting button ${i} to midpoint ${midpointPercent}%`); // log for debug
        createButton(midpoint);
        appState.buttons[i - 1].style.left = `${midpointPercent}%`;
    }
}