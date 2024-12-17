import { LineString } from 'geojson'
import { Coordinate, CustomModel } from '@/stores/QueryStore'

// minLon, minLat, maxLon, maxLat
export type Bbox = [number, number, number, number]

export interface RoutingArgs {
    readonly points: [number, number][]
    readonly heading?: number
    readonly profile: string
    readonly maxAlternativeRoutes: number
    readonly customModel: CustomModel | null
}

export interface RoutingRequest {
    readonly points: ReadonlyArray<[number, number]>
    profile: string
    locale: string
    points_encoded: boolean
    points_encoded_multiplier: number
    instructions: boolean
    elevation: boolean
    headings?: number[]
    heading_penalty?: number
    'alternative_route.max_paths'?: number
    'alternative_route.max_weight_factor'?: number
    'ch.disable'?: boolean
    algorithm?: 'alternative_route' | 'round_trip'
    snap_preventions?: string[]
    details?: string[]
    custom_model?: CustomModel
}

export interface ErrorResponse {
    message: string
    hints: any[]
}

export interface RoutingResultInfo {
    readonly copyright: string[]
    readonly road_data_timestamp: string
    readonly took: number
}

export interface RoutingResult {
    readonly info: RoutingResultInfo
    readonly paths: Path[]
}

export interface RawResult {
    readonly info: RoutingResultInfo
    readonly paths: RawPath[]
}

export interface ApiInfo {
    readonly version: string
    readonly bbox: Bbox
    readonly elevation: boolean
    readonly profiles: RoutingProfile[]
    readonly encoded_values: object[]
}

export interface RoutingProfile {
    readonly name: string
}

export interface Path extends BasePath {
    readonly points: LineString
    readonly snapped_waypoints: LineString
}

export interface RawPath extends BasePath {
    readonly points: string | LineString
    readonly snapped_waypoints: string | LineString
}

export interface BasePath {
    readonly distance: number
    readonly time: number
    readonly ascend: number
    readonly descend: number
    readonly points_encoded: boolean
    readonly points_encoded_multiplier: number
    readonly bbox?: Bbox
    readonly instructions: Instruction[]
    readonly details: Details
    readonly points_order: number[]
    readonly description: string
}

export interface Instruction {
    readonly distance: number
    readonly interval: [number, number]
    readonly points: number[][]
    readonly sign: number
    readonly text: string
    readonly street_name: string
    readonly motorway_junction: string
    readonly time: number
}

interface Details {
    readonly street_name: [number, number, string][]
    readonly surface: [number, number, string][]
    readonly road_environment: [number, number, string][]
    readonly road_class: [number, number, string][]
    readonly toll: [number, number, string][]
    readonly max_speed: [number, number, number][]
    readonly average_speed: [number, number, number][]
    readonly road_access: [number, number, string][]
    readonly access_conditional: [number, number, string][]
    readonly foot_conditional: [number, number, string][]
    readonly bike_conditional: [number, number, string][]
    readonly track_type: [number, number, string][]
    readonly country: [number, number, string][]
    readonly get_off_bike: [number, number, boolean][]
    readonly mtb_rating: [number, number, boolean][]
    readonly hike_rating: [number, number, boolean][]
}

export interface TagHash {
    [key: string]: string
}

export interface ReverseGeocodingHit {
    readonly tags: TagHash
    readonly type: string
    readonly id: number
    readonly point: Coordinate
}

export interface GeocodingResult {
    readonly hits: GeocodingHit[]
    readonly took: number
}

export interface GeocodingHit {
    readonly point: Coordinate
    readonly extent: Bbox
    readonly osm_id: string
    readonly osm_type: string
    readonly osm_key: string
    readonly osm_value: string
    readonly name: string
    readonly country: string
    readonly city: string
    readonly state: string
    readonly street: string
    readonly housenumber: string
    readonly postcode: string
}
