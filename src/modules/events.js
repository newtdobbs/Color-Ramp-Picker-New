document.querySelector("calcite-action-bar").addEventListener("click", => ({ target }) => {

    console.log("active widget is currently:", appState.activeWidget)
    if (target.tagName !== "CALCITE-ACTION") {
        return;
    }

    if (appState.activeWidget) {
        document.querySelector(`[data-action-id=${appState.activeWidget}]`).active = false;
        document.querySelector(`[data-panel-id=${appState.activeWidget}]`).closed = true;
    }

    const nextWidget = target.dataset.actionId;
    if (nextWidget !== appState.activeWidget) {


        document.querySelector(`[data-action-id=${appState.nextWidget}]`).active = true;
        document.querySelector(`[data-panel-id=${appState.nextWidget}]`).closed = false;
        appState.activeWidget = nextWidget;
        document.querySelector(`[data-panel-id=${appState.nextWidget}]`).setFocus();
    } else {
        appState.activeWidget = null;
    }
});

// Panel interaction
for (let i = 0; i < panelEls.length; i++) {
    panelEls[i].addEventListener("calcitePanelClose", () => {
    document.querySelector(`[data-action-id=${appState.activeWidget}]`).active = false;
    document.querySelector(`[data-action-id=${appState.activeWidget}]`).setFocus();
    appState.activeWidget = null;
    });
}

/* 
LOGIC FOR INPUT DIALOG
this will fire every time a new agol id is input
We want to populate the dropdown with sublayers, and create a map
*/
inputBox.addEventListener("keydown", async function (event) {
    if (event.key === "Enter") { 
        event.preventDefault(); // we want to avoid whatever normally happens with the 'Enter' key

        // hardcoding a default value --REMOVE THE IF BLOCK FOR DEPLOYMENT
        if (inputBox.value === ""){
            appState.inputItemID = appState.defaultItemID // MINC
        } else {
            const raw = inputBox.value || "";
            const itemIDs = raw.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
            const uniqueItemIDs = Array.from(new Set(itemIDs));
            appState.inputItemID = uniqueItemIDs[0]; // only taking the first ID if multiple are provided
        }

        // console.log("input AGOL id is", selectedID); // log for debug
        appState.serviceInfo = await getServiceLayers(appState.inputItemID); // check the layers present in the service
        console.log('service info is', appState.serviceInfo);

        // if valid information was attained from the service, we'll update the panel heading and create sublayer dropdown
        if (appState.serviceInfo){
            layersPanel.heading = `Layer: ${appState.serviceInfo.title}`;
            
            createDropdownForService(); // create a dropdown to list the sublayers

        // if no valid info was attained form the service we'll warn the user
        } else {
            hf.warnUser(`No valid information attained for the service with the input item ID: ${appState.inputItemID}`);
        }

        inputBox.value = ""; // clearing the input dialog box after everything is done

        // if a fields list pre-existed, we'll clear it 
        if (appState.fieldsList) {
            document.getElementById("fields-list").innerHTML = "";
        }
    }
});

// functionality to handle the generate button
generateButton.addEventListener("click", async () => {

    // error handling if no field is selected
    if(!appState.field){
        hf.warnUser('Select a field from the fields list')
        return
    } else {
        
        // otherwise, closing any pre-existing dialog so we can re-generate its contents
        if (bottomDialog.open){
            // bottomDialog.textContent = "";    
            bottomDialog.open = false;
        }
                    
        // resertting the dialog
        // bottomDialog.textContent = "";  
        
        //if its non-numeric warn user
        if(!goodFieldTypes.includes(appState.field.type)){
            hf.warnUser("Please ensure the selected field is one of the following types: small-integer, integer,  single,  double,  long,  string, big-integer.")
            appState.field = null;
            return
        }
        // // make sure its not just a Geoid, uniqueid, make sure its a DATA field
        if(!goodFieldValueTypes.includes(appState.field.valueType)){
            hf.warnUser("Please ensure the selected field is one of the following value types:  count-or-amount, currency")
            appState.field = null;
            return
        }   

        // setting the heading and opening the dialog but with a loader
        
        bottomDialog.open = true;
        bottomDialog.componentOnReady();
        bottomDialog.loading = true;
        
        try {
            // updating the dialog header
            bottomDialog.heading = `Color Ramp Information for ${appState.field.name} (${appState.field.alias})`
            bottomDialog.description = `Selected Layer: ${appState.layer.title}`
            
            // here we'll populate the dialog using the selected field's data distribution
            await initializeDialogForField()
            desc.textContent = appState.description; // is now stored in state variable after initializing
            desc.slot = "content-bottom";
            
            bottomDialog.appendChild(desc);
            bottomDialog.loading = false;
            
        } catch(err){
            console.log("Error generating histogram:", err)
            bottomDialog.heading = `Error Generating Color Ramp Information for ${appState.field.alias}`
        }
        bottomDialog.open = true;
    }   
});

// hiding buttons when slider is being dragged
export function hideButtonsOnDrag() {
  appState.buttons.forEach(b => {b.style.visibility = 'hidden'});
}

// showinng buttons when released
export function showButtonsOnRelease() {
    appState.buttons.forEach(b => {b.style.visibility = 'visible'});
    
    // if the slider moves while we were DEFAULT state
    if (appState.symbologyMode === "Default") {
        // we've moved away from the SM defaults now entered CUSTOM mode
        appState.symbologyMode = "Custom";

        // and we need to offer the a return to default mode in the button's label
        resetButton.textContent = "Default";
        resetButton.label = "Default";
   
    }
}

// helper functiont to assign the correct event listener based on the input switch's mode
export function attachSliderListener() {
    // Remove any existing listeners to avoid duplicates
    sliderElement.removeEventListener("arcgisChange", sliderHandler);
    sliderElement.removeEventListener("arcgisInput", sliderHandler);
    sliderElement.removeEventListener("arcgisInput", hideButtonsOnDrag);
    sliderElement.removeEventListener("arcgisChange", showButtonsOnRelease);


    // this if-else handles how we should adjust the histogram & color swatch according to the switchInput
    if (appState.switchValue === "static") {
        sliderElement.addEventListener("arcgisInput", hideButtonsOnDrag); // fires when a slider is clicked/dragged
        sliderElement.addEventListener("arcgisChange", sliderHandler);
        sliderElement.addEventListener("arcgisChange", showButtonsOnRelease); // fires when a slider is released
    } else {
        sliderElement.addEventListener("arcgisInput", hideButtonsOnDrag); // fires when a slider is clicked/dragged
        sliderElement.addEventListener("arcgisInput", sliderHandler);
        sliderElement.addEventListener("arcgisChange", showButtonsOnRelease); // fires when a slider is released
    }
}

export function sliderHandler() {
    // if a slider moves, we'll provide the option to reset defaults
    // console.log(`Current state of reset is ${resetButton.textContent}`) // log for debug

    
    appState.sliderValues = [...sliderElement.values]; // updating state variables to just pull from there, this fixes bug where color stops were one step behind the sliderValues
    
    const newStops = appState.colorStops.map((colorStop, i) => ({ // looping over the state variable color stops
        ...colorStop,
        value: appState.sliderValues[i] // these are the NEW values currently in the slider
    })).sort((a, b) => a.value - b.value); // this resets the slider indices in case sliders cross over
    appState.colorStops = newStops; // assigning the new slider stops to the state variable 
    // appState.sliderValues = [...sliderElement.values]; // updating the global state so we can just pull from there 
    
    // finally calling updateUI, which should only be using state variables
    updateUI(); 
    
    // updating the last custom stops to use the current slider values
    appState.lastCustomValues = [...appState.sliderValues];
    appState.lastCustomStops = [...appState.colorStops];
}

// function to export the color ramp's current configuration as JSON
jsonCopy.addEventListener("click", () => {

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