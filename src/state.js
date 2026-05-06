/* 
GLOBAL APP STATE
This should hold info about the map, the chosen feature layer, the selected field, the histogram, etc
*/
export const appState = {
    activeWidget: "layers", // initializing active widget to layers so that its open on page load
    map: null, // the map within the main map div
    view: null, // the view associated with the map
    inputItemID: null, // the item ID parsed from the user's input
    serviceInfo: null, // the service information gathered from the item ID 
    layerSelection: null, // the selected layer from the dropdown menu
    layer: null, // the feature layer created from the dropdown's selected layer
    field: null, // the selected field from the layer
    stats: null, // the statistics for the data distibution of the selected field
    description: null, // the description to populate the dialog 
    sliderValues: null, // the values currently stored in the slider element
    colorStops: null, // the color stops (color and value) currently stored in the slider elemnt
    buttons: [], // the buttons for adding stops
    defaultItemID: "c9faa265b82848498bc0a8390c0afa65",
    fieldsList: null, // the full fields list for the service
    sliderActive: false,
    switchValue: "static", // we defualt to static changes
    defaultValues: null, // this should only ever be assigned upon field initialization
    defaultStops: null, // this should only ever be assigned upon field initialization
    lastCustomValues: null,
    lastCustomStops: null,
    offsetBase: null,
    symbologyMode: "Custom", // we use CUSTOM stops on first load, so we give user option to show SM defaults
    outliersVisibility: "Hide Outliers", // we default to showing the outliers, giving the user the option to hide them
    inflectionPoints: null, // an array to store inflection values for the current field's distribution
}