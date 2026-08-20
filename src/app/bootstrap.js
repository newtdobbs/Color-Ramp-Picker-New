import { createBasemapOnlyView } from "../modules/map";
import { wireEvents } from "./wireEvents";

/**
 * initializes app by creating basemap view and wiring UI interaction events
 */
export async function initApp() {
	await createBasemapOnlyView();
    wireEvents();
}