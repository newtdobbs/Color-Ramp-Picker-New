import * as ui from "./ui";
import { appState } from "../state/store";

// Role: swatch gradient rendering.
export function renderSwatchGradient(){
    if (!appState.stats || !Array.isArray(appState.colorStops) || !appState.colorStops.length) {
        ui.swatch.style.background = "";
        return;
    }

    const gradientParts = appState.colorStops.map((stop, index) => {

        const percent = ((stop.value - appState.stats.min) / (appState.stats.max - appState.stats.min)) * 100; // getting the color stop's percentage along based on its value
        return `rgb(${stop.color.join(",")}) ${percent}%`; // returning the color at that stop to actually create the swatch
    });
    // creating a linear gradient from the pieces we just assembled from the color stops
    ui.swatch.style.background = `linear-gradient(to right, ${gradientParts.join(", ")})`;
}