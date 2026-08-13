// Role: field filtering and raw value fetch.
import { queryAllFeatures } from '@esri/arcgis-rest-feature-service';
const Query = await $arcgis.import("@arcgis/core/rest/support/Query.js");
import * as hf from "../helperFunctions";
import { appState } from "../state/store";
import * as actions from "../state/actions"


/* 
LOGIC FOR CREATING THE LIST OF FIELDS
*/
export function getSelectableFields() {
    fieldsLabel.textContent = "Select a Field";
    
    const fieldsList = document.createElement("calcite-list");
    fieldsList.innerHTML = ""; // removing any preexisting fields
    fieldsList.label = "Select a field";
    fieldsList.selectionMode = "single"; 
    fieldsLabel.appendChild(fieldsList);

    // Can log all the fields here for debug
    // console.log("All fields:");
    // appState.layer.fields.forEach(field => {
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
                actions.setField(appState.field === field ? null : field); // this will allow users to deselect a field without having to remove it from the list

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
                    actions.setField(null); // if the user removes the currently selected field, we'll clear the state variable
                    // warnUser('Select a field from the fields list')
                }
                listItem.remove(); // removing the list item from the dom
            });
        }
    });

    actions.setFieldsList(fieldsList); // adding the fields list to the global state
}

// NEED TO THINK REALLY CRITICALLY ABOUT WHETHER WE WANT TO CLEAN THE FIELD VALUES WTIHIN THIS FUNCTION
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


