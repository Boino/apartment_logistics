import { vi } from 'vitest'

// Suppress console.error in tests unless specifically testing for it
vi.spyOn(console, 'error').mockImplementation(() => {})
