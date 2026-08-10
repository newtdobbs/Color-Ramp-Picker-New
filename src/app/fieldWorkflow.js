import { queryAllFeatures } from "@esri/arcgis-rest-feature-service";
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
import { appState } from "../state/store";

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

function calculateFieldStats(values) {

    console.log("Cleaning values")
    const cleanValues = values.filter(value => typeof value === "number" && !Number.isNaN(value)).sort((a, b) => a - b);
    
    if (!cleanValues.length) {
        return null;
    }
    
    console.log("calculating basic stats")
    const count = cleanValues.length;
    const sum = cleanValues.reduce((total, value) => total + value, 0);
    const avg = sum / count;
    const median = count % 2 === 0
    ? (cleanValues[count / 2 - 1] + cleanValues[count / 2]) / 2
    : cleanValues[Math.floor(count / 2)];
    const variance = cleanValues.reduce((total, value) => total + Math.pow(value - avg, 2), 0) / Math.max(count - 1, 1);
    const stddev = Math.sqrt(variance);
    
    console.log("calculating skewness")
    let skewness = 0;
    if (count > 2 && stddev > 0) {
        const thirdMoment = cleanValues.reduce((total, value) => total + Math.pow(value - avg, 3), 0) / count;
        const populationSkew = thirdMoment / Math.pow(stddev, 3);
        skewness = populationSkew * Math.sqrt(count * (count - 1)) / (count - 2);
    }
    
    console.log("calculating kurtosis")
    const kurtosisAccumulator = incrkurtosis();
    cleanValues.forEach(value => kurtosisAccumulator(value));

    return {
        count,
        min: cleanValues[0],
        max: cleanValues[cleanValues.length - 1],
        avg,
        median,
        stddev,
        skewness,
        kurtosis: kurtosisAccumulator()
    };
}

function buildDescription() {

    const descParts = [];

    
    descParts.push(
        `${appState.field.alias} has a value range of ${hf.DecimalPrecision2.round(appState.stats.min, 2).toLocaleString()} to ${hf.DecimalPrecision2.round(appState.stats.max, 2).toLocaleString()}, with a mean of ${hf.DecimalPrecision2.round(appState.stats.avg, 2).toLocaleString()} and a median of ${hf.DecimalPrecision2.round(appState.stats.median, 2).toLocaleString()}. With a skewness of ${hf.DecimalPrecision2.round(appState.stats.skewness, 2).toLocaleString()}, the distribution shows`
    );
    
    const skewAbs = Math.abs(appState.stats.skewness);
    if (skewAbs > 0.25) {
        let skewSeverity;
        if (skewAbs > 1) {
            skewSeverity = "substantial";
        } else if (skewAbs > 0.5) {
            skewSeverity = "moderate";
        } else {
            skewSeverity = "slight";
        }
        
        const skewDirection = appState.stats.skewness > 0 ? "positive (right)" : "negative (left)";
        descParts.push(`${skewSeverity} ${skewDirection} skew.`);
    } else {
        descParts.push(" no noticeable skew.");
    }
    
    descParts.push(`The data has a kurtosis of ${hf.DecimalPrecision2.round(appState.stats.kurtosis, 2).toLocaleString()}, indicating`);
    const kurtosisAbs = Math.abs(appState.stats.kurtosis);
    if (kurtosisAbs <= 1) {
        descParts.push("an approximately normal distribution.");
    } else {
        const severity = kurtosisAbs > 2 ? "substantially " : "";
        const kurtosisDirection = appState.stats.kurtosis > 0 ? "leptokurtic (peaked)" : "platykurtic (flat)";
        descParts.push(`a ${severity}${kurtosisDirection} distribution.`);
    }
    
    appState.description = descParts.join(" ");
}

export async function initializeDialogForField() {
    try {
        console.log("Querying all features")
        const response = await queryAllFeatures({
            url: appState.layer.parsedUrl.path,
            outFields: [appState.field.name],
            returnGeometry: false
        });

        const values = response.features.map(feature => feature.attributes[appState.field.name]);
        console.log("Calculating stats")
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

        const sliderValues = [
            appState.stats.avg - appState.stats.stddev,
            appState.stats.avg - appState.stats.stddev / 2,
            appState.stats.avg,
            appState.stats.avg + appState.stats.stddev / 2,
            appState.stats.avg + appState.stats.stddev
        ];

        console.log("Slider values", sliderValues)
        
        appState.defaultValues = [...sliderValues];
        appState.sliderValues = [...sliderValues];
        appState.lastCustomValues = [...sliderValues];
        
        const defaultStops = [
            { color: [129, 0, 230], value: appState.stats.avg - appState.stats.stddev },
            { color: [179, 96, 209], value: appState.stats.avg - appState.stats.stddev / 2 },
            { color: [242, 207, 158], value: appState.stats.avg },
            { color: [110, 184, 48], value: appState.stats.avg + appState.stats.stddev / 2 },
            { color: [43, 153, 0], value: appState.stats.avg + appState.stats.stddev }
        ];
        console.log("Default stops", defaultStops)
        
        appState.defaultStops = defaultStops.map(stop => ({ ...stop }));
        
        appState.colorStops = defaultStops.map(stop => ({ ...stop }));
        appState.lastCustomStops = defaultStops.map(stop => ({ ...stop }));

        // Keep map renderer in lockstep with the same stops/colors used by the histogram.
        applyStateStopsToLayerRenderer();
        
        ui.sliderElement.min = appState.stats.min;
        ui.sliderElement.max = appState.stats.max;
        ui.sliderElement.values = [...sliderValues];
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
        ui.histogramElement.colorStops = defaultStops.map((stop, index) => ({
            color: stop.color,
            value: sliderValues[index]
        }));
        ui.histogramElement.colorBlendingEnabled = true;

        // Initialize swatch + add-stop buttons and ensure slider changes drive renderer updates.
        renderSwatchGradient();
        renderAddStopButtons();
        detachSliderListeners();
        attachSliderListeners();

        buildDescription();
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