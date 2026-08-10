import * as ui from "../modules/ui.js"
import { appState } from "../state/store";
import { getServiceLayers, createDropdownForService } from "../modules/layers";
import { initializeDialogForField } from "./fieldWorkflow";


// Role: register all listeners in one place.
export async function wireEvents(){
   
    ui.actionBar.addEventListener("click", wireActionBarClick);
        
    ui.jsonCopy.addEventListener("click", wireJSONCopyButton);

    ui.resetButton.addEventListener("click",  wireResetButton);

    ui.colorPicker.addEventListener("calciteColorPickerChange", wireColorPickerChange);

    ui.resetButton.addEventListener("click",  wireResetButton);

    ui.generateButton.addEventListener("click", await wireGenerateButton);

    ui.inputBox.addEventListener("keydown", await wireInputBox);

}

function wireActionBarClick(event){
    const action = event.target.closest("calcite-action");
    if (!action) {
        return;
    }

    const nextWidget = action.dataset.actionId;
    if (!nextWidget) {
        return;
    }

    // If clicking the already-open tab, collapse it.
    if (appState.activeWidget === nextWidget) {
        action.active = false;
        const activeBlock = document.querySelector(`[data-block-id=${nextWidget}]`);
        if (activeBlock) {
            activeBlock.hidden = true;
        }
        appState.activeWidget = null;
        return;
    }

    // Enforce a single open tab by resetting every action/block first.
    document.querySelectorAll("calcite-action-bar calcite-action[data-action-id]").forEach((actionEl) => {
        actionEl.active = false;
    });
    document.querySelectorAll("[data-block-id]").forEach((blockEl) => {
        blockEl.hidden = true;
    });

    action.active = true;
    const nextBlock = document.querySelector(`[data-block-id=${nextWidget}]`);
    if (nextBlock) {
        nextBlock.hidden = false;
        nextBlock.expanded = true;
    }

    appState.activeWidget = nextWidget;
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

export async function wireInputBox(){
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

async function wireGenerateButton() {
	if (!appState.field) {
		hf.warnUser("Select a field from the fields list");
		return;
	}

	ui.bottomShell.hidden = false;
	ui.bottomShell.loading = true;

	try {
		ui.bottomPanel.heading = `Color Ramp Information for ${appState.field.name} (${appState.field.alias})`;
		ui.bottomPanel.description = `Selected Layer: ${appState.layer.title}`;

        console.log("Initializing dialog for field")
		await initializeDialogForField();
        console.log("DONE initializing dialog")
	} catch (error) {
		console.log("Error generating histogram:", error);
		ui.bottomPanel.heading = "Error Generating Color Ramp Information";
	} finally {
		ui.bottomShell.loading = false;
		ui.bottomShell.hidden = false;
	}

	document.querySelector("[data-action-id=ramp]").disabled = false;
}

export function unwireEvents(){
    ui.actionBar.removeEventListener("click", wireActionBarClick);
    ui.jsonCopy.removeEventListener("click", wireJSONCopyButton);
    ui.resetButton.removeEventListener("click", wireResetButton);
    ui.colorPicker.removeEventListener("calciteColorPickerChange", wireColorPickerChange);
    ui.generateButton.removeEventListener("click", wireGenerateButton);
    ui.inputBox.removeEventListener("keydown", wireInputBox);
}