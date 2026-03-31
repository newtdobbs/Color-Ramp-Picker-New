import "./style.css";
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
import "@arcgis/common-components/components/arcgis-histogram";
const summaryStatistics = await $arcgis.import("@arcgis/core/smartMapping/statistics/summaryStatistics.js");
import incrkurtosis from "@stdlib/stats-incr-kurtosis";
import * as hf from "./helperFunctions";
import { queryAllFeatures } from '@esri/arcgis-rest-feature-service';
import { validateAppAccess } from "@esri/arcgis-rest-request";


/* 
CONSTANTS
*/
const default_center = [-94.66, 39.04]; // Kansas City as map view as its ~roughly~ central in US
const default_scale = 35000000; // roughly the lower 48

// ideal field types, leaving all options in for un-ommenting
const goodFieldTypes = [
    "small-integer",
    "integer",
    "single",
    "double",
    "long",
    // "string",
    // "date",
    // "oid",
    // "geometry",
    // "blob",
    // "raster",
    // "guid",
    // "global-id",
    // "xml",
    "big-integer",
    // "date-only",
    // "time-only",
    // "timestamp-offset"
];
// ideal field value types, leaving all options in for un-ommenting
const goodFieldValueTypes = [
  // "binary",
  // "coordinate",
  "count-or-amount",
  "currency",
  // "date-and-time",
  // "description",
  // "email-address",
  // "location-or-place-name",
  // "measurement",
  // "name-or-title",
  // "none",
  // "ordered-or-ranked",
  "percentage-or-ratio",
  // "phone-number",
  // "type-or-category",
  // "unique-identifier"
];

/* 
GLOBAL APP STATE
This should hold info about the map, the chosen feature layer, the selected field, the histogram, etc
*/
const appState = {
    activeWidget: "layers", // initializing active widget to layers so that its open on page load
    map: null, // the map within the main map div
    view: null, // the view associated with the map
    inputItemID: null, // the item ID parsed from the user's input
    serviceInfo: null, // the service information gathered from the item ID 
    layerSelection: null, // the selected layer from the dropdown menu
    layer: null, // the feature layer created from the dropdown's selected layer
    renderer: null, // the renderer for the selected layer
    field: null, // the selected field from the layer
    stats: null, // the statistics for the data distibution of the selected field
    description: null, // the description to populate the dialog 
    sliderValues: null, // the values currently stored in the slider element
    colorStops: null, // the color stops (color and value) currently stored in the slider elemnt
    buttons: [], // the buttons for adding stops
    defaultItemID: "c9faa265b82848498bc0a8390c0afa65",
    fieldsList: null, // the full fields list for the service
    renderer: null,
    sliderActive: false,
    switchValue: "static", // we defualt to static changes
    defaultValues: null, // this should only ever be assigned upon field initialization
    defaultStops: null, // this should only ever be assigned upon field initialization
    lastCustomValues: null,
    lastCustomStops: null,
    offsetBase: null,
    symbologyToToggle: "Default",
}

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

 const handleActionBarClick = ({ target }) => {

    console.log("active widget is currently:", appState.activeWidget)
    if (target.tagName !== "CALCITE-ACTION") {
        return;
    }

    if (activeWidget) {
        document.querySelector(`[data-action-id=${appState.activeWidget}]`).active = false;
        document.querySelector(`[data-panel-id=${appState.activeWidget}]`).closed = true;
    }

    const nextWidget = target.dataset.actionId;
    if (nextWidget !== activeWidget) {


        document.querySelector(`[data-action-id=${appState.nextWidget}]`).active = true;
        document.querySelector(`[data-panel-id=${appState.nextWidget}]`).closed = false;
        appState.activeWidget = nextWidget;
        document.querySelector(`[data-panel-id=${appState.nextWidget}]`).setFocus();
    } else {
        appState.activeWidget = null;
    }
};
// Panel interaction
for (let i = 0; i < panelEls.length; i++) {
    panelEls[i].addEventListener("calcitePanelClose", () => {
    document.querySelector(`[data-action-id=${appState.activeWidget}]`).active = false;
    document.querySelector(`[data-action-id=${appState.activeWidget}]`).setFocus();
    appState.activeWidget = null;
    });
}
document.querySelector("calcite-action-bar").addEventListener("click", handleActionBarClick);


async function createBasemapOnlyView() {
    const map = new Map({
        basemap: 'gray-vector',
        layers: []
    });

    // assigining the map to the default app's state
    appState.map = map;

    const view = new MapView({
        container: mapContainer, // the dom element to hold our map
        map: map,
        ui: { components: [] }
    });
    appState.view = view;

    console.log('view:', view)
    appState.view.when(() => {
        appState.view.goTo({ scale: default_scale, center: default_center }); // zooming to the lower 48 centered 
    })

        if (basemapGallery) {
        basemapGallery.view = view; // bind the MapView directly
    }

    return view;
}


await createBasemapOnlyView(); // assigning the returned view to the global state



/* 
LOGIC FOR INPUT DIALOG
this will fire every time a new agol id is input
We want to populate the dropdown with sublayers, and create a map
*/
inputBox.addEventListener("keydown", async function (event) {
    if (event.key === "Enter") { 
        event.preventDefault(); // we want to avoid whatever normally happens with the 'Enter' key

        // hardcoding a default value --REMOVE THE IF BLOCK FOR DEPLOYMENT
        if (inputBox.value === ""){
            appState.inputItemID = appState.defaultItemID // MINC
        } else {
            const raw = inputBox.value || "";
            const itemIDs = raw.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
            const uniqueItemIDs = Array.from(new Set(itemIDs));
            appState.inputItemID = uniqueItemIDs[0]; // only taking the first ID if multiple are provided
        }

        // console.log("input AGOL id is", selectedID); // log for debug
        appState.serviceInfo = await getServiceLayers(appState.inputItemID); // check the layers present in the service
        console.log('service info is', appState.serviceInfo);

        // if valid information was attained from the service, we'll update the panel heading and create sublayer dropdown
        if (appState.serviceInfo){
            layersPanel.heading = `Layer: ${appState.serviceInfo.title}`;
            
            createDropdownForService(); // create a dropdown to list the sublayers

        // if no valid info was attained form the service we'll warn the user
        } else {
            hf.warnUser(`No valid information attained for the service with the input item ID: ${appState.inputItemID}`);
        }

        inputBox.value = ""; // clearing the input dialog box after everything is done

        // if a fields list pre-existed, we'll clear it 
        if (appState.fieldsList) {
            document.getElementById("fields-list").innerHTML = "";
        }
    }
});

/* 
LOGIC FOR TRAVERSING A LAYER TO GET SUBLAYERS
*/
async function getServiceLayers(itemId) {
    // regex check for AGOL item ID format (32 hex chars)
    
    const idPattern = /^[a-f0-9]{32}$/i;
    if (idPattern.test(itemId)) {
        try{
            const portalItem = new PortalItem({ id: itemId });
            await portalItem.load();

            console.log('portal item title:', portalItem.title)

            // Request the service metadata
            const serviceUrl = portalItem.url;
            const response = await esriRequest(serviceUrl, {
                query: { f: "json" }
            });

            const layersInfo = response.data.layers || [];

            // console.log("layers info: ", layersInfo); // log for debug

            return {
                title: portalItem.title,
                layers: layersInfo
            };

        } catch (error) {
            // Code to handle the error
            console.warn(`An error occurred while fetching item ${itemId}, ${error.message}`);
            hf.warnUser(`An error occurred while fetching item ${itemId}, ${error.message}`);
            return null;
        }
    } else {
        console.warn(`ID ${itemId} failed regex format check`);
        hf.warnUser(`ID ${itemId} failed regex format check`);
        return null;
    }
}


/*
LOGIC FOR LAYER SELECTOR
The dropdown list should be populated AFTER the item ID is input
*/
function createDropdownForService() {
    layerSelector.innerHTML = ""; // removing old options, in case sconsecutive layers dont have the same sublayers
    layerSelector.placeholder = 'Select a Layer';

    if (appState.serviceInfo.layers.length === 1){
        appState.layer = appState.serviceInfo.layers[0]; // if needed we'll use the first entry in service layers info
        layerSelector.placeholder = `Selected Layer: ${layer.name}`;
    }

    appState.serviceInfo.layers.forEach((serviceLayer) => {
        const layerOption = document.createElement("calcite-autocomplete-item");
        layerOption.label = serviceLayer.name || serviceLayer.id; // use the layer id as fallback
        layerOption.heading = serviceLayer.name || serviceLayer.id; // use the layer id as fallback
        layerOption.value = serviceLayer.id; // the layer id as value allows us to index it in the array

        layerSelector.appendChild(layerOption); // adding the item to the autocomplete dropdown
        layerOption.addEventListener("calciteAutocompleteItemSelect", async () => {
            appState.layerSelection = serviceLayer; // setting the curent layer to the selected layer
            console.log('selection change to:', appState.layerSelection.name, 'layer info:', appState.layerSelection)
            layerSelector.placeholder = `Selected Layer: ${appState.layerSelection.name}`; 

            // call to createMap if the selection changes
            await createMap();

            // console.log('before we create a fields list, this is the map layer', appState.layer);

            // re-populating the list of fields, DON'T want to assume that the fields are consistent
            generateFieldsList();
        });
    });

    // at the end here, we'll create the map for the main-map div
    // createMap();
}

/* 
LOGIC FOR CREATING A MAP VIEW
*/
async function createMap() {
    // console.log('app state map', appState.map)  // log for debug
    appState.map.removeAll(); // first removing all layers from the current view
    try {
        const layer = new FeatureLayer({
            portalItem: { id: appState.inputItemID },
            layerId: appState.layerSelection.id
        });
        await layer.load();
        // console.log('layer to populate in map', layer); // log for debug
        appState.map.add(layer);
        appState.layer = layer;

        // zooming to the midpoint of the selected layer's visibility
        console.log(`Layer scale is from ${appState.layer.minScale} ${appState.layer.maxScale}`);

        let layerMinScale;
        if (appState.layer.minScale === 0){
            layerMinScale = default_scale;
        } else {
            layerMinScale = appState.layer.minScale;
        }
        const midScale = Math.floor((layerMinScale + appState.layer.maxScale) / 2);
  
        console.log(`Resetting view for Layer to mid scale of: ${midScale}`); // log for debug
        appState.view.goTo({ scale: midScale, center: default_center }); // re-zooming map the middle visibility rnage in to middle of the country


    } catch (e) {
        console.error('Could not create/load layer from item ID:', appState.inputItemID, e);
        hf.warnUser('Failed to create map for selected layer');
    }
}

/* 
LOGIC FOR CREATING THE LIST OF FIELDS
*/

function generateFieldsList() {
    fieldsLabel.textContent = "Select a Field";
    
    const fieldsList = document.createElement("calcite-list");
    fieldsList.innerHTML = ""; // removing any preexisting fields
    fieldsList.label = "Select a field";
    fieldsList.selectionMode = "single"; 
    fieldsLabel.appendChild(fieldsList);

    // Can log all the fields here for debug
    // console.log("All fields:");
    // appState.layer.fields.forEach(field => {
    //     console.log(`Field: ${field.name}, type: ${field.type}, valueType: ${field.valueType}`);
    // });

    appState.layer.fields.forEach(field => {
        if (goodFieldTypes.includes(field.type) && goodFieldValueTypes.includes(field.valueType)) {
            const listItem = document.createElement("calcite-list-item");
            listItem.label = field.alias;
            listItem.scale = "s";
            listItem.value = field.name;
            listItem.closable = true;

            fieldsList.appendChild(listItem);

            listItem.addEventListener("calciteListItemSelect", async () => {
                appState.field = appState.field === field ? null : field; // this will allow users to deselect a field without having to remove it from the list

                console.log(`Selected field '${appState.field.alias}' information: ${appState.field}`)
                // seleecting a field will remove any previous warnings
                if(document.querySelector("calcite-alert")){
                    document.querySelector("calcite-alert").remove();
                }
            });

            listItem.addEventListener("calciteListItemClose", async () => {
                hf.warnUser('Removing field: ', field.alias);
                // console.log('removing field: ', field.alias); // log for debug
                if (appState.field.alias === field.alias){
                    appState.field = null; // if the user removes the currently selected field, we'll clear the state variable
                    // warnUser('Select a field from the fields list')
                }
                listItem.remove(); // removing the list item from the dom
            });
        }
    });

    appState.fieldsList = fieldsList; // adding the fields list to the global state
}


/* 
LOGIC FOR THE DIALOG BOX
This should only appear after the 'generate histogram' button was clicked
*/

// functionality to handle the generate button
generateButton.addEventListener("click", async () => {

    // error handling if no field is selected
    if(!appState.field){
        hf.warnUser('Select a field from the fields list')
        return
    } else {
        
        // otherwise, closing any pre-existing dialog so we can re-generate its contents
        if (bottomDialog.open){
            // bottomDialog.textContent = "";    
            bottomDialog.open = false;
        }
                    
        // resertting the dialog
        // bottomDialog.textContent = "";  
        
        //if its non-numeric warn user
        if(!goodFieldTypes.includes(appState.field.type)){
            hf.warnUser("Please ensure the selected field is one of the following types: small-integer, integer,  single,  double,  long,  string, big-integer.")
            appState.field = null;
            return
        }
        // // make sure its not just a Geoid, uniqueid, make sure its a DATA field
        if(!goodFieldValueTypes.includes(appState.field.valueType)){
            hf.warnUser("Please ensure the selected field is one of the following value types:  count-or-amount, currency")
            appState.field = null;
            return
        }   

        // setting the heading and opening the dialog but with a loader
        
        bottomDialog.open = true;
        bottomDialog.componentOnReady();
        bottomDialog.loading = true;
        
        try {
            // updating the dialog header
            bottomDialog.heading = `Color Ramp Information for ${appState.field.name} (${appState.field.alias})`
            bottomDialog.description = `Selected Layer: ${appState.layer.title}`
            
            // here we'll populate the dialog using the selected field's data distribution
            await initializeDialogForField()
            desc.textContent = appState.description; // is now stored in state variable after initializing
            desc.slot = "content-bottom";
            
            bottomDialog.appendChild(desc);
            bottomDialog.loading = false;
            
        } catch(err){
            console.log("Error generating histogram:", err)
            bottomDialog.heading = `Error Generating Color Ramp Information for ${appState.field.alias}`
        }
        bottomDialog.open = true;
    }   
});

/* 
LOGIC FOR CALCULATING FIELD KURTOSIS, THIS WILL REQUIRE GATHERING ALL RECORDS FROM A FIELD
*/
async function calculateSkewAndKurtosis() {
    
    const t0 = performance.now(); // log for debug
    const data = await getAllFeatures(); // wait for all features
    const t1 = performance.now(); // log for debug
    console.log(`Querying ${appState.stats.count} records took ${Math.floor(t1 - t0)} milliseconds.`); // log for debug
    const values = data.features.map(f => f.attributes[appState.field.name]); // this is what actually gets the data value in the selected field for each feature 

    const cleanValues = values.filter(v => typeof v === "number" && !isNaN(v)); // filtering out NaN or non-numeric values
    const n = cleanValues.length; // the new value count AFTER filters

    // third moment
    let summedDiffs = 0;
    cleanValues.forEach(v => {
        summedDiffs += Math.pow(v - appState.stats.avg, 3);
    });
    const thirdMoment = summedDiffs / n;

    // Population skew
    const populationSkew = thirdMoment / Math.pow(appState.stats.stddev, 3);

    // Bias correction (sample skew)
    const sampleSkew = populationSkew * Math.sqrt(n * (n - 1)) / (n - 2);

    // then we'll calucalte kurtosis
    var accumulator = incrkurtosis();
    cleanValues.forEach(v => {
        if (typeof v === "number" && !isNaN(v)) {
            accumulator(v);
        }
    });
    const kurtosis = accumulator();

    // console.log(`Skew ${sampleSkew} and kurtosis ${kurtosis} off the press`) // log for debug

    // then adding these values to the global app state
    appState.stats.skewness = sampleSkew;
    appState.stats.kurtosis = kurtosis;
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

    // Skew severity & direction
    
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
    descParts.push(`The data has a kurtosis of ${hf.DecimalPrecision2.round(appState.stats.kurtosis, 2).toLocaleString()}, indicating a`);
    const kurtosisAbs = Math.abs(appState.stats.kurtosis);
    // if the kurtosis is more severe than 1 in either direction, we'll consider its severity & direction
    if (kurtosisAbs > 1){ 
        // severely peaked or flat distributions
        if(kurtosisAbs > 2){
            descParts.push("substantially")
        }
    // otherwise if its close to zero, we consider it approximately normal
    } else { 
        kurtosisSeverity = "an approximately normal";
    }
    const kurtosisDirection = appState.stats.kurtosis > 0 ? "leptokurtic (peaked)" : "platykutic (flat)";
    
    descParts.push(`${kurtosisDirection} distribution.`)

    descParts.join(" ");
    
    appState.description = descParts; // assigning it to the state variable

}

function initializeUI(){
    updateHistogram();
    updateRenderer();
    updateSwatch();
    updateButtons();
    buildDescription();
    console.log('------------ INITIAL UI DEBUG ------------------') // log for debug
    console.log('Slider stops are', appState.sliderValues)
    console.log('color stops are', appState.colorStops)
    console.log('----------------------------------------') // log for debug
}
    
/* 
OVERALL FUNCTION TO UPDATE ALL UI
we don't need to update the description when a slider is moved
*/
function updateUI(){
    updateHistogram();
    updateRenderer();
    // updateDescription();
    updateSwatch();
    updateButtons();
    console.log('------------ UPDATE UI DEBUG ------------------') // log for debug
    console.log('Slider stops are', appState.sliderValues)
    console.log('color stops are', appState.colorStops)
    console.log('----------------------------------------') // log for debug
}

async function initializeDialogForField() {
  try {

    /* 
    FIRST CALCULATING SUMAMRY STATISTICS
    */
    // gathering summary statistics from the selected field of the active feature layer
    appState.stats = await summaryStatistics({
      layer: appState.layer,
      field: appState.field.name
    });

    // console.log("statistics generated from field", stats); // log for debug

    // for sparse distributions with low record count, we'll provide a warning and return
    if(appState.stats.count < 20){
        hf.warnUser(`With only ${appState.stats.count} observtaions, for now we'll refrain from calculating statistics`)
        return    
    }

    // inserting skew and kurtosis as additional statistics into the dictionary
    await calculateSkewAndKurtosis(); 

    // creating a renderer for the map
    // grabbing the green-purple color scheme to use in the map
    const matchingScheme = getSchemeByName({
        basemap: appState.map.basemap,
        geometryType: appState.layer.geometryType,
        theme: "above-and-below",
        name: "Purple and Green 10"
    });

    console.log('Matching scheme determined as:', matchingScheme)


    // setting parameters for a continuous renderer
    const colorParams = {
        view: appState.view,
        layer: appState.layer,
        field: appState.field.name,
        theme: "above-and-below",
        colorScheme: matchingScheme
    }
    // continuous renderer using the given color scheme
    const rendererResult = await colorRendererCreator.createContinuousRenderer(colorParams);
    appState.renderer = rendererResult.renderer;
    appState.layer.renderer = appState.renderer;
    appState.layer.visible = true;

    /* 
    INITIALIZING THE SLIDER 
    */
    // grabbing the slider element & using the stats to adjust it
    sliderElement.min = appState.stats.min;
    sliderElement.max = appState.stats.max;
    calculateIntermediateStops();
    // 5 stop slider
    sliderElement.values = [
        appState.stats.min,
        appState.intermediateStops[0],
        appState.stats.avg,
        appState.intermediateStops[1],
        appState.stats.max
    ];
    appState.sliderValues = sliderElement.values; // initializing sliderValues to handle the FIRST change
    // SMART MAPPING DEFAULTS defaults as min, max, mean, 1sd above and below mean
    appState.defaultValues = [appState.stats.min, appState.stats.avg - appState.stats.stddev, appState.stats.avg, appState.stats.avg + appState.stats.stddev, appState.stats.max];
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
        numBins: Math.min(100, appState.stats.count)
    });
    
    histogramElement.min = histogramResult.minValue;
    histogramElement.max = histogramResult.maxValue;
    histogramElement.bins = histogramResult.bins;
    
    // ACTUAL HISTOGRAM COLORSTOPS
    // we're not going to round these values to 2 decimals, as that may truncate some low values to 0
    histogramElement.colorStops = [
        { color: [129, 0, 230], value: appState.stats.min },
        { color: [179, 96, 209], value: appState.intermediateStops[0] },
        { color: [242, 207, 158], value: appState.stats.avg },
        { color: [110, 184, 48], value: appState.intermediateStops[1] },
        { color: [43, 153, 0], value: appState.stats.max }
    ];
    
    histogramElement.colorBlendingEnabled = true;
    appState.colorStops = histogramElement.colorStops; // initializing the state variable color stops
    // SMART MAPPING DEFAULTS
    appState.defaultStops = [
        { color: [129, 0, 230], value: appState.stats.min },
        { color: [179, 96, 209], value: appState.stats.avg - appState.stats.stddev },
        { color: [242, 207, 158], value: appState.stats.avg },
        { color: [110, 184, 48], value: appState.stats.avg + appState.stats.stddev },
        { color: [43, 153, 0], value: appState.stats.max }
    ]; 
    
    // attaching the proper event listener based on the current value of the switch
    attachSliderListener(updateSwitch.value);

    // Switch change handling
    updateSwitch.addEventListener("calciteSwitchChange", () => {
        updateSwitch.value =  // 'continuous' if it was 'discrete' when changed, otherwise default to 'discrete'
        attachSliderListener(updateSwitch.value); // need to attach the proper listener based on the switch value
    });

    // reset button handling
    resetButton.addEventListener("click",  () => {
        const newVal = appState.symbologyToToggle === "Default" ? "Custom" : "Default"; // determining value for current click
        console.log(`Changing buttom label FROM ${appState.symbologyToToggle} to ${newVal}`)

        // if we're using custom symbology, we want to TURN ON the default
        if (appState.symbologyToToggle === "Default") {
             // Save current custom configuration before overwriting
            appState.lastCustomValues = [...appState.sliderValues];
            appState.lastCustomStops = [...appState.colorStops];

            // Apply defaults
            sliderElement.values = [...appState.defaultValues];
            histogramElement.colorStops = [...appState.defaultStops];
            appState.sliderValues = [...appState.defaultValues];
            appState.colorStops = [...appState.defaultStops];

        // otherwise we're using default symbology, so we want to RESTORE the custom stops before we clicked the reset
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

        updateUI(); // then we need to updateUI to reflect these changes in the map/histogram
        
        // then finally we adjust the label of the button
        resetButton.textContent = newVal;
        resetButton.label = newVal;
        appState.symbologyToToggle = newVal; // then reassinging the state variable for successive clicks
    })

    // then we enable the switch for the user
    updateSwitch.disabled = false;
    resetButton.disabled = false;
    
    // we have to call this function as even though updateUI() is within sliderHandler
    // its not actually called when the app is initialized, we merely add an event listener for it    
    initializeUI();
    
} catch (err) {
    console.error("Error creating histogram:", err);
  }
}

// hiding buttons when slider is being dragged
function hideButtonsOnDrag() {
  appState.buttons.forEach(b => {b.style.visibility = 'hidden'});
}

// showinng buttons when released
function showButtonsOnRelease() {
    appState.buttons.forEach(b => {b.style.visibility = 'visible'});

}

// helper functiont to assign the correct event listener based on the input switch's mode
function attachSliderListener(switchVal) {
    // Remove any existing listeners to avoid duplicates
    sliderElement.removeEventListener("arcgisChange", sliderHandler);
    sliderElement.removeEventListener("arcgisInput", sliderHandler);
    sliderElement.removeEventListener("arcgisInput", hideButtonsOnDrag);
    sliderElement.removeEventListener("arcgisChange", showButtonsOnRelease);


    // this if-else handles how we should adjust the histogram & color swatch according to the switchInput
    if (switchVal === "static") {
        sliderElement.addEventListener("arcgisInput", hideButtonsOnDrag); // fires when a slider is clicked/dragged
        sliderElement.addEventListener("arcgisChange", sliderHandler);
        sliderElement.addEventListener("arcgisChange", showButtonsOnRelease); // fires when a slider is released
    } else {
        sliderElement.addEventListener("arcgisInput", hideButtonsOnDrag); // fires when a slider is clicked/dragged
        sliderElement.addEventListener("arcgisInput", sliderHandler);
        sliderElement.addEventListener("arcgisChange", showButtonsOnRelease); // fires when a slider is released
    }
}


function sliderHandler() {
    // if a slider moves, we'll provide the option to reset defaults
    console.log(`Current state of reset is ${resetButton.textContent}`)

    resetButton.textContent === "Default" ? "Custom" : "Default"; 
    resetButton.label === "Default" ? "Custom" : "Default"; 

    appState.sliderValues = [...sliderElement.values]; // updating state variables to just pull from there, this fixes bug where color stops were one step behind the sliderValues
    
    const newStops = appState.colorStops.map((colorStop, i) => ({ // looping over the state variable color stops
        ...colorStop,
        value: appState.sliderValues[i] // these are the NEW values currently in the slider
    })).sort((a, b) => a.value - b.value); // this resets the slider indices in case sliders cross over
    appState.colorStops = newStops; // assigning the new slider stops to the state variable 
    // appState.sliderValues = [...sliderElement.values]; // updating the global state so we can just pull from there 

    // here we'll update the with the latest custom stops
    if (appState.symbologyToToggle === "Custom") {
        appState.lastCustomValues = [...appState.sliderValues];
        appState.lastCustomStops = [...appState.colorStops];
    }

    // finally calling updateUI, which should only be using state variables
    updateUI(); 
}

function updateHistogram(){
    histogramElement.colorStops = appState.colorStops; // pulling the histogram's stops from the state variable
}

function updateRenderer() {

    const renderer = appState.renderer.clone(); // clone state renderer not to mess up anything

    const colorVarIndex = renderer.visualVariables.findIndex(vv => vv.type === "color");     // finding the 'color' visual variable by type property
    if (colorVarIndex === -1) {
        console.warn("No color visual variable found in renderer.");
        hf.warnUser("Error updating map renderer with color ramp information");
        return;
    }
    
    const colorVariable = renderer.visualVariables[colorVarIndex].clone(); // cloning the color variable at its index

    // checking if the number of stops matches the slider thumbs
    // if the user adds another thumb, there will be a mismatch
    if (colorVariable.stops.length !== appState.sliderValues.length) {
        console.warn("Stop count mismatch — rebuilding stops array.");
        // if the number of thumbs does match the number of color stops
        /* 
        NEED TO ADD CODE HERE
        */
    }
    colorVariable.stops = colorVariable.stops.map((stop, i) => ({
        ...stop,
        color: appState.colorStops[i]?.color || [0, 0, 0], // grabbing the colr from the associated color stop break
        value: appState.sliderValues[i] // grabbing the value from the associated slider element
    }));

    renderer.visualVariables[colorVarIndex] = colorVariable;
    appState.layer.renderer = renderer; // updating the state variable's renderer
    appState.renderer = renderer; // updating the state renderer
}


function updateSwatch() {
    const gradientParts = appState.colorStops.map((stop, index) => {
        
        const percent = ((stop.value - appState.stats.min) / (appState.stats.max - appState.stats.min)) * 100; // getting the color stop's percentage along based on its value
        return `rgb(${stop.color.join(",")}) ${percent}%`; // returning the color at that stop to actually create the swatch
    });
    // creating a linear gradient from the pieces we just assembled from the color stops
    swatch.style.background = `linear-gradient(to right, ${gradientParts.join(", ")})`;
} 

function createButton(buttonValue){
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

function updateButtons(){

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


// FUNCTION FOR QUERYING ALL DATA FROM A FIELD
async function getAllFeatures() {
  try {
    console.log("layer parsed URL:", appState.layer.parsedUrl.path); // log for debug

    const results = await queryAllFeatures({
      url: appState.layer.parsedUrl.path,
      outFields: [appState.field.name] // need to specify the name, as appState.field is a field object
    });
    return results;
  } catch (err) {
    hf.warnUser(`Error querying all features for field: ${appState.field.name}`);
    console.error('err', err);
    return null;
  }
}

function calculateIntermediateStops(){
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

    const intermediateStops = [appState.stats.avg - leftOffset, appState.stats.avg + rightOffset];
    // console.log(`With a mean of ${appState.stats.avg}, the intermediate stops have been calculated as ${intermediateStops}`)

    appState.intermediateStops = intermediateStops;
}