/* 
CONSTANTS
*/
const default_center = [-94.66, 39.04]; // Kansas City as map view as its ~roughly~ central in US
const default_scale = 35000000; // roughly the lower 48

// ideal field types, leaving all options in for un-ommenting
const goodFieldTypes = [
    "small-integer",
    "integer",
    "single",
    "double",
    "long",
    // "string",
    // "date",
    // "oid",
    // "geometry",
    // "blob",
    // "raster",
    // "guid",
    // "global-id",
    // "xml",
    "big-integer",
    // "date-only",
    // "time-only",
    // "timestamp-offset"
];
// ideal field value types, leaving all options in for un-ommenting
const goodFieldValueTypes = [
  // "binary",
  // "coordinate",
  "count-or-amount",
  "currency",
  // "date-and-time",
  // "description",
  // "email-address",
  // "location-or-place-name",
  // "measurement",
  // "name-or-title",
  // "none",
  // "ordered-or-ranked",
  "percentage-or-ratio",
  // "phone-number",
  // "type-or-category",
  // "unique-identifier"
];