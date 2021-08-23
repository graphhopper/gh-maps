import React, { useCallback, useEffect, useRef, useState } from 'react'
import { QueryPoint, QueryPointType } from '@/stores/QueryStore'
import { GeocodingHit } from '@/api/graphhopper'
import GeocodingResult from '@/sidebar/search/GeocodingResult'

import styles from './AddressInput.module.css'
import { ApiImpl } from '@/api/Api'
import { tr } from '@/translation/Translation'

export interface AddressInputProps {
    point: QueryPoint
    autofocus: boolean
    onCancel: () => void
    onAddressSelected: (hit: GeocodingHit) => void
    onChange: (value: string) => void
}

export default function AddressInput(props: AddressInputProps) {
    // controlled component pattern with initial value set from props
    const [text, setText] = useState(props.point.queryText)
    useEffect(() => setText(props.point.queryText), [props.point.queryText])

    // container for geocoding results which get set by the geocoder class and set to empty if the undelying query point gets changed from outside
    const [geocodingResults, setGeocodingResults] = useState<GeocodingHit[]>([])
    const [geocoder] = useState(new Geocoder(hits => setGeocodingResults(hits)))
    useEffect(() => setGeocodingResults([]), [props.point])

    // highlighted result of geocoding results. Keep track which index is highlighted and change things on ArrowUp and Down
    // on Enter select highlighted result or the 0th if nothing is highlighted
    const [highlightedResult, setHighlightedResult] = useState<number>(-1)
    useEffect(() => setHighlightedResult(-1), [geocodingResults])
    const searchInput = useRef<HTMLInputElement>(null)
    const onKeypress = useCallback(
        (event: React.KeyboardEvent<HTMLInputElement>) => {
            if (event.key === 'Escape') {
                searchInput.current!.blur()
                return
            }
            if (geocodingResults.length === 0) return

            switch (event.key) {
                case 'ArrowUp':
                    setHighlightedResult(i => calculateHighlightedIndex(geocodingResults.length, i, -1))
                    break
                case 'ArrowDown':
                    setHighlightedResult(i => calculateHighlightedIndex(geocodingResults.length, i, 1))
                    break
                case 'Enter':
                case 'Tab':
                    // by default use the first result, otherwise the highlighted one
                    const index = highlightedResult >= 0 ? highlightedResult : 0
                    // it seems like the order of the following two statments is important...
                    searchInput.current!.blur()
                    props.onAddressSelected(geocodingResults[index])
                    break
            }
        },
        [geocodingResults, highlightedResult]
    )

    // keep track of focus and toggle fullscreen display on small screens
    const [hasFocus, setHasFocus] = useState(false)
    const containerClass = hasFocus ? styles.container + ' ' + styles.fullscreen : styles.container
    const type = props.point.type

    return (
        <div className={containerClass}>
            <div className={styles.inputContainer}>
                <input
                    className={styles.input}
                    type="text"
                    ref={searchInput}
                    onChange={e => {
                        setText(e.target.value)
                        geocoder.request(e.target.value)
                        props.onChange(e.target.value)
                    }}
                    onKeyDown={onKeypress}
                    onFocus={event => {
                        setHasFocus(true)
                        event.target.select()
                    }}
                    onBlur={() => {
                        geocoder.cancel()
                        setHasFocus(false)
                        setGeocodingResults([])
                    }}
                    value={text}
                    autoFocus={props.autofocus}
                    placeholder={tr(
                        type == QueryPointType.From ? 'from_hint' : type == QueryPointType.To ? 'to_hint' : 'via_hint'
                    )}
                />
                <button className={styles.btnClose} onClick={() => setHasFocus(false)}>
                    Close
                </button>
            </div>

            {geocodingResults.length > 0 && (
                <div className={styles.popup}>
                    <GeocodingResult
                        hits={geocodingResults}
                        highlightedHit={geocodingResults[highlightedResult]}
                        onSelectHit={hit => {
                            // it seems like the order of the following two statments is important...
                            searchInput.current!.blur()
                            props.onAddressSelected(hit)
                        }}
                    />
                </div>
            )}
        </div>
    )
}

function calculateHighlightedIndex(length: number, currentIndex: number, incrementBy: number) {
    const nextIndex = currentIndex + incrementBy
    if (nextIndex >= length) return 0
    if (nextIndex < 0) return length - 1
    return nextIndex
}

/**
 * This could definitely be achieved with an effect. But after trying for a while I saved some money and wrote it the
 * Way I know. If we hire an 10+ react developer, this should be changed.
 */
class Geocoder {
    private requestId = 0
    private readonly timeout = new Timout(200)
    private readonly api = new ApiImpl()
    private readonly onSuccess: (hits: GeocodingHit[]) => void

    constructor(onSuccess: (hits: GeocodingHit[]) => void) {
        this.onSuccess = onSuccess
    }

    request(query: string) {
        this.requestAsync(query).then(() => {})
    }

    cancel() {
        // invalidates last request if there is one
        this.getNextId()
    }

    async requestAsync(query: string) {
        const currentId = this.getNextId()
        this.timeout.cancel()
        if (!query || query.length < 2) return

        await this.timeout.wait()
        try {
            const result = await this.api.geocode(query)
            const hits = Geocoder.filterDuplicates(result.hits)
            if (currentId === this.requestId) this.onSuccess(hits)
        } catch (reason) {
            throw Error('Could not get geocoding results because: ' + reason)
        }
    }

    private getNextId() {
        this.requestId++
        return this.requestId
    }

    private static filterDuplicates(hits: GeocodingHit[]) {
        const set: Set<string> = new Set()
        return hits.filter(hit => {
            if (!set.has(hit.osm_id)) {
                set.add(hit.osm_id)
                return true
            }
            return false
        })
    }
}

class Timout {
    private readonly delay: number
    private handle: number = 0

    constructor(delay: number) {
        this.delay = delay
    }

    wait() {
        return new Promise(resolve => {
            this.handle = window.setTimeout(resolve, this.delay)
        })
    }
    cancel() {
        clearTimeout(this.handle)
    }
}
