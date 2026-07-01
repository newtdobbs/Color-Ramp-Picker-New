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
const summaryStatistics = await $arcgis.import("@arcgis/core/smartMapping/statistics/summaryStatistics.js");
import incrkurtosis from "@stdlib/stats-incr-kurtosis";
const StatisticDefinition = await $arcgis.import("@arcgis/core/rest/support/StatisticDefinition.js");
import * as hf from "./src/helperFunctions";
import { queryAllFeatures } from '@esri/arcgis-rest-feature-service';
import { validateAppAccess } from "@esri/arcgis-rest-request";
const Query = await $arcgis.import("@arcgis/core/rest/support/Query.js");
import { appState } from "./src/state";
import * as constants from "./src/modules/constants"
import * as ui from "./src/modules/ui"


let activeWidget = "field";
const handleActionBarClick = ({ target }) => {
if (target.tagName !== "CALCITE-ACTION") {
    return;
}
if (activeWidget) {
    document.querySelector(`[data-action-id=${activeWidget}]`).active = false;
    document.querySelector(`[data-block-id=${activeWidget}]`).hidden = true;
}
const nextWidget = target.dataset.actionId;
console.log("Next widget is:", nextWidget)
if (nextWidget !== activeWidget) {
    document.querySelector(`[data-action-id=${nextWidget}]`).active = true;
    document.querySelector(`[data-block-id=${nextWidget}]`).hidden = false;
    document.querySelector(`[data-block-id=${nextWidget}]`).expanded = true;

    activeWidget = nextWidget;
} else {
    activeWidget = null;
}
};
document.querySelector("calcite-action-bar").addEventListener("click", handleActionBarClick);

async function createBasemapOnlyView() {
    const map = new Map({
        basemap: 'gray-vector',
        layers: []
    });

    // assigining the map to the default app's state
    appState.map = map;

    const view = new MapView({
        container: ui.mapContainer, // the dom element to hold our map
        map: map,
        ui: { components: [] }
    });
    appState.view = view;

    console.log('view:', view)
    appState.view.when(() => {
        appState.view.goTo({ scale: constants.default_scale, center: constants.default_center }); // zooming to the lower 48 centered 
    })

        if (ui.basemapGallery) {
        ui.basemapGallery.view = view; // bind the MapView directly
    }

    return view;
}


await createBasemapOnlyView(); // assigning the returned view to the global state

/* 
LOGIC FOR INPUT DIALOG
this will fire every time a new agol id is input
We want to populate the dropdown with sublayers, and create a map
*/
ui.inputBox.addEventListener("keydown", async function (event) {
    if (event.key === "Enter") { 
        event.preventDefault(); // we want to avoid whatever normally happens with the 'Enter' key

        // hardcoding a default value --REMOVE THE IF BLOCK FOR DEPLOYMENT
        if (ui.inputBox.value === ""){
            appState.inputItemID = appState.defaultItemID // MINC
        } else {
            const raw = ui.inputBox.value || "";
            const itemIDs = raw.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
            const uniqueItemIDs = Array.from(new Set(itemIDs));
            appState.inputItemID = uniqueItemIDs[0]; // only taking the first ID if multiple are provided
        }

        // console.log("input AGOL id is", selectedID); // log for debug
        appState.serviceInfo = await getServiceLayers(appState.inputItemID); // check the layers present in the service
        console.log('service info is', appState.serviceInfo);

        // if valid information was attained from the service, we'll update the panel heading and create sublayer dropdown
        if (appState.serviceInfo){
            ui.fieldBlock.heading = `Layer: ${appState.serviceInfo.title}`;

            createDropdownForService(); // create a dropdown to list the sublayers

        // if no valid info was attained form the service we'll warn the user
        } else {
            hf.warnUser(`No valid information attained for the service with the input item ID: ${appState.inputItemID}`);
        }

        ui.inputBox.value = ""; // clearing the input dialog box after everything is done

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
    ui.layerSelector.innerHTML = ""; // removing old options, in case sconsecutive layers dont have the same sublayers
    ui.layerSelector.placeholder = 'Select a Layer';

    if (appState.serviceInfo.layers.length === 1){
        appState.layer = appState.serviceInfo.layers[0]; // if needed we'll use the first entry in service layers info
        ui.layerSelector.placeholder = `Selected Layer: ${layer.name}`;
    }

    appState.serviceInfo.layers.forEach((serviceLayer) => {
        const layerOption = document.createElement("calcite-autocomplete-item");
        layerOption.label = serviceLayer.name || serviceLayer.id; // use the layer id as fallback
        layerOption.heading = serviceLayer.name || serviceLayer.id; // use the layer id as fallback
        layerOption.value = serviceLayer.id; // the layer id as value allows us to index it in the array

        ui.layerSelector.appendChild(layerOption); // adding the item to the autocomplete dropdown
        layerOption.addEventListener("calciteAutocompleteItemSelect", async () => {
            appState.layerSelection = serviceLayer; // setting the curent layer to the selected layer
            console.log('selection change to:', appState.layerSelection.name, 'layer info:', appState.layerSelection)
            ui.layerSelector.placeholder = `Selected Layer: ${appState.layerSelection.name}`; 

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

        // resetting the layer's view scale
        layer.minScale = 500000000;
        layer.maxScale = 0;
        // console.log('layer to populate in map', layer); // log for debug
        appState.map.add(layer);
        appState.layer = layer;
        appState.layer.maxScale = layer.maxScale;
        const midScale = Math.floor((appState.layer.minScale + appState.layer.maxScale) / 2);

        console.log(`Resetting view for Layer to mid scale of: ${midScale}`); // log for debug
        // zooming to the midpoint of the selected layer's visibility
        appState.view.goTo({ scale: 22500000, center: constants.default_center }); // re-zooming map the middle visibility rnage in to middle of the country
    } catch (e) {
        console.error('Could not create/load layer from item ID:', appState.inputItemID, e);
        hf.warnUser('Failed to create map for selected layer');
    }
}

/* 
LOGIC FOR CREATING THE LIST OF FIELDS
*/
function generateFieldsList() {
    ui.fieldsLabel.textContent = "Select a Field";

    const fieldsList = document.createElement("calcite-list");
    fieldsList.innerHTML = ""; // removing any preexisting fields
    fieldsList.label = "Select a field";
    fieldsList.selectionMode = "single"; 
    ui.fieldsLabel.appendChild(fieldsList);

    // Can log all the fields here for debug
    // console.log("All fields:");
    // appState.layer.fields.forEach(field => {
    //     console.log(`Field: ${field.name}, type: ${field.type}, valueType: ${field.valueType}`);
    // });

    appState.layer.fields.forEach(field => {
        if (constants.goodFieldTypes.includes(field.type) && constants.goodFieldValueTypes.includes(field.valueType)) {
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
ui.generateButton.addEventListener("click", async () => {

    // error handling if no field is selected
    if(!appState.field){
        hf.warnUser('Select a field from the fields list')
        return
    } else {

        // otherwise, closing any pre-existing dialog so we can re-generate its contents
        if (ui.bottomPanel.hidden === false){
            // bottomPanel.textContent = "";    
            ui.bottomPanel.hidden = true;
        }

        // resertting the dialog
        // bottomPanel.textContent = "";  

        //if its non-numeric warn user
        if(!constants.goodFieldTypes.includes(appState.field.type)){
            hf.warnUser("Please ensure the selected field is one of the following types: small-integer, integer,  single,  double,  long,  string, big-integer.")
            appState.field = null;
            return
        }
        // // make sure its not just a Geoid, uniqueid, make sure its a DATA field
        if(!constants.goodFieldValueTypes.includes(appState.field.valueType)){
            hf.warnUser("Please ensure the selected field is one of the following value types:  count-or-amount, currency")
            appState.field = null;
            return
        }   

        // setting the heading and opening the dialog but with a loader

        ui.bottomPanel.hidden = false;
        ui.bottomPanel.componentOnReady();
        ui.bottomPanel.loading = true;

        const testPanel = document.getElementById("test-panel")
        try {
            // updating the dialog header
            testPanel.heading = `Color Ramp Information for ${appState.field.name} (${appState.field.alias})`
            testPanel.description = `Selected Layer: ${appState.layer.title}`

            // here we'll populate the dialog using the selected field's data distribution
            await initializeDialogForField()
            // desc.textContent = appState.description; // is now stored in state variable after initializing

            // desc.slot = "content-bottom";

            console.log("App state description", appState.description);

            ui.description.textContent = appState.description;
            // testPanel.appendChild(newDiv)
            ui.bottomPanel.loading = false;

        } catch(err){
            console.log("Error generating histogram:", err)
            testPanel.heading = `Error Generating Color Ramp Information`
        }
        ui.bottomPanel.hidden = false; // we show the bottom panel
        document.querySelector('[data-action-id=ramp]').disabled = false; // enabling the color ramp tab once a histogram is created
    }   
});

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

function initializeUI(){
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
function updateUI(){
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

function clearStateForNewField(){
    appState.stats = null;
    appState.description = null;
    appState.sliderValues = null;
    appState.colorStops = null;
    appState.buttons = [];
    appState.switchValue = "static";
    appState.defaultValues = null;
    appState.defaultStops = null;
    appState.lastCustomStops = [];
    appState.lastCustomValues = [];
    appState.offsetBase = null
    appState.symbologyMode = "Custom"
    appState.outliersVisibility = "Hide Outliers"
    appState.inflectionPoints = null 
    ui.resetButton.textContent = "Default";
    ui.resetButton.label = "Default";
}

async function initializeDialogForField() {
  try {

    clearStateForNewField()    // resetting the state variables for the new field selection

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
// reset button handling
ui.resetButton.addEventListener("click",  () => {

    // if we're currently using custom symbology, we want to TURN ON the smart mapping defaults
    if (appState.symbologyMode === "Custom") {
        // saving the current custom configuration before overwriting
        appState.lastCustomValues = [...appState.sliderValues];
        appState.lastCustomStops = [...appState.colorStops];

        // then applying smart mapping defaults
        ui.sliderElement.values = [...appState.defaultValues];
        ui.histogramElement.colorStops = [...appState.defaultStops];
        appState.sliderValues = [...appState.defaultValues];
        appState.colorStops = [...appState.defaultStops];

    // otherwise we're using default symbology, so we want to RESTORE last custom stops before click
    } else {
        if (appState.lastCustomValues && appState.lastCustomStops) {
            ui.sliderElement.values = [...appState.lastCustomValues];
            ui.histogramElement.colorStops = [...appState.lastCustomStops];
            appState.sliderValues = [...appState.lastCustomValues];
            appState.colorStops = [...appState.lastCustomStops];
        } else {
            hf.warnUser("No custom configuration stored to restore.");
        }
    }


    // we use the 'old' mode (before click) as the new button label 
    ui.resetButton.textContent = appState.symbologyMode;
    ui.resetButton.label = appState.symbologyMode;

    // and we'll switch the mode to the opposite state
    appState.symbologyMode = appState.symbologyMode === "Default" ? "Custom" : "Default"; // determining value for current click
    console.log(`Changed buttom label FROM ${appState.symbologyMode} to ${ui.resetButton.label}`)

    console.log(`WE'RE CURRENTLY IN ${appState.symbologyMode} SYMBOLOGY MODE.`);

    updateUI(); // finally we updateUI to reflect these changes in the map/histogram
})

// hiding buttons when slider is being dragged
function hideButtonsOnDrag() {
  appState.buttons.forEach(b => {b.style.visibility = 'hidden'});
}

// showinng buttons when released
function showButtonsOnRelease() {
    appState.buttons.forEach(b => {b.style.visibility = 'visible'});

    // if the slider moves while we were DEFAULT state
    if (appState.symbologyMode === "Default") {
        // we've moved away from the SM defaults now entered CUSTOM mode
        appState.symbologyMode = "Custom";

        // and we need to offer the a return to default mode in the button's label
        resetButton.textContent = "Default";
        resetButton.label = "Default";
       }
    console.log(`WE'RE CURRENTLY IN ${appState.symbologyMode} SYMBOLOGY MODE.`);
}

function handleColorPickerChange() {
    if(!appState.activeSliderValue){ // if there's no active slider thumb we'll warn the user & make no change
        hf.warnUser('no active slider value')
    } else {
        // hf.warnUser('active slider value is', appState.activeSliderValue);
        console.log('COLOR CHANGE: slider element active value', appState.activeSliderValue, 'color stops', appState.colorStops)
        const correspondingColorStopIndex = appState.colorStops.findIndex(stop => stop.value === appState.activeSliderValue)
        const correspondingColorStop = appState.colorStops[correspondingColorStopIndex]
        console.log('Assiging', ui.colorPicker.value,' to stop ', correspondingColorStopIndex);
        appState.colorStops[correspondingColorStopIndex].color = [
            ui.colorPicker.value.r, // red
            ui.colorPicker.value.g, // green 
            ui.colorPicker.value.b, // blue
            ui.colorPicker.value.a // alpha
        ] 
        console.log('Color stops after change', appState.colorStops)
        
        sliderHandler();
        // appState.activeSliderValue = null;
    }
}

// adding event listener only once
ui.colorPicker.addEventListener("calciteColorPickerChange", handleColorPickerChange);

function handleActiveSliderThumb(){
    if (typeof ui.sliderElement.activeValue === "number") {
        if (appState.activeSliderValue != ui.sliderElement.activeValue) {   // this only occurs on thumb CHANGE
            appState.activeSliderValue = ui.sliderElement.activeValue;
            const correspondingSliderThumb = ui.sliderElement.values.findIndex(value => value === ui.sliderElement.activeValue);
            console.log('slider element active value', ui.sliderElement.activeValue, 'corresponding to color stop', correspondingSliderThumb)
            // populating the color picker with the slider's value
            ui.colorPicker.value = {
                'r': appState.colorStops[correspondingSliderThumb].color[0],
                'g': appState.colorStops[correspondingSliderThumb].color[1],
                'b': appState.colorStops[correspondingSliderThumb].color[2],
                'a': appState.colorStops[correspondingSliderThumb].color[3] // this ensures the color's transparency is used by the picker
             }
        }
    }
}


ui.sliderElement.addEventListener('contextmenu', (event) => {
    // 1. Prevent the default browser context menu from appearing
    event.preventDefault(); 

    if (typeof ui.sliderElement.activeValue === "number") {
        if (ui.sliderElement.values.length == 2){
            hf.warnUser('Must have at least 2 sliders before removing one')
        } else {
            // determining WHICH slider handle to remove
            let removeIndex = ui.sliderElement.values.findIndex(value => value === ui.sliderElement.activeValue);

            // // Building new arrays.
            const nextSliderValues = [...appState.sliderValues]; // copying the slidervalues
            nextSliderValues.splice(removeIndex, 1); // and removing the right-clicked slider

            const nextColorStops = [...appState.colorStops];
            nextColorStops.splice(removeIndex, 1); // and removing the right-clicked slider

            appState.sliderValues = nextSliderValues;
            appState.colorStops = nextColorStops;

            // then updating DOM elements form the state 
            ui.sliderElement.values = [...nextSliderValues];
            ui.histogramElement.colorStops = [...nextColorStops];

            // updating UI
            updateUI();

        }

    }
});


// helper functiont to assign the correct event listener based on the input switch's mode
function attachSliderListener() {
    // Remove any existing listeners to avoid duplicates
    ui.sliderElement.removeEventListener("arcgisChange", sliderHandler);
    ui.sliderElement.removeEventListener("arcgisInput", sliderHandler);
    ui.sliderElement.removeEventListener("arcgisInput", hideButtonsOnDrag);
    ui.sliderElement.removeEventListener("arcgisChange", showButtonsOnRelease); 
    ui.sliderElement.removeEventListener("arcgisActiveValueChange", handleActiveSliderThumb) // changing the selected slider thumb

    // reattaching event listeners
    ui.sliderElement.addEventListener("arcgisInput", hideButtonsOnDrag); // fires when a slider is clicked/dragged
    ui.sliderElement.addEventListener("arcgisInput", sliderHandler);
    ui.sliderElement.addEventListener("arcgisChange", showButtonsOnRelease); // fires when a slider is released
    ui.sliderElement.addEventListener("arcgisActiveValueChange",  handleActiveSliderThumb)
}

function sliderHandler() {
    // if a slider moves, we'll provide the option to reset defaults
    // console.log(`Current state of reset is ${resetButton.textContent}`) // log for debug

    appState.sliderValues = [...ui.sliderElement.values]; // updating state variables to just pull from there, this fixes bug where color stops were one step behind the sliderValues

    const newStops = appState.colorStops.map((colorStop, i) => ({ // looping over the state variable color stops
        ...colorStop,
        value: appState.sliderValues[i] // these are the NEW values currently in the slider
    })).sort((a, b) => a.value - b.value); // this resets the slider indices in case sliders cross over
    appState.colorStops = newStops; // assigning the new slider stops to the state variable 
    // appState.sliderValues = [...ui.sliderElement.values]; // updating the global state so we can just pull from there 

    // finally calling updateUI, which should only be using state variables
    updateUI(); 

    // updating the last custom stops to use the current slider values
    appState.lastCustomValues = [...appState.sliderValues];
    appState.lastCustomStops = [...appState.colorStops];
}

function updateHistogram(){
    console.log('updating histogram stops to:', appState.colorStops);
    ui.histogramElement.colorStops = appState.colorStops; // pulling the histogram's stops from the state variable
}

function updateRenderer() {

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

function updateSwatch() {
    const gradientParts = appState.colorStops.map((stop, index) => {

        const percent = ((stop.value - appState.stats.min) / (appState.stats.max - appState.stats.min)) * 100; // getting the color stop's percentage along based on its value
        return `rgb(${stop.color.join(",")}) ${percent}%`; // returning the color at that stop to actually create the swatch
    });
    // creating a linear gradient from the pieces we just assembled from the color stops
    ui.swatch.style.background = `linear-gradient(to right, ${gradientParts.join(", ")})`;
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
        let insertIndex = appState.sliderValues.findIndex(v => v > buttonValue); // we find the slider thumb which was above the button that was clicked
        if (insertIndex === -1) insertIndex = appState.sliderValues.length; // if no slider values were greater than the button, we insert at the end using the length as the index

        // interpolating between the color stops above and below the value
        let lowerStop = appState.colorStops[insertIndex - 1];
        let upperStop = appState.colorStops[insertIndex];
        let fraction = (buttonValue - lowerStop.value) / (upperStop.value - lowerStop.value);
        let newColor = [
            Math.round(lowerStop.color[0] + fraction * (upperStop.color[0] - lowerStop.color[0])),
            Math.round(lowerStop.color[1] + fraction * (upperStop.color[1] - lowerStop.color[1])),
            Math.round(lowerStop.color[2] + fraction * (upperStop.color[2] - lowerStop.color[2]))
        ];

        // Build new arrays instead of mutating in place so slider re-renders on first insert.
        const nextSliderValues = [...appState.sliderValues];
        nextSliderValues.splice(insertIndex, 0, buttonValue);

        const nextColorStops = [...appState.colorStops];
        nextColorStops.splice(insertIndex, 0, { color: newColor, value: buttonValue });

        appState.sliderValues = nextSliderValues;
        appState.colorStops = nextColorStops;

        // then updating DOM elements form the state 
        ui.sliderElement.values = [...nextSliderValues];
        ui.histogramElement.colorStops = [...nextColorStops];

        // updating UI
        updateUI();
    });

    // button.style.left = `${percentAlongSwatch}%` // the button's position will be determined in updateButtons() 
    ui.swatch.appendChild(button); // adding the button to the swatch div
    appState.buttons.push(button); // adding the to the app app state
}

function updateButtons(){

    ui.swatch.innerHTML = "";
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

        const t0 = performance.now(); // log for debug
        const results = await queryAllFeatures({
            url: appState.layer.parsedUrl.path,
            outFields: appState.field.name,
            returnGeometry: false,
        });
        const t1 = performance.now(); // log for debug
        console.log(`Querying all records records took ${Math.floor(t1 - t0)} milliseconds:`, results); // log for debug
        const values = results.features.map(f => f.attributes[appState.field.name]); // this is what actually gets the data value in the selected field for each feature 
        const cleanValues = values.filter(v => typeof v === "number" && !isNaN(v)).sort((a, b) => a - b); // filtering out NaN or non-numeric values (and sorting ascending)
        const n = cleanValues.length; // the new value count AFTER filters

        // Assembling the stats dictionary
        appState.stats = {
            count: n,
            min: math.min(cleanValues),
            max: math.max(cleanValues),
            avg: math.mean(cleanValues),
            median: math.median(cleanValues),
            stddev: math.std(cleanValues),
            lowCutoff: null,  
            highCutoff: null,  
            lowOutliers: [],
            highOutliers:[],
        }

        console.log('appState.stats is currently', appState.stats); // log for debug

        // Calculating skewness
        // third moment
        let summedDiffs = 0;
        cleanValues.forEach(v => {
            summedDiffs += Math.pow(v - appState.stats.avg, 3);
        });
        const thirdMoment = summedDiffs / n;

        // pop skew
        const populationSkew = thirdMoment / Math.pow(appState.stats.stddev, 3);

        // sample skew using bias correction
        const sampleSkew = populationSkew * Math.sqrt(n * (n - 1)) / (n - 2);

        var accumulator = incrkurtosis();
        for (let i = 0; i < cleanValues.length; i++){ 
            accumulator(cleanValues[i]);
        }
        const kurtosis = accumulator();
        console.log(`Skew ${sampleSkew} and kurtosis ${kurtosis} off the press`) // log for debug

        // then adding these values to the global app state
        appState.stats.skewness = sampleSkew;
        appState.stats.kurtosis = kurtosis;

        const sorted = cleanValues.slice().sort((a, b) => a - b);
        const q1 = sorted[Math.floor((sorted.length / 4))];
        console.log(`Q1 has been determined as ${q1}`)

        const q3 = sorted[Math.ceil((sorted.length * (3 / 4))) - 1];
        console.log(`Q3 has been determined as ${q3}`)

        const iqr = q3 - q1;

        const lowCutoff = math.max(q1 - 1.5 * iqr, 0); // clamping it at 0, as we can't have negatives
        const highCutoff = q3 + 1.5 * iqr;
        appState.stats.lowCutoff = lowCutoff;
        appState.stats.highCutoff = highCutoff;

        appState.stats.lowOutliers = sorted.filter(v => v < lowCutoff);
        appState.stats.highOutliers = sorted.filter(v => v > highCutoff);

        console.log(`Low outliers: ${appState.stats.lowOutliers.length}, high outliers: ${appState.stats.highOutliers.length}`)

        // if(Math.abs(appState.stats.skewness) > 5){
        //     createOutliersButton()
        // }

        console.log('App stats is', appState.stats) // log for debug

    } catch (err) {
        hf.warnUser(`Error querying all features for field:`, );
        console.error('err', err);
        return null;
    }
}

// function createOutliersButton(){
//     const emptyLabel = document.createElement('calcite-label');
//     buttonsPanel.appendChild(emptyLabel); // adding an empty label for spacing

//     const outlierToggle = document.createElement('calcite-button'); 
//     outlierToggle.label = "Hide Outliers";
//     outlierToggle.kind = "danger";
//     outlierToggle.round = true;
//     outlierToggle.width = "full";
//     outlierToggle.id = "outlier-toggle"
//     outlierToggle.textContent = "Hide Outliers";


//     outlierToggle.addEventListener("click",  () => {


//         console.log(`After clicking, before any change, outliers toggle is ${outlierToggle.textContent}`)
//         outlierToggle.textContent = outlierToggle.textContent === "Hide Outliers" ? "Restore Outliers" : "Hide Outliers";
//         outlierToggle.label = outlierToggle.textContent === "Hide Outliers" ? "Restore Outliers" : "Hide Outliers";

//         console.log(`new slider values should theoretically be: 1.${appState.stats.lowCutoff},
//             2.${((appState.stats.avg - appState.stats.lowCutoff) / 2) + appState.stats.lowCutoff}, 3.${appState.stats.avg},
//             4.${((appState.stats.highCutoff - appState.stats.avg) / 2) + appState.stats.avg},
//             5.${appState.stats.highCutoff}`)

//         // we use the 'old' mode (before click) to dcide what to do 
//         // if we're currently showing outliers, we want to hide them
//         if (appState.outliersVisibility === "Hide Outliers") {
//             // hf.warnUser("Now we want to hide outliers");
//             ui.sliderElement.min = appState.stats.lowCutoff;
//             ui.sliderElement.max = appState.stats.highCutoff;
//             ui.sliderElement.values = [
//                 appState.stats.lowCutoff,
//                 ((appState.stats.avg - appState.stats.lowCutoff) / 2) + appState.stats.lowCutoff, 
//                 appState.stats.avg, 
//                 ((appState.stats.highCutoff - appState.stats.avg) / 2) + appState.stats.avg, 
//                 appState.stats.highCutoff
//             ]

//         // otherwise we're currently hiding outliers, so we want to restore them
//         } else {
//             // hf.warnUser("Now we want to show outliers")
//             ui.sliderElement.min = appState.stats.min;
//             ui.sliderElement.max = appState.stats.max;
//             ui.sliderElement.values = appState.lastCustomStops;

//             // outliersVisibility();
//         }


//         // and we'll switch the app state variable to the opposite mode
//         console.log(`Changed buttom label FROM ${appState.outliersVisibility} to ${outlierToggle.textContent}`)
//         appState.outliersVisibility = outlierToggle.textContent
//         sliderHandler();
//     })

//     buttonsPanel.appendChild(outlierToggle);
// }

/* 
function to calculate all stops when a field is first selected
*/
function calculateStops(){

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


// function to export the color ramp's current configuration as JSON
ui.jsonCopy.addEventListener("click", () => {

    // console.log('renderer test:', appState.layer.renderer); // log for debug

    // grapping the renderer from the map layer and json-stringifying it
    let rendererJSON = JSON.stringify(appState.layer.renderer, null, '\t');

    // copying the color ramp's json to the clipboard
    try { 
        navigator.clipboard.writeText(rendererJSON);
        console.log("JSON for color ramp copied to clipboard:", rendererJSON)
        hf.warnUser(`JSON for color ramp with ${appState.colorStops.length} stops copied to clipboard.`, "success", true)
    } catch (err) {
        console.error('Failed to copy JSON with error: ', err);
    }
});