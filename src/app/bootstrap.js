// Role: startup sequence and live app wiring.
import * as ui from "../modules/ui";
import * as hf from "../helperFunctions";
import { appState } from "../state/store";
import { createBasemapOnlyView } from "../modules/map";
import { getServiceLayers, createDropdownForService } from "../modules/layers";
import { initializeDialogForField } from "./fieldWorkflow";

function parseItemId(rawValue) {
	const itemIds = (rawValue || "")
		.split(/[\s,]+/)
		.map(value => value.trim())
		.filter(Boolean);

	return Array.from(new Set(itemIds))[0] || appState.defaultItemID;
}

async function handleItemIdSubmit(event) {
	if (event.key !== "Enter") {
		return;
	}

	event.preventDefault();
	appState.inputItemID = parseItemId(ui.inputBox.value);

	appState.serviceInfo = await getServiceLayers(appState.inputItemID);
	if (appState.serviceInfo) {
		ui.fieldBlock.heading = `Layer: ${appState.serviceInfo.title}`;
		createDropdownForService();
	} else {
		hf.warnUser(`No valid information attained for the service with the input item ID: ${appState.inputItemID}`);
	}

	ui.inputBox.value = "";
	if (appState.fieldsList) {
		appState.fieldsList.innerHTML = "";
	}
}

async function handleGenerateButton() {
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
		ui.description.textContent = appState.description;
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

export async function initApp() {
	await createBasemapOnlyView();
	ui.inputBox.addEventListener("keydown", handleItemIdSubmit);
	ui.generateButton.addEventListener("click", handleGenerateButton);
}