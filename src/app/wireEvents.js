import * as ui from "../modules/ui.js"
import { appState } from "../state/store";
import * as actions from "../state/actions";
import * as hf from "../helperFunctions.js"
import { getServiceLayers, createDropdownForService } from "../modules/layers";
import { initializeDialogForField } from "./fieldWorkflow";
import { sliderStopRemove } from "../modules/slider.js";
import { updateRampUI } from "./rampWorkflow.js";
import { wireOutlierChipClick } from "../modules/statistics.js";


// Role: register all listeners in one place.
export async function wireEvents(){

    ui.actionBar.addEventListener("click", wireActionBarClick);
    
    ui.jsonCopy.addEventListener("click", wireJSONCopyButton);
    
    ui.resetButton.addEventListener("click",  wireResetButton);
    
    ui.applyColorButton.addEventListener("click", wireColorPickerApply);
    ui.applyColorButton.addEventListener("calciteSplitButtonPrimaryClick", wireApplyColorToSelectedStop);
    
    ui.generateButton.addEventListener("click", await wireGenerateButton);
    
    ui.inputBox.addEventListener("keydown", await wireInputBox);
    
    ui.sliderElement.addEventListener('contextmenu', () => {
        event.preventDefault(); // abstracted this into here, so that we can re-use wireSliderRightClick() for non right click events
        wireSliderRightClick();
    });
    
    wireOutlierChipClick();
}

function wireColorPickerApply(){
    if (!ui.sliderStopDropdown) {
        return;
    }

    const sliderValues = Array.isArray(appState.sliderValues) ? appState.sliderValues : [];
    const signature = sliderValues // this builds a signature of stop1|stop2|stop3...
        .map((value) => Number.isFinite(value) ? value.toFixed(6) : "NaN")
        .join("|");

    // Avoid rebuilding on every click; rebuild only when slider stops actually change.
    const needsRebuild = 
        ui.sliderStopDropdown.children.length !== sliderValues.length || // if the number of slider stops move
        ui.sliderStopDropdown.dataset.valuesSignature !== signature; // or if the slider stops move, and the signature changes

    if (!needsRebuild) {
        return;
    }

    const previouslySelectedIndex = getSelectedDropdownStopIndex();

    // clearing any dropdown items that already exist so we can reuse this function in event of a slider value remove
    ui.sliderStopDropdown.replaceChildren();

    // loop through the app state slider values adding a dropdown item for each
    for(let i = 0; i < sliderValues.length; i++){
        const sliderStopDropdownItem = document.createElement("calcite-dropdown-item");
        const sliderValue = hf.DecimalPrecision2.round(sliderValues[i], 2)
        
        sliderStopDropdownItem.label = `Slider Stop ${i + 1}: ${sliderValue} `;
        sliderStopDropdownItem.textContent = `Slider Stop ${i + 1}: ${sliderValue} `;
        sliderStopDropdownItem.value = String(i);
        sliderStopDropdownItem.selected = i === (previouslySelectedIndex >= 0 ? previouslySelectedIndex : 0);
        sliderStopDropdownItem.addEventListener("calciteDropdownItemSelect", ()=>{
            ui.applyColorButton.primaryText = `Apply to Slider Stop ${i + 1}`;
            actions.setActiveSliderValue(i);
        });
        ui.sliderStopDropdown.appendChild(sliderStopDropdownItem);
    }
    ui.sliderStopDropdown.selectionMode = "single";
    if (ui.applyColorButton) {
        ui.applyColorButton.selectionMode = "single";
    }

    const activeIndex = getSelectedDropdownStopIndex();
    if (activeIndex >= 0) {
        actions.setActiveSliderValue(activeIndex);
        ui.applyColorButton.primaryText = `Apply to Slider Stop ${activeIndex + 1}`;
    }
    ui.sliderStopDropdown.dataset.valuesSignature = signature;
}

function getSelectedDropdownStopIndex() {
    if (!ui.sliderStopDropdown) {
        return -1;
    }

    const selectedItem = ui.sliderStopDropdown.querySelector("calcite-dropdown-item[selected]");
    if (!selectedItem) {
        return -1;
    }

    const parsedIndex = Number.parseInt(selectedItem.value, 10);
    return Number.isInteger(parsedIndex) ? parsedIndex : -1;
}

function wireApplyColorToSelectedStop() {
    wireColorPickerApply();

    const stopIndex = getSelectedDropdownStopIndex();
    if (stopIndex < 0) {
        hf.warnUser("Select a slider stop from the dropdown before applying color.");
        return;
    }

    if (!Array.isArray(appState.colorStops) || !appState.colorStops[stopIndex]) {
        hf.warnUser("Could not find the selected slider stop.");
        return;
    }

    const pickerValue = ui.colorPicker?.value;
    if (!pickerValue) {
        hf.warnUser("No color picker value is available.");
        return;
    }

    const nextColor = [
        pickerValue.r,
        pickerValue.g,
        pickerValue.b,
        Number.isFinite(pickerValue.a) ? pickerValue.a : 1
    ];

    const nextColorStops = appState.colorStops.map((stop, index) => {
        if (index === stopIndex) {
            return {
                ...stop,
                color: [...nextColor]
            };
        }
        return {
            ...stop,
            color: Array.isArray(stop.color) ? [...stop.color] : [0, 0, 0, 1]
        };
    });

    actions.setColorStops(nextColorStops);
    actions.setLastCustomValues([...(appState.sliderValues || [])]);
    actions.setLastCustomStops(nextColorStops.map(stop => ({ ...stop, color: [...stop.color] })));

    if (appState.symbologyMode === "Default") {
        actions.setSymbologyMode("Custom");
        ui.resetButton.textContent = "Default";
        ui.resetButton.label = "Default";
    }

    actions.setActiveSliderValue(stopIndex);
    updateRampUI();
}

function resetInnerPanelScrollToTop() {
    ui.innerPanel.scrollContentTo({ left: 0, top: 0, behavior: "auto" });
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

    // Can uncomment chunk below to hide the active block if its open
    // if (appState.activeWidget === nextWidget) {
    //     action.active = false;
    //     const activeBlock = document.querySelector(`[data-block-id=${nextWidget}]`);
    //     if (activeBlock) {
    //         activeBlock.hidden = true;
    //     }
    //     appState.activeWidget = null;
    //     return;
    // }

    // Resettting every action & block to make sure only one block stays open
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
    resetInnerPanelScrollToTop();
    console.log("Active widget in state is", appState.activeWidget)
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

function switchActionBarTab(actionName){

    // First hiding all blocks and making them inactive
    document.querySelectorAll("calcite-action-bar calcite-action[data-action-id]").forEach((actionEl) => {
        actionEl.active = false;
    });
    document.querySelectorAll("[data-block-id]").forEach((blockEl) => {
        blockEl.hidden = true;
    });

    const currentTab = document.querySelector(`[data-action-id=${actionName}]`);
    currentTab.active = true;

    const currentBlock = document.querySelector(`[data-block-id=${actionName}]`);
    if (currentBlock) {
        currentBlock.hidden = false;
        currentBlock.expanded = true;
    }

    actions.setActiveWidget(actionName);
    resetInnerPanelScrollToTop();

}

function wireResetButton(){
    // if we're currently using custom symbology, we want to TURN ON the smart mapping defaults
    if (appState.symbologyMode === "Custom") {
        // saving the current custom configuration before overwriting
        actions.setLastCustomValues([...appState.sliderValues]);
        actions.setLastCustomStops([...appState.colorStops]);

        // then applying smart mapping defaults
        ui.sliderElement.values = [...appState.defaultValues];
        ui.histogramElement.colorStops = [...appState.defaultStops];
        actions.setSliderValues([...appState.defaultValues]);
        actions.setColorStops([...appState.defaultStops]);

    // otherwise we're using default symbology, so we want to RESTORE last custom stops before click
    } else {
        if (appState.lastCustomValues && appState.lastCustomStops) {
            ui.sliderElement.values = [...appState.lastCustomValues];
            ui.histogramElement.colorStops = [...appState.lastCustomStops];
            actions.setSliderValues([...appState.lastCustomValues]);
            actions.setColorStops([...appState.lastCustomStops]);
        } else {
            hf.warnUser("No custom configuration stored to restore.");
        }
    }

    // we use the 'old' mode (before click) as the new button label 
    ui.resetButton.textContent = appState.symbologyMode;
    ui.resetButton.label = appState.symbologyMode;

    // and we'll switch the mode to the opposite state
    actions.setSymbologyMode(appState.symbologyMode === "Default" ? "Custom" : "Default"); // determining value for current click
    console.log(`Changed buttom label FROM ${appState.symbologyMode} to ${ui.resetButton.label}`)

    console.log(`WE'RE CURRENTLY IN ${appState.symbologyMode} SYMBOLOGY MODE.`);

    updateRampUI(); // finally we updateRampUI to reflect these changes in the map/histogram

}

export async function wireInputBox(){
    if (event.key === "Enter") { 
        event.preventDefault(); // we want to avoid whatever normally happens with the 'Enter' key

        // hardcoding a default value --REMOVE THE IF BLOCK FOR DEPLOYMENT
        if (ui.inputBox.value === ""){
            actions.setInputItemID(appState.defaultItemID); // defaulting to MINC
        } else {
            const raw = ui.inputBox.value || "";
            const itemIDs = raw.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
            const uniqueItemIDs = Array.from(new Set(itemIDs));
            actions.setInputItemID(uniqueItemIDs[0]); // only taking the first ID if multiple are provided
        }

        // console.log("input AGOL id is", selectedID); // log for debug
        actions.setServiceInfo(await getServiceLayers(appState.inputItemID)); // check the layers present in the service
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

function resetStateForFieldSelection(){
    ui.lowOutliersChip.disabled = true;
    ui.lowOutliersChip.disabled = true;
    ui.lowOutliersChip.selected = true;
    ui.lowOutliersChip.selected = true;
}

async function wireGenerateButton() {
	if (!appState.field) {
		hf.warnUser("Select a field from the fields list");
		return;
	}

    resetStateForFieldSelection();

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
	document.querySelector("[data-action-id=color]").disabled = false;

    switchActionBarTab("color");    
}

function wireSliderRightClick(event){
    sliderStopRemove(event);
    wireColorPickerApply();
}