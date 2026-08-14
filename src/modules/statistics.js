import * as math from "mathjs";
import incrkurtosis from "@stdlib/stats-incr-kurtosis";
import { appState } from "../state/store";
import { lowOutliersChip, highOutliersChip } from "./ui";
import { setOutliersMode } from "../state/actions";
import { updateRampUI } from "../app/rampWorkflow";


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

export function calculateOutliers(vals) {
    if (!Array.isArray(vals) || !vals.length) {
        return null;
    }

    // const sorted = vals.slice().sort((a, b) => a - b);


    const q1 = vals[Math.floor((vals.length / 4))];
    // console.log(`Q1 has been determined as ${q1}`)

    const q3 = vals[Math.ceil((vals.length * (3 / 4))) - 1];
    // console.log(`Q3 has been determined as ${q3}`)

    const iqr = q3 - q1;

        // if the dataset doesn't go below zero, we'll clamp the low cutoff at 0
    const lowCutoff = vals[0] < 0  ? q1- 1.5 * iqr : math.max(q1 - 1.5 * iqr, 0); 
    const highCutoff = q3 + 1.5 * iqr;

    const lowOutliers = vals.filter(v => v < lowCutoff);
    if (lowOutliers.length > 0) { 
        console.log("Low outliers:", lowOutliers)
        lowOutliersChip.disabled = false; 
    }
    const highOutliers = vals.filter(v => v > highCutoff);
    if (highOutliers.length > 0) { 
        console.log("High outliers:", highOutliers)
        highOutliersChip.disabled = false;
    }

    console.log(`Low outlier cutoff: ${lowCutoff}, high outlier cutoff: ${highCutoff}`)
    return [lowCutoff, lowOutliers, highCutoff, highOutliers]


    console.log(`Low outliers: ${appState.stats.lowOutliers.length}, high outliers: ${appState.stats.highOutliers.length}`)
}


export function wireOutlierChipClick(){
    const logSelection = (chip, chipName) => {
        queueMicrotask(() => {
            setOutliersMode(chipName, chip.selected);
            const cutoff = appState.stats[`${chipName}OutlierCutoff`]
            if (!chip.selected){
                console.log(`Need to hide ${chipName} outliers with cutoff: ${cutoff}`)
            } else {
                console.log(`Need to show ${chipName} outliers`)
            }
            // recalculateStats(); // need to first recalculate stats
            // updateRampUI(); // then update the symbology to reflect
        });
    };

    lowOutliersChip.addEventListener("calciteChipSelect", () => {
        logSelection(lowOutliersChip, "low");
    });
    
    highOutliersChip.addEventListener("calciteChipSelect", () => {
        logSelection(highOutliersChip, "high");
    });
}

export function calculateFieldStats(values) {
    if (!Array.isArray(values)) {
        return null;
    }

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
    
    const [lowOutlierCutoff, lowOutliers, highOutlierCutoff, highOutliers] = calculateOutliers(cleanValues); // calculating outlier values

    return {
        count,
        min: cleanValues[0],
        max: cleanValues[cleanValues.length - 1],
        avg,
        median,
        stddev,
        lowOutlierCutoff,
        lowOutliers, 
        highOutlierCutoff, 
        highOutliers, 
        skewness: calculateSkewness(cleanValues, count, avg, stddev),
        kurtosis: calculateKurtosis(cleanValues)
    };
}

export function buildDefaultStops(){
    if (!appState.stats) {
        return [];
    }

    return [
        { color: [129, 0, 230], value: appState.stats.avg - appState.stats.stddev },
        { color: [179, 96, 209], value: appState.stats.avg - appState.stats.stddev / 2 },
        { color: [242, 207, 158], value: appState.stats.avg },
        { color: [110, 184, 48], value: appState.stats.avg + appState.stats.stddev / 2 },
        { color: [43, 153, 0], value: appState.stats.avg + appState.stats.stddev }
    ];
}

export function buildCustomStops(stats){

    // we're gonna clamp the kurtosis to prevent wild scaling
    const k = Math.max(-5, Math.min(5, appState.stats.kurtosis));
    // console.log(`kurtosis ${appState.stats.kurtosis} has been clamped to ${k}.`)
    const kScale =  1 / (1 + 0.3 * k); 
    // console.log(`kurtosis scaling factor has been determined as ${kScale}.`)

    // we're also gonna clamp skew to prevent wild scaling
    const s = Math.max(-5, Math.min(5, appState.stats.skewness));
    // console.log(`skewness ${appState.stats.skewness} has been clamped to ${s}.`)
    const leftSkewFactor = 1 - (0.2 * s);
    const rightSkewFactor = 1 + (0.2 * s);

    const leftOffset = appState.stats.stddev * kScale * leftSkewFactor
    const rightOffset = appState.stats.stddev * kScale * rightSkewFactor
    console.log(`Offsets determined as: L(${leftOffset}), R(${rightOffset})`)

    return [
        { color: [129, 0, 230], value: appState.stats.avg - appState.stats.stddev}, // slider value 1 is 1 sd below mean 
        { color: [179, 96, 209], value: appState.stats.avg - leftOffset}, // slider value 2 is at the left offset below the mean
        { color: [242, 207, 158], value: appState.stats.avg }, // slider value 3 is at the mean
        { color: [110, 184, 48], value: appState.stats.avg + rightOffset}, // slider value 4 is aat the right offset above the mean
        { color: [43, 153, 0], value: appState.stats.avg + appState.stats.stddev} // slider value 5 is 1 sd above mean 
    ]
}