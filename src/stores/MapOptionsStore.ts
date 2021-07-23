import Store from '@/stores/Store'
import Dispatcher, { Action } from '@/stores/Dispatcher'
import { ErrorAction, MapIsLoaded, MapStylesReceived, SelectMapStyle } from '@/actions/Actions'
import config from 'config'

const osApiKey = config.keys.omniscale
const mapTilerKey = config.keys.maptiler
const thunderforestApiKey = config.keys.thunderforest
const kurvigerApiKey = config.keys.kurviger

const osmAttribution =
    '&copy; <a href="http://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'

export interface MapOptionsStoreState {
    mapStyles: MapboxStyle[]
    selectedMapStyle: MapboxStyle
    firstSymbolLayerId?: string
    isMapLoaded: boolean
}

export interface MapboxStyle {
    name: string
    style: {
        version: number
        sources: any
        layers: any[]
    }
}

/**
 * For vector styles we enter just a url pointing to the json file containing the style
 */
interface VectorStyleEntry {
    name: string
    styleUrl: string
    // todo: we do not use this so far and sometimes it is already included in the loaded style anyway
    attribution: string
}

/**
 * For raster styles we need the urls of the tile servers and create the style ourselves
 */
interface RasterStyleEntry {
    name: string
    tiles: string[]
    attribution: string
    maxZoom?: number
}

const mapTiler: VectorStyleEntry = {
    name: 'MapTiler',
    styleUrl: 'https://api.maptiler.com/maps/1f566542-c726-4cc5-8f2d-2309b90083db/style.json?key=' + mapTilerKey,
    attribution: osmAttribution + ', &copy; <a href="https://www.maptiler.com/copyright/" target="_blank">MapTiler</a>',
}
const mapTilerSatellite: VectorStyleEntry = {
    name: 'MapTiler Satellite',
    styleUrl: 'https://api.maptiler.com/maps/hybrid/style.json?key=' + mapTilerKey,
    attribution: osmAttribution + ', &copy; <a href="https://www.maptiler.com/copyright/" target="_blank">MapTiler</a>',
}
const osmOrg: RasterStyleEntry = {
    name: 'OpenStreetMap',
    tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
    ],
    attribution: osmAttribution,
}
const omniscale: RasterStyleEntry = {
    name: 'Omniscale',
    tiles: ['https://maps.omniscale.net/v2/' + osApiKey + '/style.default/{z}/{x}/{y}.png'],
    attribution: osmAttribution + ', &copy; <a href="https://maps.omniscale.com/" target="_blank">Omniscale</a>',
}
const esriSatellite: RasterStyleEntry = {
    name: 'Esri Satellite',
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    attribution:
        '&copy; <a href="http://www.esri.com/" target="_blank">Esri</a>' +
        ' i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 18,
}
const tfTransport: RasterStyleEntry = {
    name: 'TF Transport',
    tiles: [
        'https://a.tile.thunderforest.com/transport/{z}/{x}/{y}@2x.png?apikey=' + thunderforestApiKey,
        'https://b.tile.thunderforest.com/transport/{z}/{x}/{y}@2x.png?apikey=' + thunderforestApiKey,
        'https://c.tile.thunderforest.com/transport/{z}/{x}/{y}@2x.png?apikey=' + thunderforestApiKey,
    ],
    attribution:
        osmAttribution +
        ', <a href="https://www.thunderforest.com/maps/transport/" target="_blank">Thunderforest Transport</a>',
}
const tfCycle: RasterStyleEntry = {
    name: 'TF Cycle',
    tiles: [
        'https://a.tile.thunderforest.com/cycle/{z}/{x}/{y}@2x.png?apikey=' + thunderforestApiKey,
        'https://b.tile.thunderforest.com/cycle/{z}/{x}/{y}@2x.png?apikey=' + thunderforestApiKey,
        'https://c.tile.thunderforest.com/cycle/{z}/{x}/{y}@2x.png?apikey=' + thunderforestApiKey,
    ],
    attribution:
        osmAttribution +
        ', <a href="https://www.thunderforest.com/maps/opencyclemap/" target="_blank">Thunderforest Cycle</a>',
}
const tfOutdoors: RasterStyleEntry = {
    name: 'TF Outdoors',
    tiles: [
        'https://a.tile.thunderforest.com/outdoors/{z}/{x}/{y}@2x.png?apikey=' + thunderforestApiKey,
        'https://b.tile.thunderforest.com/outdoors/{z}/{x}/{y}@2x.png?apikey=' + thunderforestApiKey,
        'https://c.tile.thunderforest.com/outdoors/{z}/{x}/{y}@2x.png?apikey=' + thunderforestApiKey,
    ],
    attribution:
        osmAttribution +
        ', <a href="https://www.thunderforest.com/maps/outdoors/" target="_blank">Thunderforest Outdoors</a>',
}
const tfAtlas: RasterStyleEntry = {
    name: 'TF Atlas',
    tiles: [
        'https://a.tile.thunderforest.com/atlas/{z}/{x}/{y}@2x.png?apikey=' + thunderforestApiKey,
        'https://b.tile.thunderforest.com/atlas/{z}/{x}/{y}@2x.png?apikey=' + thunderforestApiKey,
        'https://c.tile.thunderforest.com/atlas/{z}/{x}/{y}@2x.png?apikey=' + thunderforestApiKey,
    ],
    attribution:
        osmAttribution + ', <a href="https://thunderforest.com/maps/atlas/" target="_blank">Thunderforest Atlas</a>',
}
const kurviger: RasterStyleEntry = {
    name: 'Kurviger Liberty',
    tiles: [
        'https://a-tiles.mapilion.com/raster/styles/kurviger-liberty/{z}/{x}/{y}@2x.png?key=' + kurvigerApiKey,
        'https://b-tiles.mapilion.com/raster/styles/kurviger-liberty/{z}/{x}/{y}@2x.png?key=' + kurvigerApiKey,
        'https://c-tiles.mapilion.com/raster/styles/kurviger-liberty/{z}/{x}/{y}@2x.png?key=' + kurvigerApiKey,
        'https://d-tiles.mapilion.com/raster/styles/kurviger-liberty/{z}/{x}/{y}@2x.png?key=' + kurvigerApiKey,
        'https://e-tiles.mapilion.com/raster/styles/kurviger-liberty/{z}/{x}/{y}@2x.png?key=' + kurvigerApiKey,
    ],
    attribution:
        osmAttribution +
        ',&copy; <a href="https://kurviger.de/" target="_blank">Kurviger</a> &copy; <a href="https://mapilion.com/attribution" target="_blank">Mapilion</a> <a href="http://www.openmaptiles.org/" target="_blank">&copy; OpenMapTiles</a>',
}
const mapillion: VectorStyleEntry = {
    name: 'Mapilion',
    styleUrl: 'https://tiles.mapilion.com/assets/osm-bright/style.json?key=' + kurvigerApiKey,
    attribution:
        osmAttribution +
        ', &copy; <a href="https://mapilion.com/attribution" target="_blank">Mapilion</a> <a href="http://www.openmaptiles.org/" target="_blank">&copy; OpenMapTiles</a>',
}
const osmDe: RasterStyleEntry = {
    name: 'OpenStreetmap.de',
    tiles: [
        'https://a.tile.openstreetmap.de/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.de/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.de/{z}/{x}/{y}.png',
    ],
    attribution: osmAttribution,
}
const lyrk: RasterStyleEntry = {
    name: 'Lyrk',
    tiles: ['https://tiles.lyrk.org/lr/{z}/{x}/{y}?apikey=6e8cfef737a140e2a58c8122aaa26077'],
    attribution: osmAttribution + ', <a href="https://geodienste.lyrk.de/">Lyrk</a>',
}
const wanderreitkarte: RasterStyleEntry = {
    name: 'WanderReitKarte',
    tiles: [
        'https://topo.wanderreitkarte.de/topo/{z}/{x}/{y}.png',
        'https://topo2.wanderreitkarte.de/topo/{z}/{x}/{y}.png',
        'https://topo3.wanderreitkarte.de/topo/{z}/{x}/{y}.png',
        'https://topo4.wanderreitkarte.de/topo/{z}/{x}/{y}.png',
    ],
    attribution: osmAttribution + ', <a href="https://wanderreitkarte.de" target="_blank">WanderReitKarte</a>',
}
const sorbian: RasterStyleEntry = {
    name: 'Sorbian Language',
    tiles: ['https://a.tile.openstreetmap.de/tilesbw/osmhrb/{z}/{x}/{y}.png'],
    attribution: osmAttribution + ', <a href="https://www.alberding.eu/">&copy; Alberding GmbH, CC-BY-SA</a>',
}

const mapBoxRasterStyles: MapboxStyle[] = [
    osmOrg,
    omniscale,
    esriSatellite,
    tfTransport,
    tfCycle,
    tfOutdoors,
    tfAtlas,
    kurviger,
    osmDe,
    // The original client has these but those options yield cors errors with mapbox yields a cors error
    // lyrk,
    // wanderreitkarte,
    // This works but is extremely slow with mapbox
    // sorbian
].map(entry => {
    return {
        name: entry.name,
        style: {
            version: 8,
            sources: {
                'raster-source': {
                    type: 'raster',
                    tiles: entry.tiles,
                    attribution: entry.attribution,
                    tileSize: 256,
                    maxzoom: entry.maxZoom ? entry.maxZoom : 22,
                },
            },
            layers: [
                {
                    id: 'raster-layer',
                    type: 'raster',
                    source: 'raster-source',
                },
            ],
        },
    }
})

export default class MapOptionsStore extends Store<MapOptionsStoreState> {
    loadStyles() {
        const entries = [mapTiler, mapTilerSatellite, mapillion]
        Promise.all(
            entries.map(entry => {
                return fetch(entry.styleUrl)
                    .then(res => res.json())
                    .then(style => {
                        return { name: entry.name, style: style }
                    })
                    .catch(_ => console.warn(`Could not load map style: ${entry.name}`))
            })
        )
            .then(vectorStyles => {
                // ignore vector styles that could not be loaded and add raster styles
                const mapStyles = vectorStyles.filter(style => !!style).concat(mapBoxRasterStyles) as MapboxStyle[]
                Dispatcher.dispatch(new MapStylesReceived(mapStyles))
            })
            .catch(e => Dispatcher.dispatch(new ErrorAction(e.message)))
    }

    protected getInitialState(): MapOptionsStoreState {
        return {
            mapStyles: [],
            selectedMapStyle: {
                name: '',
                style: {
                    version: 8,
                    sources: {},
                    layers: [],
                },
            },
            isMapLoaded: false,
        }
    }

    reduce(state: MapOptionsStoreState, action: Action): MapOptionsStoreState {
        if (action instanceof MapStylesReceived) {
            const mapStyles = action.mapStyles
            let selectedMapStyle = mapStyles.find(s => s.name === config.defaultTiles)
            if (!selectedMapStyle) {
                console.warn(
                    `Could not find tile layer specified in config: '${config.defaultTiles}', using default instead`
                )
                selectedMapStyle = mapStyles[0]
            }
            return {
                ...state,
                mapStyles: mapStyles,
                selectedMapStyle: selectedMapStyle,
                firstSymbolLayerId: getFirstSymbolLayer(selectedMapStyle),
            }
        } else if (action instanceof SelectMapStyle) {
            return {
                ...state,
                selectedMapStyle: action.mapStyle,
                firstSymbolLayerId: getFirstSymbolLayer(action.mapStyle),
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

function getFirstSymbolLayer(mapStyle: MapboxStyle) {
    return mapStyle.style.layers.find(l => l.type === 'symbol')?.id
}
