import React, { useContext, useState } from 'react'
import { kmToMPHIfMiles, metersToText, milliSecondsToText } from '@/Converters'
import { getTurnSign } from '@/sidebar/instructions/Instructions'
import styles from '@/turnNavigation/TurnNavigation.module.css'
import EndNavigation from '@/sidebar/times-solid.svg'
import { TNSettingsState, TurnNavigationStoreState } from '@/stores/TurnNavigationStore'
import Dispatcher from '@/stores/Dispatcher'
import { LocationUpdateSync, SelectMapLayer, TurnNavigationSettingsUpdate, TurnNavigationStop } from '@/actions/Actions'
import PlainButton from '@/PlainButton'
import { ApiImpl } from '@/api/Api'
import VolumeUpIcon from '@/turnNavigation/volume_up.svg'
import VolumeOffIcon from '@/turnNavigation/volume_off.svg'
import SyncLocationIcon from '@/turnNavigation/location_searching.svg'
import { tr } from '@/translation/Translation'
import { SettingsContext } from '@/contexts/SettingsContext'

// This method creates the turn navigation view with live updates about speed, turns, distances and arrival time.
export default function ({ turnNavigation }: { turnNavigation: TurnNavigationStoreState }) {
    if (turnNavigation.activePath == null) new Error('activePath cannot be null if TurnNavigation is enabled')
    const settings = useContext(SettingsContext)
    const showDistanceInMiles = settings.showDistanceInMiles
    const instruction = turnNavigation.instruction
    const pd = turnNavigation.pathDetails
    const thenInstructionSign = turnNavigation.thenInstructionSign
    let [showTime, setShowTime] = useState(true)
    let [showDebug, setShowDebug] = useState(false)

    const arrivalDate = new Date()
    const currentSpeed = kmToMPHIfMiles(turnNavigation.speed * 3.6, showDistanceInMiles)
    arrivalDate.setMilliseconds(arrivalDate.getSeconds() + instruction.timeToEnd)
    const min = arrivalDate.getMinutes()

    return (
        <>
            <div className={styles.firstRow}>
                <div className={styles.turnSign}>
                    <div className={styles.firstSign}>
                        {getTurnSign(instruction.sign, instruction.index, instruction.nextWaypointIndex)}
                    </div>
                    <div className={styles.nextDistance}>
                        {metersToText(instruction.distanceToTurn, showDistanceInMiles)}
                    </div>
                    {thenInstructionSign != null && (
                        <div className={styles.thenDistance}>
                            <div>{tr('thenSign')}</div>
                            <div>
                                {getTurnSign(thenInstructionSign, instruction.index, instruction.nextWaypointIndex)}
                            </div>
                        </div>
                    )}
                </div>
                <div
                    className={styles.instructionText}
                    title={instruction.text}
                    onClick={() => setShowDebug(!showDebug)}
                >
                    {instruction.text}
                    {showDebug ? (
                        <div className={styles.debug}>
                            <span>{pd.estimatedAvgSpeed}, </span>
                            <span>{pd.surface}, </span>
                            <span>{pd.roadClass}</span>
                        </div>
                    ) : null}
                </div>

                <div className={styles.buttonCol}>
                    <div
                        className={styles.volume}
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
                    {!turnNavigation.settings.syncView && (
                        <div
                            className={styles.syncLocation}
                            onClick={() => Dispatcher.dispatch(new LocationUpdateSync(true))}
                        >
                            <PlainButton>
                                <SyncLocationIcon />
                            </PlainButton>
                        </div>
                    )}
                </div>
            </div>
            <div className={styles.turnInfo}>
                <div className={styles.turnInfoRightSide}>
                    <div className={styles.firstCol}>
                        <div className={styles.currentSpeed}>
                            <div>{currentSpeed}</div>
                            <div>{showDistanceInMiles ? 'mph' : 'km/h'}</div>
                        </div>
                        <div className={styles.maxSpeed}>
                            {pd.maxSpeed != null && ApiImpl.isMotorVehicle(turnNavigation.activeProfile) ? (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="44px" height="44px">
                                    <circle
                                        cx="22"
                                        cy="22"
                                        r="20"
                                        stroke="rgba(255, 0, 0, 0.6)"
                                        strokeWidth="3px"
                                        fill="none"
                                    />
                                    <text x="50%" y="28" textAnchor="middle" style={{ fontSize: '18px' }}>
                                        {kmToMPHIfMiles(pd.maxSpeed, showDistanceInMiles, true)}
                                    </text>
                                </svg>
                            ) : null}
                        </div>
                    </div>
                    <div className={styles.secondCol}>
                        <div onClick={() => setShowTime(!showTime)}>
                            {showTime ? (
                                <>
                                    <div>{arrivalDate.getHours() + ':' + (min > 9 ? min : '0' + min)}</div>
                                    <svg width="30" height="8">
                                        <circle cx="5" cy="4" r="3" />
                                        <circle cx="20" cy="4" r="3.5" stroke="black" fill="white" />
                                    </svg>
                                </>
                            ) : (
                                <>
                                    <div className={styles.secondColTime}>
                                        {milliSecondsToText(instruction.timeToEnd)}
                                    </div>
                                    <svg width="30" height="8">
                                        <circle cx="5" cy="4" r="3" stroke="black" fill="white" />
                                        <circle cx="20" cy="4" r="3.5" />
                                    </svg>
                                </>
                            )}
                        </div>
                    </div>
                    <div className={styles.thirdCol}>
                        <div className={styles.remainingDistance}>
                            {metersToText(instruction.distanceToEnd, showDistanceInMiles)}
                        </div>
                    </div>
                    <PlainButton
                        className={styles.fourthCol}
                        onClick={() => {
                            if (turnNavigation.settings.forceVectorTiles)
                                Dispatcher.dispatch(new SelectMapLayer(turnNavigation.oldTiles))
                            Dispatcher.dispatch(new TurnNavigationStop())
                        }}
                    >
                        <EndNavigation />
                    </PlainButton>
                </div>
            </div>
        </>
    )
}
