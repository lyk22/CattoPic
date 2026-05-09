'use client'

import { useState, useEffect } from 'react'
import { ClockIcon } from './ui/icons'

interface ExpirySelectorProps {
  valueMinutes: number
  onChange: (minutes: number) => void
}

/** Map stored minutes back to dropdown + custom UI (best-effort for arbitrary values). */
function deriveExpiryUi(minutes: number): {
  selectedOption: string
  customValue: number
  timeUnit: 'hours' | 'days'
} {
  if (!Number.isFinite(minutes) || minutes < 0) {
    return { selectedOption: 'never', customValue: 1, timeUnit: 'hours' }
  }
  if (minutes === 0) return { selectedOption: 'never', customValue: 1, timeUnit: 'hours' }
  if (minutes === 60) return { selectedOption: '1h', customValue: 1, timeUnit: 'hours' }
  if (minutes === 1440) return { selectedOption: '24h', customValue: 1, timeUnit: 'hours' }
  if (minutes === 10080) return { selectedOption: '7d', customValue: 1, timeUnit: 'hours' }
  if (minutes === 43200) return { selectedOption: '30d', customValue: 1, timeUnit: 'hours' }
  if (minutes > 0 && minutes % (24 * 60) === 0) {
    return {
      selectedOption: 'custom',
      customValue: Math.max(1, Math.trunc(minutes / (24 * 60))),
      timeUnit: 'days',
    }
  }
  if (minutes > 0 && minutes % 60 === 0) {
    const h = Math.trunc(minutes / 60)
    return { selectedOption: 'custom', customValue: Math.max(1, h), timeUnit: 'hours' }
  }
  const hoursRounded = Math.max(1, Math.round(minutes / 60))
  return { selectedOption: 'custom', customValue: hoursRounded, timeUnit: 'hours' }
}

export default function ExpirySelector({ valueMinutes, onChange }: ExpirySelectorProps) {
  const [selectedOption, setSelectedOption] = useState(() => deriveExpiryUi(valueMinutes).selectedOption)
  const [customValue, setCustomValue] = useState(() => deriveExpiryUi(valueMinutes).customValue)
  const [timeUnit, setTimeUnit] = useState<'hours' | 'days'>(() => deriveExpiryUi(valueMinutes).timeUnit)

  useEffect(() => {
    const d = deriveExpiryUi(valueMinutes)
    setSelectedOption(d.selectedOption)
    setCustomValue(d.customValue)
    setTimeUnit(d.timeUnit)
  }, [valueMinutes])

  const handleOptionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const option = e.target.value
    setSelectedOption(option)

    let minutes = 0
    switch (option) {
      case 'never':
        minutes = 0
        break
      case '1h':
        minutes = 60
        break
      case '24h':
        minutes = 24 * 60
        break
      case '7d':
        minutes = 7 * 24 * 60
        break
      case '30d':
        minutes = 30 * 24 * 60
        break
      case 'custom':
        minutes = timeUnit === 'hours' ? customValue * 60 : customValue * 60 * 24
        break
    }
    onChange(minutes)
  }

  const handleCustomValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10)
    if (!isNaN(value) && value > 0) {
      setCustomValue(value)
      if (selectedOption === 'custom') {
        const minutes = timeUnit === 'hours' ? value * 60 : value * 60 * 24
        onChange(minutes)
      }
    }
  }

  const handleTimeUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const unit = e.target.value as 'hours' | 'days'
    setTimeUnit(unit)
    if (selectedOption === 'custom') {
      const minutes = unit === 'hours' ? customValue * 60 : customValue * 60 * 24
      onChange(minutes)
    }
  }

  return (
    <div className="mb-6 flex items-center space-x-4">
      <div className="flex items-center">
        <ClockIcon className="h-5 w-5 mr-2 text-indigo-500" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">过期时间：</span>
      </div>

      <div className="flex-1">
        <select
          value={selectedOption}
          onChange={handleOptionChange}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 text-sm shadow-xs"
        >
          <option value="never">永不过期</option>
          <option value="1h">1小时</option>
          <option value="24h">1天</option>
          <option value="7d">7天</option>
          <option value="30d">30天</option>
          <option value="custom">自定义</option>
        </select>
      </div>

      {selectedOption === 'custom' && (
        <>
          <div className="w-24">
            <input
              type="number"
              min="1"
              value={customValue}
              onChange={handleCustomValueChange}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 text-center font-medium shadow-xs"
              aria-label="自定义时间值"
            />
          </div>
          <div className="w-24">
            <select
              value={timeUnit}
              onChange={handleTimeUnitChange}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 text-sm shadow-xs"
            >
              <option value="hours">小时</option>
              <option value="days">天</option>
            </select>
          </div>
        </>
      )}
    </div>
  )
}
