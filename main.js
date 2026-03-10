import "./style.css";
const Map = await $arcgis.import("@arcgis/core/Map.js");
const MapView = await $arcgis.import("@arcgis/core/views/MapView.js");
const FeatureLayer = await $arcgis.import("@arcgis/core/layers/FeatureLayer.js");
const PortalItem = await $arcgis.import("@arcgis/core/portal/PortalItem.js");
const esriRequest = await $arcgis.import("@arcgis/core/request.js");
const BasemapGallery = await $arcgis.import("@arcgis/core/widgets/BasemapGallery.js");
// const histogram = await $arcgis.import("@arcgis/core/smartMapping/statistics/histogram.js");
const colorSymbology = await $arcgis.import("@arcgis/core/smartMapping/symbology/color.js");
const colorRendererCreator = await $arcgis.import("@arcgis/core/smartMapping/renderers/color.js");
const histogram = await  $arcgis.import("@arcgis/core/smartMapping/statistics/histogram.js");
const Color = await $arcgis.import("@arcgis/core/Color.js");
const intl = await $arcgis.import("@arcgis/core/intl.js");
import * as math from "mathjs";
const { getThemes, getSchemes, getSchemeByName, getSchemesByTag, cloneScheme, getMatchingShemes } = await $arcgis.import("@arcgis/core/smartMapping/symbology/color.js");
const { all, names, byName, byTag } = await $arcgis.import("@arcgis/core/smartMapping/symbology/support/colorRamps.js");

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
    if (kurtosisValue == 0){
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
        if (input.value == ""){
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


    if (serviceLayersInfo.length == 1){
        layerSelector.placeholder = `Selected Layer: ${selectedLayer.name}`;
        selectedLayer = serviceLayersInfo[0]; // if needed we'll use the first entry in service layers info

    }

    serviceLayersInfo.forEach((serviceLayer) => {
        const layerOption = document.createElement("calcite-autocomplete-item");
        layerOption.label = serviceLayer.name || serviceLayer.id; // use the layer id as fallback
        layerOption.heading = serviceLayer.name || serviceLayer.id; // use the layer id as fallback
        layerOption.value = serviceLayer.id; // the layer id as value allows us to index it in the array

        layerSelector.appendChild(layerOption); // adding the item to the autocomplete dropdown
        layerOption.addEventListener("calciteAutocompleteItemSelect", () => {
            selectedLayer = serviceLayer; // setting the curent layer to the selected layer
            console.log('selection change to:', selectedLayer.name, 'layer info:', selectedLayer)
            layerSelector.placeholder = `Selected Layer: ${selectedLayer.name}`; 

            // call to createMap if the selection changes
            createMap(selectedID, selectedLayer)
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
        mapView.map.add(layer);
        await mapView.when();

        // zooming to the midpoint of the selected layer's visibility
        // let layerMinScale;
        // if (layer.minScale == 0){
        //     layerMinScale = 1
        // } else {
        //     layerMinScale = layer.minScale;
        // }
        // const midScale = Math.floor((layerMinScale + layer.maxScale) / 2);
  
        // console.log(`Resetting view for Layer to mid scale of: ${midScale}`);
        // mapView.goTo({ scale: midScale, center: default_center });

        generateFieldsList(mapFeatureLayer)

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
function generateFieldsList(focusLayer) {

  const fieldsLabel = document.getElementById("fields-label");
  fieldsLabel.textContent = "Select a Field";

  fieldsList = document.createElement("calcite-list");
  fieldsList.label = "Select a field";
  fieldsList.selectionMode = "single"; // also fix typo: selectionzMode → selectionMode
  fieldsLabel.appendChild(fieldsList);

  // Clear old list items if needed
  fieldsList.innerHTML = "";

  // Can log all the fields here for debug
//   console.log("All fields:");
//   focusLayer.fields.forEach(field => {
//     console.log(`Field: ${field.name}, type: ${field.type}, valueType: ${field.valueType}`);
//   });

  focusLayer.fields.forEach(field => {
    if (goodFieldTypes.includes(field.type) && goodFieldValueTypes.includes(field.valueType)) {
      const listItem = document.createElement("calcite-list-item");
      listItem.label = field.alias;
      listItem.scale = "s";
      listItem.value = field.name;
      listItem.closable = true;

      fieldsList.appendChild(listItem);

      listItem.addEventListener("calciteListItemSelect", async () => {
        selectedField = selectedField === field ? null : field;
        // removing any previous warning for the user
        if(document.querySelector("calcite-alert")){
            document.querySelector("calcite-alert").remove();
        }
      });

      listItem.addEventListener("calciteListItemClose", async () => {
        console.log('removing field: ', field.alias);
        if (selectedField.alias == field.alias){
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

    // closing any pre-existing dialog so we can re-generate its contents
    if (bottomDialog.open){
        bottomDialog.open = false;
    }

    // error handling if no field is selected
    console.log('selected field is:', selectedField)
    if(!selectedField){
        warnUser('Select a field from the fields list')
        return
    }

    // resertting the dialog
    bottomDialog.textContent = "";

    bottomDialog.heading = `Color Ramp Information for ${selectedField.alias}`

    // console.log('generate clicked')
    // if there's nothing selected,warn user

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

 
    // here well calculate statistics for the selected field of whatever the cuurentLayer is

    const fieldStats =  await calculateFieldStats(mapFeatureLayer, selectedField);


    // here we'll assemble a description of the data distribution
    const desc = document.createElement("div");
    desc.textContent = buildDescription();
    desc.slot = "content-bottom";

    bottomDialog.appendChild(desc);
    bottomDialog.open = true;
  

    // we'll pass the ramp as an arg, so that way we can even recommend a ramp
    // const specifiedRamp = byName("Purple and Green 10") 
    const hist = await createHistogramForField("Purple and Green 10")
    bottomDialog.appendChild(hist); 


//   // we may not need this buuton, could be used instead to export colorscheme JSON
//   // applyButton = document.createElement("calcite-button");
//   // applyButton.slot = "footer-end";
//   // applyButton.textContent = "Apply Colorscale";
//   // bottomPanel.appendChild(applyButton);

});

/* 
LOGIC FOR CALCULATING STATISTICS ON A GIVEN FIELD
*/
let statsSummary;
async function calculateFieldStats(layer, field) {
  const query = layer.createQuery();
  query.where = "1=1";
  query.outFields = [field.name];
  query.returnGeometry = false;

  // here we query all the features for the selected field, filtering out null/undefined/NaN values
  const result = await layer.queryFeatures(query);
  const removeValues = [null, undefined, NaN]
  const values = result.features.map(f => f.attributes[field.name]).filter(Boolean);

  let desc = "";

  // can print values for debug
  console.log('number of values from field:', values.length);
  
  // error handling for sparse distributions
  if (values.length <= 10) {
    desc = `With only ${values.length} observtaions, for now we'll refrain from calculating statistics`
    return desc;
  }

  const fi_mean = DecimalPrecision2.round(math.mean(values), 2);
  const fi_median = DecimalPrecision2.round(math.median(values), 2);
  const fi_std = DecimalPrecision2.round(math.std(values), 2);
  const fi_min = math.min(values);
  const fi_max = math.max(values);
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

async function createHistogramForField(ramp){
    const colorSlider = document.createElement("arcgis-slider-color-legacy");
    colorSlider.componentOnReady();

    // listen to arcgisThumbChange and arcgisThumbDrag events
    // update the layer's renderer to match the slider's color stops
    colorSlider.addEventListener("arcgisThumbChange", updateRendererFromSlider);
    colorSlider.addEventListener("arcgisThumbDrag", updateRendererFromSlider);
    colorSlider.addEventListener("arcgisPropertyChange", updateRendererFromSlider);

    const matchingScheme = getSchemeByName({
        basemap: mapView.map.basemap,
        geometryType: mapFeatureLayer.geometryType,
        theme: "above-and-below",
        name: "Purple and Green 10"
    });


    const colorParams = {
        view: mapView,
        layer: mapFeatureLayer,
        field: selectedField.name,
        theme: "above-and-below",
        colorScheme: matchingScheme
    }

    const rendererResult = await colorRendererCreator.createContinuousRenderer(colorParams);

    // console.log("renderer result", rendererResult)

    // set the renderer to the layer and add it to the map
    const vv = rendererResult.visualVariable;
    mapFeatureLayer.renderer = rendererResult.renderer;
    mapFeatureLayer.visible = true;

    const histogramResult = await histogram({
        ...colorParams,
        numBins: 100,
    });

    // create reference to histogram bar elements for updating
    // their style as the user drags slider thumbs
    
    const bars = [];
    const histogramConfig = {
        average: statsSummary.mean,
        barCreatedFunction: (index, element) => {
            const bin = histogramResult.bins[index];
            const midValue = (bin.maxValue - bin.minValue) / 2 + bin.minValue;
            const color = getColorFromValue(colorSlider.stops, midValue);
            element.setAttribute("fill", color.toHex());
            bars.push(element);
        },
        bins: histogramResult.bins,
        standardDeviation: statsSummary.std,
    };

    colorSlider.updateFromRendererResult(rendererResult, histogramResult);
    colorSlider.histogramConfig = histogramConfig;
    colorSlider.labelFormatFunction = (value) => {
        return DecimalPrecision2.round(value, 2).toLocaleString(); // labeling our histogram bars with 2 decimals
    };
    
    console.log("STOPS BEFORE REASSIGNEMENT")
    let print = ""
    colorSlider.stops.forEach((stop, index) => {
        print += `Stop: ${index}, Value: ${stop.value}, `;
    });
    console.log(print);



    colorSlider.stops = [
        { value: statsSummary.min, color: new Color([129, 0, 230]), handle: true}, // stop 1 should be PURPLE
        { value: statsSummary.mean - calculateIntermediateStop(statsSummary.kurtosis, 2, statsSummary.std), color: new Color([179, 96, 209]),  handle: true}, // stop 2 ; purpley
        { value: statsSummary.mean, color: new Color([242, 207, 158]), handle: true}, // stop 3 should be the mean, YELLOW; 
        { value: statsSummary.mean + calculateIntermediateStop(statsSummary.kurtosis, 2, statsSummary.std), color: new Color([110, 184, 48]), handle: true}, // stop 4; greenish
        { value: statsSummary.max, color: new Color([43, 153, 0]), handle: true} // stop 5 should GREEN 
    ];

    /* 
    NEED TO ADD SOME VERY VERBOSE LOGGING HERE TO MAKE SURE THE STOPS ARE BEING CORRECCTLY ASSIGNED    
    */

    console.log("STOPS AFTER REASSIGNEMENT")
    print = ""
    colorSlider.stops.forEach((stop, index) => {
        print += `Stop: ${index}, Value: ${stop.value}, `;
    });

    console.log(print)


    // update rendererFromSlider will be nested, specific to each new colorslider we create with variable scope
    function updateRendererFromSlider() {
        const renderer = mapFeatureLayer.renderer.clone();
        const colorVariable = renderer.visualVariables[0].clone();
        colorVariable.stops = colorSlider.stops;
        renderer.visualVariables = [colorVariable];
        mapFeatureLayer.renderer = renderer;

        bars.forEach((bar, index) => {
            const bin = colorSlider.histogramConfig.bins[index];
            if (bin) {
                const midValue = (bin.maxValue - bin.minValue) / 2 + bin.minValue;
                const color = getColorFromValue(colorSlider.stops, midValue);
                bar.setAttribute("fill", color.toHex());
            }
        });
    }
    // infers the color for a given value
    // based on the stops from a ColorVariable
    function getColorFromValue(stops, value) {
        let minStop = stops[0];
        let maxStop = stops[stops.length - 1];

        const minStopValue = minStop.value;
        const maxStopValue = maxStop.value;

        if (value < minStopValue) {
            return minStop.color;
        }

        if (value > maxStopValue) {
            return maxStop.color;
        }

        const exactMatches = stops.filter((stop) => {
            return stop.value === value;
        });

        if (exactMatches.length > 0) {
            return exactMatches[0].color;
        }

        minStop = null;
        maxStop = null;
        stops.forEach((stop, i) => {
            if (!minStop && !maxStop && stop.value >= value) {
            minStop = stops[i - 1];
            maxStop = stop;
            }
        });

        const weightedPosition = (value - minStop.value) / (maxStop.value - minStop.value);

        return Color.blendColors(minStop.color, maxStop.color, weightedPosition);
    }

    console.log('Color slider', colorSlider)
    return colorSlider;

}


/* 
LOGIC FOR RECOMMENDING A COLORRAMP
*/
// function recommendColorRamp(){

//     /* 
//     // theme matching rulset
//     left skewed: above (emphasize high values)
//     right skewed: below (emphasize low values)
//     high kurtosis: above-and-below (narrow central gap)
//     low kurtosis: extremes (wider central gap)
//     approximately normal: centered on?
//     */

//     let schemeTheme;
//     let flipRamp = false;

//     // we'll start with non-skewed, slightly skewed, or moderately skewed
//     if(statsSummary.skewDirection != "substantial") {
//         // for high kurtosis, we'll use above an below
//         if (statsSummary.kurtosisSeverity == "peaked") {
//             schemeTheme = "above-and-below"
//         // for very low kurtosis, we'll use extremes
//         } else if (statsSummary.kurtosisSeverity == "flat") {
//             schemeTheme = "extremes"
//         // for normal, we'll default to centered-on
//         } else

//         // 
//     } else { // if the distribution is highly skewed, we'll fall back to high-to-low
//         schemeTheme = "high-to-low"
//         // for right skew, we'll flip the ramp to emphasize low values
//         if (statsSummary.skewDirection == "positive"){
//             flipRamp = true;
//         }
//     }


//     // "high-to-low" | "above-and-below" | "centered-on" | "extremes" | "above" | "below"

//     if (!mapView || !mapView.map || !mapFeatureLayer) {
//         console.warn("MapView or FeatureLayer not ready");
//         return null;
//     }

//     const bm = mapView.map.basemap;

//     const themes = getThemes(mapView.map.basemap);
//     console.log("Theme recommendations:", themes);

//     const schemes = getSchemes({
//         basemap: mapView.map.basemap,
//         geometryType: mapFeatureLayer.geometryType,
//         theme: schemeTheme
//     });
//     console.log("Scheme recommendations:", schemes);

//     return colorRampRec;
// }

/* 
LOGIC FOR DIPLAYING WARNING MESSAGE
*/
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
