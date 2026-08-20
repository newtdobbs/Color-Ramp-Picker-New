// Role: field filtering and raw value fetch.
import { queryAllFeatures } from '@esri/arcgis-rest-feature-service';
const Query = await $arcgis.import("@arcgis/core/rest/support/Query.js");
import * as hf from "../helperFunctions";
import { appState } from "../state/store";
import * as actions from "../state/actions"

/**
 * 
 * @returns an array of all values for a given feature layer using the app state field
 */
export async function queryFieldValues() {
    try {
        if (!appState.layer || !appState.field?.name) {
            hf.warnUser("Select a valid layer and numeric field before querying values.");
            return null;
        }

        const layerUrl = appState.layer?.parsedUrl?.path || appState.layer?.url;
        if (!layerUrl) {
            hf.warnUser("Unable to determine the selected layer URL.");
            return null;
        }
        
        const t0 = performance.now(); // log for debug
        const results = await queryAllFeatures({
            url: layerUrl,
            outFields: [appState.field.name],
            returnGeometry: false
        });
        const t1 = performance.now(); // log for debug
        console.log(`Querying all records records took ${Math.floor(t1 - t0)} milliseconds:`, results); // log for debug
        const values = results.features.map(f => f.attributes[appState.field.name]); // this is what actually gets the data value in the selected field for each feature 

        return values
    } catch (err) {
        hf.warnUser(`Error querying all features for field ${appState.field?.name || "(unknown)"}.`);
        console.error('err', err);
        return null;
    }
}


