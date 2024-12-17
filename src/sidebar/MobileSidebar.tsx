import { useCallback, useEffect, useRef, useState } from 'react'
import { Coordinate, QueryPoint, QueryPointType, QueryStoreState, RequestState } from '@/stores/QueryStore'
import { RouteStoreState } from '@/stores/RouteStore'
import { ErrorStoreState } from '@/stores/ErrorStore'
import styles from './MobileSidebar.module.css'
import Search from '@/sidebar/search/Search'
import ErrorMessage from '@/sidebar/ErrorMessage'
import { useMediaQuery } from 'react-responsive'
import { MarkerComponent } from '@/map/Marker'
import RoutingProfiles from '@/sidebar/search/routingProfiles/RoutingProfiles'
import OpenInputsIcon from './unfold.svg'
import CloseInputsIcon from './unfold_less.svg'
import CustomModelBox from '@/sidebar/CustomModelBox'
import { TNSettingsState, TurnNavigationStoreState } from '@/stores/TurnNavigationStore'
import { Map } from 'ol'

type MobileSidebarProps = {
    query: QueryStoreState
    route: RouteStoreState
    error: ErrorStoreState
    encodedValues: object[]
    drawAreas: boolean
    map: Map
    turnNavigationSettings: TNSettingsState
}

export default function ({
    query,
    route,
    error,
    encodedValues,
    drawAreas,
    map,
    turnNavigationSettings,
}: MobileSidebarProps) {
    const [showCustomModelBox, setShowCustomModelBox] = useState(false)
    // the following three elements control, whether the small search view is displayed
    const isShortScreen = useMediaQuery({ query: '(max-height: 55rem)' })
    const [isSmallSearchView, setIsSmallSearchView] = useState(isShortScreen && hasResult(route))

    // the following ref, callback and effect minimize the search view if there is any interaction outside the search panel
    const searchContainerRef = useRef<HTMLDivElement>(null)
    const handleWindowClick = useCallback(
        (event: Event) => {
            const clickInside = event.target instanceof Node && searchContainerRef.current?.contains(event.target)
            if (!clickInside && isShortScreen && hasResult(route)) setIsSmallSearchView(true)
        },
        [isShortScreen, route]
    )
    useEffect(() => {
        window.addEventListener('mousedown', handleWindowClick)
        window.addEventListener('touchstart', handleWindowClick)
        return () => {
            window.removeEventListener('mousedown', handleWindowClick)
            window.removeEventListener('touchstart', handleWindowClick)
        }
    })

    // query results get only the selected path as result list. If we like having just one path on the small layout we can change
    // the store so that it will only fetch a single route on mobile
    return (
        <div className={styles.sidebar}>
            <div className={styles.background} ref={searchContainerRef}>
                {isSmallSearchView ? (
                    <SmallSearchView points={query.queryPoints} onClick={() => setIsSmallSearchView(false)} />
                ) : (
                    <div className={styles.btnCloseContainer}>
                        <div className={styles.btnCloseInputs} onClick={() => setIsSmallSearchView(true)}>
                            <CloseInputsIcon />
                        </div>
                        <RoutingProfiles
                            routingProfiles={query.profiles}
                            selectedProfile={query.routingProfile}
                            showCustomModelBox={showCustomModelBox}
                            toggleCustomModelBox={() => setShowCustomModelBox(!showCustomModelBox)}
                            customModelBoxEnabled={query.customModelEnabled}
                        />
                        {showCustomModelBox && (
                            <CustomModelBox
                                customModelEnabled={query.customModelEnabled}
                                encodedValues={encodedValues}
                                customModelStr={query.customModelStr}
                                queryOngoing={query.currentRequest.subRequests[0]?.state === RequestState.SENT}
                                drawAreas={drawAreas}
                            />
                        )}
                        <Search points={query.queryPoints} map={map} turnNavigationSettings={turnNavigationSettings} />
                    </div>
                )}
                {!error.isDismissed && <ErrorMessage error={error} />}
            </div>
        </div>
    )
}

function hasResult(route: RouteStoreState) {
    return route.routingResult.paths.length > 0
}

function SmallSearchView(props: { points: QueryPoint[]; onClick: () => void }) {
    const from = props.points[0]
    const to = props.points[props.points.length - 1]
    const isSmallHeight = useMediaQuery({ query: '(max-height: 36rem)' })

    return (
        <div className={styles.btnOpenContainer} onClick={props.onClick}>
            <div className={styles.mapView}>
                {!isSmallHeight && <SmallQueryPoint text={from.queryText} color={from.color} position={from.type} />}
                {!isSmallHeight && <IntermediatePoint points={props.points} />}
                <SmallQueryPoint text={to.queryText} color={to.color} position={to.type} />
            </div>
            <div className={styles.btnOpenInputs}>
                <OpenInputsIcon />
            </div>
        </div>
    )
}

// call this queryText, so that QueryPoints can be passed in as props because they have a fitting shape
function SmallQueryPoint({ text, color, position }: { text: string; color: string; position: QueryPointType }) {
    // @ts-ignore
    return (
        <div className={styles.mapViewRow}>
            <div className={styles.markerContainer}>
                <MarkerComponent color={color} />
            </div>
            <span className={getClassName(position)}>{text}</span>
        </div>
    )
}

function getClassName(position: QueryPointType) {
    switch (position) {
        case QueryPointType.To:
            return styles.queryPointText + ' ' + styles.queryPointTextTo
        case QueryPointType.Via:
            return styles.queryPointText + ' ' + styles.queryPointTextVia
        default:
            return styles.queryPointText
    }
}

function IntermediatePoint({ points }: { points: QueryPoint[] }) {
    // for a total number of three points display intermediate via point
    if (points.length === 3)
        return <SmallQueryPoint text={points[1].queryText} color={points[1].color} position={QueryPointType.Via} />

    // for more than total of three points display the number of via points
    if (points.length > 3)
        return (
            <SmallQueryPoint text={points.length - 2 + ' via points'} color={'#76D0F7'} position={QueryPointType.Via} />
        )

    return <div /> // in case of no via points display nothing
}
