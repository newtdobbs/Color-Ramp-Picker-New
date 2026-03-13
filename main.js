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


/* 
LOGIC FOR ROUNDING A NUMBER TO 2 DECIMAL PLACES
because apparently its impossible in javascript
*/
var DecimalPrecision2 = (function() {
    if (Number.EPSILON === undefined) {
        Number.EPSILON = Math.pow(2, -52);
    }
    if (Math.sign === undefined) {
        Math.sign = function(x) {
            return ((x > 0) - (x < 0)) || +x;
        };
    }
    return {
        // Decimal round (half away from zero)
        round: function(num, decimalPlaces) {
            var p = Math.pow(10, decimalPlaces || 0);
            var n = (num * p) * (1 + Number.EPSILON);
            return Math.round(n) / p;
        },
        // Decimal ceil
        ceil: function(num, decimalPlaces) {
            var p = Math.pow(10, decimalPlaces || 0);
            var n = (num * p) * (1 - Math.sign(num) * Number.EPSILON);
            return Math.ceil(n) / p;
        },
        // Decimal floor
        floor: function(num, decimalPlaces) {
            var p = Math.pow(10, decimalPlaces || 0);
            var n = (num * p) * (1 + Math.sign(num) * Number.EPSILON);
            return Math.floor(n) / p;
        },
        // Decimal trunc
        trunc: function(num, decimalPlaces) {
            return (num < 0 ? this.ceil : this.floor)(num, decimalPlaces);
        },
        // Format using fixed-point notation
        toFixed: function(num, decimalPlaces) {
            return this.round(num, decimalPlaces).toFixed(decimalPlaces);
        }
    };
})();

//  helper function for clamping values
const clamp = (val, min, max) => Math.min(Math.max(val, min), max)

// this function will calculate the slider number for intermediate stops (stops 2 and 4)
function calculateIntermediateStop(kurtosisValue, kurtosisCap, sd){

    // for kurtosis of 0 (normal distribution), we'll default to the halfway point between mean and the standard deviation
    if (kurtosisValue === 0){
        return sd / 2
    } else {

        // we'll clamp our kurtosis between -1.9 and 1.9
        kurtosisValue = clamp(kurtosisValue, -1.9, 1.9)
        
        // formula = actual kurtosis / kurtosis cap * standard deviation
        return (kurtosisValue / kurtosisCap) * sd
    }

}

// Specifying the ideal field types and field value types, leaving all options in for un-ommenting
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

const mainMap = document.getElementById("main-map")
// once the page loads, creat an ampty map view
let mapView = null;

// we'll focus on 1 layer at a time
let mapFeatureLayer = null;

// setting Kansas City as default center as its ~roughly~ central in US
const default_center = [-94.66, 39.04];


async function createBasemapOnlyView() {

    // create a basemap-only view for a given container
//   const base = new Basemap({
//     baseLayers: [
//       new VectorTileLayer({
//         portalItem: { id: "291da5eab3a0412593b66d384379f89f" },
//         title: "Light Gray Canvas Base",
//         opacity: 1,
//         visible: true
//       })
//     ]
//   });

  const map = new Map({
    basemap: 'gray-vector',
    layers: []
  });

  const view = new MapView({
    container: mainMap,
    map: map,
    ui: { components: [] }
  });

  await view.when();
  view.goTo({ scale: 35000000, center: default_center });

  const basemapGallery = document.querySelector("arcgis-basemap-gallery");
  if (basemapGallery) {
    basemapGallery.view = view; // bind the MapView directly
  }

  return view;
}
// when the page loads, we'll create a basemap-only view
(async () => {
  try {
    mapView = await createBasemapOnlyView();
  } catch (e) {
    console.warn("Failed to create basemap-only views on startup:", e);
  }
})();



// initializing active widget to basemaps, as its open on page load
let activeWidget = "layers";

 const handleActionBarClick = ({ target }) => {

    console.log("active widget is currently:", activeWidget)
    if (target.tagName !== "CALCITE-ACTION") {
        return;
    }

    if (activeWidget) {
        document.querySelector(`[data-action-id=${activeWidget}]`).active = false;
        document.querySelector(`[data-panel-id=${activeWidget}]`).closed = true;
    }

    const nextWidget = target.dataset.actionId;
    if (nextWidget !== activeWidget) {


        document.querySelector(`[data-action-id=${nextWidget}]`).active = true;
        document.querySelector(`[data-panel-id=${nextWidget}]`).closed = false;
        activeWidget = nextWidget;
        document.querySelector(`[data-panel-id=${nextWidget}]`).setFocus();
    } else {
        activeWidget = null;
    }
};
// Panel interaction
const panelEls = document.querySelectorAll("calcite-panel");
for (let i = 0; i < panelEls.length; i++) {
    panelEls[i].addEventListener("calcitePanelClose", () => {
    document.querySelector(`[data-action-id=${activeWidget}]`).active = false;
    document.querySelector(`[data-action-id=${activeWidget}]`).setFocus();
    activeWidget = null;
    });
}

document.querySelector("calcite-action-bar").addEventListener("click", handleActionBarClick);

let actionBarExpanded = false;

document.addEventListener("calciteActionBarToggle", event => {
    actionBarExpanded = !actionBarExpanded;
    let mapElCopyrightText = actionBarExpanded ? "125px" : "45px";
    mapEl.style.setProperty("--arcgis-layout-overlay-space-left", `${mapElCopyrightText}`);
});

/* 
LOGIC FOR INPUT DIALOG
this will fire every time a new agol id is input
We want to populate the dropdown with sublayers, and create a map
*/
let selectedID = null;
let serviceTitle = "";
let serviceInfo = null;
let selectedLayer = null;    
if (input) {

    input.addEventListener("keydown", async function (event) {
        if (event.key === "Enter") {
        event.preventDefault();

        // hardcoding a default value --REMOVE THIS FOR DEPLOYMENT
        if (input.value === ""){
            selectedID = "c9faa265b82848498bc0a8390c0afa65" // MINC
        } else {
            const raw = input.value || "";
            const itemIDs = raw.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
            const uniqueItemIDs = Array.from(new Set(itemIDs));
            selectedID = uniqueItemIDs[0]; // only taking the first ID if multiple are provided
        }

        console.log("first id is", selectedID);

        // check the layers present in the service
        serviceInfo = await getServiceLayers(selectedID);

        if (serviceInfo){
            document.getElementById("layers-panel").heading = `Layer: ${serviceInfo.title}`;
        }

        // create a dropdown to list the sublayers
        createDropdownForService(serviceInfo.layers)

        input.value = "";
        }
    });
} else {
  console.warn("input-dialog element not found in DOM.");
}

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

            console.log('portal item:', portalItem.title)
            const portalItemTitle = portalItem.title


            // Request the service metadata
            const serviceUrl = portalItem.url;
            const response = await esriRequest(serviceUrl, {
                query: { f: "json" }
            });

            const layersInfo = response.data.layers || [];

            console.log("layers info: ", layersInfo);

            return {
                title: portalItem.title,
                layers: layersInfo
            };
        } catch (error) {
            // Code to handle the error
            console.warn(`An error occurred while fetching item ${itemId}, ${error.message}`);
            return null;
        }
    } else {
        console.warn(`ID ${itemId} failed regex format check`);
        return null;
    }
}


/*
LOGIC FOR LAYER SELECTOR
The dropdown list should be populated AFTER the item ID is input
*/
function createDropdownForService(serviceLayersInfo) {
    const layerSelector = document.getElementById("layer-selector")
    layerSelector.innerHTML = ""; // removing old options, in case sconsecutive layers dont have the same sublayers
    layerSelector.placeholder = 'Select a Layer';


    // selectedLayer = serviceLayersInfo[0]; // if needed we'll use the first entry in service layers info


    if (serviceLayersInfo.length === 1){
        layerSelector.placeholder = `Selected Layer: ${selectedLayer.name}`;
        selectedLayer = serviceLayersInfo[0]; // if needed we'll use the first entry in service layers info

    }

    serviceLayersInfo.forEach((serviceLayer) => {
        const layerOption = document.createElement("calcite-autocomplete-item");
        layerOption.label = serviceLayer.name || serviceLayer.id; // use the layer id as fallback
        layerOption.heading = serviceLayer.name || serviceLayer.id; // use the layer id as fallback
        layerOption.value = serviceLayer.id; // the layer id as value allows us to index it in the array

        layerSelector.appendChild(layerOption); // adding the item to the autocomplete dropdown
        layerOption.addEventListener("calciteAutocompleteItemSelect", async () => {
            selectedLayer = serviceLayer; // setting the curent layer to the selected layer
            console.log('selection change to:', selectedLayer.name, 'layer info:', selectedLayer)
            layerSelector.placeholder = `Selected Layer: ${selectedLayer.name}`; 

            // call to createMap if the selection changes
            await createMap(selectedID, selectedLayer);

            // re-populating the list of fields, DON'T want to assume that the fields are consistent
            generateFieldsList();
        });
    });

    return selectedLayer
    // at the end here, we'll create the map for the main-map div
    // createMap(selectedLayer)

}

/* 
LOGIC FOR CREATING A MAP VIEW
*/
let viewMidpoint;
async function createMap(itemId, sublayer) {
    mapView.map.removeAll(); // first removing all layers from the current view
    try {
        const layer = new FeatureLayer({
            portalItem: { id: itemId },
            layerId: sublayer.id
        });
        await layer.load();
        mapFeatureLayer = layer;
        console.log('mapfeatureLayer', mapFeatureLayer);
        mapView.map.add(layer);
        await mapView.when();

        // zooming to the midpoint of the selected layer's visibility
        let layerMinScale;
        if (layer.minScale === 0){
            layerMinScale = 1
        } else {
            layerMinScale = layer.minScale;
        }
        const midScale = Math.floor((layerMinScale + layer.maxScale) / 2);
  
        // console.log(`Resetting view for Layer to mid scale of: ${midScale}`);
        mapView.goTo({ scale: midScale, center: default_center });


    } catch (e) {
        console.error('Could not create/load layer from item ID:', itemId, e);
        warnUser('Failed to create map for selected layer');
    }
}

/* 
LOGIC FOR CREATING THE LIST OF FIELDS
*/
let selectedField;
let listItem;
let fieldsList;
let fieldValues; // an array to hold the values of the selected field
function generateFieldsList() {
    const fieldsLabel = document.getElementById("fields-label");
    fieldsLabel.textContent = "Select a Field";

    fieldsList = document.createElement("calcite-list");
    fieldsList.label = "Select a field";
    fieldsList.selectionMode = "single"; // also fix typo: selectionzMode → selectionMode
    fieldsLabel.appendChild(fieldsList);

    // Clear old list items if needed
    fieldsList.innerHTML = "";

    // Can log all the fields here for debug
    // console.log("All fields:");
    // mapFeatureLayer.fields.forEach(field => {
    //     console.log(`Field: ${field.name}, type: ${field.type}, valueType: ${field.valueType}`);
    // });


    mapFeatureLayer.fields.forEach(field => {
        if (goodFieldTypes.includes(field.type) && goodFieldValueTypes.includes(field.valueType)) {
        const listItem = document.createElement("calcite-list-item");
        listItem.label = field.alias;
        listItem.scale = "s";
        listItem.value = field.name;
        listItem.closable = true;

        fieldsList.appendChild(listItem);

        listItem.addEventListener("calciteListItemSelect", async () => {
            selectedField = selectedField === field ? null : field;

            console.log("Selected field is:", selectedField.alias, selectedField)
            // removing any previous warning for the user
            if(document.querySelector("calcite-alert")){
                document.querySelector("calcite-alert").remove();
            }
        });

        listItem.addEventListener("calciteListItemClose", async () => {
            console.log('removing field: ', field.alias);
            if (selectedField.alias === field.alias){
                selectedField = null;
                // warnUser('Select a field from the fields list')
            }
            listItem.remove();
        });
        }
    });
}


/* 
LOGIC FOR THE DIALOG BOX
This should only appear after the 'generate histogram' button was clicked
*/
const exButtonEl = document.getElementById("example-button");
const exDialogEl = document.getElementById("example-dialog");

exButtonEl?.addEventListener("click", function() {
    exDialogEl.open = true;
});
// functionality to handle the generate button
const generateButton = document.getElementById("generate-btn");
const bottomDialog = document.getElementById("bottom-dialog");
let applyButton;
generateButton.addEventListener("click", async () => {
   
    // error handling if no field is selected
    if(!selectedField){
        warnUser('Select a field from the fields list')
        return
    }
    
    // otherwise, closing any pre-existing dialog so we can re-generate its contents
    if (bottomDialog.open){
        // bottomDialog.textContent = "";    
        bottomDialog.open = false;
    }
        
    
    // resertting the dialog
    // bottomDialog.textContent = "";

    
    
    //if its non-numeric warn user
    if(!goodFieldTypes.includes(selectedField.type)){
        warnUser("Please ensure the selected field is one of the following types: small-integer, integer,  single,  double,  long,  string, big-integer.")
        selectedField = null;
        return
    }
    // // make sure its not just a Geoid, uniqueid, make sure its a DATA field
    if(!goodFieldValueTypes.includes(selectedField.valueType)){
        warnUser("Please ensure the selected field is one of the following value types:  count-or-amount, currency")
        selectedField = null;
        return
    }   

    // setting the heading and opening the dialog but with a loader
    
    bottomDialog.open = true;
    bottomDialog.componentOnReady();
    bottomDialog.loading = true;
    
    try {
        
        
        // here well calculate statistics for the selected field of whatever the cuurentLayer is
        
        const fieldStats =  await calculateFieldStats(mapFeatureLayer, selectedField);
        
        
        // here we'll assemble a description of the data distribution
        // const desc = document.createElement("div");
        // desc.textContent = buildDescription();
        // desc.slot = "content-bottom";
        
        // bottomDialog.appendChild(desc);
 
        // removing the loader
        const hist = await createHistogramForField()

        // updating the dialog header
        bottomDialog.heading = `Color Ramp Information for ${selectedField.alias}`
        
    } catch(err){
        console.log("Error generating histogram:", err)
        bottomDialog.heading = `Error Generating Color Ramp Information for ${selectedField.alias}`
    }
    bottomDialog.loading = false;
    bottomDialog.open = true;
        
});
    
    /* 
    LOGIC FOR CALCULATING STATISTICS ON A GIVEN FIELD
*/
let statsSummary;
async function calculateFieldStats(layer, field) {

    // need to ensure this query returns more than 1000 values if applicable
    const query = layer.createQuery();
    query.where = "1=1";
    query.outFields = [field.name];
    query.returnGeometry = false;

    // here we query all the features for the selected field, filtering out null/undefined/NaN values
    const result = await layer.queryFeatures(query);
    const removeValues = [null, undefined, NaN]
    const values = result.features.map(f => f.attributes[field.name]).filter(Boolean); // the array of values in the selected field after filtering 
    fieldValues = values; // assigning the filtered values from the selected field to the fieldValues global object

    let desc = "";
    
    // can print values for debug
    console.log('number of values from field:', values.length);
    
    // error handling for sparse distributions, taken AFTER the validity filter
    if (values.length <= 10) {
        desc = `With only ${values.length} observtaions, for now we'll refrain from calculating statistics`
        return desc;
    }

    const fi_mean = DecimalPrecision2.round(math.mean(values), 2);
    const fi_median = DecimalPrecision2.round(math.median(values), 2);
    const fi_std = DecimalPrecision2.round(math.std(values), 2);
    const fi_min = DecimalPrecision2.round(math.min(values), 2);
    const fi_max = DecimalPrecision2.round(math.max(values), 2);
    const fi_skewness = DecimalPrecision2.round(3 * (math.mean(values) - math.median(values)) / math.std(values), 2);

    let fi_kurtosis;
    if (fi_std !== 0) {
        // excess kurtosis = average of the fourth standardized moment minus 3
        // a normal distribution  has a kurtosis of 3
        fi_kurtosis = DecimalPrecision2.round(math.mean(values.map(v => Math.pow((v - fi_mean) / fi_std, 4))) - 3, 2);
    } else {
        // if all values are identical it yields an undefined kurtosis, which we'll treat as null
        fi_kurtosis = null;
    }

    // first skew stength
    let skewSeverity;
    let skewDirection;
    // skew strength
    if(Math.abs(fi_skewness > 0.25)) {
        skewSeverity = "slight"

        if(Math.abs(fi_skewness > 0.5)) {
            skewSeverity = "moderate"

            if(Math.abs(fi_skewness > 1)) {
                skewSeverity = "substantial"
            }
        }
        // skew direction
        if(fi_skewness > 0) {
            skewDirection = "positive (right)" // AKA right skew
        }
        else {
            skewDirection = "negative (left)" // AKA left skew
        }  
    } else {
        skewSeverity = "none"
        skewDirection = "none"
    }

    // then kurtosis
    let kurtosisSeverity;
    if (fi_kurtosis > 2){
        kurtosisSeverity = "peaked"
        // clamping kurtosis at 2 for extremely high values
    } else if(fi_kurtosis < -2){
        kurtosisSeverity = "flat"
        // clamping kurtosis at -2 for extremely low values
        } else {
        kurtosisSeverity = "none"
    }

    // interpret modalityif possible
    // let modalityInterp;

    // assembling a dictionary of the statistics
    statsSummary = {
        'length' : values.length,
        'min' : fi_min,
        'max' : fi_max,
        'mean' : fi_mean,
        'median' : fi_median,
        'std' : fi_std,
        'skewness' : fi_skewness,
        'kurtosis' : fi_kurtosis,
        'skewSeverity' : skewSeverity,
        'skewDirection' : skewDirection,
        'kurtosisSeverity' : kurtosisSeverity
    }
    
    console.log('STATS SUMMARY', statsSummary);
    return statsSummary

}

/* 
LOGIC FOR COMPILING A DESCRIPTION FROM THE FIELD STATISTICS
*/
function buildDescription(){

    const descParts = []

    descParts.push(`${selectedField.alias} has a value range of ${statsSummary.min.toLocaleString()} to ${statsSummary.max.toLocaleString()}, with a mean of ${statsSummary.mean.toLocaleString()} and a median of ${statsSummary.median.toLocaleString()}`);

    // skew
    if (statsSummary.skewSeverity && statsSummary.skewSeverity.toLowerCase() !== "none"){
        descParts.push(`The distribution has a skewness of ${statsSummary.skewness}, exhibiting ${statsSummary.skewSeverity} ${statsSummary.skewDirection} skew.`);
    } else{
        descParts.push('The distribution shows no noticeable skew.');
    }

    // kurtosis
    if (statsSummary.kurtosisSeverity && statsSummary.kurtosisSeverity.toLowerCase() !== 'none'){
        descParts.push(`The data has a kurtosis of ${statsSummary.kurtosis}, indicating a ${statsSummary.kurtosisSeverity} distribution.`)
    } else{
        descParts.push(`The data has a kurtosis of ${statsSummary.kurtosis}, approximately normal.`);
    }
    
    return descParts.join(" ");

}

async function createHistogramForField(ramp) {
  try {

    // gathering summary statistics from the selected field of the active feature layer
    const stats = await summaryStatistics({
      layer: mapFeatureLayer,
      field: selectedField.name
    });

    console.log("statistics generate", stats);

    // error handling for sparse distributions with low record count
    if(stats.count < 20){
        return `With only ${stats.count} observtaions, for now we'll refrain from calculating statistics`
    }

    // inserting skew and kurtosis as additional statistics into the dictionary
    stats['skewness'] = 3 * (stats.mean - stats.median) / stats.stddev // from pearson's median skewness


    // we'll hold off on calculating kurtosis for now, as that will require querying ALL records from the field
    // for now we'll put intermediate stops at midpoints
    // stats['kurtosis'] = calculateKurtosis

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
    console.log("RENDERER INFO  ", mapFeatureLayer.renderer);

    // grabbing the slider element & using the stats to adjust it
    const sliderElement = document.getElementById("color-slider");
    sliderElement.min = stats.min;
    sliderElement.max = stats.max;
    // 5 stop slider
    sliderElement.values = [stats.min, stats.avg - stats.stddev, stats.avg, stats.avg + stats.stddev, stats.max];
    sliderElement.valueLabelsPlacement = "after"; // placing value labels after (aka under) the slider
    console.log("color slider created", sliderElement); // log for debug
    

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
    histogramElement.colorStops = [
        { "color": [129, 0, 230], "value": stats.min}, // first stop, min value at purple
        { "color": [179, 96, 209], "value": stats.avg - stats.stddev }, // stop 2, purpley
        { "color": [242, 207, 158], "value": stats.avg }, // middle stop, mean at yellow
        { "color": [110, 184, 48], "value": stats.avg + stats.stddev}, // stop 4, greenish
        { "color": [43, 153, 0], "value": stats.max } // last stop, max value at green
    ];

    histogramElement.colorBlendingEnabled = true;

    console.log("Histogram created", histogramResult); // log for debug

    /* 
    LOGIC FOR UDPATING THE HISTOGRAM BASED ON THE USER-SPECIFIED MODE (CONTINUOUS/DISCRETE)
    */    
    // helper functiont to assign the correct event listener based on the input switch's mode
    function attachSliderListener(value) {
       // Remove any existing listeners to avoid duplicates
        sliderElement.removeEventListener("arcgisChange", sliderHandler);
        sliderElement.removeEventListener("arcgisInput", sliderHandler);

        if (value === "discrete") {
            sliderElement.addEventListener("arcgisChange", sliderHandler);
        } else {
            sliderElement.addEventListener("arcgisInput", sliderHandler);
        }
    }

    // helper fuinction to update the histogram based on slider changes, agnostic to updateSwitch mode
    function sliderHandler() {
        // variable to track which slider was changed, only one at a time
        const changedSliderIndex = determineSliderChanges(sliderElement.values, sliderValues);
         // variable to track the new value for a slider, shouldn't matter which slider is changed
        const changedSliderValue = sliderElement.values[changedSliderIndex];
        console.log(`Slider ${changedSliderIndex} changed to value ${changedSliderValue}`);

        // creating an array using the  previous histogram color stops and assigning new values 
        const newStops = histogramElement.colorStops
            .map((colorStop, i) => ({
            ...colorStop,
            value: sliderElement.values[i]
            }))
            .sort((a, b) => a.value - b.value); // this resets the slider indices in case sliders cross over

        // assigning the new slider stops to the histogram color stops 
        histogramElement.colorStops = newStops;
        sliderValues = [...sliderElement.values];
        console.log("Updated histogram color stops", histogramElement.colorStops);

        // here we need to update the map renderer 
        updateRendererFromSlider();
    }

    // Initial setup
    let sliderValues = sliderElement.values;
    const updateSwitch = document.getElementById("update-switch");
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

        console.log("Renderer updated:", renderer.visualVariables[colorVarIndex].stops);
    }
    
} catch (err) {
    console.error("Error creating histogram:", err);
  }
}



/* 
HELPER FUNCTIONS
*/

// FUNCTION FOR DIPLAYING WARNING MESSAGE
function warnUser(message){
  // clear any existing warnings
  const existingAlert = document.querySelector("calcite-alert")
  if(existingAlert) existingAlert.remove();

  // displaying an alert, warning the user to turn on the overlay when taking screensbot 
  const newAlert = document.createElement("calcite-alert");
  newAlert.open = true;
  newAlert.kind = "warning";
  newAlert.autoDismiss = true;
  const title = document.createElement("calcite-alert-message");
  title.textContent = message;
  title.slot = "title";
  newAlert.appendChild(title);

  // appending the warning to the DOM
  document.body.appendChild(newAlert);
}

// FUNCTION FOR DETECTING SLIDER CHANGE (AGNOSTIC TO NUMBER OF SLIDERS)
function determineSliderChanges(arr1, arr2) {
  // lengths must be equal for a valid index-by-index comparison
  if (arr1.length !== arr2.length) {
    console.error("Arrays must have the same length for index-by-index comparison.");
    return [];
  }
  return arr1
    .map((value, index) => value !== arr2[index] ? index : null) // where arr1 DOESNT match arr2 it converts to the index, for equivalence we leave null
    .filter(index => index !== null)[0]; // filterting out nulls (matches between arr1 and arr2), taking [0] since we only change one slider at a time
}


