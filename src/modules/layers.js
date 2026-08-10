// Role: AGOL item + service metadata.
import { appState } from "../state/store";
import * as ui from "./ui";
import * as hf from "../helperFunctions";
import { createMapForSelectedLayer } from "./map";
import { renderFieldList } from "./renderFieldList";

const PortalItem = await $arcgis.import("@arcgis/core/portal/PortalItem.js");
const esriRequest = await $arcgis.import("@arcgis/core/request.js");

/* 
LOGIC FOR TRAVERSING A LAYER TO GET SUBLAYERS
*/
export async function getServiceLayers(itemId) {
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

export function normalizeItemIdInput(){
    const itemIds = (ui.inputBox?.value || "")
        .split(/[\s,]+/)
        .map(value => value.trim())
        .filter(Boolean);

    return Array.from(new Set(itemIds))[0] || null;
}

export function createDropdownForService() {
    ui.layerSelector.innerHTML = ""; // removing old options, in case sconsecutive layers dont have the same sublayers
    ui.layerSelector.placeholder = 'Select a Layer';

    if (appState.serviceInfo.layers.length === 1){
        appState.layerSelection = appState.serviceInfo.layers[0];
        ui.layerSelector.placeholder = `Selected Layer: ${appState.layerSelection.name || appState.layerSelection.id}`;
        createMapForSelectedLayer();
        renderFieldList();
        return;
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
            await createMapForSelectedLayer();

            // console.log('before we create a fields list, this is the map layer', appState.layer);

            // re-populating the list of fields, DON'T want to assume that the fields are consistent
            renderFieldList();
        });
    });

    // at the end here, we'll create the map for the main-map div
    // createMap();
}