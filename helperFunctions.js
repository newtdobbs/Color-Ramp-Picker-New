/* 
THIS SCRIPT IS RESERVED FOR NON-ARCGIS RELATED HELPER FUNCTIONS THAT WILL PROBABLY BE USED OFTEN
*/

// ROUNDING A NUMBER TO 2 DECIMAL PLACES BECAUSE apparently its impossible in javascript
var DecimalPrecision2 = (function() {
    if (Number.EPSILON === undefined) {
        Number.EPSILON = Math.pow(2, -52);
    }
    if (Math.sign === undefined) {
        Math.sign = function(x) {
            return ((x > 0) - (x < 0)) || +x;
        };
    }
    return {
        // Decimal round (half away from zero)
        round: function(num, decimalPlaces) {
            var p = Math.pow(10, decimalPlaces || 0);
            var n = (num * p) * (1 + Number.EPSILON);
            return Math.round(n) / p;
        },
        // Decimal ceil
        ceil: function(num, decimalPlaces) {
            var p = Math.pow(10, decimalPlaces || 0);
            var n = (num * p) * (1 - Math.sign(num) * Number.EPSILON);
            return Math.ceil(n) / p;
        },
        // Decimal floor
        floor: function(num, decimalPlaces) {
            var p = Math.pow(10, decimalPlaces || 0);
            var n = (num * p) * (1 + Math.sign(num) * Number.EPSILON);
            return Math.floor(n) / p;
        },
        // Decimal trunc
        trunc: function(num, decimalPlaces) {
            return (num < 0 ? this.ceil : this.floor)(num, decimalPlaces);
        },
        // Format using fixed-point notation
        toFixed: function(num, decimalPlaces) {
            return this.round(num, decimalPlaces).toFixed(decimalPlaces);
        }
    };
})();


//  CLAMPING VALUES BETWEEN A MIN AND MAX RANGE
export function clamp (val, min, max) {
    return Math.min(Math.max(val, min), max)
}


// FUNCTION FOR DIPLAYING A CALCITE WARNING MESSAGE
export function warnUser(message){
  // clear any existing warnings
  const existingAlert = document.querySelector("calcite-alert")
  if(existingAlert) existingAlert.remove(); // clearing any preexisting alerts

  // displaying an alert, warning the user to turn on the overlay when taking screensbot 
  const newAlert = document.createElement("calcite-alert");
  newAlert.open = true;
  newAlert.kind = "warning";
  newAlert.autoDismiss = true;
  const title = document.createElement("calcite-alert-message");
  title.textContent = message;
  title.slot = "title";
  newAlert.appendChild(title);

  // appending the warning to the DOM
  document.body.appendChild(newAlert);
}

