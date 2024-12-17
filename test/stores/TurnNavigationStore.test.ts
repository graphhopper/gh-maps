import Dispatcher from '@/stores/Dispatcher'
import {
    LocationUpdate,
    SetCustomModel,
    SetCustomModelEnabled,
    SetSelectedPath,
    SetVehicleProfile,
    TurnNavigationReroutingTimeResetForTest,
    TurnNavigationSettingsUpdate,
} from '@/actions/Actions'
import TurnNavigationStore, { MapCoordinateSystem, TNSettingsState } from '@/stores/TurnNavigationStore'
import { SpeechSynthesizer } from '@/SpeechSynthesizer'
import {
    ApiInfo,
    Bbox,
    GeocodingResult,
    RawResult,
    ReverseGeocodingHit,
    RoutingArgs,
    RoutingResult,
    TagHash,
} from '@/api/graphhopper'
import Api, { ApiImpl } from '@/api/Api'
import { setTranslation } from '@/translation/Translation'
import { Coordinate } from '@/stores/QueryStore'
import { Pixel } from 'ol/pixel'
import SettingsStore from '@/stores/SettingsStore'
import { POIQuery } from '@/pois/AddressParseResult'

let routeWithVia = toRoutingResult(require('../turnNavigation/response-hoyerswerda2.json'))
let reroute1 = toRoutingResult(require('../turnNavigation/reroute1.json'))
let routeWithSimpleVia = toRoutingResult(require('../turnNavigation/routeWithSimpleVia.json'))
let reroute2 = toRoutingResult(require('../turnNavigation/reroute2.json'))

let announceBug = toRoutingResult(require('../turnNavigation/announce-bug-original.json'))
let announceBugReroute = toRoutingResult(require('../turnNavigation/announce-bug-reroute.json'))

let loopBug = toRoutingResult(require('../turnNavigation/loop-bug.json'))

function toRoutingResult(rawResult: RawResult): RoutingResult {
    return {
        ...rawResult,
        paths: ApiImpl.decodeResult(rawResult, true),
    }
}

describe('TurnNavigationStore', () => {
    beforeAll(() => {
        setTranslation('en')
    })

    afterEach(() => {
        Dispatcher.clear()
    })

    describe('geo method', () => {
        it('skip waypoint', () => {
            // close enough
            expect(
                TurnNavigationStore.skipWaypoint(49, {} as Coordinate, {} as Coordinate, {} as Coordinate)
            ).toBeTruthy()

            // state and action coordinate are both not close enough but indicate passing waypoint
            expect(
                TurnNavigationStore.skipWaypoint(
                    58,
                    { lng: 14.081976, lat: 51.420467 },
                    { lng: 14.082183, lat: 51.420978 },
                    { lng: 14.081711, lat: 51.419924 }
                )
            ).toBeTruthy()

            // https://graphhopper.com/maps/?point=51.421294%2C14.08236&point=51.420467%2C14.081976&point=51.420814%2C14.083116
            // not close enough and no passing
            expect(
                TurnNavigationStore.skipWaypoint(
                    110,
                    { lng: 14.081976, lat: 51.420467 },
                    { lng: 14.08236, lat: 51.421294 },
                    { lng: 14.083116, lat: 51.420814 }
                )
            ).toBeFalsy()

            // https://graphhopper.com/maps/?point=51.420978%2C14.082183&point=51.420467%2C14.081976&point=51.419894%2C14.082424
            // not close enough but roughly passing
            expect(
                TurnNavigationStore.skipWaypoint(
                    58,
                    { lng: 14.081976, lat: 51.420467 },
                    { lng: 14.082183, lat: 51.420978 },
                    { lng: 14.082424, lat: 51.419894 }
                )
            ).toBeTruthy()

            // https://graphhopper.com/maps/?point=51.418877%2C14.07319&point=51.419021%2C14.073986&point=51.418791%2C14.074043
            // not close enough but typical situation of passing by
            expect(
                TurnNavigationStore.skipWaypoint(
                    72,
                    { lng: 14.073986, lat: 51.419021 },
                    { lng: 14.07319, lat: 51.418877 },
                    { lng: 14.074043, lat: 51.418791 }
                )
            ).toBeTruthy()

            // https://graphhopper.com/maps/?point=51.418877%2C14.07319&point=51.419593%2C14.074243&point=51.418791%2C14.074043
            // same situation but too far away from waypoint
            expect(
                TurnNavigationStore.skipWaypoint(
                    72,
                    { lng: 14.074243, lat: 51.419593 },
                    { lng: 14.07319, lat: 51.418877 },
                    { lng: 14.074043, lat: 51.418791 }
                )
            ).toBeFalsy()
        })
    })

    describe('path state handling', () => {
        it('should set path', () => {
            const store = createStore(new LocalApi())
            Dispatcher.dispatch(new SetSelectedPath(reroute1.paths[0]))
            expect(store.state.initialPath).toEqual(reroute1.paths[0])
        })

        it('should reroute', async () => {
            // TODO are these ugly numbers like 00000000001 from server-side snapped_waypoints array?
            const api = new LocalApi()
            api.setRerouteData(reroute1, [
                [14.267238, 51.43475],
                [14.26724, 51.43253],
            ])
            const speech = new DummySpeech()
            const store = createStore(api, speech)
            Dispatcher.dispatch(new SetSelectedPath(reroute1.paths[0]))
            Dispatcher.dispatch(new LocationUpdate({ lng: 14.268908, lat: 51.434871 }, true, 10, 120))
            expect(store.state.speed).toEqual(10)
            expect(store.state.activePath).toEqual(reroute1.paths[0])
            expect(store.state.instruction.index).toEqual(1)

            Dispatcher.dispatch(new TurnNavigationSettingsUpdate({ soundEnabled: true } as TNSettingsState))

            // no rerouting without profile
            Dispatcher.dispatch(new LocationUpdate({ lng: 14.266328, lat: 51.434653 }, true, 12, 120))
            expect(store.state.speed).toEqual(12)
            expect(store.state.rerouteInProgress).toBeFalsy()

            Dispatcher.dispatch(new SetVehicleProfile({ name: 'car' }))
            Dispatcher.dispatch(new LocationUpdate({ lng: 14.267238, lat: 51.43475 }, true, 12, 120))
            expect(store.state.speed).toEqual(12)
            expect(store.state.rerouteInProgress).toBeTruthy()
            await flushPromises()
            expect(store.state.rerouteInProgress).toBeFalsy()
            expect(speech.getTexts()).toEqual(['reroute'])

            expect(store.state.activePath).toEqual(reroute1.paths[0])
            expect(store.state.instruction.index).toEqual(1)

            // avoid too frequent rerouting
            Dispatcher.dispatch(new LocationUpdate({ lng: 14.266328, lat: 51.434653 }, true, 10, 120))
            expect(store.state.speed).toEqual(10)
            expect(store.state.rerouteInProgress).toBeFalsy()

            api.setRerouteData(reroute1, [
                [14.266328, 51.434653],
                [14.26724, 51.43253],
            ])
            Dispatcher.dispatch(new TurnNavigationReroutingTimeResetForTest()) // skip waiting 10 seconds
            Dispatcher.dispatch(new LocationUpdate({ lng: 14.266328, lat: 51.434653 }, true, 12, 120))
            expect(store.state.speed).toEqual(12)
            expect(store.state.rerouteInProgress).toBeTruthy()
            await flushPromises()
            expect(store.state.rerouteInProgress).toBeFalsy()
        })

        it('should reroute with via point', async () => {
            const rerouteWaypoints = [
                [14.269289, 51.434764],
                [14.26725, 51.43253],
            ] as [number, number][]
            const store = createStore(new LocalApi().setRerouteData(reroute1, rerouteWaypoints))
            Dispatcher.dispatch(new SetSelectedPath(routeWithVia.paths[0]))
            Dispatcher.dispatch(new SetVehicleProfile({ name: 'car' }))
            Dispatcher.dispatch(new LocationUpdate({ lng: 14.266959, lat: 51.435051 }, true, 10, 120))
            expect(store.state.speed).toEqual(10)
            expect(store.state.instruction.index).toEqual(1)
            expect(store.state.activePath).toEqual(routeWithVia.paths[0])

            // close to via point it should force rerouting to avoid potential interferences with overlapping edges
            Dispatcher.dispatch(new LocationUpdate({ lng: 14.269289, lat: 51.434764 }, true, 12, 70))
            expect(store.state.speed).toEqual(12)

            expect(store.state.rerouteInProgress).toBeTruthy()
            await flushPromises()
            expect(store.state.rerouteInProgress).toBeFalsy()

            expect(store.state.activePath?.distance).toEqual(reroute1.paths[0].distance)
            expect(store.state.instruction.index).toEqual(1)
        })

        it('should reroute with via point passing by', async () => {
            const rerouteWaypoints = [
                [14.271099, 51.435433],
                [14.26724, 51.43253],
            ] as [number, number][]
            const store = createStore(new LocalApi().setRerouteData(reroute1, rerouteWaypoints))
            Dispatcher.dispatch(new SetSelectedPath(routeWithSimpleVia.paths[0]))
            Dispatcher.dispatch(new SetVehicleProfile({ name: 'car' }))
            Dispatcher.dispatch(new LocationUpdate({ lng: 14.2727, lat: 51.436269 }, true, 10, 120))
            expect(store.state.activePath).toEqual(routeWithSimpleVia.paths[0])

            // close to middle waypoint but not within 50m
            Dispatcher.dispatch(new LocationUpdate({ lng: 14.27109, lat: 51.435472 }, true, 12, 70))
            expect(store.state.speed).toEqual(12)

            // close to middle waypoint but again not within 50m but still rerouting as skipWaypoint was true
            Dispatcher.dispatch(new LocationUpdate({ lng: 14.271099, lat: 51.435433 }, true, 14, 70))
            expect(store.state.speed).toEqual(14)

            expect(store.state.rerouteInProgress).toBeTruthy()
            await flushPromises()
            expect(store.state.rerouteInProgress).toBeFalsy()

            expect(store.state.activePath?.distance).toEqual(reroute1.paths[0].distance)
            expect(store.state.instruction.index).toEqual(1)
        })

        it('reroute and fetch next destination from initialPath', async () => {
            const rerouteWaypoints = [
                [14.273946, 51.436422],
                [14.27026, 51.43514],
                [14.26724, 51.43253],
            ] as [number, number][]
            const api = new LocalApi()
            api.setRerouteData(reroute2, rerouteWaypoints)
            const speech = new DummySpeech()
            const store = createStore(api, speech)
            Dispatcher.dispatch(new SetSelectedPath(routeWithSimpleVia.paths[0]))
            Dispatcher.dispatch(new SetVehicleProfile({ name: 'car' }))
            Dispatcher.dispatch(new TurnNavigationSettingsUpdate({ soundEnabled: true } as TNSettingsState))
            Dispatcher.dispatch(new LocationUpdate({ lng: 14.2727, lat: 51.436269 }, true, 10, 120))
            expect(store.state.activePath).toEqual(routeWithSimpleVia.paths[0])
            expect(speech.getTexts()).toEqual(['Turn right onto Franz-Liszt-Straße'])

            // force reroute
            Dispatcher.dispatch(new LocationUpdate({ lng: 14.273946, lat: 51.436422 }, true, 12, 70))
            expect(store.state.speed).toEqual(12)
            expect(store.state.rerouteInProgress).toBeTruthy()
            await flushPromises()
            expect(store.state.rerouteInProgress).toBeFalsy()
            expect(store.state.activePath).toEqual(reroute2.paths[0])

            // reroute from initialPath
            const newWaypoints = [
                [14.270589, 51.435272],
                [14.26724, 51.43253],
            ] as [number, number][]
            api.setRerouteData(reroute1, newWaypoints)
            Dispatcher.dispatch(new LocationUpdate({ lng: 14.270589, lat: 51.435272 }, true, 16, 70))
            expect(store.state.speed).toEqual(16)

            expect(store.state.rerouteInProgress).toBeTruthy()
            await flushPromises()
            expect(store.state.rerouteInProgress).toBeFalsy()
            expect(store.state.activePath).toEqual(reroute1.paths[0])
            expect(store.state.instruction.index).toEqual(1)
        })

        it('should reroute with custom model', async () => {
            const customModelStr =
                '{"distance_influence": 60, "speed":[{ "if": "road_class == PRIMARY", "multiply_by": "0.9"}]}'
            const api = new LocalApi()
            api.setRerouteData(reroute1, [
                [14.267238, 51.43475],
                [14.26724, 51.43253],
            ])
            const store = createStore(api)
            Dispatcher.dispatch(new SetCustomModel(customModelStr, false))
            Dispatcher.dispatch(new SetCustomModelEnabled(true))
            Dispatcher.dispatch(new SetSelectedPath(reroute1.paths[0]))
            Dispatcher.dispatch(new LocationUpdate({ lng: 14.268908, lat: 51.434871 }, true, 10, 120))
            expect(store.state.customModelStr).toEqual(customModelStr)
            expect(store.state.speed).toEqual(10)
            expect(store.state.activePath).toEqual(reroute1.paths[0])
            expect(store.state.instruction.index).toEqual(1)

            Dispatcher.dispatch(new SetVehicleProfile({ name: 'car' }))
            Dispatcher.dispatch(new LocationUpdate({ lng: 14.267238, lat: 51.43475 }, true, 12, 120))
            expect(store.state.customModelStr).toEqual(customModelStr)
            expect(store.state.speed).toEqual(12)
            expect(store.state.rerouteInProgress).toBeTruthy()
            await flushPromises()
            expect(store.state.rerouteInProgress).toBeFalsy()

            expect(store.state.customModelStr).toEqual(customModelStr)
            expect(store.state.activePath).toEqual(reroute1.paths[0])
            expect(store.state.instruction.index).toEqual(1)
        })

        it('should reroute and announce turn instruction close to junction', async () => {
            const api = new LocalApi()
            const speech = new DummySpeech()
            const store = createStore(api, speech)
            Dispatcher.dispatch(new SetVehicleProfile({ name: 'car' }))
            Dispatcher.dispatch(new SetSelectedPath(announceBug.paths[0]))
            Dispatcher.dispatch(new TurnNavigationSettingsUpdate({ soundEnabled: true } as TNSettingsState))
            Dispatcher.dispatch(new LocationUpdate({ lng: 14.191677, lat: 51.432878 }, true, 16, 70))
            expect(store.state.activePath).toEqual(announceBug.paths[0])

            api.setRerouteData(announceBugReroute, [
                [14.190732, 51.431834],
                [14.19315, 51.43121],
            ])
            Dispatcher.dispatch(new LocationUpdate({ lng: 14.190732, lat: 51.431834 }, true, 10, 120))
            expect(store.state.rerouteInProgress).toBeTruthy()
            await flushPromises()
            expect(store.state.rerouteInProgress).toBeFalsy()
            expect(store.state.activePath).toEqual(announceBugReroute.paths[0])
            expect(store.state.instruction.index).toEqual(1)

            // the first LocationUpdate was "used" to force the re-routing -> we need another LocationUpdate
            Dispatcher.dispatch(new LocationUpdate({ lng: 14.190732, lat: 51.431834 }, true, 10, 120))

            expect(speech.getTexts()).toEqual(['Links halten', 'reroute', 'Scharf links abbiegen'])
        })

        it('do not announce too old instruction for loops', async () => {
            const api = new LocalApi()
            const speech = new DummySpeech()
            const store = createStore(api, speech)
            Dispatcher.dispatch(new SetVehicleProfile({ name: 'car' }))
            Dispatcher.dispatch(new SetSelectedPath(loopBug.paths[0]))
            Dispatcher.dispatch(new TurnNavigationSettingsUpdate({ soundEnabled: true } as TNSettingsState))
            Dispatcher.dispatch(new LocationUpdate({ lng: 11.97108, lat: 50.352875 }, true, 16, 135))
            expect(store.state.activePath).toEqual(loopBug.paths[0])
            Dispatcher.dispatch(new LocationUpdate({ lng: 11.972844, lat: 50.350855 }, true, 16, 180))

            // GPS location is closer to incorrect (underlying) motorway than to bridge.
            // Due to heading prefer the slightly more distant bridge
            Dispatcher.dispatch(new LocationUpdate({ lng: 11.972071, lat: 50.351871 }, true, 16, 45))

            expect(speech.getTexts()).toEqual([
                'Keep right and take B 173 toward Hof-Zentrum, Feilitzsch, Trogen',
                'Turn right onto B 173',
                'Arrive at destination',
            ])
        })

        it('do not announce future instruction for loops', async () => {
            const api = new LocalApi()
            const speech = new DummySpeech()
            const store = createStore(api, speech)
            Dispatcher.dispatch(new SetVehicleProfile({ name: 'car' }))
            Dispatcher.dispatch(new SetSelectedPath(loopBug.paths[0]))
            Dispatcher.dispatch(new TurnNavigationSettingsUpdate({ soundEnabled: true } as TNSettingsState))
            Dispatcher.dispatch(new LocationUpdate({ lng: 11.97108, lat: 50.352875 }, true, 16, 135))
            expect(store.state.activePath).toEqual(loopBug.paths[0])

            // GPS location is closer to bridge than to correct motorway -> with heading still enforces motorway
            Dispatcher.dispatch(new LocationUpdate({ lng: 11.97213, lat: 50.351902 }, true, 16, 135))
            // trigger announcements to turn right
            Dispatcher.dispatch(new LocationUpdate({ lng: 11.972865, lat: 50.350855 }, true, 16, 180))

            expect(speech.getTexts()).toEqual([
                'Keep right and take B 173 toward Hof-Zentrum, Feilitzsch, Trogen',
                'Turn right onto B 173',
            ])
        })
    })

    function createStore(api: Api, speech = new DummySpeech()) {
        const store = new TurnNavigationStore(api, speech, new DummyCS(), 0, '', new SettingsStore(), '')
        Dispatcher.register(store)
        return store
    }

    class DummySpeech implements SpeechSynthesizer {
        private texts: string[] = []

        synthesize(text: string, offline = true) {
            this.texts.push(text)
        }

        getTexts() {
            return this.texts
        }

        clear() {
            this.texts = []
        }
    }

    class DummyCS implements MapCoordinateSystem {
        getCoordinateFromPixel(pixel: Pixel): number[] {
            return [0, 0]
        }
    }

    class LocalApi implements Api {
        private resultOnReroute?: RoutingResult
        private waypointsInQuery?: [number, number][]

        setRerouteData(resultOnReroute: RoutingResult, waypointsInQuery: [number, number][]): Api {
            this.resultOnReroute = resultOnReroute
            this.waypointsInQuery = waypointsInQuery
            return this
        }

        route(args: RoutingArgs): Promise<RoutingResult> {
            if (this.waypointsInQuery) expect(args.points).toEqual(this.waypointsInQuery)
            if (!this.resultOnReroute) throw Error('no result on reroute defined')
            return Promise.resolve(this.resultOnReroute)
        }

        geocode(query: string): Promise<GeocodingResult> {
            return Promise.resolve({
                took: 0,
                hits: [],
            })
        }

        reverseGeocode(query: POIQuery, bbox: Bbox): Promise<ReverseGeocodingHit[]> {
            return Promise.resolve([])
        }

        supportsGeocoding(): boolean {
            return false
        }

        info(): Promise<ApiInfo> {
            return Promise.resolve({
                bbox: [0, 0, 0, 0],
                elevation: false,
                version: '',
                import_date: '',
                profiles: [],
                encoded_values: [],
            })
        }

        infoWithDispatch(): void {}

        routeWithDispatch(args: RoutingArgs): void {}
    }
})

async function flushPromises() {
    const flush = () => new Promise(setImmediatePolyfill)
    await flush()
}

function setImmediatePolyfill(callback: any) {
    return setTimeout(callback, 0)
}
