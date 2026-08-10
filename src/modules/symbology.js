import { appState } from "../state/store";
import * as hf from "../helperFunctions";

export function createInitialRenderer(){
    if (!appState.layer || !appState.layer.renderer) {
        return null;
    }
    return appState.layer.renderer.clone();
}
export function applyStopsToRenderer(stops = appState.colorStops){
    if (!Array.isArray(stops) || !stops.length || !appState.layer || !appState.layer.renderer) {
        return false;
    }

    const renderer = appState.layer.renderer.clone();
    const colorVarIndex = renderer.visualVariables.findIndex(vv => vv.type === "color");
    if (colorVarIndex === -1) {
        return false;
    }

    const colorVariable = renderer.visualVariables[colorVarIndex].clone();
    colorVariable.stops = stops.map(stop => ({
        color: stop.color,
        value: stop.value
    }));

    renderer.visualVariables[colorVarIndex] = colorVariable;
    appState.layer.renderer = renderer;
    return true;
}

export function createDefaultStops(){
    if (!appState.stats) {
        return [];
    }

    return [
        { color: [129, 0, 230], value: appState.stats.avg - appState.stats.stddev },
        { color: [179, 96, 209], value: appState.stats.avg - appState.stats.stddev / 2 },
        { color: [242, 207, 158], value: appState.stats.avg },
        { color: [110, 184, 48], value: appState.stats.avg + appState.stats.stddev / 2 },
        { color: [43, 153, 0], value: appState.stats.avg + appState.stats.stddev }
    ];
}

export function cloneStops(stops = appState.colorStops){
    if (!Array.isArray(stops)) {
        return [];
    }

    return stops.map(stop => ({
        ...stop,
        color: Array.isArray(stop.color) ? [...stop.color] : stop.color
    }));
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
