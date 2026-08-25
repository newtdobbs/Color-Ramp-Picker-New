function getBinCenter(){

}
export function estimateRange(values){
    const lerp = (start, end, t) => start + (end - start) * t;
    const Vmin = math.min(values);
    const Vmax = math.max(values);
    const sample_count = values.length;
    const lowerLimit = sample_count * 0.1;
    const higherLimit = sample_count * 0.9;
    let binCenterValues = []
    let histogramSums = []
    let i1;
    let i2;
    let a1;
    let a2;
    for(let i = 0; i < sample_count - 1; i++){
        // FIRST THE BIN CENTER VALUES
        binCenterValues[i] = ((values[i] + 0.5) * (Vmax - Vmin) / sample_count) 

        // THEN THE CUMULATIVE HISTOGRAM
        histogramSums[i] = i === 0 ? 0 : histogramSums[i-1]; // with a guard for the first index
        if(histogramSums[i] > low){i1 = i} // index where cumulative sum surpasses lower limit
        if(histogramSums[i] > high){i2 = i} // index where cumulative sum surpasess upper limit  
    };

    // REFINING OUR RANGE MIN-MAX USING LINEAR INTERPOLATION
    a1 = lerp(0, 1, ( lowerLimit - sum(i1-1) ) / ( sum( i1 )- sum(i1-1 )));
    a2 = lerp(0, 1, ( higherLimit - sum(i2-1) ) / ( sum( i2 )- sum(i2-1 ) ));
    const range_min = (1.0 - a1) * values[i1-1] + a1 * values[i1]

    range_min = (1.0- a1 ) * values[ i1-1 ] + a1 * values[i1];
    range_max = (1.0- a2 ) * values[ i2-1 ] + a2 * values[i2];

}