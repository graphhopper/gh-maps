import { GeocodingHit } from '@/api/graphhopper'
import styles from './GeocodingResult.module.css'
import React, { useState } from 'react'
import CurrentLocationIcon from './current-location.svg'

export default function GeocodingResult({
    hits,
    highlightedHit,
    onSelectHit,
}: {
    hits: GeocodingHit[]
    highlightedHit: GeocodingHit
    onSelectHit: (hit: GeocodingHit) => void
}) {
    return (
        <ul className={styles.geocodingList}>
            {hits.map(hit => (
                <GeocodingEntry
                    key={hit.osm_id}
                    entry={hit}
                    isHighlighted={hit === highlightedHit}
                    onSelectHit={onSelectHit}
                />
            ))}
        </ul>
    )
}

const GeocodingEntry = ({
    entry,
    isHighlighted,
    onSelectHit,
}: {
    entry: GeocodingHit
    isHighlighted: boolean
    onSelectHit: (hit: GeocodingHit) => void
}) => {
    const [isCancelled, setIsCancelled] = useState(false)
    const className = isHighlighted
        ? styles.selectableGeocodingEntry + ' ' + styles.highlightedGeocodingEntry
        : styles.selectableGeocodingEntry
    return (
        <li className={styles.geocodingListItem}>
            <button
                className={className}
                // using click events for mouse interaction to select an entry.
                onClick={() => onSelectHit(entry)}
                // On touch devices when listening for the click or pointerup event the next or last address input would
                // be immediately selected after the 'onSelectHit' method was called. This can be prevented by listening
                // for the touchend event separately.
                onTouchEnd={e => {
                    e.preventDefault()
                    if (!isCancelled) onSelectHit(entry)
                }}
                // listen for cancel events to prevent selections in case the result list is e.g. scrolled on touch devices
                onPointerCancel={() => setIsCancelled(true)}
                // prevent blur event for input textbox
                onPointerDown={e => {
                    setIsCancelled(false)
                    e.preventDefault()
                }}
            >
                {entry.osm_type === 'current_location' ? (
                    <div className={styles.currentLocationEntry}>
                        <CurrentLocationIcon className={styles.currentLocationIcon} fill="#5b616a" />
                        <span className={styles.geocodingEntryMain}>{convertToMainText(entry)}</span>
                    </div>
                ) : (
                    <div className={styles.geocodingEntry}>
                        <span className={styles.geocodingEntryMain}>{convertToMainText(entry)}</span>
                        <span>{convertToSecondaryText(entry)}</span>
                    </div>
                )}
            </button>
        </li>
    )
}

function convertToMainText(hit: GeocodingHit) {
    if (hit.name && hit.housenumber) return hit.name + ' ' + hit.housenumber
    return hit.name
}

function convertToSecondaryText(hit: GeocodingHit) {
    let result = convertToCity(hit, ', ')
    result += convertToCountry(hit)
    return result
}

function convertToCity(hit: GeocodingHit, appendix: string) {
    if (hit.city && hit.postcode) return hit.postcode + ' ' + hit.city + appendix
    if (hit.city) return hit.city + appendix
    if (hit.postcode) return hit.postcode + appendix
    return ''
}

function convertToCountry(hit: GeocodingHit) {
    return hit.country ? hit.country : ''
}
