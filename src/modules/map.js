// Role: map/view/layer creation.
import { appState } from "../state/store";
import * as ui from "./ui";
import * as constants from "./constants";
import * as hf from "../helperFunctions";
import { setLayer } from "../state/actions";

const Map = await $arcgis.import("@arcgis/core/Map.js");
const MapView = await $arcgis.import("@arcgis/core/views/MapView.js");
const FeatureLayer = await $arcgis.import("@arcgis/core/layers/FeatureLayer.js");

// function for initializing the map with a basemap-only view
export async function createBasemapOnlyView() {
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


/* 
LOGIC FOR CREATING A MAP VIEW
*/
export async function createMapForSelectedLayer() {
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
        setLayer(layer);
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