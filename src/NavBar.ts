import { coordinateToText } from '@/Converters'
import Dispatcher from '@/stores/Dispatcher'
import { ClearPoints, SelectMapLayer, SetBBox, SetPOIs, SetQueryPoints, SetVehicleProfile } from '@/actions/Actions'
// import the window like this so that it can be mocked during testing
import { window } from '@/Window'
import QueryStore, { getBBoxFromCoord, QueryPoint, QueryPointType, QueryStoreState } from '@/stores/QueryStore'
import MapOptionsStore, { MapOptionsStoreState } from './stores/MapOptionsStore'
import { ApiImpl, getApi } from '@/api/Api'
import { AddressParseResult } from '@/pois/AddressParseResult'
import { getQueryStore } from '@/stores/Stores'

export default class NavBar {
    private readonly queryStore: QueryStore
    private readonly mapStore: MapOptionsStore
    private ignoreStateUpdates = false

    constructor(queryStore: QueryStore, mapStore: MapOptionsStore) {
        this.queryStore = queryStore
        this.mapStore = mapStore
        window.addEventListener('popstate', async () => await this.updateStateFromUrl())
    }

    async startSyncingUrlWithAppState() {
        // our first history entry shall be the one that we end up with when the app loads for the first time
        window.history.replaceState(null, '', this.createUrlFromState())
        this.queryStore.register(() => this.updateUrlFromState())
        this.mapStore.register(() => this.updateUrlFromState())
    }

    private static createUrl(baseUrl: string, queryStoreState: QueryStoreState, mapState: MapOptionsStoreState) {
        const result = new URL(baseUrl)
        if (queryStoreState.queryPoints.filter(point => point.isInitialized).length > 0) {
            queryStoreState.queryPoints
                .map(point => (!point.isInitialized ? '' : NavBar.pointToParam(point)))
                .forEach(pointAsString => result.searchParams.append('point', pointAsString))
        }

        result.searchParams.append('profile', queryStoreState.routingProfile.name)
        result.searchParams.append('layer', mapState.selectedStyle.name)
        if (queryStoreState.customModelEnabled)
            result.searchParams.append('custom_model', queryStoreState.customModelStr.replace(/\s+/g, ''))

        return result
    }

    private static pointToParam(point: QueryPoint) {
        const coordinate = coordinateToText(point.coordinate)
        return coordinate === point.queryText ? coordinate : coordinate + '_' + point.queryText
    }

    private static parsePoints(url: URL): QueryPoint[] {
        return url.searchParams.getAll('point').map((parameter, idx) => {
            const split = parameter.split('_')

            const point = {
                coordinate: { lat: 0, lng: 0 },
                isInitialized: false,
                id: idx,
                queryText: parameter,
                streetName: '' /**/,
                color: '',
                type: QueryPointType.Via,
            }
            if (split.length >= 1)
                try {
                    point.coordinate = NavBar.parseCoordinate(split[0])
                    if (!Number.isNaN(point.coordinate.lat) && !Number.isNaN(point.coordinate.lng)) {
                        point.queryText = split.length >= 2 ? split[1] : coordinateToText(point.coordinate)
                        point.isInitialized = true
                    }
                } catch (e) {}

            return point
        })
    }

    private static parseCoordinate(params: string) {
        const coordinateParams = params.split(',')
        if (coordinateParams.length !== 2) throw Error('Could not parse coordinate with value: "' + params[0] + '"')
        return {
            lat: Number.parseFloat(coordinateParams[0]),
            lng: Number.parseFloat(coordinateParams[1]),
        }
    }

    private static parseProfile(url: URL): string {
        // we can cast to string since we test for presence before
        if (url.searchParams.has('profile')) return url.searchParams.get('profile') as string
        if (url.searchParams.has('vehicle')) return url.searchParams.get('vehicle') as string

        return ''
    }

    private static parseLayer(url: URL): string | null {
        return url.searchParams.get('layer')
    }

    async updateStateFromUrl() {
        // We update the state several times ourselves, but we don't want to push history entries for each dispatch.
        this.ignoreStateUpdates = true

        Dispatcher.dispatch(new ClearPoints())
        const url = new URL(window.location.href)

        const parsedProfileName = NavBar.parseProfile(url)
        if (parsedProfileName)
            // this won't trigger a route request because we just cleared the points
            Dispatcher.dispatch(new SetVehicleProfile({ name: parsedProfileName }))
        const parsedPoints = NavBar.parsePoints(url)

        // support legacy URLs without coordinates (not initialized) and only text, see #199
        if (parsedPoints.some(p => !p.isInitialized && p.queryText.length > 0)) {
            const promises = parsedPoints.map(p => {
                if (p.isInitialized) return Promise.resolve(p)
                const result = AddressParseResult.parse(p.queryText, false)
                if (result.hasPOIs() && result.location) {
                    // two stage POI search: 1. use extracted location to get coordinates 2. do reverse geocoding with this coordinates
                    return getApi()
                        .geocode(result.location, 'nominatim')
                        .then(res => {
                            if (res.hits.length == 0) return p
                            getApi()
                                .reverseGeocode(result.query, res.hits[0].extent)
                                .then(res => AddressParseResult.handleGeocodingResponse(res, result))
                            return p
                        })
                }
                return (
                    getApi()
                        .geocode(p.queryText, 'nominatim')
                        .then(res => {
                            if (res.hits.length == 0) return p
                            return {
                                ...p,
                                queryText: res.hits[0].name,
                                streetName: res.hits[0].street,
                                coordinate: { lat: res.hits[0].point.lat, lng: res.hits[0].point.lng },
                                isInitialized: true,
                            }
                        })
                        // if the geocoding request fails we just keep the point as it is, just as if no results were found
                        .catch(() => p)
                )
            })
            const points = await Promise.all(promises)
            NavBar.dispatchQueryPoints(points)
        } else {
            NavBar.dispatchQueryPoints(parsedPoints)
        }

        const parsedLayer = NavBar.parseLayer(url)
        if (parsedLayer) Dispatcher.dispatch(new SelectMapLayer(parsedLayer))

        this.ignoreStateUpdates = false
    }

    private static dispatchQueryPoints(points: QueryPoint[]) {
        // estimate map bounds from url points if there are any. this way we prevent loading tiles for the world view
        // only to zoom to the route shortly after
        const initializedPoints = points.filter(p => p.isInitialized)
        const bbox =
            initializedPoints.length == 1
                ? getBBoxFromCoord(initializedPoints[0].coordinate)
                : ApiImpl.getBBoxPoints(initializedPoints.map(p => p.coordinate))
        if (bbox) Dispatcher.dispatch(new SetBBox(bbox))
        return Dispatcher.dispatch(new SetQueryPoints(points))
    }

    public updateUrlFromState() {
        if (this.ignoreStateUpdates) return
        const newHref = this.createUrlFromState()
        if (newHref !== window.location.href) window.history.pushState(null, '', newHref)
    }

    private createUrlFromState() {
        return NavBar.createUrl(
            window.location.origin + window.location.pathname,
            this.queryStore.state,
            this.mapStore.state
        ).toString()
    }
}
