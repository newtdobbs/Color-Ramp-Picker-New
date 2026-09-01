// Role: AGOL item + service metadata.
import { appState } from "../state/store";
import * as ui from "./ui";
import {warnUser} from "../helperFunctions";
import { createMapForSelectedLayer } from "./map";
import { renderFieldList } from "./renderFieldList";

const PortalItem = await $arcgis.import("@arcgis/core/portal/PortalItem.js");
const esriRequest = await $arcgis.import("@arcgis/core/request.js");

/**
 * 
 * @param {string} itemId the string present in the input box when 'enter' is clicked 
 * @returns dictionary object with layer information
 */
export async function getServiceLayers(itemId) {
    
    // regex check for AGOL item ID format (32 hex chars)
    const idPattern = /^[a-f0-9]{32}$/i;
    if (idPattern.test(itemId)) {
        try{
            const portalItem = new PortalItem({ id: itemId });
            await portalItem.load();

            console.log(`portal item ${portalItem.title}`, portalItem)

            if(portalItem.type !== "Feature Service"){
                warnUser("Input item must be of type 'Feature Service', please try again.")
                return
            }

            // requesting service metadata
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
            warnUser(`An error occurred while fetching item ${itemId}, ${error.message}`);
            return null;
        }
    } else {
        warnUser(`ID ${itemId} failed regex format check, ArcGIS Online item IDs should be 32 alphanumeric characters.`);
        return null;
    }
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

            // re-populating the list of fields, DON'T want to assume that the fields are consistent
            renderFieldList();
        });
    });
}