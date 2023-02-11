import { useEffect, useState } from 'react'
import PathDetails from '@/pathDetails/PathDetails'
import styles from './App.module.css'
import {
    getApiInfoStore,
    getErrorStore,
    getMapFeatureStore,
    getMapOptionsStore,
    getPathDetailsStore,
    getQueryStore,
    getRouteStore,
    getSettingsStore,
    getTurnNavigationStore,
} from '@/stores/Stores'
import MapComponent from '@/map/MapComponent'
import MapOptions from '@/map/MapOptions'
import MobileSidebar from '@/sidebar/MobileSidebar'
import { useMediaQuery } from 'react-responsive'
import RoutingResults from '@/sidebar/RoutingResults'
import PoweredBy from '@/sidebar/PoweredBy'
import { QueryStoreState, RequestState } from '@/stores/QueryStore'
import { RouteStoreState } from '@/stores/RouteStore'
import { MapOptionsStoreState } from '@/stores/MapOptionsStore'
import { ErrorStoreState } from '@/stores/ErrorStore'
import Search from '@/sidebar/search/Search'
import ErrorMessage from '@/sidebar/ErrorMessage'
import { TNSettingsState, TurnNavigationStoreState } from './stores/TurnNavigationStore'
import useBackgroundLayer from '@/layers/UseBackgroundLayer'
import useQueryPointsLayer from '@/layers/UseQueryPointsLayer'
import usePathsLayer from '@/layers/UsePathsLayer'
import ContextMenu from '@/layers/ContextMenu'
import usePathDetailsLayer from '@/layers/UsePathDetailsLayer'
import { Map } from 'ol'
import { getMap } from '@/map/map'
import CustomModelBox from '@/sidebar/CustomModelBox'
import useRoutingGraphLayer from '@/layers/UseRoutingGraphLayer'
import useUrbanDensityLayer from '@/layers/UseUrbanDensityLayer'
import useMapBorderLayer from '@/layers/UseMapBorderLayer'
import { ShowDistanceInMilesContext } from '@/ShowDistanceInMilesContext'
import RoutingProfiles from '@/sidebar/search/routingProfiles/RoutingProfiles'
import { TurnNavigationSettingsUpdate } from '@/actions/Actions'
import Dispatcher from '@/stores/Dispatcher'
import VolumeUpIcon from '@/turnNavigation/volume_up.svg'
import VolumeOffIcon from '@/turnNavigation/volume_off.svg'
import PlainButton from '@/PlainButton'
import TurnNavigation from '@/turnNavigation/TurnNavigation'
import MapPopups from '@/map/MapPopups'
import useCurrentLocationLayer from '@/layers/CurrentLocationLayer'
import Menu from '@/sidebar/menu.svg'
import Cross from '@/sidebar/times-solid.svg'

export const POPUP_CONTAINER_ID = 'popup-container'
export const SIDEBAR_CONTENT_ID = 'sidebar-content'

export default function App() {
    const [settings, setSettings] = useState(getSettingsStore().state)
    const [query, setQuery] = useState(getQueryStore().state)
    const [info, setInfo] = useState(getApiInfoStore().state)
    const [route, setRoute] = useState(getRouteStore().state)
    const [turnNavigation, setTurnNavigation] = useState(getTurnNavigationStore().state)
    const [error, setError] = useState(getErrorStore().state)
    const [mapOptions, setMapOptions] = useState(getMapOptionsStore().state)
    const [pathDetails, setPathDetails] = useState(getPathDetailsStore().state)
    const [mapFeatures, setMapFeatures] = useState(getMapFeatureStore().state)

    const map = getMap()

    useEffect(() => {
        const onSettingsChanged = () => setSettings(getSettingsStore().state)
        const onQueryChanged = () => setQuery(getQueryStore().state)
        const onInfoChanged = () => setInfo(getApiInfoStore().state)
        const onRouteChanged = () => setRoute(getRouteStore().state)
        const onErrorChanged = () => setError(getErrorStore().state)
        const onMapOptionsChanged = () => setMapOptions(getMapOptionsStore().state)
        const onTurnNavigationChanged = () => setTurnNavigation(getTurnNavigationStore().state)
        const onPathDetailsChanged = () => setPathDetails(getPathDetailsStore().state)
        const onMapFeaturesChanged = () => setMapFeatures(getMapFeatureStore().state)

        getSettingsStore().register(onSettingsChanged)
        getQueryStore().register(onQueryChanged)
        getApiInfoStore().register(onInfoChanged)
        getRouteStore().register(onRouteChanged)
        getErrorStore().register(onErrorChanged)
        getMapOptionsStore().register(onMapOptionsChanged)
        getTurnNavigationStore().register(onTurnNavigationChanged)
        getPathDetailsStore().register(onPathDetailsChanged)
        getMapFeatureStore().register(onMapFeaturesChanged)

        onQueryChanged()
        onInfoChanged()
        onRouteChanged()
        onErrorChanged()
        onMapOptionsChanged()
        onTurnNavigationChanged()
        onPathDetailsChanged()
        onMapFeaturesChanged()

        return () => {
            getSettingsStore().register(onSettingsChanged)
            getQueryStore().deregister(onQueryChanged)
            getApiInfoStore().deregister(onInfoChanged)
            getRouteStore().deregister(onRouteChanged)
            getErrorStore().deregister(onErrorChanged)
            getMapOptionsStore().deregister(onMapOptionsChanged)
            getTurnNavigationStore().deregister(onTurnNavigationChanged)
            getPathDetailsStore().deregister(onPathDetailsChanged)
            getMapFeatureStore().deregister(onMapFeaturesChanged)
        }
    }, [])

    // our different map layers
    useBackgroundLayer(map, mapOptions.selectedStyle)
    useMapBorderLayer(map, info.bbox)
    useRoutingGraphLayer(map, mapOptions.routingGraphEnabled)
    useUrbanDensityLayer(map, mapOptions.urbanDensityEnabled)
    usePathsLayer(map, route, turnNavigation)
    useQueryPointsLayer(map, query.queryPoints)
    usePathDetailsLayer(map, pathDetails)
    useCurrentLocationLayer(map, turnNavigation)

    const isSmallScreen = useMediaQuery({ query: '(max-width: 44rem)' })
    return (
        <ShowDistanceInMilesContext.Provider value={settings.showDistanceInMiles}>
            <div className={styles.appWrapper}>
                <MapPopups map={map} pathDetails={pathDetails} mapFeatures={mapFeatures} />
                <ContextMenu map={map} route={route} queryPoints={query.queryPoints} />
                {isSmallScreen ? (
                    <SmallScreenLayout
                        query={query}
                        route={route}
                        map={map}
                        mapOptions={mapOptions}
                        error={error}
                        turnNavigation={turnNavigation}
                        encodedValues={info.encoded_values}
                    />
                ) : (
                    <LargeScreenLayout
                        query={query}
                        route={route}
                        map={map}
                        mapOptions={mapOptions}
                        error={error}
                        turnNavigation={turnNavigation}
                        encodedValues={info.encoded_values}
                    />
                )}
            </div>
        </ShowDistanceInMilesContext.Provider>
    )
}

interface LayoutProps {
    query: QueryStoreState
    route: RouteStoreState
    turnNavigation: TurnNavigationStoreState
    map: Map
    mapOptions: MapOptionsStoreState
    error: ErrorStoreState
    encodedValues: object[]
}

function LargeScreenLayout({ query, route, map, error, mapOptions, encodedValues, turnNavigation }: LayoutProps) {
    const [showSidebar, setShowSidebar] = useState(true)
    if (turnNavigation.showUI)
        return (
            <>
                <div className={styles.turnNavigation}>
                    <TurnNavigation turnNavigation={turnNavigation} />
                </div>
                <div className={styles.volume}>
                    <PlainButton
                        onClick={() =>
                            Dispatcher.dispatch(
                                new TurnNavigationSettingsUpdate({
                                    soundEnabled: !turnNavigation.settings.soundEnabled,
                                } as TNSettingsState)
                            )
                        }
                    >
                        {turnNavigation.settings.soundEnabled ? (
                            <VolumeUpIcon fill="#5b616a" />
                        ) : (
                            <VolumeOffIcon fill="#5b616a" />
                        )}
                    </PlainButton>
                </div>
                <div className={styles.map}>
                    <MapComponent map={map} />
                </div>
            </>
        )

    return (
        <>
            {showSidebar ? (
                <div className={styles.sidebar}>
                    <div className={styles.sidebarContent} id={SIDEBAR_CONTENT_ID}>
                        <PlainButton onClick={() => setShowSidebar(false)} className={styles.sidebarCloseButton}>
                            <Cross />
                        </PlainButton>
                        <RoutingProfiles
                            routingProfiles={query.profiles}
                            selectedProfile={query.routingProfile}
                            customModelAllowed={true}
                            customModelEnabled={query.customModelEnabled}
                        />
                        <CustomModelBox
                            enabled={query.customModelEnabled}
                            encodedValues={encodedValues}
                            initialCustomModelStr={query.initialCustomModelStr}
                            queryOngoing={query.currentRequest.subRequests[0]?.state === RequestState.SENT}
                        />
                        <Search points={query.queryPoints} />
                        <div>{!error.isDismissed && <ErrorMessage error={error} />}</div>
                        <RoutingResults
                            paths={route.routingResult.paths}
                            selectedPath={route.selectedPath}
                            currentRequest={query.currentRequest}
                            profile={query.routingProfile.name}
                            turnNavigation={turnNavigation}
                        />
                        <div>
                            <PoweredBy />
                        </div>
                    </div>
                </div>
            ) : (
                <div className={styles.sidebarWhenClosed} onClick={() => setShowSidebar(true)}>
                    <PlainButton className={styles.sidebarOpenButton}>
                        <Menu />
                    </PlainButton>
                </div>
            )}
            <div className={styles.popupContainer} id={POPUP_CONTAINER_ID} />
            <div className={styles.map}>
                <MapComponent map={map} />
            </div>
            <div className={styles.mapOptions}>
                <MapOptions {...mapOptions} />
            </div>

            <div className={styles.pathDetails}>
                <PathDetails selectedPath={route.selectedPath} />
            </div>
        </>
    )
}

function SmallScreenLayout({ query, route, map, error, mapOptions, turnNavigation }: LayoutProps) {
    if (turnNavigation.showUI)
        return (
            <>
                <div className={styles.smallScreenRoutingResult}>
                    <TurnNavigation turnNavigation={turnNavigation} />
                </div>
                <div className={styles.smallScreenMap}>
                    <MapComponent map={map} />
                </div>
                <div
                    className={styles.smallScreenVolume}
                    onClick={() =>
                        Dispatcher.dispatch(
                            new TurnNavigationSettingsUpdate({
                                soundEnabled: !turnNavigation.settings.soundEnabled,
                            } as TNSettingsState)
                        )
                    }
                >
                    <PlainButton>
                        {turnNavigation.settings.soundEnabled ? (
                            <VolumeUpIcon fill="#5b616a" />
                        ) : (
                            <VolumeOffIcon fill="#5b616a" />
                        )}
                    </PlainButton>
                </div>
            </>
        )

    return (
        <>
            <div className={styles.smallScreenSidebar}>
                <MobileSidebar query={query} route={route} error={error} />
            </div>
            <div className={styles.smallScreenMap}>
                <MapComponent map={map} />
            </div>
            <div className={styles.smallScreenMapOptions}>
                <div className={styles.smallScreenMapOptionsContent}>
                    <MapOptions {...mapOptions} />
                </div>
            </div>
            <div className={styles.smallScreenRoutingResult}>
                <RoutingResults
                    paths={route.routingResult.paths}
                    selectedPath={route.selectedPath}
                    currentRequest={query.currentRequest}
                    profile={query.routingProfile.name}
                    turnNavigation={turnNavigation}
                />
            </div>

            <div className={styles.smallScreenPoweredBy}>
                <PoweredBy />
            </div>
        </>
    )
}
