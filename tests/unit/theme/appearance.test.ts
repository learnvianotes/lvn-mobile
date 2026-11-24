import { Appearance } from 'react-native'
import { Uniwind } from 'uniwind'
import { applyTheme, watchTheme } from '@/lib/theme/apply'
import { chooseMode } from '@/lib/theme'
import { getTheme, setSystemScheme } from '@/lib/theme/store'

/**
 * RN 0.88 locks the app color scheme when Uniwind is told 'light' or 'dark'.
 * System has to ask for 'system' so a later device change still arrives.
 */
describe('device appearance on RN 0.88', () => {
  const getColorScheme = jest.spyOn(Appearance, 'getColorScheme')
  const setTheme = jest.spyOn(Uniwind, 'setTheme').mockImplementation(() => undefined)
  const updateCSSVariables = jest.spyOn(Uniwind, 'updateCSSVariables').mockImplementation(() => undefined)

  afterEach(() => {
    getColorScheme.mockReset()
    setTheme.mockClear()
    setSystemScheme('light')
    chooseMode('system')
  })

  afterAll(() => {
    getColorScheme.mockRestore()
    setTheme.mockRestore()
    updateCSSVariables.mockRestore()
  })

  it('follows the phone in System mode instead of locking the scheme that was current', () => {
    getColorScheme.mockReturnValue('dark')
    setSystemScheme('light')
    chooseMode('system')
    applyTheme()
    expect(setTheme).toHaveBeenCalledWith('system')
    expect(setTheme).not.toHaveBeenCalledWith('light')
    expect(setTheme).not.toHaveBeenCalledWith('dark')
    expect(getTheme()).toMatchObject({ mode: 'system', scheme: 'dark' })
    expect(getTheme().palette.paper).toBe('#141413')
  })

  it('locks an explicit Light or Dark choice', () => {
    getColorScheme.mockReturnValue('dark')
    chooseMode('light')
    applyTheme()
    expect(setTheme).toHaveBeenCalledWith('light')
    expect(getTheme()).toMatchObject({ mode: 'light', scheme: 'light' })
    expect(getTheme().palette.paper).toBe('#f8f7f4')
  })

  it('keeps asking Uniwind for system when the device scheme changes', () => {
    getColorScheme.mockReturnValue('light')
    const stop = watchTheme()
    chooseMode('system')
    expect(getTheme().palette.paper).toBe('#f8f7f4')
    getColorScheme.mockReturnValue('dark')
    setSystemScheme('dark')
    expect(getTheme()).toMatchObject({ mode: 'system', scheme: 'dark' })
    expect(getTheme().palette.paper).toBe('#141413')
    expect(setTheme.mock.calls.at(-1)).toEqual(['system'])
    stop()
  })
})
