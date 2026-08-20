import * as ui from "../modules/ui";
import * as actions from "../state/actions"
import { appState } from "../state/store";
import { updateButtons } from "../modules/renderButtons";

function updateHistogramFromState() {
    if (!ui.histogramElement) {
        return;
    }

    ui.histogramElement.colorStops = appState.colorStops.map(stop => ({
        color: [...stop.color],
        value: stop.value
    }));
}

function updateRendererFromState() {
    if (!appState.layer || !appState.layer.renderer || typeof appState.layer.renderer.clone !== "function") {
        return;
    }

    const renderer = appState.layer.renderer.clone();
    const colorVarIndex = renderer.visualVariables.findIndex(vv => vv.type === "color");
    if (colorVarIndex === -1) {
        return;
    }

    const colorVariable = renderer.visualVariables[colorVarIndex].clone();
    colorVariable.stops = appState.colorStops.map(stop => ({
        color: stop.color,
        value: stop.value
    }));
    renderer.visualVariables[colorVarIndex] = colorVariable;
    appState.layer.renderer = renderer;
}

function updateSwatchFromState() {
    if (!appState.stats || !Array.isArray(appState.colorStops) || !appState.colorStops.length) {
        ui.swatch.style.background = "";
        return;
    }

    const span = appState.stats.max - appState.stats.min || 1;
    const gradientParts = appState.colorStops.map(stop => {
        const percent = ((stop.value - appState.stats.min) / span) * 100;
        return `rgb(${stop.color.join(",")}) ${percent}%`;
    });

    ui.swatch.style.background = `linear-gradient(to right, ${gradientParts.join(", ")})`;
}

export function updateRampUI() {
    updateHistogramFromState();
    updateRendererFromState();
    updateSwatchFromState();
    updateButtons();
}
