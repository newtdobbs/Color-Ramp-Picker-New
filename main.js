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
const intl = await $arcgis.import("@arcgis/core/intl.js");
import * as math from "mathjs";
const { getThemes, getSchemes, getSchemeByName, getSchemesByTag, cloneScheme, getMatchingShemes } = await $arcgis.import("@arcgis/core/smartMapping/symbology/color.js");
const { all, names, byName, byTag } = await $arcgis.import("@arcgis/core/smartMapping/symbology/support/colorRamps.js");
import "@arcgis/common-components/components/arcgis-slider";
import histogram from "@arcgis/core/smartMapping/statistics/histogram.js";
import "@arcgis/common-components/components/arcgis-histogram";
const summaryStatistics = await $arcgis.import("@arcgis/core/smartMapping/statistics/summaryStatistics.js");
import incrkurtosis from "@stdlib/stats-incr-kurtosis";
import * as hf from 'helperFunctions.js';

/* 
CONSTANTS
*/
const default_center = [-94.66, 39.04]; // Kansas City as map view as its ~roughly~ central in US
const default_scale = 35000000 // roughly the lower 48

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
    layer: null, // the selected layer from the dropdown menu
    field: null, // the selected field from the layer
    stats: null, // the statistics for the data distibution of the selected field
    sliderValues: null, // the values currently stored in the slider element
    colorStops: null, // the color stops (color and value) currently stored in the slider elemnt
    buttons: null, // the buttons for adding stops
    defaultItemID: "c9faa265b82848498bc0a8390c0afa65",
    fieldsList: null, // the full fields list for the service
    renderer: null
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



// // once the page loads, creat an ampty map view
// let mapView = null;

// // we'll focus on 1 layer at a time
// let mapFeatureLayer = null;

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

  const view = new MapView({
    container: mapContainer, // the dom element to hold our map
    map: map,
    ui: { components: [] }
  });

  view.goTo({ scale: default_scale, center: default_center }); // zooming to the lower 48 centered 

  if (basemapGallery) {
    basemapGallery.view = view; // bind the MapView directly
  }

  return view;
}



// when the page loads, we'll create a basemap-only view
(async () => {
  try {
    appState.view = await createBasemapOnlyView(); // assigning the returned view to the global state
  } catch (e) {
    console.warn("Failed to create basemap-only views on startup:", e);
  }
})();



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

        // if valid information was attained from the service, we'll update the panel heading and create sublayer dropdown
        if (appState.serviceInfo){
            layersPanel.heading = `Layer: ${appState.serviceInfo}`;
            
            createDropdownForService() // create a dropdown to list the sublayers

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
            appState.layer = serviceLayer; // setting the curent layer to the selected layer
            console.log('selection change to:', appState.layer.name, 'layer info:', appState.layer)
            layerSelector.placeholder = `Selected Layer: ${appState.layer.name}`; 

            // call to createMap if the selection changes
            await createMap();

            // re-populating the list of fields, DON'T want to assume that the fields are consistent
            generateFieldsList();
        });
    });

    // at the end here, we'll create the map for the main-map div
    createMap(appState.layer);
    
    return selectedLayer

}

/* 
LOGIC FOR CREATING A MAP VIEW
*/
async function createMap() {
    appState.view.map.removeAll(); // first removing all layers from the current view
    try {
        const layer = new FeatureLayer({
            portalItem: { id: appState.inputItemID },
            layerId: appState.layer.id
        });
        await layer.load();
        // console.log('layer to populate in map', layer); // log for debug
        appState.view.map.add(layer);

        // zooming to the midpoint of the selected layer's visibility
        let layerMinScale;
        if (layer.minScale === 0){
            layerMinScale = 1
        } else {
            layerMinScale = appState.layer.minScale;
        }
        const midScale = Math.floor((layerMinScale + appState.layer.maxScale) / 2);
  
        // console.log(`Resetting view for Layer to mid scale of: ${midScale}`); // log for debug
        appState.map.view.goTo({ scale: midScale, center: default_center }); // re-zooming map the middle visibility rnage in to middle of the country


    } catch (e) {
        console.error('Could not create/load layer from item ID:', itemId, e);
        warnUser('Failed to create map for selected layer');
    }
}

/* 
LOGIC FOR CREATING THE LIST OF FIELDS
*/

function generateFieldsList() {
    fieldsLabel.textContent = "Select a Field";
    
    fieldsList = document.createElement("calcite-list");
    fieldsList.innerHTML = ""; // removing any preexisting fields
    fieldsList.label = "Select a field";
    fieldsList.selectionMode = "single"; 
    fieldsLabel.appendChild(fieldsList);

    // Can log all the fields here for debug
    // console.log("All fields:");
    // mapFeatureLayer.fields.forEach(field => {
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
            desc.textContent = await populateDialogForField()
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
LOGIC FOR COMPILING A DESCRIPTION FROM THE FIELD STATISTICS
*/
async function buildDescription(summaryStats) {
    console.log("Building a description for the summary statistics:", summaryStats);

    const descParts = [];

    descParts.push(
        `${selectedField.alias} has a value range of ${DecimalPrecision2.round(summaryStats.min, 2).toLocaleString()} to ${DecimalPrecision2.round(summaryStats.max, 2).toLocaleString()}, with a mean of ${DecimalPrecision2.round(summaryStats.avg, 2).toLocaleString()} and a median of ${DecimalPrecision2.round(summaryStats.median, 2).toLocaleString()}. With a skewness of ${DecimalPrecision2.round(summaryStats.skewness, 2).toLocaleString()}, the distribution shows`
    ); 

    // Skew severity & direction
    const skewAbs = Math.abs(summaryStats.skewness);

    if (skewAbs > 0.25) {
        let severity;
        if (skewAbs > 1) {
            severity = "substantial";
        } else if (skewAbs > 0.5) {
            severity = "moderate";
        } else {
            severity = "slight";
        }

        const direction = summaryStats.skewness > 0 ? "positive (right)" : "negative (left)";
        descParts.push(`${severity} ${direction} skew.`);
    } else {
        descParts.push(" no noticeable skew.");

    }
    console.log(`For ${selectedField.name}, kurtosis has been calculated as ${summaryStats.kurtosis}`)
    
    // // Kurtosis severity
    const kurtosisAbs = Math.abs(summaryStats.kurtosis);
    let kurtosisSeverity;
    if (kurtosisAbs > 1) {
        kurtosisSeverity = "a leptokurtic (peaked)";
    } else if (kurtosisAbs < -1) {
        kurtosisSeverity = "a platykurtic (flat)";
    } else {
        kurtosisSeverity = "an approximately normal";
    }
    descParts.push(`The data has a kurtosis of ${DecimalPrecision2.round(summaryStats.kurtosis, 2).toLocaleString()}, indicating ${kurtosisSeverity} distribution.`)

    return descParts.join(" ");
}
 


/* 
LOGIC FOR CALCULATING FIELD KURTOSIS, THIS WILL REQUIRE GATHERING ALL RECORDS FROM A FIELD
*/
async function calculateSkewAndKurtosis(statsDictionary) {
    const t0 = performance.now();

    const data = await getData(); // wait for all features
    const t1 = performance.now();
    // console.log(`Querying ${statsDictionary.count} records took ${Math.floor(t1 - t0)} milliseconds.`); // log for debug
    const values = data.features.map(f => f.attributes[selectedField.name]); // this is what actually gets the data value in the selected field for each feature 

    const cleanValues = values.filter(v => typeof v === "number" && !isNaN(v));
    const n = cleanValues.length;

    // third moment
    let summedDiffs = 0;
    cleanValues.forEach(v => {
        summedDiffs += Math.pow(v - statsDictionary.avg, 3);
    });
    const thirdMoment = summedDiffs / n;

    // Population skew
    const populationSkew = thirdMoment / Math.pow(statsDictionary.stddev, 3);

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

    // console.log(`Skew ${sampleSkew} and kurtosis ${kurtosis} off the press`) // lkog for debug

    // returning a list with these two items    
    return [sampleSkew, kurtosis];
}

async function populateDialogForField(ramp) {
  try {

    /* 
    FIRST CALCULATING SUMAMRY STATISTICS
    */
    // gathering summary statistics from the selected field of the active feature layer
    const stats = await summaryStatistics({
      layer: mapFeatureLayer,
      field: selectedField.name
    });

    // console.log("statistics generated from field", stats); // log for debug

    // error handling for sparse distributions with low record count
    if(stats.count < 20){
        return `With only ${stats.count} observtaions, for now we'll refrain from calculating statistics`
    }

    // inserting skew and kurtosis as additional statistics into the dictionary
    const skewAndKurtosis = await calculateSkewAndKurtosis(stats); 
    stats['skewness'] = skewAndKurtosis[0]
    stats['kurtosis'] = skewAndKurtosis[1];

    /* 
    CREATING A RENDERER FOR THE MAP
    */
    // grabbing the green-purple color scheme to use in the map
    const matchingScheme = getSchemeByName({
        basemap: mapView.map.basemap,
        geometryType: mapFeatureLayer.geometryType,
        theme: "above-and-below",
        name: "Purple and Green 10"
    });
    
    // setting parameters for a continuous renderer
    const colorParams = {
        view: mapView,
        layer: mapFeatureLayer,
        field: selectedField.name,
        theme: "above-and-below",
        colorScheme: matchingScheme
    }
     
    // creating continuous renderer using the given color scheme
    const rendererResult = await colorRendererCreator.createContinuousRenderer(colorParams);

    // qapplying the selected color ramp to the map rendering
    mapFeatureLayer.renderer = rendererResult.renderer;
    mapFeatureLayer.visible = true;
    // console.log("RENDERER INFO  ", mapFeatureLayer.renderer); // log for debug

    /* 
    UPDATING THE SLIDER 
    */
    // grabbing the slider element & using the stats to adjust it
    const sliderElement = document.getElementById("color-slider");
    sliderElement.max = stats.max;
    sliderElement.min = stats.min;
    // 5 stop slider
    sliderElement.values = [stats.min, stats.avg - stats.stddev, stats.avg, stats.avg + stats.stddev, stats.max]; // defaulting to min, max, mean, 1sd above and below mean
    // Initial setup
    let sliderValues = sliderElement.values; // initializing sliderValues to handle the FIRST change
    console.log(`sliderValues represented as ${sliderValues}`)
    sliderElement.valueLabelsPlacement = "after"; // placing value labels after (aka under) the slider
    sliderElement.valueLabelsEditingEnabled = true; // allow users to edit slider values directly
    sliderElement.segmentsDraggingDisabled = true; // don't want dragging between the stops

    // initializing the vertical bars within the swatch
    const swatch = document.getElementById("color-swatch");
    sliderElement.values.map((value, index) => {
        // adding the vertical bars
        const percent = ((value - stats.min) / (stats.max - stats.min)) * 100; // using stats.min/max to place bars at the full width of the swatch
        const bar = document.createElement('div'); // creating a div
        bar.id = `bar${index}`; 
        bar.classList.add('vertical'); // assigning it to the vertical class so it gets the styles 
        bar.style.left = `${Math.min(percent, 99.5)}%`; // using the calculated percentate for its horizontal placement along the gradient 
        swatch.appendChild(bar); // finally adding the bar to the color swatch
        
        // adding the plus buttons as well since theres n(stops)-1 bars and n(stops)-1 buttons
        
    });
    
    function buttonMidpoint(buttonIndex) {
        // claculating the midpoint value of the current division of the color ramp, the ACTUAL BUTTON LOCATION
        const mp = ((sliderElement.values[buttonIndex] - sliderElement.values[buttonIndex-1]) / 2) + sliderElement.values[buttonIndex-1];
        
        return mp
    }

    // initializing the buttions within the swatch
    // starting at index 1, and adding buttons at the midpoint of the current and previous stops
    let buttons = [];
    for(let i = 1; i < sliderElement.values.length; i++){
        
        // converting it to the percentge of the color ramp's width for css placement
        const midpoint = buttonMidpoint(i); // this gets the midpoint value between the upper and lower sotps
        const midpointPercent = (midpoint - stats.min) / (stats.max - stats.min); // and this converts it to a locaiton along the full swatch for placement
        console.log(`adding button ${i} at midpoint ${midpointPercent}%`);
        
        const button = document.createElement('calcite-button'); // creating the calcite button
        button.iconStart = "plus";
        button.label = "Add color stop";
        button.kind = "neutral";
        button.round = true;
        button.scale = "s";
        button.appearance = "outline";
        button.style.left = `${midpointPercent * 100}%` 


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

            console.log(`Adding stop for button ${i} at value ${buttonMidpoint(i)}`)

            let stops = histogramElement.colorStops;
            
            let lowerStop = stops[i - 1];
            let upperStop = stops[i];


            // Interpolate RGB channels BETWEEN STOPS
            let resultRed   = Math.round(lowerStop.color[0] + midpointPercent * (upperStop.color[0] - lowerStop.color[0]));
            let resultGreen = Math.round(lowerStop.color[1] + midpointPercent * (upperStop.color[1] - lowerStop.color[1]));
            let resultBlue  = Math.round(lowerStop.color[2] + midpointPercent * (upperStop.color[2] - lowerStop.color[2]));


            console.log(`Adding a slider stop at value ${midpoint} with color (${resultRed},${resultGreen},${resultBlue})`)

            // we need to create a new slider with two values: the value along the range, and the color
            histogramElement.colorStops.push({ color: [resultRed, resultGreen, resultBlue], value: midpoint });
            histogramElement.colorStops.sort((a, b) => a.value - b.value); // resorting the histogram stops
            
            // then we should just be able to call updateSliderHandler, which will update histogram, renderer, color swatch, and new button locations
            // sliderHandler()
        });

        swatch.appendChild(button);
        buttons.push(button);
    }
    
    function updateButtonLocations(){
        for(let i = 1; i < sliderElement.values.length; i++){
            // claculating the midpoint value of the current division of the color ramp
            const midpoint = ((sliderElement.values[i] - sliderElement.values[i-1]) / 2) + sliderElement.values[i-1];
            // converting it to the percentge of the color ramp's width
            const midpointPercent = ((midpoint - stats.min) / (stats.max - stats.min)) * 100;
            // console.log(`shifting button ${i} to midpoint ${midpointPercent}%`); // log for debug
            buttons[i - 1].style.left = `${midpointPercent}%`;
        }
    }

    // console.log("color slider created", sliderElement); // log for debug

    /* 
    UPDATING THE COLOR SWATCH
    */
    function updateColorSwatchFromStops() {
        const swatch = document.getElementById("color-swatch");
        const min = stats.min;
        const max = stats.max;
        
        const gradientParts = histogramElement.colorStops.map((stop, index) => {
            
            const percent = ((stop.value - min) / (max - min)) * 100; // getting the color stop's percentage along based on its value
            
            // console.log(`Creating stop at value ${stop.value} for index ${index} at ${percent}%`); // log for debug

            const bar = document.getElementById(`bar${index}`); // updating the position of the corresponding vertical bar 
            bar.style.left = `${Math.min(percent, 99.5)}%`;
            // console.log(`Color stops are currently ${stop.color} at value ${stop.value}`) // log for debug
           
            return `rgb(${stop.color.join(",")}) ${percent}%`; // returning the color at that stop to actually create the swatch
        });
        

        swatch.style.background = `linear-gradient(to right, ${gradientParts.join(", ")})`;
    } 
    
    /* 
    UPDATING THE HISTOGRAM A RENDERER FOR THE MAP
    */
    // grabbing the histogram element and using the stats to adjust it
    const histogramResult = await histogram({
        layer: mapFeatureLayer,
        field: selectedField.name,
        numBins: Math.min(100, stats.count)
    });
    
    const histogramElement = document.getElementById("histogram");
    histogramElement.min = histogramResult.minValue;
    histogramElement.max = histogramResult.maxValue;
    histogramElement.bins = histogramResult.bins;
    
    // defaulting our histogram's color stops to min, mean, max, and 1 sd above and below mean
    // we're not going to round these values to 2 decimals, as that may truncate some low values to 0
    histogramElement.colorStops = [
        { "color": [129, 0, 230], "value": stats.min}, // first stop, min value at purple
        { "color": [179, 96, 209], "value": stats.avg - stats.stddev}, // stop 2, purpley
        { "color": [242, 207, 158], "value": stats.avg}, // middle stop, mean at yellow
        { "color": [110, 184, 48], "value": stats.avg + stats.stddev}, // stop 4, greenish
        { "color": [43, 153, 0], "value": stats.max} // last stop, max value at green
    ];

    updateColorSwatchFromStops(); // populating the color swatch after creating our histogram

    histogramElement.colorBlendingEnabled = true;
    // console.log("Histogram created", histogramResult); // log for debug

    /* 
    LOGIC FOR UDPATING THE HISTOGRAM BASED ON THE USER-SPECIFIED MODE (CONTINUOUS/DISCRETE)
    */    
    // helper functiont to assign the correct event listener based on the input switch's mode
    function attachSliderListener(value) {
       // Remove any existing listeners to avoid duplicates
        sliderElement.removeEventListener("arcgisChange", sliderHandler);
        sliderElement.removeEventListener("arcgisInput", sliderHandler);
        // sliderElement.removeEventListener("arcgisActiveValueChange", buttonHandler);
        
        // sliderElement.addEventListener("arcgisActiveValueChange", buttonHandler);

        // this if-else handles how we should adjust the histogram & color swatch according to the switchInput
        if (value === "discrete") {
            sliderElement.addEventListener("arcgisChange", sliderHandler);
        } else {
            sliderElement.addEventListener("arcgisInput", sliderHandler);
        }
    }

    function sliderHandler() {
        // graying out the buttons for color ramp visiblity
        // buttons.forEach(button => button.disabled = true);
        
        // FIRST, DETERMINING THE SLIDER CHANGES
        const sliderChanges = determineSliderChanges(sliderValues, sliderElement.values);
        const oldIndex = sliderChanges[0];
        const oldValue = sliderChanges[1];
        const newIndex = sliderChanges[2];
        const newValue = sliderChanges[3];
        // const changedSliderValue = sliderElement.values[changedSliderIndex]; // this is WROONG, ITS just grabbing the 
        
        // UPDATING THE POPOVER TEXT
        // console.log(`Slider ${oldIndex} changed from ${oldValue} to value ${newValue}, now at position ${newIndex}`); // log for debug
        // updatePopoverText(newIndex, newValue);
        
        const newStops = histogramElement.colorStops // looping over the histogram
        .map((colorStop, i) => ({
            ...colorStop,
            value: sliderElement.values[i] // these are the NEW values currently in the slider
        }))
        .sort((a, b) => a.value - b.value); // this resets the slider indices in case sliders cross over
        
        histogramElement.colorStops = newStops; // assigning the new slider stops to the histogram color stops 
        sliderValues = [...sliderElement.values];
        // console.log("Updated histogram color stops", histogramElement.colorStops); // log for debug
        
        // here we need to update the map renderer 
        updateRendererFromSlider();
        
        // here we update the color swatches
        updateColorSwatchFromStops(histogramElement.colorStops);
        
        // then we update the button locations
        updateButtonLocations();

        // console logs for debug
        // console.log(`AFTER CHANGES, HISTOGRAM STOPS ARE:}`);
        // console.table(histogramElement.colorStops);
        // console.log(`AFTER CHANGES, SLIDER VALUES ARE ${sliderElement.values}`);
        
    }
    
  
    // grabbing the switch from the DOM
    const updateSwitch = document.getElementById("update-switch");
    // attaching the proper event listener
    attachSliderListener(updateSwitch.value);

    // Switch change handling
    updateSwitch.addEventListener("calciteSwitchChange", () => {
        // set to 'continuous' if it was 'discrete' when changed, otherwise default to 'discrete'
        updateSwitch.value = updateSwitch.value === "discrete" ? "continuous" : "discrete";
        console.log("Switch value is now:", updateSwitch.value);
        // attaching the proper listener based on the switch value
        attachSliderListener(updateSwitch.value);
    });

    // helper function to update the map renderer when a slider moves
    function updateRendererFromSlider() {

        const renderer = mapFeatureLayer.renderer.clone();

        // finding the 'color' visual variable by type property
        const colorVarIndex = renderer.visualVariables.findIndex(vv => vv.type === "color");
        if (colorVarIndex === -1) {
            console.warn("No color visual variable found in renderer.");
            warnUser("Error updating map renderer with color ramp information");
            return;
        }

        // cloning the color variable specifically at its index
        const colorVariable = renderer.visualVariables[colorVarIndex].clone();

        // checking if the number of stops matches the slider thumbs
        // if the user adds another thumb, there will be a mismatch
        if (colorVariable.stops.length !== sliderElement.values.length) {
            console.warn("Stop count mismatch — rebuilding stops array.");
            // if the number of thumbs does match the number of color stops
        }
        colorVariable.stops = colorVariable.stops.map((stop, i) => ({
            ...stop,
            color: histogramElement.colorStops[i]?.color || [0, 0, 0], // grabbing the colr from the associated hisotgram break
            value: sliderElement.values[i] // grabbing the value from the associated slider element
        }));

        renderer.visualVariables[colorVarIndex] = colorVariable;
        mapFeatureLayer.renderer = renderer;


        // console.log("Renderer updated:", renderer.visualVariables[colorVarIndex].stops); // renderer updated
    }


    // then we enable the switch for the user to prevent before the histogram is generated
    updateSwitch.disabled = false;
    
    /* 
    BUILDING THE DESCRIPTION FOR THE SELECTED FIELD
    */
    return await buildDescription(stats);
    
} catch (err) {
    console.error("Error creating histogram:", err);
  }
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
async function getAllFeatures(featureLayerUrl, selectedField) {
  try {
    console.log("grabbing item from the URL: ", mapFeatureLayer.parsedUrl);

    const results = await queryAllFeatures({
      url: featureLayerUrl,
      outFields: [selectedField]
    });

    // console.log('full query results', results) // log for debug
    return results;
  } catch (err) {
    warnUser(`Error querying all features for field: ${selectedField.name}`);
    console.error('err', err);
    return null;
  }
}