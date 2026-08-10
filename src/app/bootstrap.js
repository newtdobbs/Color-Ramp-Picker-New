// Role: startup sequence and live app wiring.
import * as ui from "../modules/ui";
import * as hf from "../helperFunctions";
import { appState } from "../state/store";
import { createBasemapOnlyView } from "../modules/map";
import { getServiceLayers, createDropdownForService } from "../modules/layers";
import { wireEvents } from "./wireEvents";

function parseItemId(rawValue) {
	const itemIds = (rawValue || "")
		.split(/[\s,]+/)
		.map(value => value.trim())
		.filter(Boolean);

	return Array.from(new Set(itemIds))[0] || appState.defaultItemID;
}

export async function initApp() {
	await createBasemapOnlyView();
    wireEvents();
}