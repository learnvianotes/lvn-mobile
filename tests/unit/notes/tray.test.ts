import { addToTray, fitWithin, sizeLabel, type TrayItem } from '@/features/notes/capture/tray'

const item = (n: number, kind: 'image' | 'pdf' = 'image', size = 300_000): TrayItem => ({ key: `k${n}`, uri: `file:///${n}`, name: kind === 'pdf' ? `doc${n}.pdf` : `p${n}.jpg`, mimeType: kind === 'pdf' ? 'application/pdf' : 'image/jpeg', size, kind })

/** The tray's limits (lvn-backend ADR-0084): ten photos or PDFs, no PDF over 20 MB, pictures resized to fit 2,048. */
describe('the photo tray', () => {
  it('keeps up to ten and says how many were left out', () => {
    const eight = Array.from({ length: 8 }, (_, i) => item(i))
    const { tray, refused } = addToTray(eight, [item(8), item(9), item(10), item(11)])
    expect(tray.map((i) => i.key)).toEqual([...eight.map((i) => i.key), 'k8', 'k9'])
    expect(refused).toEqual(['Only 10 photos or PDFs go into one note; 2 were left out.'])
  })

  it('turns away a PDF over 20 MB with its size, and keeps the rest', () => {
    const { tray, refused } = addToTray([], [item(1, 'pdf', 25 * 1024 ** 2), item(2, 'pdf', 2 * 1024 ** 2), item(3)])
    expect(tray.map((i) => i.key)).toEqual(['k2', 'k3'])
    expect(refused).toEqual(['doc1.pdf is 25.0 MB; a PDF can be at most 20 MB.'])
  })

  it('resizes only pictures larger than the limit, on their longer side', () => {
    expect(fitWithin(4000, 3000, 2048)).toEqual({ width: 2048 })
    expect(fitWithin(3000, 4000, 2048)).toEqual({ height: 2048 })
    expect(fitWithin(1600, 1200, 2048)).toBeNull()
    expect([sizeLabel(512), sizeLabel(640 * 1024), sizeLabel(3.2 * 1024 ** 2)]).toEqual(['1 KB', '640 KB', '3.2 MB'])
  })
})
