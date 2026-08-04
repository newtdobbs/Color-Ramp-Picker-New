export function createInitialRenderer(){
    
}
export function applyStopsToRenderer(){
    
}

export function createDefaultStops(){
    
}

export function cloneStops(){
    
}

export function updateRenderer() {

    const renderer = appState.layer.renderer.clone(); // clone state renderer not to mess up anything

    const colorVarIndex = renderer.visualVariables.findIndex(vv => vv.type === "color");     // finding the 'color' visual variable by type property
    if (colorVarIndex === -1) {
        console.warn("No color visual variable found in renderer.");
        hf.warnUser("Error updating map renderer with color ramp information");
        return;
    }

    const colorVariable = renderer.visualVariables[colorVarIndex].clone(); // cloning the color variable at its index

    // if the user adds another thumb, the renderer's color stops and the number of slider thumbs WONT match
    // adding a stop
    if (colorVariable.stops.length < appState.sliderValues.length) {
        console.log(`Stop added, color variable has ${colorVariable.stops.length} stops, slider has ${appState.sliderValues.length} values`)
        // console.log(`Rebuilding from ${colorVariable.stops.length} to ${appState.sliderValues.length} stops`)
        // so we'll have to to rebuild the color variable using the color stops in state variable
        colorVariable.stops = appState.colorStops.map(stop => ({
            // the appState.colorStops should already have updated color information from the createButton click event listener
            color: stop.color,
            value: stop.value
        }));
    } else if (colorVariable.stops.length > appState.sliderValues.length){
        console.log(`Stop removed, color variable has ${colorVariable.stops.length} stops, slider has ${appState.sliderValues.length} values`)        
    } else {
        colorVariable.stops = colorVariable.stops.map((stop, i) => ({
            ...stop,
            color: appState.colorStops[i]?.color || [0, 0, 0], // grabbing the colr from the associated color stop break
            value: appState.sliderValues[i] // grabbing the value from the associated slider element
        }));
    }

    console.log('Color variable now has the following stops', colorVariable.stops);

    renderer.visualVariables[colorVarIndex] = colorVariable;
    appState.layer.renderer = renderer; // updating the state variable's renderer
}
