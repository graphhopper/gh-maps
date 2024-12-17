import Store from '@/stores/Store'
import { Action } from '@/stores/Dispatcher'
import {
    MapIsLoaded,
    SelectMapLayer,
    ToggleExternalMVTLayer,
    ToggleRoutingGraph,
    ToggleUrbanDensityLayer,
} from '@/actions/Actions'
import config from 'config'

const osApiKey = config.keys.omniscale
const mapTilerKey = config.keys.maptiler
const thunderforestApiKey = config.keys.thunderforest
const kurvigerApiKey = config.keys.kurviger

const osmAttribution =
    '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'

export interface MapOptionsStoreState {
    styleOptions: StyleOption[]
    selectedStyle: StyleOption
    isMapLoaded: boolean
    routingGraphEnabled: boolean
    urbanDensityEnabled: boolean
    externalMVTEnabled: boolean
}

export interface StyleOption {
    name: string
    type: 'raster' | 'vector'
    url: string[] | string
    attribution: string
    maxZoom?: number
}

export interface RasterStyle extends StyleOption {
    type: 'raster'
    url: string[]
    tilePixelRatio?: number
}

export interface VectorStyle extends StyleOption {
    type: 'vector'
    url: string
}

const mediaQuery =
    '(-webkit-min-device-pixel-ratio: 1.5),(min--moz-device-pixel-ratio: 1.5),(-o-min-device-pixel-ratio: 3/2),(min-resolution: 1.5dppx)'
const isRetina = window.devicePixelRatio > 1 || (window.matchMedia && window.matchMedia(mediaQuery).matches)
const tilePixelRatio = isRetina ? 2 : 1
const retina2x = isRetina ? '@2x' : ''

const mapTilerSatellite: VectorStyle = {
    name: 'MapTiler Satellite',
    type: 'vector',
    url: 'https://api.maptiler.com/maps/hybrid/style.json?key=' + mapTilerKey,
    attribution: osmAttribution + ', &copy; <a href="https://www.maptiler.com/copyright/" target="_blank">MapTiler</a>',
}
const osmOrg: RasterStyle = {
    name: 'OpenStreetMap',
    type: 'raster',
    url: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
    attribution: osmAttribution,
    maxZoom: 19,
}
const osmCycl: RasterStyle = {
    name: 'Cyclosm',
    type: 'raster',
    url: [
        'https://a.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
        'https://b.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
        'https://c.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
    ],
    attribution:
        osmAttribution +
        ', &copy; <a href="https://github.com/cyclosm/cyclosm-cartocss-style/releases" target="_blank">CyclOSM</a>',
    maxZoom: 19,
}

const omniscale: RasterStyle = {
    name: 'Omniscale',
    type: 'raster',
    url: [
        'https://maps.omniscale.net/v2/' + osApiKey + '/style.default/{z}/{x}/{y}.png' + (isRetina ? '?hq=true' : ''),
    ],
    attribution: osmAttribution + ', &copy; <a href="https://maps.omniscale.com/" target="_blank">Omniscale</a>',
    tilePixelRatio: tilePixelRatio,
}
const esriSatellite: RasterStyle = {
    name: 'Esri Satellite',
    type: 'raster',
    url: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    attribution:
        '&copy; <a href="http://www.esri.com/" target="_blank">Esri</a>' +
        ' i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 18,
}
const tfTransport: RasterStyle = {
    name: 'TF Transport',
    type: 'raster',
    url: [
        'https://a.tile.thunderforest.com/transport/{z}/{x}/{y}' + retina2x + '.png?apikey=' + thunderforestApiKey,
        'https://b.tile.thunderforest.com/transport/{z}/{x}/{y}' + retina2x + '.png?apikey=' + thunderforestApiKey,
        'https://c.tile.thunderforest.com/transport/{z}/{x}/{y}' + retina2x + '.png?apikey=' + thunderforestApiKey,
    ],
    attribution:
        osmAttribution +
        ', <a href="https://www.thunderforest.com/maps/transport/" target="_blank">Thunderforest Transport</a>',
    tilePixelRatio: tilePixelRatio,
}
const tfCycle: RasterStyle = {
    name: 'TF Cycle',
    type: 'raster',
    url: [
        'https://a.tile.thunderforest.com/cycle/{z}/{x}/{y}' + retina2x + '.png?apikey=' + thunderforestApiKey,
        'https://b.tile.thunderforest.com/cycle/{z}/{x}/{y}' + retina2x + '.png?apikey=' + thunderforestApiKey,
        'https://c.tile.thunderforest.com/cycle/{z}/{x}/{y}' + retina2x + '.png?apikey=' + thunderforestApiKey,
    ],
    attribution:
        osmAttribution +
        ', <a href="https://www.thunderforest.com/maps/opencyclemap/" target="_blank">Thunderforest Cycle</a>',
    tilePixelRatio: tilePixelRatio,
}
const tfOutdoors: RasterStyle = {
    name: 'TF Outdoors',
    type: 'raster',
    url: [
        'https://a.tile.thunderforest.com/outdoors/{z}/{x}/{y}' + retina2x + '.png?apikey=' + thunderforestApiKey,
        'https://b.tile.thunderforest.com/outdoors/{z}/{x}/{y}' + retina2x + '.png?apikey=' + thunderforestApiKey,
        'https://c.tile.thunderforest.com/outdoors/{z}/{x}/{y}' + retina2x + '.png?apikey=' + thunderforestApiKey,
    ],
    attribution:
        osmAttribution +
        ', <a href="https://www.thunderforest.com/maps/outdoors/" target="_blank">Thunderforest Outdoors</a>',
    tilePixelRatio: tilePixelRatio,
}
const path = '/raster/styles/kurviger-liberty/{z}/{x}/{y}' + retina2x + '.png?key=' + kurvigerApiKey
const kurviger: RasterStyle = {
    name: 'Kurviger Liberty',
    type: 'raster',
    url: [
        'https://a-tiles.mapilion.com' + path,
        'https://b-tiles.mapilion.com' + path,
        'https://c-tiles.mapilion.com' + path,
        'https://d-tiles.mapilion.com' + path,
        'https://e-tiles.mapilion.com' + path,
    ],
    attribution:
        osmAttribution +
        ',&copy; <a href="https://kurviger.de/" target="_blank">Kurviger</a> &copy; <a href="https://mapilion.com/attribution" target="_blank">Mapilion</a> <a href="http://www.openmaptiles.org/" target="_blank">&copy; OpenMapTiles</a>',
    maxZoom: 22,
    tilePixelRatio: tilePixelRatio,
}
const mapillion: VectorStyle = {
    name: 'Mapilion',
    type: 'vector',
    url: 'https://tiles.mapilion.com/assets/osm-bright/style.json?key=' + kurvigerApiKey,
    attribution:
        osmAttribution +
        ', &copy; <a href="https://mapilion.com/attribution" target="_blank">Mapilion</a> <a href="http://www.openmaptiles.org/" target="_blank">&copy; OpenMapTiles</a>',
}
const lyrk: RasterStyle = {
    name: 'Lyrk',
    type: 'raster',
    url: ['https://tiles.lyrk.org/lr/{z}/{x}/{y}?apikey=6e8cfef737a140e2a58c8122aaa26077'],
    attribution: osmAttribution + ', <a href="https://geodienste.lyrk.de/">Lyrk</a>',
    maxZoom: 15,
}
const wanderreitkarte: RasterStyle = {
    name: 'WanderReitKarte',
    type: 'raster',
    url: [
        'https://topo.wanderreitkarte.de/topo/{z}/{x}/{y}.png',
        'https://topo2.wanderreitkarte.de/topo/{z}/{x}/{y}.png',
        'https://topo3.wanderreitkarte.de/topo/{z}/{x}/{y}.png',
        'https://topo4.wanderreitkarte.de/topo/{z}/{x}/{y}.png',
    ],
    attribution: osmAttribution + ', <a href="https://wanderreitkarte.de" target="_blank">WanderReitKarte</a>',
    maxZoom: 18,
}

const styleOptions: StyleOption[] = [
    // omniscale,
    osmOrg,
    osmCycl,
    esriSatellite,
    // mapTilerSatellite,
    tfTransport,
    tfCycle,
    tfOutdoors,
    // kurviger,
    mapillion,
    // lyrk,
    // wanderreitkarte,
]

export default class MapOptionsStore extends Store<MapOptionsStoreState> {
    constructor() {
        super(MapOptionsStore.getInitialState())
    }

    private static getInitialState(): MapOptionsStoreState {
        const selectedStyle = styleOptions.find(s => s.name === config.defaultTiles)
        if (!selectedStyle)
            console.warn(
                `Could not find tile layer specified in config: '${config.defaultTiles}', using default instead`
            )
        return {
            selectedStyle: selectedStyle ? selectedStyle : omniscale,
            styleOptions,
            routingGraphEnabled: false,
            urbanDensityEnabled: false,
            externalMVTEnabled: false,
            isMapLoaded: false,
        }
    }

    reduce(state: MapOptionsStoreState, action: Action): MapOptionsStoreState {
        if (action instanceof SelectMapLayer) {
            const styleOption = state.styleOptions.find(o => o.name === action.layer)
            if (styleOption)
                return {
                    ...state,
                    selectedStyle: styleOption,
                }
        } else if (action instanceof ToggleRoutingGraph) {
            return {
                ...state,
                routingGraphEnabled: action.routingGraphEnabled,
            }
        } else if (action instanceof ToggleUrbanDensityLayer) {
            return {
                ...state,
                urbanDensityEnabled: action.urbanDensityEnabled,
            }
        } else if (action instanceof ToggleExternalMVTLayer) {
            return {
                ...state,
                externalMVTEnabled: action.externalMVTLayerEnabled,
            }
        } else if (action instanceof MapIsLoaded) {
            return {
                ...state,
                isMapLoaded: true,
            }
        }
        return state
    }
}
