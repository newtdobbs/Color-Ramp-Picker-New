// REFACTOR: main.js() should call initApp() and nothing else
import { initApp } from "./src/app/bootstrap"; 
import "./style.css";
initApp();


const Map = await $arcgis.import("@arcgis/core/Map.js");
const MapView = await $arcgis.import("@arcgis/core/views/MapView.js");
const FeatureLayer = await $arcgis.import("@arcgis/core/layers/FeatureLayer.js");
const PortalItem = await $arcgis.import("@arcgis/core/portal/PortalItem.js");
const esriRequest = await $arcgis.import("@arcgis/core/request.js");
const BasemapGallery = await $arcgis.import("@arcgis/core/widgets/BasemapGallery.js");
const colorSymbology = await $arcgis.import("@arcgis/core/smartMapping/symbology/color.js");
const colorRendererCreator = await $arcgis.import("@arcgis/core/smartMapping/renderers/color.js");
const Color = await $arcgis.import("@arcgis/core/Color.js");
// const intl = await $arcgis.import("@arcgis/core/intl.js");
import * as math from "mathjs";
const { getThemes, getSchemes, getSchemeByName, getSchemesByTag, cloneScheme, getMatchingShemes } = await $arcgis.import("@arcgis/core/smartMapping/symbology/color.js");
// const { all, names, byName, byTag } = await $arcgis.import("@arcgis/core/smartMapping/symbology/support/colorRamps.js");
import "@arcgis/common-components/components/arcgis-slider";
import histogram from "@arcgis/core/smartMapping/statistics/histogram.js";
const summaryStatistics = await $arcgis.import("@arcgis/core/smartMapping/statistics/summaryStatistics.js");
import incrkurtosis from "@stdlib/stats-incr-kurtosis";
const StatisticDefinition = await $arcgis.import("@arcgis/core/rest/support/StatisticDefinition.js");
import * as hf from "./src/helperFunctions";
import { queryAllFeatures } from '@esri/arcgis-rest-feature-service';
import { validateAppAccess } from "@esri/arcgis-rest-request";
const Query = await $arcgis.import("@arcgis/core/rest/support/Query.js");
import { appState } from "./src/state/store";
import * as constants from "./src/modules/constants"
import * as ui from "./src/modules/ui"



async function initializeDialogForField() {
  try {

    clearStateForNewField()    // resetting the state variables for the new field selection

    await getAllFeatures();

    // for sparse distributions with low record count, we'll provide a warning and return


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
    ui.sliderElement.min = appState.stats.min; // slider range will go all the way to min to show full spread of values
    ui.sliderElement.max = appState.stats.max; // slider range will go all the way to max to show full spread of values
    console.log(`slider element is within the range of ${ui.sliderElement.min} to ${ui.sliderElement.max}`)

    // 5 stop slider
    ui.sliderElement.values = [...appState.sliderValues]; // assign a fresh array so slider reacts reliably
    appState.sliderValues = [...ui.sliderElement.values]; // copy to avoid sharing the component's internal array reference
    appState.lastCustomValues = [...appState.sliderValues]; // store an independent copy of initial custom values

    // SMART MAPPING DEFAULTS defaults as -1sd, midpoint of -1sd and mean, mean, midpoint of 1sd and mean, and 1sd
    appState.defaultValues = [
        appState.stats.avg - appState.stats.stddev, // default slider value 1 is 1 sd below mean 
        appState.stats.avg - appState.stats.stddev / 2, // default slider value 2 is at the mipoint between the mean and 1sd below mean
        appState.stats.avg, // default slider value 3 is at the mean
        appState.stats.avg + appState.stats.stddev / 2, // default slider value 4 is at the midpoint between the mean and 1 sd above the mean
        appState.stats.avg + appState.stats.stddev // default slider value 5 is at 1 sd above mean
    ]

    // console.log(`sliderValues represented as ${sliderValues}`) // log for debug
    ui.sliderElement.valueLabelsPlacement = "after"; // placing value labels after (aka under) the slider
    ui.sliderElement.valueLabelsEditingEnabled = true; // allow users to edit slider values directly
    ui.sliderElement.segmentsDraggingDisabled = true; // don't want dragging between the stops

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

    ui.histogramElement.min = histogramResult.minValue;
    ui.histogramElement.max = histogramResult.maxValue;
    ui.histogramElement.bins = histogramResult.bins;


    // assigning histogram color stops using the respective slider element value
    // we're not going to round these values to 2 decimals, as that may truncate some low values to 0
    ui.histogramElement.colorStops = colorSchemeStops.map((color, index) => ({
        color,
        value: appState.sliderValues[index]
    }));

    ui.histogramElement.colorBlendingEnabled = true;
    appState.colorStops = ui.histogramElement.colorStops.map(stop => ({ ...stop })); // clone to avoid mutating histogram internals by reference
    appState.lastCustomStops = appState.colorStops.map(stop => ({ ...stop })); // store independent copy as initial custom stops
    // SMART MAPPING DEFAULTS
    appState.defaultStops = [
        { color: [129, 0, 230], value: appState.stats.avg - appState.stats.stddev },
        { color: [179, 96, 209], value: appState.stats.avg - appState.stats.stddev / 2 },
        { color: [242, 207, 158], value: appState.stats.avg },
        { color: [110, 184, 48], value: appState.stats.avg + appState.stats.stddev / 2 },
        { color: [43, 153, 0], value: appState.stats.avg + appState.stats.stddev }
    ]; 

    console.log('histogram created', ui.histogramElement)

    // attaching the proper event listener based on the current value of the switch
    attachSliderListener();
    

    // Switch change handling
    // updateSwitch.addEventListener("calciteSwitchChange", () => {
    //     appState.switchValue = appState.switchValue === "static" ? "responsive" : "static";  // 'continuous' if it was 'discrete' when changed, otherwise default to 'discrete'
    //     attachSliderListener(); // need to attach the proper listener based on the switch value
    // });

    // then we enable the switch for the user
    // updateSwitch.disabled = false;
    ui.resetButton.disabled = false;
    ui.jsonCopy.disabled = false;

    // we have to call this function as even though updateUI() is within sliderHandler
    // its not actually called when the app is initialized, we merely add an event listener for it    
    initializeUI();

} catch (err) {
    console.error("Error creating histogram:", err);
  }
}




