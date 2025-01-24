import Api from '@/api/Api'
import {
    ApiInfo,
    Bbox,
    GeocodingResult,
    ReverseGeocodingHit,
    RoutingArgs,
    RoutingResult,
    RoutingResultInfo,
} from '@/api/graphhopper'
import QueryStore, { QueryPoint, QueryPointType, QueryStoreState, RequestState, SubRequest } from '@/stores/QueryStore'
import {
    AddPoint,
    ClearPoints,
    InfoReceived,
    InvalidatePoint,
    RemovePoint,
    RouteRequestFailed,
    RouteRequestSuccess,
    SetPoint,
    SetVehicleProfile,
} from '@/actions/Actions'
import { POIAndQuery, POIQuery } from '@/pois/AddressParseResult'

class ApiMock implements Api {
    private readonly callback: { (args: RoutingArgs): void }

    constructor(callback: { (args: RoutingArgs): void }) {
        this.callback = callback
    }

    geocode(query: string): Promise<GeocodingResult> {
        throw Error('not implemented')
    }

    reverseGeocode(query: POIQuery, bbox: Bbox): Promise<ReverseGeocodingHit[]> {
        throw Error('not implemented')
    }

    info(): Promise<ApiInfo> {
        throw Error('not implemented')
    }

    route(args: RoutingArgs): Promise<RoutingResult> {
        throw Error('not implemented')
    }

    routeWithDispatch(args: RoutingArgs): void {
        this.callback(args)
    }

    supportsGeocoding(): boolean {
        return false
    }
}

describe('QueryStore', () => {
    describe('SetPoint action', () => {
        it('should update a point on set point action', () => {
            const store = new QueryStore(
                new ApiMock(() => {
                    throw Error('not expected')
                })
            )
            const point: QueryPoint = {
                ...store.state.queryPoints[0],
                isInitialized: true,
            }
            const storeState = {
                ...store.state,
                routingProfile: { name: 'car' },
            }

            const state = store.reduce(storeState, new SetPoint(point, true))

            expect(state.queryPoints[0]).toEqual(point)
        })
        it('should only send a route request if all parameters are initialized', () => {
            let counter = 0
            const store = new QueryStore(new ApiMock(() => counter++))
            let state = {
                ...store.state,
                maxAlternativeRoutes: 1,
            }

            for (const point of store.state.queryPoints) {
                state = store.reduce(state, new SetPoint({ ...point, isInitialized: true }, true))
            }

            // the store should not send anything unless points and routing profile are specified
            expect(counter).toEqual(0)
            state = store.reduce(state, new SetVehicleProfile({ name: 'car' }))

            expect(state.queryPoints.every(point => point.isInitialized)).toBeTruthy()
            expect(counter).toEqual(1)
        })
        it('should send two requests with different parameters when maxAlternativeRoutes is > 1', () => {
            const requestArgs: RoutingArgs[] = []
            const store = new QueryStore(new ApiMock(args => requestArgs.push(args)))

            let state = {
                ...store.state,
                routingProfile: { name: 'car' },
            }
            for (const point of store.state.queryPoints) {
                state = store.reduce(state, new SetPoint({ ...point, isInitialized: true }, true))
            }

            expect(state.queryPoints.every(point => point.isInitialized)).toBeTruthy()
            expect(requestArgs.length).toEqual(2)
            expect(requestArgs[0].maxAlternativeRoutes).toEqual(1)
            expect(requestArgs[1].maxAlternativeRoutes).toEqual(state.maxAlternativeRoutes)
        })
        it('should send one request when querypoints.length > 2 even though maxAlternativeRoutes > 1', () => {
            const requestArgs: RoutingArgs[] = []
            const store = new QueryStore(new ApiMock(args => requestArgs.push(args)))

            let state = {
                ...store.state,
                routingProfile: { name: 'car' },
            }
            state.queryPoints.push({ ...state.queryPoints[0], id: 2 })
            for (const point of store.state.queryPoints) {
                state = store.reduce(state, new SetPoint({ ...point, isInitialized: true }, true))
            }

            expect(state.queryPoints.every(point => point.isInitialized)).toBeTruthy()
            expect(requestArgs.length).toEqual(1)
            expect(requestArgs[0].maxAlternativeRoutes).toEqual(1)
        })
    })
    describe('Invalidate point action', () => {
        it('should set point with the same id to isInitialized: false', () => {
            const store = new QueryStore(new ApiMock(() => {}))

            const initializedPoints = store.state.queryPoints.map(p => ({
                ...p,
                isInitialized: true,
            }))
            const state = {
                ...store.state,
                queryPoints: initializedPoints,
            }
            const point = initializedPoints[0]

            const newState = store.reduce(state, new InvalidatePoint(point))

            expect(
                newState.queryPoints.filter(p => p.id === point.id).every(point => !point.isInitialized)
            ).toBeTruthy()
            expect(newState.queryPoints.filter(p => p.id !== point.id).every(point => point.isInitialized)).toBeTruthy()
        })
    })
    describe('Clear Points action', () => {
        it('should reset all points', () => {
            const store = new QueryStore(new ApiMock(() => {}))
            const initializedPoints = store.state.queryPoints.map((p, i) => ({
                ...p,
                isInitialized: true,
                queryText: `${i}`,
                point: { lat: i, lng: i },
            }))
            const state = {
                ...store.state,
                queryPoints: initializedPoints,
            }

            const newState = store.reduce(state, new ClearPoints())

            expect(newState.queryPoints.every(p => isCleared(p)))
        })
    })
    describe('AddPoint action', () => {
        it('should add point at the action`s index', () => {
            let counter = 0
            const store = new QueryStore(
                new ApiMock(() => {
                    counter++
                })
            )
            const newPointId = store.state.nextQueryPointId
            const atIndex = 1

            const newState = store.reduce(store.state, new AddPoint(atIndex, { lat: 1, lng: 1 }, false, true))

            expect(newState.queryPoints.findIndex(p => p.id === newPointId)).toEqual(atIndex)
            expect(newState.queryPoints.every((p, i) => isCorrectType(p, i, newState.queryPoints.length))).toBeTruthy()
            expect(counter).toEqual(0)
        })
        it('should add point at index and route if all points are initialized', () => {
            let counter = 0
            const store = new QueryStore(
                new ApiMock(() => {
                    counter++
                })
            )
            const newPointId = store.state.nextQueryPointId
            const atIndex = 1
            const initializedPoints = store.state.queryPoints.map(p => ({ ...p, isInitialized: true }))
            const state = {
                ...store.state,
                queryPoints: initializedPoints,
                routingProfile: { name: 'car' },
            }

            const newState = store.reduce(state, new AddPoint(atIndex, { lat: 1, lng: 1 }, true, true))
            expect(newState.queryPoints.findIndex(p => p.id === newPointId)).toEqual(atIndex)
            expect(newState.queryPoints[atIndex].queryText).toEqual('1,1') // if initialized flag is set the coordinates are set as query text
            expect(counter).toEqual(1)
            expect(newState.queryPoints.every((p, i) => isCorrectType(p, i, newState.queryPoints.length))).toBeTruthy()
        })
    })
    describe('RemovePoint action', () => {
        it('should remove the corresponding ponit', () => {
            let counter = 0
            const store = new QueryStore(
                new ApiMock(() => {
                    counter++
                })
            )

            const initializedPoints = store.state.queryPoints.map(p => ({ ...p, isInitialized: true }))
            const thirdPoint = {
                ...getQueryPoint(3),
                isInitialized: true,
            }
            initializedPoints.push(thirdPoint)
            const state = {
                ...store.state,
                queryPoints: initializedPoints,
                maxAlternativeRoutes: 1,
                routingProfile: { name: 'car' },
            }

            const lastState = store.reduce(state, new RemovePoint(thirdPoint))

            expect(lastState.queryPoints.length).toEqual(2)
            expect(
                lastState.queryPoints.every((p, i) => isCorrectType(p, i, lastState.queryPoints.length))
            ).toBeTruthy()
            expect(counter).toEqual(1)
        })
    })
    describe('InfoReceived action', () => {
        it('keep profile if it was already set', () => {
            const store = new QueryStore(
                new ApiMock(() => {
                    fail('no routing request when profile was already set.')
                })
            )

            const profile = 'some-profile'
            const state: QueryStoreState = {
                ...store.state,
                routingProfile: {
                    name: profile,
                },
                profiles: [{ name: profile }],
            }
            const newState = store.reduce(
                state,
                new InfoReceived({
                    profiles: [{ name: 'some-other-profile' }],
                    elevation: true,
                    version: '',
                    bbox: [0, 0, 0, 0],
                    encoded_values: [],
                })
            )

            expect(newState).toEqual({ ...state, profiles: [{ name: 'some-other-profile' }] })
        })
        it('should use the first profile received from info endpoint', () => {
            const expectedProfile = {
                name: 'some-name',
                import_date: 'some_date',
                elevation: false,
                version: 'some-version',
            }
            let routingRequestWasIssued = false
            const store = new QueryStore(
                new ApiMock(args => {
                    expect(args.profile).toEqual(expectedProfile.name)
                    routingRequestWasIssued = true
                })
            )
            let state: QueryStoreState = store.state

            // initialize all query points so that the store will issue a route request.
            state = store.reduce(
                state,
                new SetPoint(
                    {
                        ...state.queryPoints[0],
                        isInitialized: true,
                    },
                    true
                )
            )
            state = store.reduce(
                state,
                new SetPoint(
                    {
                        ...state.queryPoints[1],
                        isInitialized: true,
                    },
                    true
                )
            )
            state = store.reduce(
                state,
                new InfoReceived({
                    profiles: [expectedProfile, { name: 'other' }],
                    elevation: false,
                    version: '',
                    bbox: [0, 0, 0, 0],
                    encoded_values: [],
                })
            )

            expect(state.routingProfile).toEqual(expectedProfile)
            expect(routingRequestWasIssued).toBeTruthy()
        })
    })
    describe('SetVehicleProfile action', () => {
        it('should set the routing profile (surprise!)', () => {
            const store = new QueryStore(new ApiMock(() => {}))
            const state: QueryStoreState = store.state
            const profile = {
                name: 'car',
                import_date: 'some_date',
                features: { elevation: false },
                version: 'some-version',
            }

            const newState = store.reduce(state, new SetVehicleProfile(profile))

            expect(newState.routingProfile).toEqual(profile)
        })
    })
    describe('RouteRequestSuccess action', () => {
        it('should mark the correct subrequest as done', () => {
            const store = new QueryStore(new ApiMock(() => {}))
            const routingArgs: RoutingArgs = {
                maxAlternativeRoutes: 1,
                points: [],
                pointHints: [],
                profile: 'some-profile',
                customModel: null,
            }
            const subRequest: SubRequest = {
                state: RequestState.SENT,
                args: routingArgs,
            }
            const state: QueryStoreState = {
                ...store.state,
                currentRequest: {
                    subRequests: [subRequest],
                },
            }

            const newState = store.reduce(
                state,
                new RouteRequestSuccess(routingArgs, true, {
                    info: { took: 1, road_data_timestamp: '', copyright: [] } as RoutingResultInfo,
                    paths: [],
                })
            )

            expect(newState.currentRequest.subRequests[0].state).toEqual(RequestState.SUCCESS)
        })
    })
    describe('RouteRequestFailed action', () => {
        it('should mark the correct subrequest as done', () => {
            const store = new QueryStore(new ApiMock(() => {}))
            const routingArgs: RoutingArgs = {
                maxAlternativeRoutes: 1,
                points: [],
                pointHints: [],
                profile: 'some-profile',
                customModel: null,
            }
            const subRequest: SubRequest = {
                state: RequestState.SENT,
                args: routingArgs,
            }
            const state: QueryStoreState = {
                ...store.state,
                currentRequest: {
                    subRequests: [subRequest],
                },
            }

            const newState = store.reduce(state, new RouteRequestFailed(routingArgs, 'message'))

            expect(newState.currentRequest.subRequests[0].state).toEqual(RequestState.FAILED)
        })
    })
})

function getQueryPoint(id: number): QueryPoint {
    return {
        type: QueryPointType.From,
        isInitialized: true,
        queryText: '',
        streetName: '',
        color: '',
        coordinate: { lat: 0, lng: 0 },
        id: id,
    }
}

function isCleared(point: QueryPoint) {
    return !point.isInitialized && point.queryText === '' && point.coordinate.lat === 0 && point.coordinate.lng === 0
}

function isCorrectType(point: QueryPoint, index: number, length: number) {
    if (index === 0 && point.type === QueryPointType.From) return true
    if (index === length - 1 && point.type === QueryPointType.To) return true
    return point.type === QueryPointType.Via
}
