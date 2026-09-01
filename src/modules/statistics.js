import incrkurtosis from "@stdlib/stats-incr-kurtosis";
import { appState } from "../state/store";
import { lowOutliersChip, highOutliersChip, sliderStopDropdown } from "./ui";
import { setOutliersMode, setSliderValues, setColorStops } from "../state/actions";
import { classifyDistribution } from "../app/ruleset";
import { setProfile } from "../state/actions";
import { warnUser } from "../helperFunctions";
import { addStopAtValue, sliderStopRemove } from "./slider";
import { warn } from "@esri/arcgis-rest-request";
import { add, max } from "mathjs";
import { updateRampUI } from "../app/rampWorkflow";
import * as ui from "./ui"
import { sliderHandler } from "./slider";
import { updateButtons } from "./renderButtons";


/**
 * function to mask low outliers by injecting black into the end of the distribution, does not change the data distribution 
 * @returns boolean indicating success/failure of masking outcome
 */
function hideLowOutliersWithBlack() {
    const cutoff = appState.stats?.lowOutlierCutoff;
    const stops = Array.isArray(appState.colorStops)
        ? appState.colorStops.map(stop => ({
            color: Array.isArray(stop.color) ? [...stop.color] : [0, 0, 0],
            value: stop.value
        }))
        : [];

    if (!Number.isFinite(cutoff) || stops.length < 2) {
        return false;
    }

    // Prevent repeated deselection from stacking extra black or duplicate inserted colors.
    const existingFirst = stops[0];
    if (existingFirst?.value === cutoff && Array.isArray(existingFirst?.color)
        && existingFirst.color[0] === 0 && existingFirst.color[1] === 0 && existingFirst.color[2] === 0) {
        return false;
    }

    if (stops.length >= 8) {
        warnUser("ArcGIS visual variables only support 8 stops, please remove a stop before filtering outliers.", "warning", true);
        return false;
    }

    const originalFirst = stops[0];
    const nextStop = stops.find((stop, index) => index > 0 && stop.value > cutoff) || stops[1];
    if (!nextStop || !Number.isFinite(nextStop.value) || nextStop.value <= cutoff) {
        return false;
    }

    const midpoint = cutoff + ((nextStop.value - cutoff) / 2); // the midpoint between the low cutoff and the next stop
    const epsilon = Math.max((nextStop.value - cutoff) / 1000, Number.EPSILON); // assigning a safety margin as the max between the difference of the cutoff and the next stop / 1000 and epsilon (2.220446049250313e-16)
    // using epsilon and min/max guards to keep a buffer between the low cutoff and the next stop's value 
    const clampedMidpoint = Math.min(nextStop.value - epsilon, Math.max(cutoff + epsilon, midpoint)); 

    const nextStops = [...stops];
    nextStops[0] = { color: [0, 0, 0], value: cutoff };
    // inserting color from the original first stop into the new stop found at index 1
    nextStops.splice(1, 0, {
        color: [...originalFirst.color],
        value: clampedMidpoint
    });

    const sortedStops = nextStops.sort((a, b) => a.value - b.value);
    const sliderValues = sortedStops.map(stop => stop.value);

    ui.sliderElement.values = [...sliderValues];
    setColorStops(sortedStops);
    setSliderValues(sliderValues);

    return true;
}

/**
 * function to mask high outliers by injecting black into the end of the distribution, does not change the data distribution 
 * @returns boolean indicating success/failure of masking
 */
function hideHighOutliersWithBlack(){
    const cutoff = appState.stats?.highOutlierCutoff;
    console.log(`High cutoff: ${cutoff}`)
    const stops = Array.isArray(appState.colorStops)
        ? appState.colorStops.map(stop => ({
            color: Array.isArray(stop.color) ? [...stop.color] : [0, 0, 0],
            value: stop.value
        }))
        : [];
   

    if (!Number.isFinite(cutoff) || stops.length < 2) {
        return false;
    }

    const existingLast = stops[stops.length-1];

    if (existingLast?.value === cutoff && Array.isArray(existingLast?.color)
        && existingLast.color[0] === 0 && existingLast.color[1] === 0 && existingLast.color[2] === 0) {
        return false;
    }

    if (stops.length >= 8) {
        warnUser("ArcGIS visual variables only support 8 stops, please remove a stop before filtering outliers.", "warning", true);
        return false;
    }

    const originalLast = stops[stops.length - 1]; // this grabs the last stop BEFORE we inject black
    const previousStop = stops.findLast((stop, index) => index < stops.length - 1 && stop.value < cutoff); // the nearest stop below the cutoff
    if (!previousStop || !Number.isFinite(previousStop.value) || previousStop.value >= cutoff) {
        return false;
    }
    
    const midpoint = cutoff - ((cutoff - previousStop.value) / 2); // midpoint between the high cutoff and the previous stop
    const epsilon = Math.max((cutoff - previousStop.value) / 1000, Number.EPSILON); // assigning a safety margin as the max between the difference of the cutoff and the next stop / 1000 and epsilon (2.220446049250313e-16)
    // using epsilon and min/max guards to keep a buffer between high cutoff and previous stop's value
    const clampedMidpoint = Math.min(cutoff - epsilon, Math.max(previousStop.value + epsilon, midpoint));

    const nextStops = [...stops];
    nextStops[stops.length - 1] = { color: [0, 0, 0], value: cutoff }; // injecting black at the high cutoff
    // inserting color from original last stop directly before the new black stop
    nextStops.splice(stops.length - 1, 0, {
        color: [...originalLast.color],
        value: clampedMidpoint
    });

    const sortedStops = nextStops.sort((a, b) => a.value - b.value);
    const sliderValues = sortedStops.map(stop => stop.value);

    ui.sliderElement.values = [...sliderValues];
    setColorStops(sortedStops);
    setSliderValues(sliderValues);

    return true;
}

/**
 * shows high outliers by removing black and shifting highest color to distribution's maximum
 * @returns boolean indicating success
 */
function showHighOutliers(){
    // quick guard to make sure outliers are hidden before showing
    if(appState.outliers.high === "Hidden"){
        const stops = Array.isArray(appState.colorStops)
        ? appState.colorStops.map(stop => ({
            color: Array.isArray(stop.color) ? [...stop.color] : [0, 0, 0],
            value: stop.value
        }))
        : [];

        console.log(`Stops BEFORE pop`, appState.colorStops);
        // removing the last color stop from the array which had the black color 
        const newStops = stops.slice(0, -1)

        // move what is now the last stop to the end at the max value
        newStops[newStops.length - 1].value = appState.stats.max;

        const sortedStops = newStops.sort((a, b) => a.value - b.value);
        const sliderValues = sortedStops.map(stop => stop.value);

        ui.sliderElement.values = [...sliderValues];
        setColorStops(sortedStops);
        setSliderValues(sliderValues);

        return true;
    }
}

/**
 * shows low outliers by removing black, and shifting lowest color to the distribution's minimum
 * @returns boolean indicating success
 */
function showLowOutliers(){
    if(appState.outliers.low === "Hidden"){
        
        const stops = Array.isArray(appState.colorStops)
        ? appState.colorStops.map(stop => ({
            color: Array.isArray(stop.color) ? [...stop.color] : [0, 0, 0],
            value: stop.value
        }))
        : [];

        console.log('Stops before removing the first')
        // removing the first stop from the array which had the black color
        const newStops = stops.slice(1);

        // moving what is now the first stop to the end at the min value
        newStops[0].value = appState.stats.min;

        const sortedStops = newStops.sort((a, b) => a.value - b.value);
        const sliderValues = sortedStops.map(stop => stop.value);

        ui.sliderElement.values = [...sliderValues];
        setColorStops(sortedStops);
        setSliderValues(sliderValues);

        return true;
    }
}

/**
 * 
 * @param {array} sortedVals an array of values, sorted ascending
 * @param {float} p the quantile to calculate (10%, 50%, 75%, etc) 
 * @returns the distribution value at the provided quantile
 */
function quantileFromSorted(sortedVals, p) {
    if (!Array.isArray(sortedVals) || !sortedVals.length) {
        return null;
    }

    if (p <= 0) {
        return sortedVals[0];
    }

    if (p >= 1) {
        return sortedVals[sortedVals.length - 1];
    }

    const index = (sortedVals.length - 1) * p;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
        return sortedVals[lower];
    }

    const weight = index - lower;
    return sortedVals[lower] + (sortedVals[upper] - sortedVals[lower]) * weight;
}

/**
 * 
 * @param {array} sortedVals an array of values, sorted ascending
 * @returns dictionary of important quantiles 
 */
function summarizeQuantiles(sortedVals) {
    return {
        p01: quantileFromSorted(sortedVals, 0.01),
        p05: quantileFromSorted(sortedVals, 0.05),
        p10: quantileFromSorted(sortedVals, 0.1),
        p25: quantileFromSorted(sortedVals, 0.25),
        p50: quantileFromSorted(sortedVals, 0.5),
        p75: quantileFromSorted(sortedVals, 0.75),
        p90: quantileFromSorted(sortedVals, 0.9),
        p95: quantileFromSorted(sortedVals, 0.95),
        p99: quantileFromSorted(sortedVals, 0.99)
    };
}

/**
 * 
 * @param {dictionary} stats dictionary in app state of the data statistics 
 * @param {*} p the percentile
 * @returns an interpolated value using the quantile summary
 */
function interpolateFromQuantileSummary(stats, p) {
    if (!stats || !stats.quantiles) {
        return null;
    }

    const table = [
        [0, stats.min],
        [0.01, stats.quantiles.p01],
        [0.05, stats.quantiles.p05],
        [0.1, stats.quantiles.p10],
        [0.25, stats.quantiles.p25],
        [0.5, stats.quantiles.p50],
        [0.75, stats.quantiles.p75],
        [0.9, stats.quantiles.p90],
        [0.95, stats.quantiles.p95],
        [0.99, stats.quantiles.p99],
        [1, stats.max]
    ].filter(([, value]) => Number.isFinite(value));

    if (!table.length) {
        return null;
    }

    if (p <= table[0][0]) { // returning the min if the percentile is lower than the minimum value of stats
        return table[0][1];
    }

    if (p >= table[table.length - 1][0]) { // returning the max if the percentile is greater than the maximum value of stats
        return table[table.length - 1][1];
    }

    for (let i = 1; i < table.length; i += 1) {
        const [x1, y1] = table[i];
        const [x0, y0] = table[i - 1];
        if (p <= x1) {
            const width = x1 - x0;
            if (width <= 0) {
                return y1;
            }
            const t = (p - x0) / width;
            return y0 + (y1 - y0) * t;
        }
    }

    return table[table.length - 1][1];
}

/**
 * 
 * @param {array} values array of values over which to enforce increasing order
 * @param {number} min the min of the values range
 * @param {*} max the max of the values range
 * @returns array of values clamped within the min,max range
 */
function enforceIncreasing(values, min, max) {
    const clamped = values.map(value => Math.min(max, Math.max(min, value)));
    const gap = Math.max((max - min) / 5000, Number.EPSILON);

    for (let i = 1; i < clamped.length; i += 1) {
        if (clamped[i] <= clamped[i - 1]) {
            clamped[i] = Math.min(max, clamped[i - 1] + gap);
        }
    }

    for (let i = clamped.length - 2; i >= 0; i -= 1) {
        if (clamped[i] >= clamped[i + 1]) {
            clamped[i] = Math.max(min, clamped[i + 1] - gap);
        }
    }

    clamped[0] = min;
    clamped[clamped.length - 1] = max;
    return clamped;
}

/**
 * 
 * @param {array} vals array of values for which to calculate kurtosis
 * @returns calculated kurtosis
 */
export function calculateKurtosis(vals) {
    if (!Array.isArray(vals) || vals.length < 4) {
        return null;
    }

    console.log("calculating kurtosis")
    const kurtosisAccumulator = incrkurtosis();
    vals.forEach(value => kurtosisAccumulator(value));
    return kurtosisAccumulator();
}

export function calculateSkewness(vals, n, avg, sd) {
    if (!Array.isArray(vals) || n <= 2 || sd <= 0) {
        return null;
    }

    // calculating third moment
    const thirdMoment = vals.reduce((total, value) => total + Math.pow(value - avg, 3), 0) / n;
    // population skew
        const populationSkew = thirdMoment / Math.pow(sd, 3);
    // sample skew using bias correction
    return populationSkew * Math.sqrt(n * (n - 1)) / (n - 2);
}

/**
 * 
 * @param {array} vals array of values for which to calculate outliers 
 * @returns the low cutoff (number) and values below it, and high cutoff (number) and values above it (array)
 */
export function calculateOutliers(vals) {
    if (!Array.isArray(vals) || !vals.length) {
        return null;
    }

    const q1 = quantileFromSorted(vals, 0.25);
    const q3 = quantileFromSorted(vals, 0.75);

    const iqr = q3 - q1;

    // If the dataset doesn't go below zero, clamp the low cutoff at zero.
    const lowCutoff = vals[0] < 0 ? q1 - 1.5 * iqr : Math.max(q1 - 1.5 * iqr, 0);
    const highCutoff = q3 + 1.5 * iqr;

    const lowOutliers = vals.filter(v => v < lowCutoff);
    lowOutliersChip.disabled = true;
    if (lowOutliers.length > 0) { 
        console.log("Low outliers:", lowOutliers)
        lowOutliersChip.disabled = false; 
    }
    const highOutliers = vals.filter(v => v > highCutoff);
    highOutliersChip.disabled = true;
    if (highOutliers.length > 0) { 
        console.log("High outliers:", highOutliers)
        highOutliersChip.disabled = false;
    }

    console.log(`Low outlier cutoff: ${lowCutoff}, high outlier cutoff: ${highCutoff}`)
    return [lowCutoff, lowOutliers, highCutoff, highOutliers]


    console.log(`Low outliers: ${appState.stats.lowOutliers.length}, high outliers: ${appState.stats.highOutliers.length}`)
}

/**
 * wires the outlier chips to hide/show outliers based on their selection
 */
export function wireOutlierChipClick(){
    const logSelection = (chip, chipName) => {
        queueMicrotask(() => {
            const cutoff = appState.stats[`${chipName}OutlierCutoff`]
            console.log("Click logged for chip:", chipName)
            
            // CHIP NOT SELECTED: HIDING OUTLIERS
            if (!chip.selected){ // if its unselected, we want to hide outliers, injecting black into ends
                // HIDING LOW STOPS
                warnUser(`Hiding ${chipName} outliers with cutoff: ${cutoff.toLocaleString()}`,"warning", true)
                if (chipName === "low"){
                    if (hideLowOutliersWithBlack()) {
                        updateRampUI();
                        setOutliersMode(chipName, chip.selected);
                    }
                    
                    // HIDING HIGH STOPS
                }
                else {
                    if(hideHighOutliersWithBlack()){
                        updateRampUI();
                        setOutliersMode(chipName, chip.selected);
                    }
                }
                    
            // CHIP SELECTED: SHOWING OUTLIERS
            } else {
                console.log(`Need to show ${chipName} outliers with cutoff: ${cutoff}`)
                // SHOWING LOW OUTLIERS 
                if (chipName === "low"){
                    if(showLowOutliers()){
                        updateRampUI()
                        setOutliersMode(chipName, chip.selected)
                    }
                // SHOWING HIGH OUTLIERS 
                } else {
                    if(showHighOutliers()){
                        updateRampUI()
                        setOutliersMode(chipName, chip.selected)
                    }
                }
            }

            

            // these should be applied regardless of whether we're showing or hiding high or low outliers
            // updateRampUI(); // then update the symbology to reflect
            // setOutliersMode(chipName, chip.selected)

            console.log("After stop change, app state stops are now", appState.colorStops);
            console.log(`State of ${chipName} outliers:`, appState.outliers[chipName])
        });
    };

    lowOutliersChip.addEventListener("calciteChipSelect", () => {
        logSelection(lowOutliersChip, "low", );
    });
    
    highOutliersChip.addEventListener("calciteChipSelect", () => {
        logSelection(highOutliersChip, "high");
    });
}

/**
 * 
 * @param {array} values array of raw field values for which to calculate statistics
 * @returns a dictionary with important descriptive statistics of the distribution
 */
export function calculateFieldStats(values) {
    if (!Array.isArray(values)) {
        return null;
    }

    const cleanValues = values.filter(value => typeof value === "number" && !Number.isNaN(value)).sort((a, b) => a - b); // cleaning and sorting ascending
    
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
    
    const [lowOutlierCutoff, lowOutliers, highOutlierCutoff, highOutliers] = calculateOutliers(cleanValues);
    const quantiles = summarizeQuantiles(cleanValues); // calculating important quantiles (1%, 25%, 75%, etc)
    const uniqueCount = new Set(cleanValues).size;
    const outlierCount = lowOutliers.length + highOutliers.length;

    return {
        count,
        min: cleanValues[0],
        max: cleanValues[cleanValues.length - 1],
        avg,
        median,
        stddev,
        quantiles,
        uniqueCount,
        uniqueRatio: count > 0 ? uniqueCount / count : 1,
        isIntegerLike: cleanValues.every(Number.isInteger),
        outlierRate: count > 0 ? outlierCount / count : 0,
        lowOutlierCutoff,
        lowOutliers, 
        highOutlierCutoff, 
        highOutliers, 
        skewness: calculateSkewness(cleanValues, count, avg, stddev),
        kurtosis: calculateKurtosis(cleanValues)
    };
}

/**
 * 
 * @param {dictionary} stats dictionary in app state of the data statistics 
 * @returns array of color stops for the smart mapping defaults: 1 sd above and below mean, mean, and the midpoints
 */
export function buildDefaultStops(stats = appState.stats){
    if (!stats) {
        return [];
    }

    return [
        { color: [129, 0, 230], value: stats.avg - stats.stddev },
        { color: [179, 96, 209], value: stats.avg - stats.stddev / 2 },
        { color: [242, 207, 158], value: stats.avg },
        { color: [110, 184, 48], value: stats.avg + stats.stddev / 2 },
        { color: [43, 153, 0], value: stats.avg + stats.stddev }
    ];
}

export function buildCustomStops(stats = appState.stats){
    if (!stats) {
        return [];
    }

    const profile = classifyDistribution(stats);
    setProfile(profile);

    const stopPercentiles = profile.stopPercentiles || [0, 0.25, 0.5, 0.75, 1];

    const lowBound = appState.outliers.low === "Hidden" && Number.isFinite(stats.lowOutlierCutoff)
        ? Math.max(stats.min, stats.lowOutlierCutoff)
        : stats.min;
    const highBound = appState.outliers.high === "Hidden" && Number.isFinite(stats.highOutlierCutoff)
        ? Math.min(stats.max, stats.highOutlierCutoff)
        : stats.max;

    if (!Number.isFinite(lowBound) || !Number.isFinite(highBound) || highBound <= lowBound) {
        return buildDefaultStops(stats);
    }

    const rawValues = stopPercentiles.map(percentile => {
        const interpolated = interpolateFromQuantileSummary(stats, percentile);
        return Number.isFinite(interpolated) ? interpolated : stats.avg;
    });

    rawValues[0] = lowBound;
    rawValues[rawValues.length - 1] = highBound;
    const values = enforceIncreasing(rawValues, lowBound, highBound);

    appState.stats.distributionProfile = profile;
    console.log("Distribution profile selected:", profile.name, profile.rationale);

    return [
        { color: [129, 0, 230], value: values[0] },
        { color: [179, 96, 209], value: values[1] },
        { color: [242, 207, 158], value: values[2] },
        { color: [110, 184, 48], value: values[3] },
        { color: [43, 153, 0], value: values[4] }
    ];
}