import * as math from "mathjs";


const summaryStatistics = await $arcgis.import("@arcgis/core/smartMapping/statistics/summaryStatistics.js");
import incrkurtosis from "@stdlib/stats-incr-kurtosis";
const StatisticDefinition = await $arcgis.import("@arcgis/core/rest/support/StatisticDefinition.js");