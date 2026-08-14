import { appState } from "../state/store";

export function calculateOutliers(vals) {
    if (!Array.isArray(vals) || !vals.length) {
        return null;
    }

    const sorted = vals.slice().sort((a, b) => a - b);

    const q1 = sorted[Math.floor((sorted.length / 4))];
    // console.log(`Q1 has been determined as ${q1}`)

    const q3 = sorted[Math.ceil((sorted.length * (3 / 4))) - 1];
    // console.log(`Q3 has been determined as ${q3}`)

    const iqr = q3 - q1;

        // if the dataset doesn't go below zero, we'll clamp the low cutoff at 0
    const lowCutoff = appState.stats.min < 0  ? q1 - 1.5 * iqr : math.max(q1 - 1.5 * iqr, 0); 
    const highCutoff = q3 + 1.5 * iqr;

    const lowOutliers = sorted.filter(v => v < lowCutoff);
    if (lowOutliers.length > 0) { 
        console.log("Low outliers:", lowOutliers)
        lowOutliersChip.disabled = false; 
    }
    const highOutliers = sorted.filter(v => v > highCutoff);
    if (highOutliers.length > 0) { 
        console.log("High outliers:", highOutliers)
        highOutliersChip.disabled = false;
    }

    console.log(`Low outlier cutoff: ${lowCutoff}, high outlier cutoff: ${highCutoff}`)
    return [lowCutoff, highCutoff]


    console.log(`Low outliers: ${appState.stats.lowOutliers.length}, high outliers: ${appState.stats.highOutliers.length}`)
}