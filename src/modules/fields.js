import { queryAllFeatures } from '@esri/arcgis-rest-feature-service';
const Query = await $arcgis.import("@arcgis/core/rest/support/Query.js");

/* 
LOGIC FOR CREATING THE LIST OF FIELDS
*/
export function generateFieldsList() {
    fieldsLabel.textContent = "Select a Field";
    
    const fieldsList = document.createElement("calcite-list");
    fieldsList.innerHTML = ""; // removing any preexisting fields
    fieldsList.label = "Select a field";
    fieldsList.selectionMode = "single"; 
    fieldsLabel.appendChild(fieldsList);

    // Can log all the fields here for debug
    // console.log("All fields:");
    // appState.layer.fields.forEach(field => {
    //     console.log(`Field: ${field.name}, type: ${field.type}, valueType: ${field.valueType}`);
    // });

    appState.layer.fields.forEach(field => {
        if (goodFieldTypes.includes(field.type) && goodFieldValueTypes.includes(field.valueType)) {
            const listItem = document.createElement("calcite-list-item");
            listItem.label = field.alias;
            listItem.scale = "s";
            listItem.value = field.name;
            listItem.closable = true;

            fieldsList.appendChild(listItem);

            listItem.addEventListener("calciteListItemSelect", async () => {
                appState.field = appState.field === field ? null : field; // this will allow users to deselect a field without having to remove it from the list

                console.log(`Selected field '${appState.field.alias}' information: ${appState.field}`)
                // seleecting a field will remove any previous warnings
                if(document.querySelector("calcite-alert")){
                    document.querySelector("calcite-alert").remove();
                }
            });

            listItem.addEventListener("calciteListItemClose", async () => {
                hf.warnUser('Removing field: ', field.alias);
                // console.log('removing field: ', field.alias); // log for debug
                if (appState.field.alias === field.alias){
                    appState.field = null; // if the user removes the currently selected field, we'll clear the state variable
                    // warnUser('Select a field from the fields list')
                }
                listItem.remove(); // removing the list item from the dom
            });
        }
    });

    appState.fieldsList = fieldsList; // adding the fields list to the global state
}

export async function getAllFeatures() {
    try {
        
        const t0 = performance.now(); // log for debug
        const results = await queryAllFeatures({
            url: appState.layer.parsedUrl.path,
            outFields: appState.field.name,
            returnGeometry: false,
        });
        const t1 = performance.now(); // log for debug
        console.log(`Querying all records records took ${Math.floor(t1 - t0)} milliseconds:`, results); // log for debug
        const values = results.features.map(f => f.attributes[appState.field.name]); // this is what actually gets the data value in the selected field for each feature 
        return values
        
    } catch (err) {
        hf.warnUser(`Error querying all features for field:`, );
        console.error('err', err);
        return null;
    }
}

// FUNCTION FOR QUERYING ALL DATA FROM A FIELD
export async function calculateStatsForField(){
        const cleanValues = values.filter(v => typeof v === "number" && !isNaN(v)).sort((a, b) => a - b); // filtering out NaN or non-numeric values (and sorting ascending)
        const n = cleanValues.length; // the new value count AFTER filters

        // Assembling the stats dictionary
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

        console.log('appState.stats is currently', appState.stats); // log for debug

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

        var accumulator = incrkurtosis();
        for (let i = 0; i < cleanValues.length; i++){ 
            accumulator(cleanValues[i]);
        }
        const kurtosis = accumulator();
        console.log(`Skew ${sampleSkew} and kurtosis ${kurtosis} off the press`) // log for debug
   
        // then adding these values to the global app state
        appState.stats.skewness = sampleSkew;
        appState.stats.kurtosis = kurtosis;

        const sorted = cleanValues.slice().sort((a, b) => a - b);
        const q1 = sorted[Math.floor((sorted.length / 4))];
        console.log(`Q1 has been determined as ${q1}`)
    
        const q3 = sorted[Math.ceil((sorted.length * (3 / 4))) - 1];
        console.log(`Q3 has been determined as ${q3}`)
    
        const iqr = q3 - q1;

        const lowCutoff = math.max(q1 - 1.5 * iqr, 0); // clamping it at 0, as we can't have negatives
        const highCutoff = q3 + 1.5 * iqr;
        appState.stats.lowCutoff = lowCutoff;
        appState.stats.highCutoff = highCutoff;

        appState.stats.lowOutliers = sorted.filter(v => v < lowCutoff);
        appState.stats.highOutliers = sorted.filter(v => v > highCutoff);

        console.log(`Low outliers: ${appState.stats.lowOutliers.length}, high outliers: ${appState.stats.highOutliers.length}`)

        // if(Math.abs(appState.stats.skewness) > 5){
        //     createOutliersButton()
        // }

        console.log('App stats is', appState.stats) // log for debug

}
