import type { ChartData, HouseSystem, ZodiacMode } from '../types'

export interface ChartSettingsValue {
  zodiac: ZodiacMode
  house_system: HouseSystem
}

export function defaultChartSettings(): ChartSettingsValue {
  return { zodiac: 'tropical', house_system: 'placidus' }
}

export function chartSettingsFromChart(chart: ChartData): ChartSettingsValue {
  return { zodiac: chart.zodiac, house_system: chart.house_system }
}

interface ChartSettingsFieldsProps {
  idPrefix: string
  value: ChartSettingsValue
  onChange: (value: ChartSettingsValue) => void
}

export function ChartSettingsFields({ idPrefix, value, onChange }: ChartSettingsFieldsProps) {
  return (
    <div className="field-row field-row--split">
      <div className="field">
        <label htmlFor={`${idPrefix}-zodiac`}>Zodiac</label>
        <select
          id={`${idPrefix}-zodiac`}
          value={value.zodiac}
          onChange={(e) => onChange({ ...value, zodiac: e.target.value as ZodiacMode })}
        >
          <option value="tropical">Tropical</option>
          <option value="sidereal">Sidereal</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${idPrefix}-house_system`}>Houses</label>
        <select
          id={`${idPrefix}-house_system`}
          value={value.house_system}
          onChange={(e) => onChange({ ...value, house_system: e.target.value as HouseSystem })}
        >
          <option value="placidus">Placidus</option>
          <option value="whole_sign">Whole sign</option>
        </select>
      </div>
    </div>
  )
}
