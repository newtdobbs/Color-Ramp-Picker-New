import incrkurtosis from "@stdlib/stats-incr-kurtosis";
import { appState } from "../state/store";
import { lowOutliersChip, highOutliersChip } from "./ui";
import { setOutliersMode } from "../state/actions";
import { classifyDistribution } from "../app/ruleset";
import { setProfile } from "../state/actions";

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
            setOutliersMode(chipName, chip.selected);
            const cutoff = appState.stats[`${chipName}OutlierCutoff`]
            
            // HIDING STOPS
            if (!chip.selected){ // if its unselected, we want to hide outliers, injecting black into ends
                console.log(`Need to hide ${chipName} outliers with cutoff: ${cutoff}`)
                // HIDING LOW STOPS
                if (chipName="low"){
                    // if the first stop goes below the low outlier cutoff, we bring it to the cuttof
                    if(appState.colorStops[0].value < appState.stats.lowOutlierCutoff){
                    

                    // otherwise we'll add a stop at the low cutoff of pure black
                    

                // HIDING HIGH STOPS
                } else {

                }
                
                
                // injecting black into low outliers first
                    // change the value to appState.stats.lowOutlierCutoff
                    // change the color to black
                    //
                } else {
                    // if the 
                }
                // then injecting black high outliers
            
            // SHOWING STOPS
            } else { // if it is selected, we want to show outliers, restoring color to ends
                console.log(`Need to show ${chipName} outliers`)
                // showing low outliers 
                // 
            }
            // recalculateStats(); // need to first recalculate stats
            // updateRampUI(); // then update the symbology to reflect
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