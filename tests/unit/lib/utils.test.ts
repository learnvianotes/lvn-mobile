import { cn } from '@/lib/utils'

describe('cn', () => {
  it('joins class names and drops falsy ones', () => {
    expect(cn('px-4', false, undefined, 'font-bold')).toBe('px-4 font-bold')
  })

  it('lets the later Tailwind class win', () => {
    expect(cn('bg-card px-4', 'bg-primary')).toBe('px-4 bg-primary')
  })
})
