// Role: update histogram
export function updateHistogram(){
    console.log('updating histogram stops to:', appState.colorStops);
    ui.histogramElement.colorStops = appState.colorStops; // pulling the histogram's stops from the state variable
}