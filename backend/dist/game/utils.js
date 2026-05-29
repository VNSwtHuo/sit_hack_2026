export function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
export function randomBetween(min, max) {
    return Math.floor(min + Math.random() * (max - min));
}
