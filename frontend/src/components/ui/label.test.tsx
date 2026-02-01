import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Label } from './label'

describe('Label', () => {
  it('renders label text', () => {
    render(<Label>My Label</Label>)
    expect(screen.getByText('My Label')).toBeInTheDocument()
  })
})
