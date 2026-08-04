export function renderAddStopButtons(){
    
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
        resetButton.textContent = "Default";
        resetButton.label = "Default";
       }
    console.log(`WE'RE CURRENTLY IN ${appState.symbologyMode} SYMBOLOGY MODE.`);
}

export function clearAddStopButtons(){
    
}

export function createButton(buttonValue){
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
        // determining WHERE to insert the new value
        let insertIndex = appState.sliderValues.findIndex(v => v > buttonValue); // we find the slider thumb which was above the button that was clicked
        if (insertIndex === -1) insertIndex = appState.sliderValues.length; // if no slider values were greater than the button, we insert at the end using the length as the index
        
        // interpolating between the color stops above and below the value
        let lowerStop = appState.colorStops[insertIndex - 1];
        let upperStop = appState.colorStops[insertIndex];
        let fraction = (buttonValue - lowerStop.value) / (upperStop.value - lowerStop.value);
        let newColor = [
            Math.round(lowerStop.color[0] + fraction * (upperStop.color[0] - lowerStop.color[0])),
            Math.round(lowerStop.color[1] + fraction * (upperStop.color[1] - lowerStop.color[1])),
            Math.round(lowerStop.color[2] + fraction * (upperStop.color[2] - lowerStop.color[2]))
        ];
        
        // Build new arrays instead of mutating in place so slider re-renders on first insert.
        const nextSliderValues = [...appState.sliderValues];
        nextSliderValues.splice(insertIndex, 0, buttonValue);
        
        const nextColorStops = [...appState.colorStops];
        nextColorStops.splice(insertIndex, 0, { color: newColor, value: buttonValue });
        
        appState.sliderValues = nextSliderValues;
        appState.colorStops = nextColorStops;
        
        // then updating DOM elements form the state 
        ui.sliderElement.values = [...nextSliderValues];
        ui.histogramElement.colorStops = [...nextColorStops];
        
        // updating UI
        // updateUI();
        sliderHandler();
        
        // assigning the active slider value to the button value
        console.log("AFTER BUTTON ADDED, ACTIVE SLIDER VALUE IS", ui.sliderElement.values.findIndex(v => v === buttonValue))
    });

    // button.style.left = `${percentAlongSwatch}%` // the button's position will be determined in updateButtons() 
    ui.swatch.appendChild(button); // adding the button to the swatch div
    appState.buttons.push(button); // adding the to the app app state
}

export function updateButtons(){

    ui.swatch.innerHTML = "";
    appState.buttons = [];

    for(let i = 1; i < appState.sliderValues.length; i++){

        // shifting the buttons 
        const midpoint = ((appState.sliderValues[i] - appState.sliderValues[i-1]) / 2) + appState.sliderValues[i-1]; // midpoint value of the current division of the color ramp 
        const midpointPercent = ((midpoint - appState.stats.min) / (appState.stats.max - appState.stats.min)) * 100; // percentge of the color ramp's width
        // console.log(`shifting button ${i} to midpoint ${midpointPercent}%`); // log for debug
        const button = createButton(midpoint);
        appState.buttons[i - 1].style.left = `${midpointPercent}%`;
    }
}