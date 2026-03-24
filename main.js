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
    updateSwitch: null // the value (discrete v. continuous) of the updateSwitch
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
  appState.view.goTo({ scale: default_scale, center: default_center }); // zooming to the lower 48 centered 

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
        let layerMinScale;
        if (layer.minScale === 0){
            layerMinScale = 1
        } else {
            layerMinScale = appState.layer.minScale;
        }
        const midScale = Math.floor((layerMinScale + appState.layer.maxScale) / 2);
  
        // console.log(`Resetting view for Layer to mid scale of: ${midScale}`); // log for debug
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
            await populateDialogForField()
            desc.textContent = appState.description; // pulling the dialog description from the state variable
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
    appState.stats.skew = sampleSkew;
    appState.stats.kurtosis = kurtosis;
}

/* 
OVERALL FUNCTION TO UPDATE ALL UI
*/
function updateUI(){
    updateHistogram();
    updateRenderer();
    updateDescription();
    updateSwatch();
    updateButtons();
}

async function populateDialogForField() {
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

    // error handling for sparse distributions with low record count
    if(appState.stats.count < 20){
        return `With only ${appState.stats.count} observtaions, for now we'll refrain from calculating statistics`
    }

    // inserting skew and kurtosis as additional statistics into the dictionary
    await calculateSkewAndKurtosis(); 

    /* 
    CREATING A RENDERER FOR THE MAP
    */
    // grabbing the green-purple color scheme to use in the map
    const matchingScheme = getSchemeByName({
        basemap: appState.map.basemap,
        geometryType: appState.layer.geometryType,
        theme: "above-and-below",
        name: "Purple and Green 10"
    });
    
    // setting parameters for a continuous renderer
    const colorParams = {
        view: appState.view,
        layer: appState.layer,
        field: appState.field.name,
        theme: "above-and-below",
        colorScheme: matchingScheme
    }
     
    // creating continuous renderer using the given color scheme
    const rendererResult = await colorRendererCreator.createContinuousRenderer(colorParams);
    appState.renderer = rendererResult.renderer;

    appState.layer.renderer = appState.renderer;
    appState.layer.visible = true;
    // console.log("RENDERER INFO  ", mapFeatureLayer.renderer); // log for debug

    /* 
    INITIALIZING THE SLIDER 
    */
    // grabbing the slider element & using the stats to adjust it
    sliderElement.min = appState.stats.min;
    sliderElement.max = appState.stats.max;
    // 5 stop slider
    sliderElement.values = [appState.stats.min, appState.stats.avg - appState.stats.stddev, appState.stats.avg, appState.stats.avg + appState.stats.stddev, appState.stats.max]; // defaulting to min, max, mean, 1sd above and below mean
    appState.sliderValues = sliderElement.values; // initializing sliderValues to handle the FIRST change
    // console.log(`sliderValues represented as ${sliderValues}`) // log for debug
    sliderElement.valueLabelsPlacement = "after"; // placing value labels after (aka under) the slider
    sliderElement.valueLabelsEditingEnabled = true; // allow users to edit slider values directly
    sliderElement.segmentsDraggingDisabled = true; // don't want dragging between the stops
    
    /* 
    INITIALIZING THE COLOR SWATCH
    */
    appState.sliderValues.map((value, index) => {
        const percent = ((value - appState.stats.min) / (appState.stats.max - appState.stats.min)) * 100; // using stats.min/max to place bars relative to the full width of the swatch
        const bar = document.createElement('div'); // creating a div
        bar.id = `bar${index}`; 
        bar.classList.add('vertical'); // assigning it to the vertical class so it gets the styles 
        bar.style.left = `${Math.min(percent, 99.5)}%`; // using the calculated percentate for its horizontal placement along the gradient 
        swatch.appendChild(bar); // finally adding the bar to the color swatch
    });
    
    /* 
    INITIALIZING THE BUTTONS WITHIN THE SWATCH 
    */
    // initializing the buttions within the swatch
    // we're starting at index 1, as there's nothing between the start of the swatch, and stop 0, were adding buttons at the midpoint of the current and previous stops
    appState.buttons.forEach(btn => btn.remove());
    appState.buttons = [];
    for(let i = 1; i < appState.sliderValues.length; i++){
        
        // converting the button's value it to the percentge of the color ramp's width for css placement
        const buttonValue = ((appState.sliderValues[i] - appState.sliderValues[i-1]) / 2) + appState.sliderValues[i-1];; // this gets the midpoint value between the surrounding stop's
        const percentAlongSwatch = ((buttonValue - appState.stats.min) / (appState.stats.max - appState.stats.min)) * 100; // and this converts it to a locaiton along the full swatch for placement
        console.log(`adding button ${i} at the value ${buttonValue}%`);
        
        const button = document.createElement('calcite-button'); // creating the calcite button
        button.iconStart = "plus";
        button.label = "Add color stop";
        button.kind = "neutral";
        button.round = true;
        button.scale = "s";
        button.appearance = "outline";
        button.style.left = `${percentAlongSwatch}%` 

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
            
            // if a button was clicked, we need to loop through the stops and find the surrounding color stops
            let stops = appState.colorStops;
            let lowerStop = stops[0];
            let upperStop = stops[stops.length - 1];
            for (let j = 0; j < stops.length - 1; j++){
                if(buttonValue >= stops[j].value && buttonValue <= stops[j + 1].value) {
                    lowerStop = stops[j];
                    upperStop = stops[j + 1];
                    break;
                } 
            }
                        
            // Midpoint value between the two stops
            let midpoint = ((upperStop.value - lowerStop.value) / 2) + lowerStop.value;

            // Fraction between lower and upper stops
            let fraction = (midpoint - lowerStop.value) / (upperStop.value - lowerStop.value);

            // Interpolate RGB channels
            let resultRed   = Math.round(lowerStop.color[0] + fraction * (upperStop.color[0] - lowerStop.color[0]));
            let resultGreen = Math.round(lowerStop.color[1] + fraction * (upperStop.color[1] - lowerStop.color[1]));
            let resultBlue  = Math.round(lowerStop.color[2] + fraction * (upperStop.color[2] - lowerStop.color[2]));

            console.log(`Adding stop at value ${midpoint} with color rgb(${resultRed},${resultGreen},${resultBlue})`);

            // addding the new stop to our histogram element
            histogramElement.colorStops.push({
                color: [resultRed, resultGreen, resultBlue],
                value: midpoint
            });
            histogramElement.colorStops.sort((a, b) => a.value - b.value); // and resorting the stops by value

            appState.colorStops = histogramElement.colorStops; // update state
            sliderHandler(); // update the UI
        });

        // adding the button to the swatch div, and to the state variable
        swatch.appendChild(button);
        appState.buttons.push(button);
    }
       
    /* 
    INITIALIZING THE HISTOGRAM & RENDERER FOR THE MAP
    */
    // grabbing the histogram element and using the stats to adjust it
    const histogramResult = await histogram({
        layer: appState.layer,
        field: appState.field.name,
        numBins: Math.min(100, appState.stats.count)
    });
    
    histogramElement.min = histogramResult.minValue;
    histogramElement.max = histogramResult.maxValue;
    histogramElement.bins = histogramResult.bins;
    
    // defaulting our histogram's color stops to min, mean, max, and 1 sd above and below mean
    // we're not going to round these values to 2 decimals, as that may truncate some low values to 0
    histogramElement.colorStops = [
        { "color": [129, 0, 230], "value": appState.stats.min}, // first stop, min value at purple
        { "color": [179, 96, 209], "value": appState.stats.avg - appState.stats.stddev}, // stop 2, purpley
        { "color": [242, 207, 158], "value": appState.stats.avg}, // middle stop, mean at yellow
        { "color": [110, 184, 48], "value": appState.stats.avg + appState.stats.stddev}, // stop 4, greenish
        { "color": [43, 153, 0], "value": appState.stats.max} // last stop, max value at green
    ];  
    histogramElement.colorBlendingEnabled = true;
    appState.colorStops = histogramElement.colorStops; // initializing the state variable color stops
    // console.log("Histogram created", histogramResult); // log for debug

    /* 
    INITIALIZING THE SWATCH
    */
    updateSwatch();

    /* 
    SLIDER HANDLER
    */
    function sliderHandler() {
        appState.sliderValues = [...sliderElement.values]; // we FIRST store the new slider values in the state
        // then pull from state sliderValues to update the colorStops in place
        appState.colorStops = appState.colorStops.map((colorStop, i) => ({
            ...colorStop,
            value: appState.sliderValues[i] // these are the NEW values currently in the state variable
        })).sort((a, b) => a.value - b.value); // this resets the slider indices in case sliders cross over
        
        updateUI(); // calling update UI which uses state variables to update histogram, renderer, swatch, buttons, etc
    }

    /* 
    LOGIC FOR UDPATING THE HISTOGRAM BASED ON THE USER-SPECIFIED MODE (CONTINUOUS/DISCRETE)
    */    
    // helper functiont to assign the correct event listener based on the input switch's mode
    function attachSliderListener(switchVal) {
       // Remove any existing listeners to avoid duplicates
        sliderElement.removeEventListener("arcgisChange", sliderHandler);
        sliderElement.removeEventListener("arcgisInput", sliderHandler);

        // this if-else handles how we should adjust the histogram & color swatch according to the switchInput
        if (switchVal === "discrete") {
            sliderElement.addEventListener("arcgisChange", sliderHandler);
        } else {
            sliderElement.addEventListener("arcgisInput", sliderHandler);
        }
    }
    
    /* 
    INITIALIZING THE UPDATE SWITCH
    */
    appState.updateSwitch = updateSwitch.value; // assigning the state updateSwitch to the current swith value
    attachSliderListener(appState.updateSwitch); // attaching the proper event listener based on the current value of the switch

    // Switch change handling for the DOM element
    updateSwitch.addEventListener("calciteSwitchChange", () => {
        // set to 'continuous' if it was 'discrete' when changed, otherwise default to 'discrete'
        updateSwitch.value = updateSwitch.value === "discrete" ? "continuous" : "discrete";
        appState.updateSwitch = updateSwitch.value; // reassigning the state updateSwitch to the current swith value

        // console.log("Switch value is now:", updateSwitch.value); // log for debug
        // any time the switch changes we need to attach the proper listener based on the switch value
        attachSliderListener(appState.updateSwitch); 
    });

    // then we enable the switch (DOM ELEMENT) for the user
    updateSwitch.disabled = false;
    
    // finally, calling update UI which should update histogram, swatch, buttons, description
    updateUI();
    
} catch (err) {
    console.error("Error creating histogram:", err);
  }
}

/* 
UPDATING THE BUTTON POSITIONS
*/
function updateButtons(){
    // clearing old buttons/bars

    for(let i = 1; i < appState.sliderValues.length; i++){
        // claculating the midpoint VALUE of the current division of the color ramp
        const midpoint = ((appState.sliderValues[i] - appState.sliderValues[i-1]) / 2) + appState.sliderValues[i-1];
       
        // converting it to the percentge of the color ramp's width
        const midpointPercent = ((midpoint - appState.stats.min) / (appState.stats.max - appState.stats.min)) * 100;
        console.log(`shifting button ${i} to midpoint ${midpointPercent}%`); // log for debug
        // styling the button's left-alignment using the percentage along the color ramp
        appState.buttons[i - 1].style.left = `${midpointPercent}%`;
    }
}

/* 
UPDATING THE HISTOGRAM
*/
function updateHistogram(){
    histogramElement.colorStops = appState.colorStops; // assigning the histogram's stops from the state variable
}

/* 
UPDATING THE DESCRIPTION IN THE DIALOG
*/
function updateDescription(){
    // console.log("Building a description for the summary statistics:", appState.stats); // log for debug

    const descParts = [];

    descParts.push(
        `${appState.field.alias} has a value range of ${hf.DecimalPrecision2.round(appState.stats.min, 2).toLocaleString()} to ${hf.DecimalPrecision2.round(appState.stats.max, 2).toLocaleString()}, with a mean of ${hf.DecimalPrecision2.round(appState.stats.avg, 2).toLocaleString()} and a median of ${hf.DecimalPrecision2.round(appState.stats.median, 2).toLocaleString()}. With a skewness of ${hf.DecimalPrecision2.round(appState.stats.skewness, 2).toLocaleString()}, the distribution shows`
    ); 

    // Skew severity & direction
    const skewAbs = Math.abs(appState.stats.skewness);

    if (skewAbs > 0.25) {
        let severity;
        if (skewAbs > 1) {
            severity = "substantial";
        } else if (skewAbs > 0.5) {
            severity = "moderate";
        } else {
            severity = "slight";
        }

        const direction = appState.stats.skewness > 0 ? "positive (right)" : "negative (left)";
        descParts.push(`${severity} ${direction} skew.`);
    } else {
        descParts.push(" no noticeable skew.");

    }

    // console.log(`For ${appState.field.name}, kurtosis has been calculated as ${appState.stats.kurtosis}`) // log for debug
    
    // // Kurtosis severity
    const kurtosisAbs = Math.abs(appState.stats.kurtosis);
    let kurtosisSeverity;
    if (kurtosisAbs > 1) {
        kurtosisSeverity = "a leptokurtic (peaked)";
    } else if (kurtosisAbs < -1) {
        kurtosisSeverity = "a platykurtic (flat)";
    } else {
        kurtosisSeverity = "an approximately normal";
    }
    descParts.push(`The data has a kurtosis of ${hf.DecimalPrecision2.round(appState.stats.kurtosis, 2).toLocaleString()}, indicating ${kurtosisSeverity} distribution.`)

    appState.description = descParts.join(" "); // assigning it to the state variable
}

/* 
UPDATING THE COLOR SWATCH
*/
function updateSwatch() {

    const gradientParts = appState.colorStops.map((stop, index) => {
        
        const percent = ((stop.value - appState.stats.min) / (appState.stats.max - appState.stats.min)) * 100; // getting the color stop's percentage along based on its value
        
        // console.log(`Creating stop at value ${stop.value} for index ${index} at ${percent}%`); // log for debug

        const bar = document.getElementById(`bar${index}`); // updating the position of the corresponding vertical bar 
        console.log(`Moving bar index ${index} to color ${stop.color} at value ${stop.value}`) // log for debug
        bar.style.left = `${Math.min(percent, 99.5)}%`;
        
        return `rgb(${stop.color.join(",")}) ${percent}%`; // returning the color at that stop to actually create the swatch
    });
    // creating a linear gradient from the pieces we just assembled from the color stops
    swatch.style.background = `linear-gradient(to right, ${gradientParts.join(", ")})`;
} 

/* 
UPDATING THE MAP RENDERER FROM SLIDER MOVEMENT
*/
function updateRenderer() {

    // first we clone the state renderer so as not to mess up anything
    const renderer = appState.renderer.clone();

    // finding the 'color' visual variable by type property
    const colorVarIndex = renderer.visualVariables.findIndex(vv => vv.type === "color");
    if (colorVarIndex === -1) {
        console.warn("No color visual variable found in renderer.");
        hf.warnUser("Error updating map renderer with color ramp information");
        return;
    }

    // cloning the color variable specifically at its index
    const colorVariable = renderer.visualVariables[colorVarIndex].clone();

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
        color: appState.colorStops[i]?.color || [0, 0, 0], // grabbing the colr from the associated hisotgram break
        value: appState.sliderValues[i] // grabbing the value from the associated slider element
    }));

    renderer.visualVariables[colorVarIndex] = colorVariable;
    appState.layer.renderer = renderer;
    // console.log("Renderer updated:", renderer.visualVariables[colorVarIndex].stops); // renderer updated
}


// FUNCTION FOR DETECTING SLIDER CHANGE (AGNOSTIC TO NUMBER OF SLIDERS)
function determineSliderChanges(oldValues, newValues) {
    // lengths must be equal for a valid index-by-index comparison
    if (oldValues.length !== newValues.length) {
        console.error("Arrays must have the same length for index-by-index comparison.");
        return [];
    }

    // filter the old array to find the value NOT present in the new array
    const oldSliderValue = oldValues.filter(val => !newValues.includes(val))[0];
    // console.log(`Missing value ${oldSliderValue}`); // log for debug

    // find the index in the old array of that missing value 
    // console.log(`old values: ${oldValues}`); // log for debug
    const oldSliderIndex = oldValues.indexOf(oldSliderValue);
    
    // determining the new value 
    const newSliderValue = newValues.filter(val => !oldValues.includes(val))[0]; // index 0 as only one should change at a time
    const newSliderIndex = newValues.indexOf(newSliderValue);
    // console.log(`Slider ${oldSliderIndex} changed to new value: ${newSliderValue}`); // log for debug

    return [oldSliderIndex, oldSliderValue, newSliderIndex, newSliderValue];

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