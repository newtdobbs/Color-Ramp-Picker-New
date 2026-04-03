    function updateHistogram(){
        histogramElement.colorStops = [
            histogramElement.colorStops.forEach((stop, stopIndex) => {
            stop.value = sliderValues[stopIndex];
        })];




    }

    function updateRendererFromSlider(){
        const renderer = mapFeatureLayer.renderer.clone(); // cloning the renderer so we don't touch it
        const colorVariable = renderer.visualVariables[0].clone(); // cloning the visual variable of the renderer
        colorVariable.stops = sliderElement.values; // replacing the colorVarable's stops with the slider's current stops
        renderer.visualVariables = [colorVariable]; // reassinging the cloned variable to the newly-created renderer
        mapFeatureLayer.renderer = renderer; // assigning the updated renderer to the map

        // looping through the hist bars to update their cololrs
        histogramElement.bins.forEach((bar, binIndex) => {
            // have to access each bin directly from the histogram element
            const bin = histogramElement.bins[binIndex];
            if(bin){
                const midValue = (bin.maxValue - bin.minValue) / 2 + bin.minValue; // finding the midpoint value of the bin
                const barColor = getColorFromValue(sliderElement.values, midValue); 
                bar.setAttribute('fill', barColor.toHex()) // then assigning the bar's fil color to the newly-calculated color 
            }

        });

        // within this function, we need to call getColorFromValue on each bar


    }
    // infers the color for a given value based on the stops from a ColorVariable
    function getColorFromValue(stops, value) {
        console.log(`reassinging olor stops ${stops} to accomdate value ${value}`)
        let minStop = stops[0]; // first stop/thumb
        let maxStop = stops[stops.length - 1]; // last stop/thumn

        const minStopValue = minStop.value; // value at first stop/thumb
        const maxStopValue = maxStop.value; // value at last stop/thumb

        // this clamps the lower end of the color ramp, so values below the first stop always have the bottom color
        if (value < minStopValue) {
            return minStop.color;
        }
        
        // this clamps the upper end of the color ramp, so values above the last stop always have the top color
        if (value > maxStopValue) {
            return maxStop.color;
        }

        // return the exact color if a value matches a stop exactly
        const exactMatches = stops.filter((stop) => {
            return stop.value === value;
        });
        if (exactMatches.length > 0) {
            return exactMatches[0].color;
        }

        // otherwise we fine the braketing stops
        minStop = null;
        maxStop = null;
        stops.forEach((stop, i) => {
            if (!minStop && !maxStop && stop.value >= value) {
            minStop = stops[i - 1];
            maxStop = stop;
            }
        });

        // interpolate the color
        const weightedPosition = (value - minStop.value) / (maxStop.value - minStop.value);

        return Color.blendColors(minStop.color, maxStop.color, weightedPosition);
    }

    // function buildDescription(statsSummary){

//     return descrioptionForField;

// }

async function OldcreateHistogramForField(ramp){
    const colorSlider = document.createElement("arcgis-slider-color-legacy");
    colorSlider.componentOnReady();

    // listen to arcgisThumbChange and arcgisThumbDrag events
    // update the layer's renderer to match the slider's color stops
    colorSlider.addEventListener("arcgisThumbChange", updateRendererFromSlider);
    colorSlider.addEventListener("arcgisThumbDrag", updateRendererFromSlider);
    colorSlider.addEventListener("arcgisPropertyChange", updateRendererFromSlider);

    const matchingScheme = getSchemeByName({
        basemap: mapView.map.basemap,
        geometryType: mapFeatureLayer.geometryType,
        theme: "above-and-below",
        name: "Purple and Green 10"
    });


    const colorParams = {
        view: mapView,
        layer: mapFeatureLayer,
        field: selectedField.name,
        theme: "above-and-below",
        colorScheme: matchingScheme
    }

    const rendererResult = await colorRendererCreator.createContinuousRenderer(colorParams);

    // console.log("renderer result", rendererResult)

    // set the renderer to the layer and add it to the map
    mapFeatureLayer.renderer = rendererResult.renderer;
    mapFeatureLayer.visible = true;

    const histogramResult = await histogram({
        ...colorParams,
        numBins: Math.min(100,  statsSummary.length),
    });

    // create reference to histogram bar elements for updating
    // their style as the user drags slider thumbs
    
    const bars = [];
    const histogramConfig = {
        average: statsSummary.mean,
        barCreatedFunction: (index, element) => {
            const bin = histogramResult.bins[index];
            const midValue = (bin.maxValue - bin.minValue) / 2 + bin.minValue;
            const color = getColorFromValue(colorSlider.stops, midValue);
            element.setAttribute("fill", color.toHex());
            bars.push(element);
        },
        bins: histogramResult.bins,
        standardDeviation: statsSummary.std,
    };

    colorSlider.updateFromRendererResult(rendererResult, histogramResult);
    colorSlider.histogramConfig = histogramConfig;
    colorSlider.labelFormatFunction = (value) => {
        return DecimalPrecision2.round(value, 2).toLocaleString(); // labeling our histogram bars with 2 decimals
    };
    
    console.log("STOPS BEFORE REASSIGNEMENT")
    let print = ""
    colorSlider.stops.forEach((stop, index) => {
        print += `Stop: ${index}, Value: ${stop.value}, `;
    });
    console.log(print);


    // ARRAY WITHN ARRAY?
    colorSlider.stops = [
        { value: statsSummary.min, color: new Color([129, 0, 230]), handle: true}, // stop 1 should be PURPLE
        { value: statsSummary.mean - calculateIntermediateStop(statsSummary.kurtosis, 2, statsSummary.std), color: new Color([179, 96, 209]),  handle: true}, // stop 2 ; purpley
        { value: statsSummary.mean, color: new Color([242, 207, 158]), handle: true}, // stop 3 should be the mean, YELLOW; 
        { value: statsSummary.mean + calculateIntermediateStop(statsSummary.kurtosis, 2, statsSummary.std), color: new Color([110, 184, 48]), handle: true}, // stop 4; greenish
        { value: statsSummary.max, color: new Color([43, 153, 0]), handle: true} // stop 5 should GREEN 
    ];

    /* 
    NEED TO ADD SOME VERY VERBOSE LOGGING HERE TO MAKE SURE THE STOPS ARE BEING CORRECCTLY ASSIGNED    
    */

    console.log("STOPS AFTER REASSIGNEMENT")
    print = ""
    colorSlider.stops.forEach((stop, index) => {
        print += `Stop: ${index}, Value: ${stop.value}, `;
    });

    console.log(print)


    // update rendererFromSlider will be nested, specific to each new colorslider we create with variable scope
    function updateRendererFromSlider() {
        const renderer = mapFeatureLayer.renderer.clone(); // cloning the renderer so we don't touch it
        const colorVariable = renderer.visualVariables[0].clone(); // cloning the visual variable of the renderer
        colorVariable.stops = colorSlider.stops; // replacing the colorVarable's stops with the slider's current stops
        renderer.visualVariables = [colorVariable]; // reassinging the cloned variable to the newly-created renderer
        mapFeatureLayer.renderer = renderer; // assigning the updated renderer to the map

        bars.forEach((bar, index) => {
            const bin = colorSlider.histogramConfig.bins[index];
            if (bin) {
                const midValue = (bin.maxValue - bin.minValue) / 2 + bin.minValue;
                const color = getColorFromValue(colorSlider.stops, midValue);
                bar.setAttribute("fill", color.toHex());
            }
        });
    }
    // infers the color for a given value
    // based on the stops from a ColorVariable
    function getColorFromValue(stops, value) {
        let minStop = stops[0];
        let maxStop = stops[stops.length - 1];

        const minStopValue = minStop.value;
        const maxStopValue = maxStop.value;

        if (value < minStopValue) {
            return minStop.color;
        }

        if (value > maxStopValue) {
            return maxStop.color;
        }

        const exactMatches = stops.filter((stop) => {
            return stop.value === value;
        });

        if (exactMatches.length > 0) {
            return exactMatches[0].color;
        }

        minStop = null;
        maxStop = null;
        stops.forEach((stop, i) => {
            if (!minStop && !maxStop && stop.value >= value) {
            minStop = stops[i - 1];
            maxStop = stop;
            }
        });

        const weightedPosition = (value - minStop.value) / (maxStop.value - minStop.value);

        return Color.blendColors(minStop.color, maxStop.color, weightedPosition);
    }

    console.log('Color slider', colorSlider)
    return colorSlider;

}


/* 
LOGIC FOR RECOMMENDING A COLORRAMP
*/
// function recommendColorRamp(){

//     /* 
//     // theme matching rulset
//     left skewed: above (emphasize high values)
//     right skewed: below (emphasize low values)
//     high kurtosis: above-and-below (narrow central gap)
//     low kurtosis: extremes (wider central gap)
//     approximately normal: centered on?
//     */

//     let schemeTheme;
//     let flipRamp = false;

//     // we'll start with non-skewed, slightly skewed, or moderately skewed
//     if(statsSummary.skewDirection != "substantial") {
//         // for high kurtosis, we'll use above an below
//         if (statsSummary.kurtosisSeverity == "peaked") {
//             schemeTheme = "above-and-below"
//         // for very low kurtosis, we'll use extremes
//         } else if (statsSummary.kurtosisSeverity == "flat") {
//             schemeTheme = "extremes"
//         // for normal, we'll default to centered-on
//         } else

//         // 
//     } else { // if the distribution is highly skewed, we'll fall back to high-to-low
//         schemeTheme = "high-to-low"
//         // for right skew, we'll flip the ramp to emphasize low values
//         if (statsSummary.skewDirection == "positive"){
//             flipRamp = true;
//         }
//     }


//     // "high-to-low" | "above-and-below" | "centered-on" | "extremes" | "above" | "below"

//     if (!mapView || !mapView.map || !mapFeatureLayer) {
//         console.warn("MapView or FeatureLayer not ready");
//         return null;
//     }

//     const bm = mapView.map.basemap;

//     const themes = getThemes(mapView.map.basemap);
//     console.log("Theme recommendations:", themes);

//     const schemes = getSchemes({
//         basemap: mapView.map.basemap,
//         geometryType: mapFeatureLayer.geometryType,
//         theme: schemeTheme
//     });
//     console.log("Scheme recommendations:", schemes);

//     return colorRampRec;
// }

    /* 
    LOGIC FOR CALCULATING STATISTICS ON A GIVEN FIELD
*/
let statsSummary;
async function calculateFieldStats(layer, field) {

    // need to ensure this query returns more than 1000 values if applicable
    const query = layer.createQuery();
    query.where = "1=1";
    query.outFields = [field.name];
    query.returnGeometry = false;

    // here we query all the features for the selected field, filtering out null/undefined/NaN values
    const result = await layer.queryFeatures(query);
    const removeValues = [null, undefined, NaN]
    const values = result.features.map(f => f.attributes[field.name]).filter(Boolean); // the array of values in the selected field after filtering 
    fieldValues = values; // assigning the filtered values from the selected field to the fieldValues global object

    let desc = "";
    
    // can print values for debug
    console.log('number of values from field:', values.length);
    
    // error handling for sparse distributions, taken AFTER the validity filter
    if (values.length <= 10) {
        desc = `With only ${values.length} observtaions, for now we'll refrain from calculating statistics`
        return desc;
    }

    const fi_mean = DecimalPrecision2.round(math.mean(values), 2);
    const fi_median = DecimalPrecision2.round(math.median(values), 2);
    const fi_std = DecimalPrecision2.round(math.std(values), 2);
    const fi_min = DecimalPrecision2.round(math.min(values), 2);
    const fi_max = DecimalPrecision2.round(math.max(values), 2);
    const fi_skewness = DecimalPrecision2.round(3 * (math.mean(values) - math.median(values)) / math.std(values), 2);

    let fi_kurtosis;
    if (fi_std !== 0) {
        // excess kurtosis = average of the fourth standardized moment minus 3
        // a normal distribution  has a kurtosis of 3
        fi_kurtosis = DecimalPrecision2.round(math.mean(values.map(v => Math.pow((v - fi_mean) / fi_std, 4))) - 3, 2);
    } else {
        // if all values are identical it yields an undefined kurtosis, which we'll treat as null
        fi_kurtosis = null;
    }

    // first skew stength
    let skewSeverity;
    let skewDirection;
    // skew strength
    if(Math.abs(fi_skewness > 0.25)) {
        skewSeverity = "slight"

        if(Math.abs(fi_skewness > 0.5)) {
            skewSeverity = "moderate"

            if(Math.abs(fi_skewness > 1)) {
                skewSeverity = "substantial"
            }
        }
        // skew direction
        if(fi_skewness > 0) {
            skewDirection = "positive (right)" // AKA right skew
        }
        else {
            skewDirection = "negative (left)" // AKA left skew
        }  
    } else {
        skewSeverity = "none"
        skewDirection = "none"
    }

    // then kurtosis
    let kurtosisSeverity;
    if (fi_kurtosis > 2){
        kurtosisSeverity = "peaked"
        // clamping kurtosis at 2 for extremely high values
    } else if(fi_kurtosis < -2){
        kurtosisSeverity = "flat"
        // clamping kurtosis at -2 for extremely low values
        } else {
        kurtosisSeverity = "none"
    }

    // interpret modalityif possible
    // let modalityInterp;

    // assembling a dictionary of the statistics
    statsSummary = {
        'length' : values.length,
        'min' : fi_min,
        'max' : fi_max,
        'mean' : fi_mean,
        'median' : fi_median,
        'std' : fi_std,
        'skewness' : fi_skewness,
        'kurtosis' : fi_kurtosis,
        'skewSeverity' : skewSeverity,
        'skewDirection' : skewDirection,
        'kurtosisSeverity' : kurtosisSeverity
    }
    
    console.log('STATS SUMMARY', statsSummary);
    return statsSummary

}



// let promises = [];
    // let data = [];
    // const maxRecordCount = 1000; // in batches of 1000

    // // looping through the records in batches of maxRecordCount
    // for (var i = 0; i < numRecords; i += maxRecordCount) {
    //     let q = arcgisRest.queryFeatures({
    //         url: url,
    //         resultOffset: i,
    //         resultRecordCount: maxRecordCount
    //     });
    //     promises.push(q);
    // }
    // let dataArr = await Promise.all(promises);

    // for (const res of dataArr) {
    //     data = data.concat(res.features);
    // }
    // return data;

        // addding a popover
        // sliderElement.popoverPlacement = "start";
        // const popover = document.createElement('div');
        // popover.slot = "popover";
        // popover.textContent = ""; // defaulting to an empty popuover, will be updated with slider drag
        // sliderElement.poopoverLabel = "Color Slider RGB Value";
        // sliderElement.appendChild(popover);
    
    
        // think i dont need this popver text until I change it to just the color ramp percentage
        // function updatePopoverText(newIndex, val){
            
        //     let rampMin =  stats.min; // the min value of the color ramp
        //     let rampMax = stats.max; // the max value of the color ramp 
        //     // console.log(`Slider stretches from ${rampMin} to ${rampMax}`); // log for debug
    
        //     // first we'll need to calculate the color within our color ramp at val (changedSliderVal)
            
        //     // finding the stop below the color value
        //     let stops = histogramElement.colorStops;
            
        //     let lowerStop = stops[0];
        //     let upperStop = stops[stops.length - 1];
        //     for (let i = 0; i < stops.length - 1; i++){
        //         if(val >= stops[i].value && val <= stops[i + 1].value) {
        //             lowerStop = stops[i];
        //             upperStop = stops[i + 1];
        //             break;
        //         } 
        //     }
            
        //     // Calculate percent BETWEEN THE TWO STOPS
        //     let percent = (val - lowerStop.value) / (upperStop.value - lowerStop.value);
        //     console.log(`Slider ${newIndex} is now at ${percent * 100}% between stops ${lowerStop.color} and ${upperStop.color}`); // using the NEW index here to calculate color position
    
        //     // Interpolate RGB channels BETWEEN STOPS
        //     let resultRed   = Math.round(lowerStop.color[0] + percent * (upperStop.color[0] - lowerStop.color[0]));
        //     let resultGreen = Math.round(lowerStop.color[1] + percent * (upperStop.color[1] - lowerStop.color[1]));
        //     let resultBlue  = Math.round(lowerStop.color[2] + percent * (upperStop.color[2] - lowerStop.color[2]));
    
        //     popover.textContent = `rgb(${resultRed}, ${resultGreen}, ${resultBlue})`;
        // }
    
        
        // function for formatting labels (with color?)
        // sliderElement.labelFormatter = (value, type, defaultFormatter) => {
        //     if (type === "min") return `start: ${value}`;
        //     if (type === "max") return `end: ${value}`;
        //     return `val: ${value}<br>rgb(29,10,2947)`;
        // };


        

// this function will calculate the slider number for intermediate stops (stops 2 and 4)
function calculateIntermediateStop(kurtosisValue, kurtosisCap, sd){

    // for kurtosis of 0 (normal distribution), we'll default to the halfway point between mean and the standard deviation
    if (kurtosisValue === 0){
        return sd / 2
    } else {

        // we'll clamp our kurtosis between -1.9 and 1.9
        kurtosisValue = clamp(kurtosisValue, -1.9, 1.9)
        
        // formula = actual kurtosis / kurtosis cap * standard deviation
        return (kurtosisValue / kurtosisCap) * sd
    }

}

// old code used to update after a button was clicked

 // // if a button was clicked, we need to loop through the stops and find the surrounding color stops
            // let stops = appState.colorStops;
            // let lowerStop = stops[0];
            // let upperStop = stops[stops.length - 1];
            // for (let j = 0; j < stops.length - 1; j++){
            //     if(buttonValue >= stops[j].value && buttonValue <= stops[j + 1].value) {
            //         lowerStop = stops[j];
            //         upperStop = stops[j + 1];
            //         break;
            //     } 
            // }
                        
            // // Midpoint value between the two stops
            // let midpoint = ((upperStop.value - lowerStop.value) / 2) + lowerStop.value;

            // // Fraction between lower and upper stops
            // let fraction = (midpoint - lowerStop.value) / (upperStop.value - lowerStop.value);

            // // Interpolate RGB channels
            // let resultRed   = Math.round(lowerStop.color[0] + fraction * (upperStop.color[0] - lowerStop.color[0]));
            // let resultGreen = Math.round(lowerStop.color[1] + fraction * (upperStop.color[1] - lowerStop.color[1]));
            // let resultBlue  = Math.round(lowerStop.color[2] + fraction * (upperStop.color[2] - lowerStop.color[2]));

            // console.log(`Adding stop at value ${midpoint} with color rgb(${resultRed},${resultGreen},${resultBlue})`);

            // // addding the new stop to our histogram element
            // histogramElement.colorStops.push({
            //     color: [resultRed, resultGreen, resultBlue],
            //     value: midpoint
            // });
            // histogramElement.colorStops.sort((a, b) => a.value - b.value); // and resorting the stops by value

            // appState.colorStops = histogramElement.colorStops; // update state

            
// FUNCTION FOR DETECTING SLIDER CHANGE (AGNOSTIC TO NUMBER OF SLIDERS)
function determineSliderChanges(oldValues, newValues) {
    // lengths must be equal for a valid index-by-index comparison
    if (oldValues.length !== newValues.length) {
        console.error("Arrays must have the same length for index-by-index comparison.");
        return [];
    }

    // filter the old array to find the value NOT present in the new array
    const oldSliderValue = oldValues.filter(val => !newValues.includes(val))[0];
    // console.log(`Missing value ${oldSliderValue}`); // log for debug

    // find the index in the old array of that missing value 
    // console.log(`old values: ${oldValues}`); // log for debug
    const oldSliderIndex = oldValues.indexOf(oldSliderValue);
    
    // determining the new value 
    const newSliderValue = newValues.filter(val => !oldValues.includes(val))[0]; // index 0 as only one should change at a time
    const newSliderIndex = newValues.indexOf(newSliderValue);
    // console.log(`Slider ${oldSliderIndex} changed to new value: ${newSliderValue}`); // log for debug

    return [oldSliderIndex, oldSliderValue, newSliderIndex, newSliderValue];

}

// newDiff = cleanValues[i] - cleanValues[i-1]; // slope between the current and previous value
// if (newDiff > 0 && prevDiff < 0){ // slope goes from negative to positive, MINIMA
//     inflectionPoints["minima"].push(cleanValues[i]) // adding current value to minima array
// }
// if (newDiff < 0 && prevDiff > 0){ // slope goes from positive to negative, MAXIMA
//     inflectionPoints["maxima"].push(cleanValues[i]) // adding current value to maxima array
// }
// if (newDiff != 0) { // so long as the new difference is non-zero
//     prevDiff = newDiff; // we'll use it to update the previous diff
// }

        // filtering outliers
        

        // let q1, q3, iqr,  maxNonOutlierValue, minNonOutlierValue, lowOutliers, highOutliers;

        // values = cleanValues.slice().sort( (a, b) => a - b);//copy array fast and sort

        // if((n / 4) % 1 === 0){//find quartiles
        //     q1 = 1/2 * (values[(n / 4)] + values[(n / 4) + 1]);
        //     q3 = 1/2 * (values[(n * (3 / 4))] + values[(n * (3 / 4)) + 1]);
        // } else {
        //     q1 = values[Math.floor(n / 4 + 1)];
        //     q3 = values[Math.ceil(n * (3 / 4) + 1)];
        // }

        // iqr = q3 - q1;
        // maxValue = q3 + iqr * 1.5;
        // minValue = q1 - iqr * 1.5;
