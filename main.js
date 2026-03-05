import "./style.css";
import Map from "@arcgis/core/Map.js";
import MapView from "@arcgis/core/views/MapView.js";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer.js";
import PortalItem from "@arcgis/core/portal/PortalItem.js";
import Basemap from "@arcgis/core/Basemap.js";
import VectorTileLayer from "@arcgis/core/layers/VectorTileLayer.js";
import esriRequest from "@arcgis/core/request.js";
import histogram from "@arcgis/core/smartMapping/statistics/histogram.js";


const mainMap = document.getElementById("main-map")
// once the page loads, creat an ampty map view
let mapView = null;
// setting Kansas City as default center as its ~roughly~ central in US
const default_center = [-94.66, 39.04];
// create a basemap-only view for a given container
async function createBasemapOnlyView() {
  const base = new Basemap({
    baseLayers: [
      new VectorTileLayer({
        portalItem: { id: "291da5eab3a0412593b66d384379f89f" },
        title: "Light Gray Canvas Base",
        opacity: 1,
        visible: true
      })
    ]
  });

  const map = new Map({
    basemap: base,
    layers: []
  });

  const view = new MapView({
    container: mainMap,
    map: map,
    ui: { components: [] }
  });

  await view.when();
  view.goTo({ scale: 20000000, center: default_center });
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



let activeWidget;

 const handleActionBarClick = ({ target }) => {
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

        generateFieldsList(selectedLayer)


        // console.log("service layers length:", serviceLayersInfo.length);
        // const layerLabel = document.getElementById("layer-label");
        // if (serviceLayersInfo.length > 1) {
        //     layerLabel.textContent = "Select a Layer";
        //     layerSelector = document.createElement("calcite-select");
        //     createDropdownForService(serviceLayersInfo);
        //     layerLabel.appendChild(layerSelector);
        //         // event handler for when a list item is removed
        //     layerSelector.addEventListener("calciteSelectChange", async () => {
        //     const selectedLayerId = layerSelector.selectedOption.value;
        //     console.log('selection change, creating map for selection:', layerSelector.selectedOption.label, 'at index:', selectedLayerId);
        //     // call createMap for the specific layer
        //     currentLayer = await createMap(selectedID, selectedLayerId)
        //     });
        // } else {
        //     layerLabel.textContent = `Selected Layer: ${serviceLayersInfo[0]['NAME']}`;
        // }

        // // Wait for the layer to be created and loaded
        // currentLayer = await createMap(firstID, serviceLayersInfo[0].id)

        // if (currentLayer) {
        //     await currentLayer.load(); // ensure fields are available
        //     populateListGroup(currentLayer);
        // }

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
        mapView.map.add(layer);
        await mapView.when();
        // console.log('layer', layer);

        // zooming to the midpoint of the selected layer's visibility
        let layerMinScale;
        if (layer.minScale == 0){
            layerMinScale = 1
        } else {
            layerMinScale = layer.minScale;
        }
        const midScale = Math.floor((layerMinScale + layer.maxScale) / 2);
  
        console.log(`Resetting view for Layer to mid scale of: ${midScale}`);
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
  console.log("All fields:");
  focusLayer.fields.forEach(field => {
    console.log(`Field: ${field.name}, type: ${field.type}, valueType: ${field.valueType}`);
  });

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
