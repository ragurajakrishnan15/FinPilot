import '@testing-library/jest-dom/vitest'
import { configure } from '@testing-library/react'

// Routes are lazy-loaded; a cold dynamic import (e.g. the chart chunk) can exceed the 1s default.
configure({ asyncUtilTimeout: 5000 })
