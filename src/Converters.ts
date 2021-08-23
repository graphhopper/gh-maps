import { GeocodingHit } from '@/api/graphhopper'

import { Coordinate } from '@/stores/QueryStore'

export function milliSecondsToText(seconds: number) {
    const hours = Math.floor(seconds / 3600000)
    const minutes = Math.floor((seconds % 3600000) / 60000)

    const hourText = hours > 0 ? hours + ' h' : ''
    return hourText + ' ' + minutes + ' min'
}

const distanceFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })

export function metersToText(meters: number) {
    if (meters < 1000) return Math.floor(meters) + ' m'
    return distanceFormat.format(meters / 1000) + ' km'
}

export function convertToQueryText(hit: GeocodingHit) {
    let result = convertToName(hit)
    result += convertToStreet(hit, result.length > 0 ? ', ' : '')
    result += convertToCity(hit, result.length > 0 ? ', ' : '')
    result += convertToCountry(hit, result.length > 0 ? ', ' : '')
    return result
}

function convertToName(hit: GeocodingHit) {
    return hit.name === hit.street ? '' : hit.name
}

function convertToStreet(hit: GeocodingHit, prefix: string) {
    if (hit.housenumber && hit.street) return (prefix.length > 0 ? prefix : '') + hit.street + ' ' + hit.housenumber
    if (hit.street) return (prefix.length > 0 ? prefix : '') + hit.street
    return ''
}

function convertToCity(hit: GeocodingHit, prefix: string) {
    if (hit.city && hit.postcode) return (prefix.length > 0 ? prefix : '') + hit.postcode + ' ' + hit.city
    if (hit.city) return (prefix.length > 0 ? prefix : '') + hit.city
    if (hit.postcode) return (prefix.length > 0 ? prefix : '') + hit.postcode
    return ''
}

function convertToCountry(hit: GeocodingHit, prefix: string) {
    return hit.country ? (prefix.length > 0 ? prefix : '') + hit.country : ''
}

export function coordinateToText(coord: Coordinate): string {
    return Math.round(coord.lat * 1e6) / 1e6 + ',' + Math.round(coord.lng * 1e6) / 1e6
}
