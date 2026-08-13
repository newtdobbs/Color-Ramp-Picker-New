import { queryFieldValues } from "../modules/fields";
import histogram from "@arcgis/core/smartMapping/statistics/histogram.js";
import { getSchemeByName } from "@arcgis/core/smartMapping/symbology/color.js";
const colorRendererCreator = await $arcgis.import("@arcgis/core/smartMapping/renderers/color.js");
import incrkurtosis from "@stdlib/stats-incr-kurtosis";
import * as ui from "../modules/ui";
import * as hf from "../helperFunctions";
import * as constants from "../modules/constants";
import { getServiceLayers, createDropdownForService } from "../modules/layers";
import { createMapForSelectedLayer } from "../modules/map";
import { renderFieldList } from "../modules/renderFieldList";
import { attachSliderListeners, detachSliderListeners } from "../modules/slider";
import { renderSwatchGradient } from "../modules/renderSwatch";
import { renderAddStopButtons } from "../modules/renderButtons";
import { buildAndStoreDescription } from "./descriptionWorkflow";
import { appState } from "../state/store";
import * as actions from "../state/actions";
import { buildCustomStops, buildDefaultStops, calculateFieldStats } from "../modules/statistics";

function applyStateStopsToLayerRenderer() {
    if (!appState.layer || !appState.layer.renderer || !Array.isArray(appState.colorStops)) {
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

function normalizeItemIdInput(rawValue) {
    const itemIds = (rawValue || "")
        .split(/[\s,]+/)
        .map(value => value.trim())
        .filter(Boolean);
    return Array.from(new Set(itemIds))[0] || appState.defaultItemID;
}


export async function initializeDialogForField() {
    try {
        console.log("Querying all features for the field")
        const values = await queryFieldValues();

        if (!Array.isArray(values)) {
            hf.warnUser(`Unable to query numeric values for ${appState.field?.alias || "the selected field"}.`);
            return;
        }

        console.log("Cleaning values and calculating stats")
        const stats = calculateFieldStats(values);


        if (!stats) {
            hf.warnUser(`No numeric values were returned for ${appState.field.alias}.`);
            return;
        }

        appState.stats = stats;
        console.log("Stats has been calculated as:", stats)
        
        if (appState.stats.count < 20) {
            hf.warnUser(`With only ${appState.stats.count} observations, for now we'll refrain from calculating statistics`);
            return;
        }
        
        const matchingScheme = getSchemeByName({name: "Purple and Green 10"})
        
        console.log("Creating continuous renderer with params:")
        console.log("appState view:",appState.view)
        console.log("appState layer:",appState.layer)
        console.log("appState field name:",appState.field.name)
        const rendererResult = await colorRendererCreator.createContinuousRenderer({
            view: appState.view,
            layer: appState.layer,
            field: appState.field.name,
            theme: "above-and-below",
            colorScheme: matchingScheme
        });
        
        console.log("Renderer result", rendererResult)
        
        appState.layer.renderer = rendererResult.renderer;
        appState.layer.visible = true;

        
        // DEFAULTS
        const defaultStops = buildDefaultStops();
        actions.setDefaultValues(defaultStops.map(({ value }) => value)); // just grabbing the numbers from smart mapping defaults
        actions.setDefaultStops(defaultStops.map(stop => ({ ...stop })));
        
        
        // CUSTOM
        const customStops = buildCustomStops();
        actions.setLastCustomStops(customStops.map(stop => ({ ...stop })));
        actions.setLastCustomValues(customStops.map(({ value }) => value)); // just grabbing the numbers from custom stops defaults
        actions.setColorStops(customStops.map(stop => ({ ...stop })));
        actions.setSliderValues(customStops.map(({ value }) => value)); // just grabbing the numbers from custom stops defaults


        // Keep map renderer in lockstep with the same stops/colors used by the histogram.
        applyStateStopsToLayerRenderer();
        
        ui.sliderElement.min = appState.stats.min;
        ui.sliderElement.max = appState.stats.max;
        ui.sliderElement.values = [...appState.sliderValues];
        ui.sliderElement.valueLabelsPlacement = "after";
        ui.sliderElement.valueLabelsEditingEnabled = true;
        ui.sliderElement.segmentsDraggingDisabled = true;
        
        const histogramResult = await histogram({
            layer: appState.layer,
            field: appState.field.name,
            minValue: appState.stats.min,
            maxValue: appState.stats.max,
            numBins: Math.min(100, appState.stats.count)
        });
        console.log("Histogram result", histogramResult)

        ui.histogramElement.min = histogramResult.minValue;
        ui.histogramElement.max = histogramResult.maxValue;
        ui.histogramElement.bins = histogramResult.bins;
        ui.histogramElement.colorStops = [...customStops]
        ui.histogramElement.colorBlendingEnabled = true;

        // Initialize swatch + add-stop buttons and ensure slider changes drive renderer updates.
        renderSwatchGradient();
        renderAddStopButtons();
        detachSliderListeners();
        attachSliderListeners();

        buildAndStoreDescription();
        ui.description.textContent = appState.description;

        ui.resetButton.disabled = false;
        ui.jsonCopy.disabled = false;
    } catch (error) {
        console.error("Error creating histogram:", error);
    }
}

// Role: end-to-end field pipeline.
export async function handleItemIDSubmit(event) {
    if (!event || event.key !== "Enter") {
        return false;
    }

    event.preventDefault();
    appState.inputItemID = normalizeItemIdInput(ui.inputBox.value);
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

    return Boolean(appState.serviceInfo);
}
export async function handleLayerSelect(layerSelection) {
    if (!layerSelection) {
        return false;
    }

    appState.layerSelection = layerSelection;
    await createMapForSelectedLayer();
    renderFieldList();
    return true;
}
export function handleFieldSelect(selectedField) {
    if (!selectedField) {
        appState.field = null;
        return null;
    }

    appState.field = appState.field === selectedField ? null : selectedField;
    return appState.field;
}
export async function handleGenerateHistogram() {
    if (!appState.field) {
        hf.warnUser("Select a field from the fields list");
        return false;
    }

    if (!constants.goodFieldTypes.includes(appState.field.type)) {
        hf.warnUser("Please ensure the selected field is one of the following types: small-integer, integer, single, double, long, big-integer.");
        appState.field = null;
        return false;
    }

    if (!constants.goodFieldValueTypes.includes(appState.field.valueType)) {
        hf.warnUser("Please ensure the selected field is one of the following value types: count-or-amount, currency, percentage-or-ratio.");
        appState.field = null;
        return false;
    }

    ui.bottomPanel.hidden = false;
    ui.bottomPanel.loading = true;

    const testPanel = document.getElementById("test-panel");
    try {
        testPanel.heading = `Color Ramp Information for ${appState.field.name} (${appState.field.alias})`;
        testPanel.description = `Selected Layer: ${appState.layer.title}`;

        await initializeDialogForField();
        ui.description.textContent = appState.description || "";
        document.querySelector("[data-action-id=ramp]").disabled = false;
    } catch (error) {
        console.log("Error generating histogram:", error);
        testPanel.heading = "Error Generating Color Ramp Information";
        return false;
    } finally {
        ui.bottomPanel.loading = false;
        ui.bottomPanel.hidden = false;
    }

    return true;
}