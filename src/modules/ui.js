import histogram from "@arcgis/core/smartMapping/statistics/histogram.js";
const BasemapGallery = await $arcgis.import("@arcgis/core/widgets/BasemapGallery.js");
const { getSchemeByName } = await $arcgis.import("@arcgis/core/smartMapping/symbology/color.js");
const colorRendererCreator = await $arcgis.import("@arcgis/core/smartMapping/renderers/color.js");
import "@arcgis/common-components/components/arcgis-slider";
import * as hf from "./helperFunctions";


/* 
DOM ELEMENTS
*/
const mapContainer = document.getElementById("main-map")
const panelEls = document.querySelectorAll("calcite-panel"); // this grabs all panels from the actionbar(layers, basemap, legend)
const layersPanel = document.getElementById("layers-panel"); // the panel for the service layers 
const basemapGallery = document.querySelector("arcgis-basemap-gallery"); // the basemap gallery to bind it to the map view
const inputBox = document.getElementById("input"); // the dialog box for users to type their input item ID
const layerSelector = document.getElementById("layer-selector") // the dropdown for users to select a sublayer of the AGOL service
const fieldsLabel = document.getElementById("fields-label");
const generateButton = document.getElementById("generate-btn"); // the button that says 'Generate Histogram'
const bottomDialog = document.getElementById("bottom-dialog"); // the bottom dialog, which is hidden by default
const desc = document.getElementById("dialog-description");
const sliderElement = document.getElementById("color-slider");
const swatch = document.getElementById("color-swatch");
const histogramElement = document.getElementById("histogram");
const updateSwitch = document.getElementById("update-switch");
const resetButton = document.getElementById("reset-button");
const buttonsPanel = document.getElementById("right-buttons-panel");
const jsonCopy = document.getElementById("copy-json");

export function updateHistogram(){
    histogramElement.colorStops = appState.colorStops; // pulling the histogram's stops from the state variable
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
    if (colorVariable.stops.length !== appState.sliderValues.length) {
        console.log(`Rebuilding from ${colorVariable.stops.length} to ${appState.sliderValues.length} stops`)
        // so we'll have to to rebuild the color variable using the color stops in state variable
        colorVariable.stops = appState.colorStops.map(stop => ({
            // the appState.colorStops should already have updated color information from the createButton click event listener
            color: stop.color,
            value: stop.value
        }));
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


export function updateSwatch() {
    const gradientParts = appState.colorStops.map((stop, index) => {
        
        const percent = ((stop.value - appState.stats.min) / (appState.stats.max - appState.stats.min)) * 100; // getting the color stop's percentage along based on its value
        return `rgb(${stop.color.join(",")}) ${percent}%`; // returning the color at that stop to actually create the swatch
    });
    // creating a linear gradient from the pieces we just assembled from the color stops
    swatch.style.background = `linear-gradient(to right, ${gradientParts.join(", ")})`;
} 

export function updateButtons(){

    swatch.innerHTML = "";
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
/* 
function to calculate all stops when a field is first selected
*/
export function calculateStops(){


    // we're gonna clamp the kurtosis to prevent wild scaling
    const k = Math.max(-5, Math.min(5, appState.stats.kurtosis));
    // console.log(`kurtosis ${appState.stats.kurtosis} has been clamped to ${k}.`)
    const kScale =  1 / (1 + 0.3 * k); 
    // console.log(`kurtosis scaling factor has been determined as ${kScale}.`)

    // we're also gonna clamp skew to prevent wild scaling
    const s = Math.max(-5, Math.min(5, appState.stats.skewness));
    // console.log(`skewness ${appState.stats.skewness} has been clamped to ${s}.`)
    const leftSkewFactor = 1 - (0.2 * s);
    const rightSkewFactor = 1 + (0.2 * s);

    const leftOffset = appState.stats.stddev * kScale * leftSkewFactor
    const rightOffset = appState.stats.stddev * kScale * rightSkewFactor
    console.log(`Offsets determined as: L(${leftOffset}), R(${rightOffset})`)


    appState.sliderValues = [
        appState.stats.avg - appState.stats.stddev, // slider value 1 is 1 sd below mean 
        appState.stats.avg - leftOffset, // slider value 2 is at the left offset below the mean
        appState.stats.avg, // slider value 3 is at the mean
        appState.stats.avg + rightOffset, // slider value 4 is aat the right offset above the mean
        appState.stats.avg + appState.stats.stddev // slider value 5 is 1 sd above mean 
    ]


    console.log('appState.sliderValues are currently', appState.sliderValues); // log for debug
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
        let insertIndex = appState.sliderValues.findIndex(v => v > buttonValue);
        if (insertIndex === -1) insertIndex = appState.sliderValues.length;

        // interpolating between the color stops above and below the value
        let lowerStop = appState.colorStops[insertIndex - 1];
        let upperStop = appState.colorStops[insertIndex];
        let fraction = (buttonValue - lowerStop.value) / (upperStop.value - lowerStop.value);
        let newColor = [
            Math.round(lowerStop.color[0] + fraction * (upperStop.color[0] - lowerStop.color[0])),
            Math.round(lowerStop.color[1] + fraction * (upperStop.color[1] - lowerStop.color[1])),
            Math.round(lowerStop.color[2] + fraction * (upperStop.color[2] - lowerStop.color[2]))
        ];

        // inserting a new value into the state variables FIRST, the sliderValues and colorStops array
        appState.sliderValues.splice(insertIndex, 0, buttonValue);
        appState.colorStops.splice(insertIndex, 0, { color: newColor, value: buttonValue });

        
        // then updating DOM elements form there
        sliderElement.values = [...appState.sliderValues];
        histogramElement.colorStops = [...appState.colorStops];

        // updating UI
        updateUI();
    });

    // button.style.left = `${percentAlongSwatch}%` // the button's position will be determined in updateButtons() 
    swatch.appendChild(button); // adding the button to the swatch div
    appState.buttons.push(button); // adding the to the app app state
}

export async function initializeDialogForField() {
  try {

    appState.defaultStops = [];
    appState.lastCustomStops = [];
    appState.symbologyMode = 'Custom'

    await getAllFeatures();
    
    // for sparse distributions with low record count, we'll provide a warning and return
    if(appState.stats.count < 20){
        hf.warnUser(`With only ${appState.stats.count} observtaions, for now we'll refrain from calculating statistics`)
        return    
    }

    // creating a renderer for the map
    // grabbing the green-purple color scheme to use in the map
    const matchingScheme = getSchemeByName({
        basemap: appState.map.basemap,
        geometryType: appState.layer.geometryType,
        theme: "above-and-below",
        name: "Purple and Green 10"
    });

    // console.log('Matching scheme determined as:', matchingScheme) log for debug

    // setting parameters for a continuous renderer
    const colorParams = {
        view: appState.view,
        layer: appState.layer,
        field: appState.field.name,
        theme: "above-and-below",
        colorScheme: matchingScheme
    }
    // an array of the rgb stops for our purple-green color ramp, will make assigning stops easier later
    const colorSchemeStops = [
        [129, 0, 230], // purple
        [179, 96, 209], // light purple
        [242, 207, 158], // tan
        [110, 184, 48], // light green
        [43, 153, 0], // green
    ]
    // continuous renderer using the given color scheme
    const rendererResult = await colorRendererCreator.createContinuousRenderer(colorParams);
    appState.layer.renderer = rendererResult.renderer;
    appState.layer.visible = true;

    /* 
    INITIALIZING THE SLIDER 
    */
    // grabbing the slider element & using the stats to adjust it
    calculateStops(); // calculating stops which will be stored in the state variable
    sliderElement.min = appState.stats.min; // slider range will go all the way to min to show full spread of values
    sliderElement.max = appState.stats.max; // slider range will go all the way to max to show full spread of values
    console.log(`slider element is within the range of ${sliderElement.min} to ${sliderElement.max}`)

    // 5 stop slider
    sliderElement.values = appState.sliderValues; // we'll pull from state values which we calcualte in 
    appState.sliderValues = sliderElement.values; // initializing sliderValues to handle the FIRST change
    appState.lastCustomValues = appState.sliderValues; // storing the initial values as custom values since we DON't use SM deafults on first load
    
    // SMART MAPPING DEFAULTS defaults as -1sd, midpoint of -1sd and mean, mean, midpoint of 1sd and mean, and 1sd
    appState.defaultValues = [
        appState.stats.avg - appState.stats.stddev, // default slider value 1 is 1 sd below mean 
        appState.stats.avg - appState.stats.stddev / 2, // default slider value 2 is at the mipoint between the mean and 1sd below mean
        appState.stats.avg, // default slider value 3 is at the mean
        appState.stats.avg + appState.stats.stddev / 2, // default slider value 4 is at the midpoint between the mean and 1 sd above the mean
        appState.stats.avg + appState.stats.stddev // default slider value 5 is at 1 sd above mean
    ]

    // console.log(`sliderValues represented as ${sliderValues}`) // log for debug
    sliderElement.valueLabelsPlacement = "after"; // placing value labels after (aka under) the slider
    sliderElement.valueLabelsEditingEnabled = true; // allow users to edit slider values directly
    sliderElement.segmentsDraggingDisabled = true; // don't want dragging between the stops

    // creating buttons
    for(let i = 1; i < appState.sliderValues.length; i++){
        const underlyingButtonValue = ((appState.sliderValues[i] - appState.sliderValues[i-1]) / 2) + appState.sliderValues[i-1];; // this gets the midpoint value between the surrounding stop's
        createButton(underlyingButtonValue); // creating a button BETWEEN each of the sliders, so we index from 1 and use i < sliderValues.length
    };

    // // then updating the buttons
    // updateButtons();
    
       
    // initializing renderer
    const histogramResult = await histogram({
        layer: appState.layer,
        field: appState.field.name,
        minValue: appState.stats.min,
        maxValue: appState.stats.max,
        numBins: Math.min(100, appState.stats.count)
    });

    console.log('histogramResult:', histogramResult);
    console.log('appState stats', appState.stats)
    
    histogramElement.min = histogramResult.minValue;
    histogramElement.max = histogramResult.maxValue;
    histogramElement.bins = histogramResult.bins;
    

    // assigning histogram color stops using the respective slider element value
    // we're not going to round these values to 2 decimals, as that may truncate some low values to 0
    histogramElement.colorStops = colorSchemeStops.map((color, index) => ({
        color,
        value: appState.sliderValues[index]
    }));

    histogramElement.colorBlendingEnabled = true;
    appState.colorStops = histogramElement.colorStops; // initializing the state variable color stops
    appState.lastCustomStops = appState.colorStops; // storing initial stops as CUSTOM stops since we DONT use SM defaults on first load
    // SMART MAPPING DEFAULTS
    appState.defaultStops = [
        { color: [129, 0, 230], value: appState.stats.avg - appState.stats.stddev },
        { color: [179, 96, 209], value: appState.stats.avg - appState.stats.stddev / 2 },
        { color: [242, 207, 158], value: appState.stats.avg },
        { color: [110, 184, 48], value: appState.stats.avg + appState.stats.stddev / 2 },
        { color: [43, 153, 0], value: appState.stats.avg + appState.stats.stddev }
    ]; 
    
    // attaching the proper event listener based on the current value of the switch
    attachSliderListener();
    

    // Switch change handling
    updateSwitch.addEventListener("calciteSwitchChange", () => {
        appState.switchValue = appState.switchValue === "static" ? "responsive" : "static";  // 'continuous' if it was 'discrete' when changed, otherwise default to 'discrete'
        attachSliderListener(); // need to attach the proper listener based on the switch value
    });

    // appState.symbologyMode = "Default" value for current click

    // reset button handling
    resetButton.addEventListener("click",  () => {
        
        // if we're currently using custom symbology, we want to TURN ON the smart mapping defaults
        if (appState.symbologyMode === "Custom") {
            // saving the current custom configuration before overwriting
            appState.lastCustomValues = [...appState.sliderValues];
            appState.lastCustomStops = [...appState.colorStops];
            
            // then applying smart mapping defaults
            sliderElement.values = [...appState.defaultValues];
            histogramElement.colorStops = [...appState.defaultStops];
            appState.sliderValues = [...appState.defaultValues];
            appState.colorStops = [...appState.defaultStops];
            
        // otherwise we're using default symbology, so we want to RESTORE last custom stops before click
        } else {
            if (appState.lastCustomValues && appState.lastCustomStops) {
                sliderElement.values = [...appState.lastCustomValues];
                histogramElement.colorStops = [...appState.lastCustomStops];
                appState.sliderValues = [...appState.lastCustomValues];
                appState.colorStops = [...appState.lastCustomStops];
            } else {
                hf.warnUser("No custom configuration stored to restore.");
            }
        }
        
        
        // we use the 'old' mode (before click) as the new button label 
        resetButton.textContent = appState.symbologyMode;
        resetButton.label = appState.symbologyMode;
        
        // and we'll switch the mode to the opposite state
        appState.symbologyMode = appState.symbologyMode === "Default" ? "Custom" : "Default"; // determining value for current click
        console.log(`Changed buttom label FROM ${appState.symbologyMode} to ${resetButton.label}`)

        updateUI(); // finally we updateUI to reflect these changes in the map/histogram
    })

    // then we enable the switch for the user
    updateSwitch.disabled = false;
    resetButton.disabled = false;
    jsonCopy.disabled = false;
    
    // we have to call this function as even though updateUI() is within sliderHandler
    // its not actually called when the app is initialized, we merely add an event listener for it    
    initializeUI();
    
} catch (err) {
    console.error("Error creating histogram:", err);
  }
}
/* 
LOGIC FOR COMPILING A DESCRIPTION FROM THE FIELD STATISTICS
*/
function buildDescription() {
    // console.log("Building a description for the summary statistics:", appState.stats); // log for debug

    const descParts = [];

    descParts.push(
        `${appState.field.alias} has a value range of ${hf.DecimalPrecision2.round(appState.stats.min, 2).toLocaleString()} to ${hf.DecimalPrecision2.round(appState.stats.max, 2).toLocaleString()}, with a mean of ${hf.DecimalPrecision2.round(appState.stats.avg, 2).toLocaleString()} and a median of ${hf.DecimalPrecision2.round(appState.stats.median, 2).toLocaleString()}. With a skewness of ${hf.DecimalPrecision2.round(appState.stats.skewness, 2).toLocaleString()}, the distribution shows`
    ); 


    // SKEW    
    const skewAbs = Math.abs(appState.stats.skewness);
    if (skewAbs > 0.25) {
        let skewSeverity;
        if (skewAbs > 1) {
            skewSeverity = "substantial";
        } else if (skewAbs > 0.5) {
            skewSeverity = "moderate";
        } else {
            skewSeverity = "slight";
        }

        const skewDirection = appState.stats.skewness > 0 ? "positive (right)" : "negative (left)";
        descParts.push(`${skewSeverity} ${skewDirection} skew.`);
    } else {
        descParts.push(" no noticeable skew.");
        
    }
    
    // console.log(`For ${appState.field.name}, kurtosis has been calculated as ${appState.stats.kurtosis}`) // log for debug

    // KURTOSIS
    descParts.push(`The data has a kurtosis of ${hf.DecimalPrecision2.round(appState.stats.kurtosis, 2).toLocaleString()}, indicating`);
    const kurtosisAbs = Math.abs(appState.stats.kurtosis);
    if (kurtosisAbs <= 1) {
        descParts.push("an approximately normal distribution.");
    } else {
        let severity = "";
        if (kurtosisAbs > 2) {
            severity = "substantially ";
        }
        const kurtosisDirection = appState.stats.kurtosis > 0 ? "leptokurtic (peaked)" : "platykurtic (flat)";
        descParts.push(`a ${severity}${kurtosisDirection} distribution.`);
    }

    // // OUTLIERS
    // if (math.abs(appState.stats.skewness) >  5) {


    //     if(appState.stats.highOutliers.length > 0 || appState.stats.lowOutliers.length > 0){ // for high skew we'll encourage the user to hide outliers
    //         descParts.push(`There are ${appState.stats.lowOutliers.length + appState.stats.highOutliers.length} outliers within the dataset, consider using the 'Filter Outliers' button to mask outliers from the map's symbology`);
    //     }
    // } 

    // PUTTING IT ALL TOGETHER    
    appState.description = descParts.join(" "); // assigning it to the state variable

}



export function initializeUI(){
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
export function updateUI(){
    updateHistogram();
    updateRenderer();
    // updateDescription();
    updateSwatch();
    updateButtons();
    console.log('------------ UPDATE UI DEBUG ------------------'); // log for debug
    console.log(`WE'RE CURRENTLY IN ${appState.symbologyMode} SYMBOLOGY MODE.`);
    console.log('Slider stops are', appState.sliderValues);
    console.log('color stops are', appState.colorStops);
    console.log('----------------------------------------'); // log for debug
}