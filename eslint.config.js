//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

export default [
  ...tanstackConfig,
  {
    name: 'local/ignores',
    ignores: [
      '**/.output/**',
      '**/.nitro/**',
      'eslint.config.js',
      'prettier.config.js',
    ],
  },
]
