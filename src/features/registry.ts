import { audioFeatures } from './audio'
import { editFeatures } from './edit'
import type { Feature } from './types'

/** Every button in the app. Adding a feature = adding it to one of these arrays. */
export const features: Feature[] = [...audioFeatures, ...editFeatures]

export const GROUP_ORDER: Feature['group'][] = ['Convert', 'Audio', 'Edit', 'Size & quality', 'Images', 'Info']
