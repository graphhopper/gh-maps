import { Action } from '@/stores/Dispatcher'
import { Coordinate, QueryPoint } from '@/stores/QueryStore'
import { ApiInfo, Bbox, Path, RoutingArgs, RoutingProfile, RoutingResult } from '@/api/graphhopper'
import { PathDetailsPoint } from '@/stores/PathDetailsStore'
import { TNSettingsState } from '@/stores/TurnNavigationStore'
import { POI } from '@/stores/POIsStore'
import { Settings } from '@/stores/SettingsStore'

export class InfoReceived implements Action {
    readonly result: ApiInfo

    constructor(result: ApiInfo) {
        this.result = result
    }
}

export class TurnNavigationStop implements Action {}

export class TurnNavigationStart implements Action {}

export class LocationUpdateSync implements Action {
    readonly enableViewSync: boolean

    constructor(enableViewSync: boolean) {
        this.enableViewSync = enableViewSync
    }
}

export class LocationUpdate implements Action {
    readonly coordinate: Coordinate
    readonly speed: number // in meter/sec
    readonly heading: number
    readonly syncView: boolean

    constructor(coordinate: Coordinate, syncView: boolean, speed: number, heading: number) {
        this.coordinate = coordinate
        this.speed = speed
        this.syncView = syncView
        this.heading = heading
    }
}

export class TurnNavigationSettingsUpdate implements Action {
    readonly settings: TNSettingsState

    constructor(settings: TNSettingsState) {
        this.settings = settings
    }
}

export class TurnNavigationReroutingFailed implements Action {}
export class TurnNavigationReroutingTimeResetForTest implements Action {}
export class TurnNavigationRerouting implements Action {
    readonly path: Path

    constructor(path: Path) {
        this.path = path
    }
}

export class SetPoint implements Action {
    readonly point: QueryPoint
    readonly zoomResponse: boolean

    /**
     * @param point
     * @param zoomResponse This action triggers a route request (if the specified point and all existing points
     * are initialized) and if this response returns and zoomResponse is set to "true" the map will be zoomed to fit
     * the geometry of the first route on the screen.
     */
    constructor(point: QueryPoint, zoomResponse: boolean) {
        this.point = point
        this.zoomResponse = zoomResponse
    }
}

export class SetVehicleProfile implements Action {
    readonly profile: RoutingProfile

    constructor(profile: RoutingProfile) {
        this.profile = profile
    }
}

export class AddPoint implements Action {
    readonly atIndex: number
    readonly coordinate: Coordinate
    readonly isInitialized: boolean
    readonly zoom: boolean

    constructor(atIndex: number, coordinate: Coordinate, isInitialized: boolean, zoom: boolean) {
        this.atIndex = atIndex
        this.coordinate = coordinate
        this.isInitialized = isInitialized
        this.zoom = zoom
    }
}

export class SetQueryPoints implements Action {
    readonly queryPoints: QueryPoint[]

    constructor(queryPoints: QueryPoint[]) {
        this.queryPoints = queryPoints
    }
}

export class ClearPoints implements Action {}

export class RemovePoint implements Action {
    readonly point: QueryPoint

    constructor(point: QueryPoint) {
        this.point = point
    }
}

export class MovePoint implements Action {
    readonly point: QueryPoint
    readonly newIndex: number

    constructor(point: QueryPoint, newIndex: number) {
        this.point = point
        this.newIndex = newIndex
    }
}

export class InvalidatePoint implements Action {
    readonly point: QueryPoint

    constructor(point: QueryPoint) {
        this.point = point
    }
}

export class SetCustomModelEnabled implements Action {
    readonly enabled: boolean

    constructor(enabled: boolean) {
        this.enabled = enabled
    }
}

export class SetCustomModel implements Action {
    readonly customModelStr: string
    readonly issueRoutingRequest: boolean

    constructor(customModelStr: string, issueRoutingRequest: boolean) {
        this.customModelStr = customModelStr
        this.issueRoutingRequest = issueRoutingRequest
    }
}

export class RouteRequestSuccess implements Action {
    readonly result: RoutingResult
    readonly request: RoutingArgs
    readonly zoom: boolean

    constructor(request: RoutingArgs, zoom: boolean, result: RoutingResult) {
        this.result = result
        this.request = request
        this.zoom = zoom
    }
}

export class ErrorAction implements Action {
    readonly message: string

    constructor(message: string) {
        this.message = message
    }
}

export class RouteRequestFailed extends ErrorAction {
    readonly request: RoutingArgs

    constructor(request: RoutingArgs, message: string) {
        super(message)
        this.request = request
    }
}

export class ClearRoute implements Action {}

export class SetSelectedPath implements Action {
    readonly path: Path

    constructor(path: Path) {
        this.path = path
    }
}

export class DismissLastError implements Action {}

export class SelectMapLayer implements Action {
    readonly layer: string
    readonly forNavigation: boolean

    constructor(layer: string, forNavigation: boolean = false) {
        this.layer = layer
        this.forNavigation = forNavigation
    }
}

export class ToggleRoutingGraph implements Action {
    readonly routingGraphEnabled: boolean

    constructor(routingGraphEnabled: boolean) {
        this.routingGraphEnabled = routingGraphEnabled
    }
}

export class ToggleUrbanDensityLayer implements Action {
    readonly urbanDensityEnabled: boolean

    constructor(urbanDensityEnabled: boolean) {
        this.urbanDensityEnabled = urbanDensityEnabled
    }
}

export class ToggleExternalMVTLayer implements Action {
    readonly externalMVTLayerEnabled: boolean

    constructor(externalMVTLayerEnabled: boolean) {
        this.externalMVTLayerEnabled = externalMVTLayerEnabled
    }
}

export class MapIsLoaded implements Action {}

export class ZoomMapToPoint implements Action {
    readonly coordinate: Coordinate

    constructor(coordinate: Coordinate) {
        this.coordinate = coordinate
    }
}

export class SetBBox implements Action {
    readonly bbox: Bbox

    constructor(bbox: Bbox) {
        this.bbox = bbox
    }
}

export class PathDetailsHover implements Action {
    readonly pathDetailsPoint: PathDetailsPoint | null

    constructor(pathDetailsPoint: PathDetailsPoint | null) {
        this.pathDetailsPoint = pathDetailsPoint
    }
}

export class PathDetailsRangeSelected implements Action {
    readonly bbox: Bbox | null

    constructor(bbox: Bbox | null) {
        this.bbox = bbox
    }
}

export class PathDetailsElevationSelected implements Action {
    readonly segments: Coordinate[][]

    constructor(segments: Coordinate[][]) {
        this.segments = segments
    }
}

export class RoutingGraphHover implements Action {
    readonly point: Coordinate | null
    readonly properties: object

    constructor(point: Coordinate | null, properties: object) {
        this.point = point
        this.properties = properties
    }
}

export class InstructionClicked implements Action {
    readonly coordinate: Coordinate | null
    readonly text: string

    constructor(point: Coordinate | null, text: string) {
        this.coordinate = point
        this.text = text
    }
}

export class ToggleVectorTilesForNavigation implements Action {}
export class ToggleFullScreenForNavigation implements Action {}

export class UpdateSettings implements Action {
    readonly updatedSettings: Partial<Settings>

    constructor(updatedSettings: Partial<Settings>) {
        this.updatedSettings = updatedSettings
    }
}

export class SelectPOI implements Action {
    readonly selected: POI | null

    constructor(selected: POI | null) {
        this.selected = selected
    }
}

export class SetPOIs implements Action {
    readonly pois: POI[]

    constructor(pois: POI[]) {
        this.pois = pois
    }
}
