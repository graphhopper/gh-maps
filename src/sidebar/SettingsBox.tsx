import { ToggleFullScreenForNavigation, ToggleVectorTilesForNavigation } from '@/actions/Actions'
import { UpdateSettings } from '@/actions/Actions'
import Dispatcher from '@/stores/Dispatcher'
import styles from '@/sidebar/SettingsBox.module.css'
import { tr } from '@/translation/Translation'
import PlainButton from '@/PlainButton'
import OnIcon from '@/sidebar/toggle_on.svg'
import OffIcon from '@/sidebar/toggle_off.svg'
import LinkIcon from '@/sidebar/link.svg'
import { useContext, useState } from 'react'
import { SettingsContext } from '@/contexts/SettingsContext'
import { TNSettingsState } from '@/stores/TurnNavigationStore'

export default function SettingsBox({ turnNavSettings }: { turnNavSettings: TNSettingsState }) {
    const [showCopiedInfo, setShowCopiedInfo] = useState(false)
    const settings = useContext(SettingsContext)
    const { forceVectorTiles, fullScreen } = turnNavSettings
    return (
        <div className={styles.parent}>
            <div
                className={styles.copyLinkRow}
                onClick={() => {
                    let url = window.location.href
                    if (window.location.href.startsWith('http://localhost'))
                        url = 'https://navi.graphhopper.org' + window.location.pathname + window.location.search
                    navigator.clipboard.writeText(url)
                    if (navigator.share) navigator.share({ url: url })
                    setShowCopiedInfo(true)
                    setTimeout(function () {
                        setShowCopiedInfo(false)
                    }, 2500)
                }}
            >
                <PlainButton>
                    <LinkIcon />
                </PlainButton>
                <div>{showCopiedInfo ? tr('Copied!') : tr('Copy Link')}</div>
            </div>
            <div className={styles.title}>{tr('settings')}</div>
            <div className={styles.settingsTable}>
                <SettingsToggle
                    title={tr('distance_unit', [tr(settings.showDistanceInMiles ? 'mi' : 'km')])}
                    enabled={settings.showDistanceInMiles}
                    onClick={() =>
                        Dispatcher.dispatch(new UpdateSettings({ showDistanceInMiles: !settings.showDistanceInMiles }))
                    }
                />
            </div>
            <div className={styles.title}>{tr('settings_gpx_export')}</div>
            <div className={styles.settingsTable}>
                <div className={styles.settingsCheckboxes}>
                    <SettingsCheckbox
                        title={tr('settings_gpx_export_trk')}
                        enabled={settings.gpxExportTrk}
                        onClick={() =>
                            Dispatcher.dispatch(new UpdateSettings({ gpxExportTrk: !settings.gpxExportTrk }))
                        }
                    />

                    <SettingsCheckbox
                        title={tr('settings_gpx_export_rte')}
                        enabled={settings.gpxExportRte}
                        onClick={() =>
                            Dispatcher.dispatch(new UpdateSettings({ gpxExportRte: !settings.gpxExportRte }))
                        }
                    />

                    <SettingsCheckbox
                        title={tr('settings_gpx_export_wpt')}
                        enabled={settings.gpxExportWpt}
                        onClick={() =>
                            Dispatcher.dispatch(new UpdateSettings({ gpxExportWpt: !settings.gpxExportWpt }))
                        }
                    />
                </div>
            </div>
            <div className={styles.title}>{tr('turn_navigation_settings_title')}</div>
            <div className={styles.settingsTable}>
                <SettingsToggle
                    title={tr('vector_tiles_for_navigation')}
                    enabled={forceVectorTiles}
                    onClick={() => Dispatcher.dispatch(new ToggleVectorTilesForNavigation())}
                />
                <SettingsToggle
                    title={tr('full_screen_for_navigation')}
                    enabled={fullScreen}
                    onClick={() => Dispatcher.dispatch(new ToggleFullScreenForNavigation())}
                />
            </div>
            <div className={styles.infoLine}>
                <a target="_blank" href="https://www.graphhopper.com/maps-route-planner/">
                    {tr('info')}
                </a>
                <a target="_blank" href="https://github.com/graphhopper/graphhopper-maps/issues">
                    {tr('feedback')}
                </a>
                <a target="_blank" href="https://www.graphhopper.com/imprint/">
                    {tr('imprint')}
                </a>
                <a target="_blank" href="https://www.graphhopper.com/privacy/">
                    {tr('privacy')}
                </a>
                <a target="_blank" href="https://www.graphhopper.com/terms/">
                    {tr('terms')}
                </a>
            </div>
        </div>
    )
}

function SettingsToggle({ title, enabled, onClick }: { title: string; enabled: boolean; onClick: () => void }) {
    return (
        <div className={styles.settingsToggle} onClick={onClick}>
            <PlainButton style={{ color: enabled ? '' : 'lightgray' }} className={styles.toggleButton}>
                {enabled ? <OnIcon /> : <OffIcon />}
            </PlainButton>
            <div style={{ color: enabled ? '#5b616a' : 'gray' }}>{title}</div>
        </div>
    )
}

function SettingsCheckbox({ title, enabled, onClick }: { title: string; enabled: boolean; onClick: () => void }) {
    return (
        <div className={styles.settingsCheckbox} onClick={onClick}>
            <input type="checkbox" checked={enabled} onChange={ignore => {}}></input>
            <label style={{ color: enabled ? '#5b616a' : 'gray' }}>{title}</label>
        </div>
    )
}
