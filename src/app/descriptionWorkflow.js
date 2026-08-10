import * as hf from "../helperFunctions";
import * as ui from "../modules/ui";
import { appState } from "../state/store";

// Role: compose and show narrative text
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

    // // OUTLIERS
    // if (math.abs(appState.stats.skewness) >  5) {
    //     if(appState.stats.highOutliers.length > 0 || appState.stats.lowOutliers.length > 0){ // for high skew we'll encourage the user to hide outliers
    //         descParts.push(`There are ${appState.stats.lowOutliers.length + appState.stats.highOutliers.length} outliers within the dataset, consider using the 'Filter Outliers' button to mask outliers from the map's symbology`);
    //     }
    // } 

    // PUTTING IT ALL TOGETHER    
    appState.description = descParts.join(" "); // assigning it to the state variable

}
export function renderDescription(){
    ui.description.textContent = appState.description || "";
}