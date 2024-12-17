import NavBar from '@/NavBar'
import QueryStore, { QueryPoint, QueryPointType } from '@/stores/QueryStore'
import DummyApi from './DummyApi'
import { SelectMapLayer, SetPoint, SetVehicleProfile } from '@/actions/Actions'
import Dispatcher from '@/stores/Dispatcher'
import { coordinateToText } from '@/Converters'

// import the window and mock it with jest
import { window } from '@/Window'
import MapOptionsStore from '@/stores/MapOptionsStore'
import * as config from 'config'
import { RoutingProfile } from '@/api/graphhopper'

jest.mock('@/Window', () => ({
    window: {
        location: {
            origin: 'https://current.origin',
            pathname: '/',
        },
        history: {
            pushState: jest.fn(),
            replaceState: jest.fn(),
        },
        addEventListener: jest.fn(),
    },
}))

describe('NavBar', function () {
    let queryStore: QueryStore
    let mapStore: MapOptionsStore
    let navBar: NavBar
    let callbacks: { (type: string): void }[]

    beforeEach(() => {
        // because we mock the global 'window' object, we also need to mock event listeners.
        // this must be done before 'new NavBar' is called below, since this subscribes as event listener
        callbacks = []
        window.addEventListener = jest.fn((type: any, listener: any) => {
            callbacks.push(listener)
        })
        queryStore = new QueryStore(new DummyApi())
        mapStore = new MapOptionsStore()
        navBar = new NavBar(queryStore, mapStore)
        navBar.startSyncingUrlWithAppState()
        Dispatcher.register(queryStore)
        Dispatcher.register(mapStore)
    })

    afterEach(() => {
        jest.resetAllMocks()
        Dispatcher.clear()
    })

    describe('state to url', () => {
        it('should convert query store state into url params on change', function () {
            const coordinates = [
                { lat: 1, lng: 2 },
                { lat: 10, lng: 10 },
            ]
            const points = coordinates.map((c, i) => {
                return {
                    ...queryStore.state.queryPoints[i],
                    coordinate: c,
                    queryText: coordinateToText(c),
                    isInitialized: true,
                }
            })

            testCreateUrl(points, { name: 'my-profile' }, 'Mapilion')
        })

        it('should convert query store state into url params on change including addresses', () => {
            const points = [
                { lat: 1, lng: 2, text: 'som3, address with ! some, characters-in it' },
                { lat: 10, lng: 10, text: 'some_?more>characters' },
            ].map((point, i) => {
                return {
                    ...queryStore.state.queryPoints[i],
                    coordinate: { lat: point.lat, lng: point.lng },
                    queryText: point.text,
                    isInitialized: true,
                }
            })

            testCreateUrl(points, { name: 'my-profile' }, 'Mapilion')
        })

        function testCreateUrl(points: QueryPoint[], profile: RoutingProfile, layer: string) {
            // build url which we expect at the end
            const expectedUrl = new URL(window.location.origin + window.location.pathname)
            for (const point of points) {
                const coordinate = coordinateToText(point.coordinate)
                const param = coordinate === point.queryText ? coordinate : coordinate + '_' + point.queryText
                expectedUrl.searchParams.append('point', param)
            }
            expectedUrl.searchParams.append('profile', profile.name)
            expectedUrl.searchParams.append('layer', layer)

            // modify state of stores which the nav bar depends on
            for (const point of points) {
                queryStore.receive(new SetPoint(point, true))
            }
            queryStore.receive(new SetVehicleProfile(profile))
            mapStore.receive(new SelectMapLayer(layer))

            // make assertions
            // number of calls profile, style and how many points there are
            const numberOfCalls = 2 + points.length
            expect(window.history.pushState).toHaveBeenCalledTimes(numberOfCalls)
            expect(window.history.pushState).toHaveBeenNthCalledWith(numberOfCalls, null, '', expectedUrl.toString())
        }
    })

    describe('url to state', () => {
        it('should parse the url and create a new query state when triggered from outside', () => {
            // set up data
            const point: QueryPoint = {
                coordinate: { lat: 1, lng: 1 },
                id: 0,
                type: QueryPointType.To,
                isInitialized: false,
                queryText: 'some1address-with!/<symb0ls',
                color: '',
            }
            const profile = 'some-profile'
            const layer = 'OpenStreetMap'
            const url = new URL(window.location.origin + window.location.pathname)
            url.searchParams.append('point', coordinateToText(point.coordinate) + '_' + point.queryText)
            url.searchParams.append('profile', profile)
            url.searchParams.append('layer', layer)

            window.location = {
                ...window.location,
                href: url.toString(),
            }

            // act
            navBar.updateStateFromUrl()

            //assert
            expect(queryStore.state.queryPoints.length).toEqual(2)
            expect(queryStore.state.queryPoints[0].coordinate).toEqual(point.coordinate)
            expect(queryStore.state.queryPoints[0].isInitialized).toEqual(true)
            expect(queryStore.state.queryPoints[0].queryText).toEqual(point.queryText)
            expect(queryStore.state.queryPoints[1].coordinate).toEqual({ lat: 0, lng: 0 })
            expect(queryStore.state.queryPoints[1].isInitialized).toEqual(false)
            expect(queryStore.state.routingProfile.name).toEqual(profile)

            expect(mapStore.state.selectedStyle.name).toEqual(layer)

            // make sure the navbar doesn't change the window's location while parsing
            expect(url.toString()).toEqual(window.location.href)
        })

        it('should parse the url and set no points when no points are set', () => {
            window.location = {
                ...window.location,
                href: 'https://origin.com',
            }
            const point1 = queryStore.state.queryPoints[0]
            const point2 = queryStore.state.queryPoints[1]

            // act
            navBar.updateStateFromUrl()

            //assert
            // we still want to have 2 points and they should have the same values as before - the ids are changed though
            // since the store creates new instances of points regardless what is fed with "setallqyeryparamsatonce"
            expect(queryStore.state.queryPoints.length).toEqual(2)
            expect(queryStore.state.queryPoints[0].coordinate).toEqual(point1.coordinate)
            expect(queryStore.state.queryPoints[1].coordinate).toEqual(point2.coordinate)
            expect(queryStore.state.queryPoints[0].queryText).toEqual(point1.queryText)
            expect(queryStore.state.queryPoints[1].queryText).toEqual(point2.queryText)
        })

        it('should parse the url and only skip invalid points', () => {
            const expectedUrl = 'https://current.origin/?point=&point=11%2C12'
            window.location = { ...window.location, href: expectedUrl }

            // act
            navBar.updateStateFromUrl()

            //assert
            expect(queryStore.state.queryPoints.length).toEqual(2)
            expect(queryStore.state.queryPoints[0].isInitialized).toEqual(false)
            expect(queryStore.state.queryPoints[0].queryText).toEqual('')
            expect(queryStore.state.queryPoints[1].coordinate).toEqual({ lat: 11, lng: 12 })
            expect(queryStore.state.queryPoints[1].isInitialized).toEqual(true)

            // make sure the navbar doesn't change the window's location while parsing
            expect(expectedUrl).toEqual(window.location.href)
            expect(window.history.pushState).toHaveBeenCalledTimes(0)

            navBar.updateUrlFromState()
            expect(window.history.pushState).toHaveBeenNthCalledWith(
                1,
                null,
                '',
                expectedUrl + '&profile=&layer=OpenStreetMap'
            )
        })

        it('should parse the url and invalidate old points', () => {
            window.location = {
                ...window.location,
                href: 'https://origin.com',
            }
            Dispatcher.dispatch(
                new SetPoint(
                    {
                        ...queryStore.state.queryPoints[0],
                        isInitialized: true,
                    },
                    true
                )
            )

            //act
            navBar.updateStateFromUrl()

            // assert
            expect(queryStore.state.queryPoints.length).toEqual(2)
            expect(queryStore.state.queryPoints[0].isInitialized).toBeFalsy()
            expect(queryStore.state.queryPoints[1].isInitialized).toBeFalsy()
        })

        it('should parse the url and set defaults for layer if not provided', () => {
            window.location = {
                ...window.location,
                href: 'https://origin.com',
            }

            // act
            navBar.updateStateFromUrl()

            //assert
            expect(queryStore.state.queryPoints.length).toEqual(2)
            expect(queryStore.state.queryPoints[0].isInitialized).toEqual(false)
            expect(queryStore.state.queryPoints[1].isInitialized).toEqual(false)
            expect(queryStore.state.routingProfile.name).toEqual('')

            expect(mapStore.state.selectedStyle.name).toEqual(config.defaultTiles)
        })

        it('should parse the url and set defaults for profile if not set', () => {
            const layername = 'OpenStreetMap'
            const url = new URL(window.location.origin + window.location.pathname)
            url.searchParams.append('layer', layername)
            window.location = {
                ...window.location,
                href: url.toString(),
            }

            Dispatcher.dispatch(new SetVehicleProfile({ name: 'some-profile' }))
            const defaultProfile = queryStore.state.routingProfile

            // act
            navBar.updateStateFromUrl()

            //assert
            expect(queryStore.state.queryPoints.length).toEqual(2)
            expect(queryStore.state.queryPoints[0].isInitialized).toEqual(false)
            expect(queryStore.state.queryPoints[1].isInitialized).toEqual(false)
            expect(queryStore.state.routingProfile.name).toEqual(defaultProfile.name)
            expect(mapStore.state.selectedStyle.name).toEqual(layername)
        })

        it('should parse the url and set routing profile for legacy "vehicle" param', () => {
            const layername = 'OpenStreetMap'
            const profileName = 'some-profile-name'
            const url = new URL(window.location.origin + window.location.pathname)
            url.searchParams.append('layer', layername)
            url.searchParams.append('vehicle', profileName)

            window.location = {
                ...window.location,
                href: url.toString(),
            }

            // act
            navBar.updateStateFromUrl()

            // assert
            expect(queryStore.state.routingProfile.name).toEqual(profileName)
        })
    })

    it('should update the query store state on popstate (back-pressed)', () => {
        // set up data
        const point: QueryPoint = {
            coordinate: { lat: 1, lng: 1 },
            id: 0,
            type: QueryPointType.To,
            isInitialized: false,
            queryText: '',
            color: '',
        }
        const profile = 'some-profile'
        const layer = 'OpenStreetMap'
        const url = new URL(window.location.origin + window.location.pathname)
        url.searchParams.append('point', coordinateToText(point.coordinate))
        url.searchParams.append('profile', profile)
        url.searchParams.append('layer', layer)

        window.location = {
            ...window.location,
            href: url.toString(),
        }

        // act
        callbacks.forEach(callback => callback('popstate'))

        // assert
        expect(queryStore.state.queryPoints.length).toEqual(2)
        expect(queryStore.state.queryPoints[0].coordinate).toEqual(point.coordinate)
        expect(queryStore.state.queryPoints[0].isInitialized).toEqual(true)
        expect(queryStore.state.queryPoints[1].coordinate).toEqual({ lat: 0, lng: 0 })
        expect(queryStore.state.queryPoints[1].isInitialized).toEqual(false)
        expect(queryStore.state.routingProfile.name).toEqual(profile)

        expect(mapStore.state.selectedStyle.name).toEqual(layer)

        // make sure the navbar doesn't change the window's location while parsing
        expect(url.toString()).toEqual(window.location.href)
    })
})
