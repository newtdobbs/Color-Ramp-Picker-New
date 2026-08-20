import * as hf from "../helperFunctions";
import * as ui from "../modules/ui";
import { appState } from "../state/store";
import { setDescription } from "../state/actions";

/**
 * Assembles components of description text by pulling from statistics stored in app state 
 */
export function buildAndStoreDescription(){

    const descParts = [];

    descParts.push(
        `${appState.field.alias} has a value range of ${hf.DecimalPrecision2.round(appState.stats.min, 2).toLocaleString()} to ${hf.DecimalPrecision2.round(appState.stats.max, 2).toLocaleString()}, with a mean of ${hf.DecimalPrecision2.round(appState.stats.avg, 2).toLocaleString()} and a median of ${hf.DecimalPrecision2.round(appState.stats.median, 2).toLocaleString()}. With a skewness of ${hf.DecimalPrecision2.round(appState.stats.skewness, 2).toLocaleString()}, the distribution shows`
    ); 

    // SKEW    
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

    // KURTOSIS
    descParts.push(`The data has a kurtosis of ${hf.DecimalPrecision2.round(appState.stats.kurtosis, 2).toLocaleString()}, indicating`);
    const kurtosisAbs = Math.abs(appState.stats.kurtosis);
    if (kurtosisAbs <= 1) {
        descParts.push("an approximately normal distribution.");
    } else {
        let severity = "";
        if (kurtosisAbs > 2) {
            severity = "substantially ";
        }
        const kurtosisDirection = appState.stats.kurtosis > 0 ? "leptokurtic (peaked)" : "platykurtic (flat)";
        descParts.push(`a ${severity}${kurtosisDirection} distribution.`);
    }
    
    descParts.push(appState.profile.rationale);
    console.log('app state profile', appState.profile)

    // OUTLIERS
    if (appState.stats.lowOutliers.length > 0 || appState.stats.highOutliers.length > 0) {
        descParts.push(`There are outliers in your dataset, consider restricting the slider values to`);
        if (appState.stats.lowOutliers.length > 0){
            descParts.push(`above ${appState.stats.lowOutlierCutoff}`);
        }
        if (appState.stats.highOutliers.length > 0){
            descParts.push(`below ${appState.stats.highOutlierCutoff}`);
        }
        descParts.push(".")
    }

    // PUTTING IT ALL TOGETHER    
    setDescription(descParts.join(" ")); // assigning it to the state variable
}

/**
 * Assigns the description currently in state to the ui description block
 */
export function renderDescription(){
    ui.description.textContent = appState.description || "";
}