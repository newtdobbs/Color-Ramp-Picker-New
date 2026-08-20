/**
 * 
 * @param {string} name descriptive name for the distribution
 * @param {array} stopPercentiles array of the color stops as they fall across the data's distribution
 * @param {string} rationale justification for the given profile 
 * @returns 
 */
function profile(name, stopPercentiles, rationale) {
    return {
        name,
        stopPercentiles,
        rationale
    };
}

/**
 * 
 * @param {dictionary} stats dictionary in app state of the data statistics 
 * @returns a profile matching the data's distribution
 */
export function classifyDistribution(stats) {
    if (!stats) {
        return profile("fallback", [0, 0.25, 0.5, 0.75, 1], "No stats available");
    }

    const skew = Number.isFinite(stats.skewness) ? stats.skewness : 0;
    const kurtosis = Number.isFinite(stats.kurtosis) ? stats.kurtosis : 0;
    const outlierRate = Number.isFinite(stats.outlierRate) ? stats.outlierRate : 0;
    const uniqueRatio = Number.isFinite(stats.uniqueRatio) ? stats.uniqueRatio : 1;

    const range = stats.max - stats.min;
    const q = stats.quantiles || {};
    const iqr = (q.p75 ?? stats.max) - (q.p25 ?? stats.min);
    const iqrShare = range > 0 ? iqr / range : 0.5;

    const symmetric = Math.abs(skew) < 0.35;
    const stronglyRightSkewed = skew >= 0.8;
    const stronglyLeftSkewed = skew <= -0.8;
    const mildlyRightSkewed = skew >= 0.35 && skew < 0.8;
    const mildlyLeftSkewed = skew <= -0.35 && skew > -0.8;
    const heavyTails = kurtosis > 1.2 || outlierRate > 0.03;
    const lightTails = kurtosis < -0.8 && outlierRate < 0.01;
    const nearUniform = Math.abs(skew) < 0.2 && iqrShare > 0.42 && iqrShare < 0.58;
    const discrete = Boolean(stats.isIntegerLike) && uniqueRatio < 0.25;

    if (discrete && stronglyRightSkewed) {
        return profile("discrete-right-skew", [0, 0.55, 0.78, 0.92, 1], "Discrete with strong right skew");
    }

    if (discrete && stronglyLeftSkewed) {
        return profile("discrete-left-skew", [0, 0.08, 0.22, 0.45, 1], "Discrete with strong left skew");
    }

    if (discrete && symmetric) {
        return profile("discrete-symmetric", [0, 0.2, 0.5, 0.8, 1], "Discrete and roughly symmetric");
    }

    if (stronglyRightSkewed && heavyTails) {
        return profile("right-heavy-tail", [0, 0.45, 0.7, 0.88, 1], "Strong right skew with heavy upper tail");
    }

    if (stronglyLeftSkewed && heavyTails) {
        return profile("left-heavy-tail", [0, 0.12, 0.3, 0.55, 1], "Strong left skew with heavy lower tail");
    }

    if (symmetric && heavyTails) {
        return profile("symmetric-heavy-tail", [0, 0.18, 0.5, 0.82, 1], "Symmetric with pronounced tails");
    }

    if (nearUniform || lightTails) {
        return profile("uniform-like", [0, 0.25, 0.5, 0.75, 1], "Near-uniform or light-tailed");
    }

    if (mildlyRightSkewed) {
        return profile("mild-right-skew", [0, 0.3, 0.52, 0.8, 1], "Mild right skew");
    }

    if (mildlyLeftSkewed) {
        return profile("mild-left-skew", [0, 0.2, 0.48, 0.7, 1], "Mild left skew");
    }

    return profile("normal-like", [0, 0.2, 0.5, 0.8, 1], "Approximately normal");
}