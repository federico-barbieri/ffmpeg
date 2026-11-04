import { audioFeatures } from './audio'
import { convertFeatures } from './convert'
import { editFeatures } from './edit'
import { imageFeatures } from './images'
import { infoFeatures } from './info'
import { sizeFeatures } from './size'
import type { Feature } from './types'

/** Every button in the app. Adding a feature = adding it to one of these arrays. */
export const features: Feature[] = [
  ...convertFeatures, ...audioFeatures, ...editFeatures, ...sizeFeatures, ...imageFeatures, ...infoFeatures,
]

export const GROUP_ORDER: Feature['group'][] = ['Convert', 'Audio', 'Edit', 'Size & quality', 'Images', 'Info']
