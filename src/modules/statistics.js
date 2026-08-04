import * as math from "mathjs";
import incrkurtosis from "@stdlib/stats-incr-kurtosis";
import { queryFieldValues } from "./fields";

export function calculateKurtosis(){
    var accumulator = incrkurtosis();
        for (let i = 0; i < cleanValues.length; i++){ 
            accumulator(cleanValues[i]);
        }
    const kurtosis = accumulator();

    appState.stats.kurtosis = kurtosis;
}

export function calculateSkewness(){
        // Calculating skewness
        // third moment
        let summedDiffs = 0;
        cleanValues.forEach(v => {
            summedDiffs += Math.pow(v - appState.stats.avg, 3);
        });
        const thirdMoment = summedDiffs / n;

        // pop skew
        const populationSkew = thirdMoment / Math.pow(appState.stats.stddev, 3);

        // sample skew using bias correction
        const sampleSkew = populationSkew * Math.sqrt(n * (n - 1)) / (n - 2);

        appState.stats.skewness = sampleSkew;
}

export function calculateOutliers(){

    const sorted = cleanValues.slice().sort((a, b) => a - b); // pretty sure this is unnecessary as cleanValues is already sorted


    const q1 = sorted[Math.floor((sorted.length / 4))];
    console.log(`Q1 has been determined as ${q1}`)

    const q3 = sorted[Math.ceil((sorted.length * (3 / 4))) - 1];
    console.log(`Q3 has been determined as ${q3}`)

    const iqr = q3 - q1;

    const lowCutoff = math.max(q1 - 1.5 * iqr, 0); // clamping it at 0, as we can't have negatives
    const highCutoff = q3 + 1.5 * iqr;

    const lowOutliers = sorted.filter(v => v < lowCutoff);
    const highOutliers = sorted.filter(v => v > highCutoff);

    return [lowCutoff, highCutoff, lowOutliers, highOutliers]
    // appState.stats.lowCutoff = lowCutoff;
    // appState.stats.highCutoff = highCutoff;


    console.log(`Low outliers: ${appState.stats.lowOutliers.length}, high outliers: ${appState.stats.highOutliers.length}`)
}

export function calculateFieldStats(values){
    const cleanValues = values.filter(v => typeof v === "number" && !isNaN(v)).sort((a, b) => a - b); // filtering out NaN or non-numeric values (and sorting ascending)
    const n = cleanValues.length; // the new value count AFTER filters
    appState.stats = {
        count: n,
        min: math.min(cleanValues),
        max: math.max(cleanValues),
        avg: math.mean(cleanValues),
        median: math.median(cleanValues),
        stddev: math.std(cleanValues),
        lowCutoff: null,  
        highCutoff: null,  
        lowOutliers: [],
        highOutliers:[],
    }
}

function calculateStops(stats){

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

    appState.sliderValues = [
        appState.stats.avg - appState.stats.stddev, // slider value 1 is 1 sd below mean 
        appState.stats.avg - leftOffset, // slider value 2 is at the left offset below the mean
        appState.stats.avg, // slider value 3 is at the mean
        appState.stats.avg + rightOffset, // slider value 4 is aat the right offset above the mean
        appState.stats.avg + appState.stats.stddev // slider value 5 is 1 sd above mean 
    ]
}