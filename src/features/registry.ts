import { audioFeatures } from './audio'
import type { Feature } from './types'

/** Every button in the app. Adding a feature = adding it to one of these arrays. */
export const features: Feature[] = [...audioFeatures]
