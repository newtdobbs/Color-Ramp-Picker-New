import * as ui from "./src/modules/ui"

// Role: register all listeners in one place.
export function wireEvents(){
   
    ui.actionBar.addEventListener("click", wireActionBarClick);
        
    ui.jsonCopy.addEventListener("click", wireJSONCopyButton);

    ui.resetButton.addEventListener("click",  wireResetButton);

    ui.colorPicker.addEventListener("calciteColorPickerChange", wireColorPickerChange);

    ui.resetButton.addEventListener("click",  wireResetButton);

    ui.generateButton.addEventListener("click", await wireGenerateButton);

    ui.inputBox.addEventListener("keydown", await wireInputBox);

}

function wireActionBarClick(target){
    let activeWidget = "field";

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
}

function wireJSONCopyButton(){
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
}

function wireColorPickerChange(){

}

function wireResetButton(){
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

}

export function wireInputBox(){
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
};

async function wireGenerateButton(){
    
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
}

export function unwireEvents(){
    
}