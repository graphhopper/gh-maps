import { GeocodingHit } from '@/api/graphhopper'

import { Coordinate } from '@/stores/QueryStore'

export function milliSecondsToText(ms: number) {
    const hours = Math.floor(ms / 3600000)
    const minutes = Math.round((ms % 3600000) / 60000)

    if (minutes == 60) return hours + 1 + ' h'
    const hourText = hours > 0 ? hours + ' h' : ''
    if (minutes == 0 && hourText.length > 0) return hourText
    return (hourText ? hourText + ' ' : '') + minutes + ' min'
}

let distanceFormat: Intl.NumberFormat = new Intl.NumberFormat('en', { maximumFractionDigits: 1 })
let distanceFormat2 = new Intl.NumberFormat('en', { maximumFractionDigits: 2 })

export function initDistanceFormat(lang: string) {
    distanceFormat = new Intl.NumberFormat(lang, { maximumFractionDigits: 1 })
    distanceFormat2 = new Intl.NumberFormat(lang, { maximumFractionDigits: 2 })
}

export function kmToMPHIfMiles(value: number, showDistanceInMiles: boolean, roundTo10 = false) {
    return showDistanceInMiles
        ? roundTo10
            ? Math.round(value / 1.60934 / 10.0) * 10
            : Math.round(value / 1.60934)
        : Math.round(value)
}

export function meterToFt(value: number) {
    return value / 0.3048
}

export function meterToMiles(value: number) {
    return value / 1609.34
}

export function metersToText(meters: number, showDistanceInMiles: boolean, forceSmallUnits: boolean = false) {
    if (showDistanceInMiles) {
        if (meters < 160.934 || forceSmallUnits) return Math.floor(meters / 0.3048) + ' ft'
        if (meters < 600) return distanceFormat2.format(meters / 1609.34) + ' mi'
        return distanceFormat.format(meters / 1609.34) + ' mi'
    } else {
        if (meters < 1000 || forceSmallUnits) return Math.floor(meters) + ' m'
        return distanceFormat.format(meters / 1000) + ' km'
    }
}

// text does not contain decimal numbers or space
export function metersToTextForFile(meters: number, showDistanceInMiles: boolean) {
    if (showDistanceInMiles) {
        if (meters < 1609.34) return Math.floor(meters / 0.3048) + 'ft'
        return Math.round(meters / 1609.34) + 'mi'
    } else {
        if (meters < 1000) return Math.floor(meters) + 'm'
        return Math.round(meters / 1000) + 'km'
    }
}

// create fewer characters e.g. less precision for bigger values (>100km / 100mi) and use mi instead of ft already for >0.1mi
export function metersToShortText(meters: number, showDistanceInMiles: boolean) {
    if (showDistanceInMiles) {
        if (meters < 160.934) return Math.floor(meters / 0.3048) + 'ft' // e.g. 0.2mi is better than 1056ft
        if (meters < 160934) return distanceFormat.format(meters / 1609.34) + 'mi'
        return Math.round(meters / 1609.34) + 'mi'
    } else {
        if (meters < 1_000) return Math.floor(meters) + 'm'
        if (meters < 100_000) return distanceFormat.format(meters / 1000) + 'km'
        return Math.round(meters / 1000) + 'km'
    }
}

export function hitToItem(hit: GeocodingHit) {
    const mainText =
        hit.street && hit.name.indexOf(hit.street) >= 0
            ? hit.street + (hit.housenumber ? ' ' + hit.housenumber : '')
            : hit.name
    return {
        mainText: mainText,
        secondText: toSecondText(hit, mainText),
    }
}

function toSecondText(hit: GeocodingHit, mainText: string) {
    let result =
        hit.street && mainText.indexOf(hit.street) < 0
            ? hit.street + (hit.housenumber ? ' ' + hit.housenumber : '') + ', '
            : ''
    result += toCity(hit)
    if (hit.state && !result.includes(hit.state)) result += (result ? ', ' : '') + hit.state
    if (hit.country) result += (result ? ', ' : '') + hit.country
    return result
}

function toCity(hit: GeocodingHit) {
    if (hit.city && hit.postcode) return hit.postcode + ' ' + hit.city
    if (hit.city) return hit.city
    if (hit.postcode) return hit.postcode
    return ''
}

export function nominatimHitToItem(hit: GeocodingHit) {
    const name = hit.name ? hit.name : hit.country
    const street = hit.street ? hit.street + (hit.housenumber ? ' ' + hit.housenumber : '') : ''
    const mainText = hit.street && name.indexOf(hit.street) == 0 ? street : name.split(',')[0]
    return {
        mainText: mainText,
        secondText:
            (!mainText.includes(street) && street.length > 0 ? street + ', ' : '') +
            (!mainText.includes(hit.postcode) && hit.postcode ? hit.postcode + ' ' : '') +
            (!mainText.includes(hit.city) && hit.city ? hit.city + ', ' : '') +
            (!mainText.includes(hit.state) && hit.state ? hit.state + ', ' : '') +
            hit.country,
    }
}

export function coordinateToText(coord: Coordinate): string {
    return Math.round(coord.lat * 1e6) / 1e6 + ',' + Math.round(coord.lng * 1e6) / 1e6
}

export function textToCoordinate(text: string): Coordinate | null {
    // this splits the string at ',' or ' '. The filter filters out empty results
    // in case something like 1.0, 2.0 was supplied.
    const split = text.split(/[,| s]/).filter(s => s)

    if (split.length !== 2) return null

    const result = {
        lat: Number.parseFloat(split[0]),
        lng: Number.parseFloat(split[1]),
    }

    return isNaN(result.lng) || isNaN(result.lat) ? null : result
}
