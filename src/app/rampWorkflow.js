import * as ui from "../modules/ui";
import * as hf from "../helperFunctions";
import * as actions from "../state/actions"
import { appState } from "../state/store";
import { initializeDialogForField } from "./fieldWorkflow";
import { buildAndStoreDescription, renderDescription } from "./descriptionWorkflow";
import { updateButtons } from "../modules/renderButtons";

function syncStopsFromSliderValues() {
    const sliderValues = [...ui.sliderElement.values];
    actions.setSliderValues(sliderValues)

    const previousStops = Array.isArray(appState.colorStops) ? appState.colorStops : [];
    if (previousStops.length === sliderValues.length) {
        actions.setColorStops(previousStops.map((stop, index) => ({
            color: Array.isArray(stop.color) ? [...stop.color] : [0, 0, 0],
            value: sliderValues[index]
        })));
    } else {
        actions.setColorStops(sliderValues.map((value, index) => {
            const fallbackStop = previousStops[Math.min(index, Math.max(previousStops.length - 1, 0))];
            const fallbackColor = fallbackStop && Array.isArray(fallbackStop.color) ? [...fallbackStop.color] : [0, 0, 0];
            return {
                color: fallbackColor,
                value
            };
        }));
    }

    actions.setLastCustomValues([...appState.sliderValues]);
    actions.setLastCustomStops(appState.colorStops.map(stop => ({ ...stop, color: [...stop.color] })));
}

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

// Role: ramp lifecycle and interactions.
export async function initializeRampForField() {
    if (!appState.field) {
        hf.warnUser("Select a field from the fields list");
        return false;
    }

    await initializeDialogForField();
    initializeRampUI();
    return true;
}

export function handleSliderInput() {
    if (!Array.isArray(ui.sliderElement.values) || !ui.sliderElement.values.length) {
        return;
    }

    syncStopsFromSliderValues();
    updateRampUI();
}

export function handleSliderChange() {
    if (!Array.isArray(ui.sliderElement.values) || !ui.sliderElement.values.length) {
        return;
    }

    syncStopsFromSliderValues();
    updateRampUI();
}

export function handleResetToggle() {
    const defaultStops = appState.defaultStops || [];
    const defaultValues = appState.defaultValues || [];

    if (!defaultStops.length || !defaultValues.length) {
        hf.warnUser("No default symbology is available for reset.");
        return false;
    }

    if (appState.symbologyMode === "Custom") {
        actions.setLastCustomValues([...appState.sliderValues]);
        actions.setLastCustomStops(appState.colorStops.map(stop => ({ ...stop, color: [...stop.color] })));

        actions.setSliderValues([...defaultValues]);
        actions.setColorStops(defaultStops.map(stop => ({ ...stop, color: [...stop.color] })));
        actions.setSymbologyMode("Default");
        ui.resetButton.textContent = "Custom";
        ui.resetButton.label = "Custom";
    } else {
        if (!appState.lastCustomValues || !appState.lastCustomStops || !appState.lastCustomValues.length) {
            hf.warnUser("No custom symbology is stored to restore.");
            return false;
        }

        actions.setSliderValues([...appState.lastCustomValues]);
        actions.setColorStops(appState.lastCustomStops.map(stop => ({ ...stop, color: [...stop.color] })));
        actions.setSymbologyMode("Custom");
        ui.resetButton.textContent = "Default";
        ui.resetButton.label = "Default";
    }

    ui.sliderElement.values = [...appState.sliderValues];
    updateRampUI();
    return true;
}

export function handleCopyJson() {
    if (!appState.layer || !appState.layer.renderer) {
        hf.warnUser("No renderer is available to copy.");
        return false;
    }

    const rendererJSON = JSON.stringify(appState.layer.renderer, null, "\t");
    try {
        navigator.clipboard.writeText(rendererJSON);
        hf.warnUser(`JSON for color ramp with ${appState.colorStops.length} stops copied to clipboard.`, "success", true);
        return true;
    } catch (error) {
        console.error("Failed to copy JSON:", error);
        return false;
    }
}

export function handleRemoveStop() {
    const activeValue = ui.sliderElement.activeValue;
    if (typeof activeValue !== "number") {
        hf.warnUser("Select a slider stop before removing it.");
        return false;
    }

    if (!Array.isArray(appState.sliderValues) || appState.sliderValues.length <= 2) {
        hf.warnUser("At least two slider stops are required.");
        return false;
    }

    const removeIndex = appState.sliderValues.findIndex(value => value === activeValue);
    if (removeIndex === -1) {
        hf.warnUser("Could not find the selected stop to remove.");
        return false;
    }

    actions.setSliderValues(appState.sliderValues.filter((_, index) => index !== removeIndex));
    actions.setColorStops(appState.colorStops.filter((_, index) => index !== removeIndex));
    ui.sliderElement.values = [...appState.sliderValues];

    updateRampUI();
    return true;
}

export function initializeRampUI() {
    updateRampUI();
    buildAndStoreDescription();
    renderDescription();
}

/*
OVERALL FUNCTION TO UPDATE ALL UI
we don't need to update the description when a slider is moved
*/
export function updateRampUI() {
    updateHistogramFromState();
    updateRendererFromState();
    updateSwatchFromState();
    updateButtons();
}
