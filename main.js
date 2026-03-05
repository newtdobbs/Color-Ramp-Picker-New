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
This will call the layer selector
*/
if (input) {
    let firstID = "";
    let serviceTitle = "";
    let serviceInfo = null;
    input.addEventListener("keydown", async function (event) {
        if (event.key === "Enter") {
        event.preventDefault();

        // hardcoding a default value --REMOVE THIS FOR DEPLOYMENT
        if (input.value == ""){
            firstID = "c9faa265b82848498bc0a8390c0afa65" // MINC
        } else {
            const raw = input.value || "";
            const itemIDs = raw.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
            const uniqueItemIDs = Array.from(new Set(itemIDs));
            firstID = uniqueItemIDs[0]; // only taking the first ID if multiple are provided
        }

        console.log("first id is", firstID);

        // check the layers present in the service
        serviceInfo = await getServiceLayers(firstID);

        if (serviceInfo){
            document.getElementById("layers-panel").heading = `Layer: ${serviceInfo.title}`;
        }


        createDropdownForService(serviceInfo.layers)

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
        //     currentLayer = await createMap(firstID, selectedLayerId)
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
let selectedLayer = null;
async function createDropdownForService(serviceLayersInfo) {
    const layerSelector = document.getElementById("layer-selector")
    layerSelector.innerHTML = ""; // removing old options, in case sconsecutive layers dont have the same sublayers

    // by default, we'll use the first entry in service layers info
    selectedLayer = serviceLayersInfo[0]; // the actual layer object, not just the name


    if (serviceLayersInfo.length == 1){
        layerSelector.placeholder = `Selected Layer: ${selectedLayer.name}`;
    }

    serviceLayersInfo.forEach((serviceLayer) => {
        const layerOption = document.createElement("calcite-autocomplete-item");
        layerOption.label = serviceLayer.name || `${serviceLayer.id}`; // use the layer id as fallback
        layerOption.heading = serviceLayer.name || `${serviceLayer.id}`; // use the layer id as fallback
        layerOption.value = serviceLayer.id; // the layer id as value allows us to index it in the array

        layerSelector.appendChild(layerOption); // adding the item to the autocomplete dropdown
        layerOption.addEventListener("calciteAutocompleteItemSelect", async () => {
            selectedLayer = serviceLayer; // setting the curent layer to the selected layer
            console.log('selection change to:', selectedLayer.name, 'layer info:', selectedLayer)
            layerSelector.placeholder = `Selected Layer: ${selectedLayer.name}`; 

            // call to createMap if the selection changes
            await createMap(selectedLayer)
        });
    });

    // at the end here, we'll create the map for the main-map div
    await createMap(selectedLayer)

}

/* 
LOGIC FOR CREATING A MAP VIEW
*/
async function createMap(itemId, layerId) {
  mapView.map.removeAll();
  const layer = await createLayerFromItemId(itemId, layerId);
  if (layer) {
    console.log('Valid layer created from id:', itemId);
    mapView.map.add(layer);
    return layer;
  } else {
    console.error('Failed to create layer from item ID:', itemId);
  }
}

async function createLayerFromItemId(itemId, layerId) {
  console.log("Creating FeatureLayer with itemId:", itemId, "layerId:", layerId);
  try {
    const layer = new FeatureLayer({
      portalItem: { id: itemId },
      layerId: layerId
    });
    await layer.load();
    return layer;
  } catch (e) {
    console.error('Could not create/load layer from item ID:', itemId, e);
    return null;
  }
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
