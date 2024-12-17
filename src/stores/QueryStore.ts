import { coordinateToText, metersToText } from '@/Converters'
import Api, { ApiImpl } from '@/api/Api'
import Store from '@/stores/Store'
import Dispatcher, { Action } from '@/stores/Dispatcher'
import {
    AddPoint,
    ClearPoints,
    ErrorAction,
    InfoReceived,
    InvalidatePoint,
    MovePoint,
    RemovePoint,
    RouteRequestFailed,
    RouteRequestSuccess,
    SetCustomModel,
    SetCustomModelEnabled,
    SetPoint,
    SetQueryPoints,
    SetVehicleProfile,
} from '@/actions/Actions'
import { Bbox, RoutingArgs, RoutingProfile } from '@/api/graphhopper'
import { calcDist } from '@/turnNavigation/GeoMethods'
import config from 'config'
import { customModel2prettyString, customModelExamples } from '@/sidebar/CustomModelExamples'

export interface Coordinate {
    lat: number
    lng: number
}

export function getBBoxFromCoord(c: Coordinate, offset: number = 0.005): Bbox {
    return [c.lng - offset, c.lat - offset, c.lng + offset, c.lat + offset]
}

export interface QueryStoreState {
    readonly profiles: RoutingProfile[]
    readonly queryPoints: QueryPoint[]
    readonly nextQueryPointId: number
    readonly currentRequest: CurrentRequest
    readonly maxAlternativeRoutes: number
    readonly routingProfile: RoutingProfile
    readonly customModelEnabled: boolean
    readonly customModelStr: string
}

export interface QueryPoint {
    readonly coordinate: Coordinate
    readonly queryText: string
    readonly isInitialized: boolean
    readonly color: string
    readonly id: number
    readonly type: QueryPointType
}

export interface CustomModel {
    readonly speed?: object[]
    readonly priority?: object[]
    readonly distance_influence?: number
    readonly areas?: object
}

export enum QueryPointType {
    From,
    To,
    Via,
}

export interface CurrentRequest {
    subRequests: SubRequest[]
}

export enum RequestState {
    SENT,
    SUCCESS,
    FAILED,
}

export interface SubRequest {
    readonly args: RoutingArgs
    readonly state: RequestState
}

export default class QueryStore extends Store<QueryStoreState> {
    private readonly api: Api

    constructor(api: Api, initialCustomModelStr: string | null = null) {
        super(QueryStore.getInitialState(initialCustomModelStr))
        this.api = api
    }

    private static getInitialState(initialCustomModelStr: string | null): QueryStoreState {
        const customModelEnabledInitially = initialCustomModelStr != null
        if (!initialCustomModelStr)
            initialCustomModelStr = customModel2prettyString(customModelExamples['default_example'])
        // prettify the custom model if it can be parsed or leave it as is otherwise
        try {
            initialCustomModelStr = customModel2prettyString(JSON.parse(initialCustomModelStr))
        } catch (e) {}

        return {
            profiles: [],
            queryPoints: [
                QueryStore.getEmptyPoint(0, QueryPointType.From),
                QueryStore.getEmptyPoint(1, QueryPointType.To),
            ],
            nextQueryPointId: 2,
            currentRequest: {
                subRequests: [],
            },
            maxAlternativeRoutes: 3,
            routingProfile: {
                name: '',
            },
            customModelEnabled: customModelEnabledInitially,
            customModelStr: initialCustomModelStr,
        }
    }

    reduce(state: QueryStoreState, action: Action): QueryStoreState {
        if (action instanceof InvalidatePoint) {
            const points = QueryStore.replacePoint(state.queryPoints, {
                ...action.point,
                isInitialized: false,
            })
            return {
                ...state,
                queryPoints: points,
            }
        } else if (action instanceof ClearPoints) {
            const newPoints = state.queryPoints.map(point => {
                return {
                    ...point,
                    queryText: '',
                    point: { lat: 0, lng: 0 },
                    isInitialized: false,
                }
            })

            return {
                ...state,
                queryPoints: newPoints,
            }
        } else if (action instanceof SetPoint) {
            const newState: QueryStoreState = {
                ...state,
                queryPoints: QueryStore.replacePoint(state.queryPoints, action.point),
            }

            return this.routeIfReady(newState, action.zoomResponse)
        } else if (action instanceof MovePoint) {
            // Remove and Add in one action but with only one route request
            const newPoints = QueryStore.movePoint(state.queryPoints, action.point, action.newIndex).map(
                (point, index) => {
                    const type = QueryStore.getPointType(index, state.queryPoints.length)
                    return {
                        ...point,
                        color: QueryStore.getMarkerColor(type),
                        type: type,
                        id: this.state.nextQueryPointId + index,
                    }
                }
            )

            const newState = {
                ...state,
                nextQueryPointId: state.nextQueryPointId + state.queryPoints.length,
                queryPoints: newPoints,
            }
            return this.routeIfReady(newState, false)
        } else if (action instanceof AddPoint) {
            const tmp = state.queryPoints.slice()
            const queryText = action.isInitialized ? coordinateToText(action.coordinate) : ''

            // add new point at the desired index
            tmp.splice(action.atIndex, 0, {
                coordinate: action.coordinate,
                id: state.nextQueryPointId,
                queryText: queryText,
                color: '',
                isInitialized: action.isInitialized,
                type: QueryPointType.Via,
            })

            // determine colors for each point. I guess this could be smarter if this needs to be faster
            const newPoints = tmp.map((point, i) => {
                const type = QueryStore.getPointType(i, tmp.length)
                return { ...point, color: QueryStore.getMarkerColor(type), type: type }
            })

            const newState: QueryStoreState = {
                ...state,
                nextQueryPointId: state.nextQueryPointId + 1,
                queryPoints: newPoints,
            }

            return this.routeIfReady(newState, action.zoom)
        } else if (action instanceof SetQueryPoints) {
            // make sure that some things are set correctly, regardless of what was passed in here.
            const queryPoints = action.queryPoints.map((point, i) => {
                const type = QueryStore.getPointType(i, action.queryPoints.length)
                const queryText =
                    point.isInitialized && !point.queryText ? coordinateToText(point.coordinate) : point.queryText
                return {
                    ...point,
                    id: state.nextQueryPointId + i,
                    type: type,
                    color: QueryStore.getMarkerColor(type),
                    queryText: queryText,
                }
            })
            // make sure there are always at least two input boxes
            while (queryPoints.length < 2) {
                const type = QueryStore.getPointType(queryPoints.length, 2)
                queryPoints.push({
                    id: queryPoints.length,
                    type: type,
                    color: QueryStore.getMarkerColor(type),
                    queryText: '',
                    isInitialized: false,
                    coordinate: { lat: 0, lng: 0 },
                })
            }
            const nextId = state.nextQueryPointId + queryPoints.length

            return this.routeIfReady(
                {
                    ...state,
                    queryPoints: queryPoints,
                    nextQueryPointId: nextId,
                },
                true
            )
        } else if (action instanceof RemovePoint) {
            const newPoints = state.queryPoints
                .filter(point => point.id !== action.point.id)
                .map((point, i) => {
                    const type = QueryStore.getPointType(i, state.queryPoints.length - 1)
                    return { ...point, color: QueryStore.getMarkerColor(type), type: type }
                })

            const newState: QueryStoreState = {
                ...state,
                queryPoints: newPoints,
            }
            return this.routeIfReady(newState, false)
        } else if (action instanceof InfoReceived) {
            // Do nothing if no routing profiles were received
            if (action.result.profiles.length <= 0) return state

            // if there are profiles defined in the config file use them, otherwise use the profiles from /info
            const profiles: RoutingProfile[] = config.profiles
                ? Object.keys(config.profiles).map(profile => ({ name: profile }))
                : action.result.profiles

            // if a routing profile was in the url keep it, otherwise select the first entry as default profile
            const profile = state.routingProfile.name ? state.routingProfile : profiles[0]
            return this.routeIfReady(
                {
                    ...state,
                    profiles,
                    routingProfile: profile,
                },
                true
            )
        } else if (action instanceof SetVehicleProfile) {
            const newState: QueryStoreState = {
                ...state,
                routingProfile: action.profile,
            }

            return this.routeIfReady(newState, true)
        } else if (action instanceof SetCustomModel) {
            const newState = {
                ...state,
                customModelStr: action.customModelStr,
            }
            return action.issueRoutingRequest ? this.routeIfReady(newState, true) : newState
        } else if (action instanceof RouteRequestSuccess || action instanceof RouteRequestFailed) {
            return QueryStore.handleFinishedRequest(state, action)
        } else if (action instanceof SetCustomModelEnabled) {
            const newState: QueryStoreState = {
                ...state,
                customModelEnabled: action.enabled,
            }
            return this.routeIfReady(newState, true)
        }
        return state
    }

    private static handleFinishedRequest(
        state: QueryStoreState,
        action: RouteRequestSuccess | RouteRequestFailed
    ): QueryStoreState {
        const newState = action instanceof RouteRequestSuccess ? RequestState.SUCCESS : RequestState.FAILED
        const newSubrequests = QueryStore.replaceSubRequest(state.currentRequest.subRequests, action.request, newState)

        return {
            ...state,
            currentRequest: {
                subRequests: newSubrequests,
            },
        }
    }

    private routeIfReady(state: QueryStoreState, zoom: boolean): QueryStoreState {
        if (QueryStore.isReadyToRoute(state)) {
            let requests
            const maxDistance = getMaxDistance(state.queryPoints)
            if (state.customModelEnabled) {
                if (maxDistance < 200_000) {
                    // Use a single request, possibly including alternatives when custom models are enabled.
                    requests = [QueryStore.buildRouteRequest(state)]
                } else if (maxDistance < 500_000) {
                    // Force no alternatives for longer custom model routes.
                    requests = [
                        QueryStore.buildRouteRequest({
                            ...state,
                            maxAlternativeRoutes: 1,
                        }),
                    ]
                } else {
                    // Custom model requests with large distances take too long, so we just error.
                    // later: better usability if we just remove ch.disable? i.e. the request always succeeds
                    Dispatcher.dispatch(
                        new ErrorAction(
                            'Using the custom model feature is unfortunately not ' +
                                'possible when the request points are further than ' +
                                // todo: use settings#showDistanceInMiles, but not sure how to use state from another store here
                                metersToText(500_000, false) +
                                ' apart.'
                        )
                    )
                    return state
                }
            } else {
                requests = [
                    // We first send a fast request without alternatives ...
                    QueryStore.buildRouteRequest({
                        ...state,
                        maxAlternativeRoutes: 1,
                    }),
                ]
                // ... and then a second, slower request including alternatives if they are enabled.
                if (
                    state.queryPoints.length === 2 &&
                    state.maxAlternativeRoutes > 1 &&
                    ((ApiImpl.isMotorVehicle(state.routingProfile.name) && maxDistance < 7_000_000) ||
                        maxDistance < 500_000)
                )
                    requests.push(QueryStore.buildRouteRequest(state))
            }

            return {
                ...state,
                currentRequest: { subRequests: this.send(requests, zoom) },
            }
        }
        return state
    }

    private send(args: RoutingArgs[], zoom: boolean) {
        const subRequests = args.map(arg => {
            return {
                args: arg,
                state: RequestState.SENT,
            }
        })

        subRequests.forEach((subRequest, i) => this.api.routeWithDispatch(subRequest.args, i == 0 ? zoom : false))
        return subRequests
    }

    private static isReadyToRoute(state: QueryStoreState) {
        if (state.customModelEnabled)
            try {
                JSON.parse(state.customModelStr)
            } catch {
                return false
            }
        // Janek deliberately chose this style of if statements, to make this readable.
        if (state.queryPoints.length <= 1) return false
        if (!state.queryPoints.every(point => point.isInitialized)) return false
        if (!state.routingProfile.name) return false

        return true
    }

    private static movePoint(points: QueryPoint[], point: QueryPoint, newIndex: number): QueryPoint[] {
        if (newIndex < 0) return points

        const newPoints = points.filter((p, index) => {
            if (p.id == point.id) {
                if (index < newIndex) newIndex-- // index adjustment is important
                return false
            }
            return true
        })

        if (newIndex >= points.length) return points
        newPoints.splice(newIndex, 0, point)
        return newPoints
    }

    private static replacePoint(points: QueryPoint[], point: QueryPoint) {
        return replace(
            points,
            p => p.id === point.id,
            () => point
        )
    }

    private static replaceSubRequest(subRequests: SubRequest[], args: RoutingArgs, state: RequestState) {
        return replace(
            subRequests,
            r => r.args === args,
            r => {
                return { ...r, state }
            }
        )
    }

    public static getMarkerColor(type: QueryPointType) {
        switch (type) {
            case QueryPointType.From:
                return '#7cb342'
            case QueryPointType.To:
                return '#F97777'
            default:
                return '#76D0F7'
        }
    }

    private static getPointType(index: number, numberOfPoints: number) {
        if (index === 0) return QueryPointType.From
        if (index === numberOfPoints - 1) return QueryPointType.To
        return QueryPointType.Via
    }

    private static buildRouteRequest(state: QueryStoreState): RoutingArgs {
        const coordinates = state.queryPoints.map(point => [point.coordinate.lng, point.coordinate.lat]) as [
            number,
            number
        ][]

        let customModel = null
        if (state.customModelEnabled)
            try {
                customModel = JSON.parse(state.customModelStr)
            } catch {}

        return {
            points: coordinates,
            profile: state.routingProfile.name,
            maxAlternativeRoutes: state.maxAlternativeRoutes,
            customModel: customModel,
        }
    }

    private static getEmptyPoint(id: number, type: QueryPointType): QueryPoint {
        return {
            isInitialized: false,
            queryText: '',
            coordinate: { lat: 0, lng: 0 },
            id: id,
            color: QueryStore.getMarkerColor(type),
            type: type,
        }
    }
}

function replace<T>(array: T[], compare: { (element: T): boolean }, provider: { (element: T): T }) {
    const result = []

    for (const element of array) {
        if (compare(element)) result.push(provider(element))
        else result.push(element)
    }

    return result
}

function getMaxDistance(queryPoints: QueryPoint[]): number {
    let max = 0
    for (let idx = 1; idx < queryPoints.length; idx++) {
        const dist = calcDist(queryPoints[idx - 1].coordinate, queryPoints[idx].coordinate)
        max = Math.max(dist, max)
    }
    return max
}
