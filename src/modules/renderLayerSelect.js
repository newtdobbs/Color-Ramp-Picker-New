// Role: layer list DOM rendering.
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