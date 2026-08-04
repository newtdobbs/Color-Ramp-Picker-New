// Role: slider behavior and stop-index integrity.
export function attachSliderListeners(){
    // reattaching event listeners
    ui.sliderElement.addEventListener("arcgisInput", hideButtonsOnDrag); // fires when a slider is clicked/dragged
    ui.sliderElement.addEventListener("arcgisInput", sliderHandler);
    ui.sliderElement.addEventListener("arcgisChange", showButtonsOnRelease); // fires when a slider is released
    ui.sliderElement.addEventListener("arcgisActiveValueChange",  handleActiveSliderThumb)
}

export function detachSliderListeners(){
    // Remove any existing listeners to avoid duplicates
    ui.sliderElement.removeEventListener("arcgisChange", sliderHandler);
    ui.sliderElement.removeEventListener("arcgisInput", sliderHandler);
    ui.sliderElement.removeEventListener("arcgisInput", hideButtonsOnDrag);
    ui.sliderElement.removeEventListener("arcgisChange", showButtonsOnRelease); 
    ui.sliderElement.removeEventListener("arcgisActiveValueChange", handleActiveSliderThumb) // changing the selected slider thumb
}

export function syncStopsFromSlider(){
    
}

export function addStopAtValue(){
    
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
    
}
export function getActiveStopIndex(){
    
}

export function sliderHandler() {
    // if a slider moves, we'll provide the option to reset defaults
    // console.log(`Current state of reset is ${resetButton.textContent}`) // log for debug

    appState.sliderValues = [...ui.sliderElement.values]; // updating state variables to just pull from there, this fixes bug where color stops were one step behind the sliderValues

    const newStops = appState.colorStops.map((colorStop, i) => ({ // looping over the state variable color stops
        ...colorStop,
        value: appState.sliderValues[i] // these are the NEW values currently in the slider
    })).sort((a, b) => a.value - b.value); // this resets the slider indices in case sliders cross over
    appState.colorStops = newStops; // assigning the new slider stops to the state variable 
    // appState.sliderValues = [...ui.sliderElement.values]; // updating the global state so we can just pull from there 

    // finally calling updateUI, which should only be using state variables
    updateUI(); 

    // updating the last custom stops to use the current slider values
    appState.lastCustomValues = [...appState.sliderValues];
    appState.lastCustomStops = [...appState.colorStops];
}
