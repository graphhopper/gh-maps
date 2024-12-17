import { Instruction, Path } from '@/api/graphhopper'
import { Coordinate } from '@/stores/QueryStore'

export function getCurrentDetails(path: Path, pillarPoint: Coordinate, details: [any, any, any][][]): any[] {
    const points = path.points.coordinates
    let foundIndex = -1

    for (let pIdx = 0; pIdx < points.length; pIdx++) {
        const p: number[] = points[pIdx]
        if (pillarPoint.lat == p[1] && pillarPoint.lng == p[0]) {
            foundIndex = pIdx
            break
        }
    }
    if (foundIndex < 0) return []

    let result = []
    for (let i = 0; i < details.length; i++) {
        let detailOnPath = details[i]
        if (!detailOnPath) {
            console.log('cannot find path detail ' + i)
            continue
        }
        for (let d = 0; d < detailOnPath.length; d++) {
            let [from, to, val] = detailOnPath[d]
            if ((foundIndex >= from && foundIndex < to) || (foundIndex == to && d + 1 == detailOnPath.length)) {
                result.push(val)
                break
            }
        }
    }

    return result
}

export function getCurrentInstruction(
    instructions: Instruction[],
    location: Coordinate,
    heading: undefined | number
): {
    index: number
    timeToTurn: number
    distanceToTurn: number
    distanceToRoute: number
    pillarPointOnRoute: Coordinate
    timeToEnd: number
    distanceToEnd: number
    distanceToWaypoint: number
    nextWaypointIndex: number
} {
    let waypointIndex = 0
    const result = new InstructionResult()
    const resultWithHeadingFilter = new InstructionResult()

    for (let instrIdx = 0; instrIdx < instructions.length; instrIdx++) {
        const sign = instructions[instrIdx].sign
        if (sign === 4 || sign === 5) waypointIndex++
        const points: number[][] = instructions[instrIdx].points

        for (let pIdx = 0; pIdx < points.length; pIdx++) {
            const p: number[] = points[pIdx]
            let snapped = { lat: p[1], lng: p[0] }
            const last: number[] = points[points.length - 1]
            let dist = calcDist(snapped, location)
            let headingMatches = false
            // calculate the snapped point
            // TODO use first point of next instruction for "next" if last point of current instruction
            if (pIdx + 1 < points.length) {
                const next: number[] = points[pIdx + 1]
                if (validEdgeDistance(location.lat, location.lng, p[1], p[0], next[1], next[0])) {
                    snapped = calcCrossingPointToEdge(location.lat, location.lng, p[1], p[0], next[1], next[0])
                    dist = Math.min(dist, calcDist(snapped, location))
                }

                if (heading) {
                    // TODO reject point based on heading if a similar close point is available
                    const tmpHeading = toDegrees(toNorthBased(calcOrientation(p[1], p[0], next[1], next[0])))
                    headingMatches = Math.abs(heading - tmpHeading) < 40
                }
            }

            const set = (res: InstructionResult) => {
                res.distanceToRoute = dist
                // use next instruction or finish
                res.index = instrIdx + 1 < instructions.length ? instrIdx + 1 : instrIdx
                res.distanceToTurn = Math.round(calcDist({ lat: last[1], lng: last[0] }, snapped))
                res.nextWaypointIndex = waypointIndex + 1
                res.pillarPointOnRoute = { lat: p[1], lng: p[0] }
            }

            if (dist < result.distanceToRoute) set(result)
            if (dist < resultWithHeadingFilter.distanceToRoute && headingMatches) set(resultWithHeadingFilter)
        }
    }

    const finalResult =
        resultWithHeadingFilter.index >= 0 && resultWithHeadingFilter.distanceToRoute < 20
            ? resultWithHeadingFilter
            : result
    let distanceToWaypoint = -1
    let timeToTurn = 0
    let timeToEnd = 0
    let distanceToEnd = finalResult.distanceToTurn
    if (finalResult.index >= 0) {
        if (finalResult.index > 0) {
            // proportional estimate the time to the next instruction, TODO use time from path details instead
            let prevInstr = instructions[finalResult.index - 1]
            timeToTurn = prevInstr.distance > 0 ? prevInstr.time * (distanceToEnd / prevInstr.distance) : 0
        }
        timeToEnd = timeToTurn
        distanceToEnd = finalResult.distanceToTurn
        for (let instrIdx = finalResult.index; instrIdx < instructions.length; instrIdx++) {
            timeToEnd += instructions[instrIdx].time
            distanceToEnd += instructions[instrIdx].distance

            const sign = instructions[instrIdx].sign
            if ((sign === 4 || sign === 5) && distanceToWaypoint < 0) distanceToWaypoint = distanceToEnd
        }
        if (distanceToWaypoint < 0)
            throw new Error("remaining instructions didn't include a via or finish!?" + instructions)
    }

    return {
        ...finalResult,
        timeToTurn,
        timeToEnd,
        distanceToEnd,
        distanceToWaypoint,
    }
}

class InstructionResult {
    index = -1
    distanceToRoute = Number.MAX_VALUE
    // TODO do we need to calculate the more precise route distance or is the current straight-line distance sufficient?
    distanceToTurn = -1
    nextWaypointIndex = 0
    pillarPointOnRoute = { lat: 0, lng: 0 }
}

/**
 * Calculates the great-circle distance between two points on Earth given the latitudes and longitudes
 * assuming that Earth is a sphere with radius 6371km. The result is returned in meters.
 */
export function calcDist(point1: Coordinate, point2: Coordinate): number {
    const fromLat = point1.lat
    const toLat = point2.lat
    const fromLng = point1.lng
    const toLng = point2.lng
    const sinDeltaLat: number = Math.sin(toRadians(toLat - fromLat) / 2)
    const sinDeltaLon: number = Math.sin(toRadians(toLng - fromLng) / 2)
    const normedDist: number =
        sinDeltaLat * sinDeltaLat +
        sinDeltaLon * sinDeltaLon * Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat))
    return 6371000 * 2 * Math.asin(Math.sqrt(normedDist))
}

function validEdgeDistance(
    r_lat_deg: number,
    r_lon_deg: number,
    a_lat_deg: number,
    a_lon_deg: number,
    b_lat_deg: number,
    b_lon_deg: number
): boolean {
    let shrinkFactor = calcShrinkFactor(a_lat_deg, b_lat_deg)
    let a_lat = a_lat_deg
    let a_lon = a_lon_deg * shrinkFactor

    let b_lat = b_lat_deg
    let b_lon = b_lon_deg * shrinkFactor

    let r_lat = r_lat_deg
    let r_lon = r_lon_deg * shrinkFactor

    let ar_x = r_lon - a_lon
    let ar_y = r_lat - a_lat
    let ab_x = b_lon - a_lon
    let ab_y = b_lat - a_lat
    let ab_ar = ar_x * ab_x + ar_y * ab_y

    let rb_x = b_lon - r_lon
    let rb_y = b_lat - r_lat
    let ab_rb = rb_x * ab_x + rb_y * ab_y

    // calculate the exact degree alpha(ar, ab) and beta(rb,ab) if it is case 1 then both angles are <= 90°
    // double ab_ar_norm = Math.sqrt(ar_x * ar_x + ar_y * ar_y) * Math.sqrt(ab_x * ab_x + ab_y * ab_y);
    // double ab_rb_norm = Math.sqrt(rb_x * rb_x + rb_y * rb_y) * Math.sqrt(ab_x * ab_x + ab_y * ab_y);
    // return Math.acos(ab_ar / ab_ar_norm) <= Math.PI / 2 && Math.acos(ab_rb / ab_rb_norm) <= Math.PI / 2;
    return ab_ar > 0 && ab_rb > 0
}

function calcShrinkFactor(a_lat_deg: number, b_lat_deg: number): number {
    return Math.cos(toRadians((a_lat_deg + b_lat_deg) / 2))
}

function calcCrossingPointToEdge(
    r_lat_deg: number,
    r_lon_deg: number,
    a_lat_deg: number,
    a_lon_deg: number,
    b_lat_deg: number,
    b_lon_deg: number
): Coordinate {
    let shrinkFactor = calcShrinkFactor(a_lat_deg, b_lat_deg)
    let a_lat = a_lat_deg
    let a_lon = a_lon_deg * shrinkFactor

    let b_lat = b_lat_deg
    let b_lon = b_lon_deg * shrinkFactor

    let r_lat = r_lat_deg
    let r_lon = r_lon_deg * shrinkFactor

    let delta_lon = b_lon - a_lon
    let delta_lat = b_lat - a_lat

    if (delta_lat == 0)
        // special case: horizontal edge
        return { lat: a_lat_deg, lng: r_lon_deg }

    if (delta_lon == 0)
        // special case: vertical edge
        return { lat: r_lat_deg, lng: a_lon_deg }

    let norm = delta_lon * delta_lon + delta_lat * delta_lat
    let factor = ((r_lon - a_lon) * delta_lon + (r_lat - a_lat) * delta_lat) / norm

    // x,y is projection of r onto segment a-b
    let c_lon = a_lon + factor * delta_lon
    let c_lat = a_lat + factor * delta_lat
    return { lat: c_lat, lng: c_lon / shrinkFactor }
}

// returns orientation in interval -pi to +pi where 0 is east
export function calcOrientation(lat1: number, lon1: number, lat2: number, lon2: number): number {
    let shrinkFactor = Math.cos(toRadians((lat1 + lat2) / 2))
    return Math.atan2(lat2 - lat1, shrinkFactor * (lon2 - lon1))
}

// convert east-based radians into north based
export function toNorthBased(orientation: number): number {
    orientation = orientation >= 0 ? (5 * Math.PI) / 2 - orientation : Math.PI / 2 - orientation
    // modulo with decimals seems to work too!? orientation % (2 * Math.PI)
    return orientation > 2 * Math.PI ? orientation - 2 * Math.PI : orientation
}

export function toDegrees(rad: number): number {
    return (rad * 180.0) / Math.PI
}

export function toRadians(deg: number): number {
    return (deg * Math.PI) / 180.0
}
