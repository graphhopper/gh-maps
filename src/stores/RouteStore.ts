import Store from '@/stores/Store'
import { Action } from '@/stores/Dispatcher'
import { ClearPoints, ClearRoute, RemovePoint, RouteRequestSuccess, SetPoint, SetSelectedPath } from '@/actions/Actions'
import QueryStore from '@/stores/QueryStore'
import { Path, RoutingResult } from '@/api/graphhopper'

export interface RouteStoreState {
    routingResult: RoutingResult
    selectedPath: Path
}

export default class RouteStore extends Store<RouteStoreState> {
    private static getEmptyPath(): Path {
        return {
            bbox: undefined,
            instructions: [],
            points: {
                coordinates: [],
                type: 'LineString',
            },
            points_encoded: false,
            points_encoded_multiplier: 1e5,
            snapped_waypoints: {
                type: 'LineString',
                coordinates: [],
            },
            ascend: 0,
            descend: 0,
            details: {
                surface: [],
                average_speed: [],
                max_speed: [],
                street_name: [],
                toll: [],
                road_environment: [],
                road_class: [],
                road_access: [],
                access_conditional: [],
                foot_conditional: [],
                bike_conditional: [],
                track_type: [],
                country: [],
                get_off_bike: [],
                mtb_rating: [],
                hike_rating: [],
            },
            distance: 0,
            points_order: [],
            time: 0,
            description: '',
        }
    }

    constructor() {
        super(RouteStore.getInitialState())
    }

    reduce(state: RouteStoreState, action: Action): RouteStoreState {
        if (action instanceof RouteRequestSuccess) {
            return this.reduceRouteReceived(state, action)
        } else if (action instanceof SetSelectedPath) {
            return {
                ...state,
                selectedPath: action.path,
            }
        } else if (
            action instanceof SetPoint ||
            action instanceof ClearRoute ||
            action instanceof ClearPoints ||
            action instanceof RemovePoint
        ) {
            return RouteStore.getInitialState()
        }
        return state
    }

    private static getInitialState(): RouteStoreState {
        return {
            routingResult: {
                paths: [],
                info: {
                    copyright: [],
                    road_data_timestamp: '',
                    took: 0,
                },
            },
            selectedPath: RouteStore.getEmptyPath(),
        }
    }

    private reduceRouteReceived(state: RouteStoreState, action: RouteRequestSuccess) {
        if (RouteStore.containsPaths(action.result.paths)) {
            return {
                routingResult: action.result,
                selectedPath: action.result.paths[0],
            }
        }
        return RouteStore.getInitialState()
    }

    private static containsPaths(paths: Path[]) {
        return paths.length > 0
    }
}
