import { clearFieldList, renderFieldList } from "../modules/renderFieldList";
import * as stats from "../modules/statistics.js";
import * as state from '../state/actions.js';
import * as field from '../modules/fields.js';
import * as symbology from '../modules/symbology.js';

// Role: ramp lifecycle and interactions.
export function initializeRampForField(){
    // resetFieldState + resetRampState
    state.resetFieldState();
    state.resetRampState();

    // prepareRampUiForLoading
    prepareRampUIForLoading();

    // values = queryFieldValues
    const values = field.queryFieldValues();
    
    // stats = calculateStatsForValues(values)
    const stats = calculateFieldValues(allValues)
    
    // guard sparse count, if there's <20 observations we do nothing
    if(appState.stats.count < 20){
        hf.warnUser(`With only ${appState.stats.count} observtaions, for now we'll refrain from calculating statistics`)
        return    
    }

    // setStats(stats)
    state.setStats(stats);

    // renderer = createInitialRenderer
    const renderer = symbology.createInitialRenderer();

    // sliderValues = calculateInitialStops(stats)
    const sliderValues = calculateInitialStops(stats);
    state.setSliderValues(sliderValues);

    // configureSliderRange + configureSliderBehavior

    // histogram/colorStops = createInitialColorStops
    // defaultStops/defaultValues = createDefaultStops/buildDefaultStopValues
    // set all state via actions
    // attachSliderListeners
    // renderAddStopButtons + render swatch/histogram
    // buildAndStoreDescription + renderDescription
    // finalizeRampUiReady
    
}

export function handleSliderInput(){
    
}

export function handleSliderChange(){
    
}

export function handleResetToggle(){
    
}

export function handleCopyJson(){
    
}

export function handleRemoveStop(){
    
}

export function initializeRampUI(){
    updateHistogram();
    updateRenderer();
    updateSwatch();
    updateButtons();
    buildDescription();
    console.log('------------ INITIAL UI DEBUG ------------------'); // log for debug
    console.log(`WE DEFAULT TO ${appState.symbologyMode} SYMBOLOGY MODE.`);
    console.log('Slider stops are', appState.sliderValues);
    console.log('color stops are', appState.colorStops);
    console.log('----------------------------------------'); // log for debug
}

/* 
OVERALL FUNCTION TO UPDATE ALL UI
we don't need to update the description when a slider is moved
*/
export function updateRampUI(){
    updateHistogram();
    updateRenderer();
    // updateDescription();
    updateSwatch();
    updateButtons();
    console.log('------------ UPDATE UI DEBUG ------------------'); // log for debug
    console.log('Slider stops are', appState.sliderValues);
    console.log('color stops are', appState.colorStops);
    console.log('----------------------------------------'); // log for debug
}
