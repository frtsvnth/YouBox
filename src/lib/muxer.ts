import { runSubprocess } from './subprocess'
import { BinaryNotFoundError } from './errors'
import fs from 'node:fs'

export function convertAudio(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    runSubprocess({
      bin: 'ffmpeg',
      args: [
        '-i', inputPath,
        '-vn',
        '-acodec', 'libmp3lame',
        '-ab', '192k',
        outputPath,
      ],
      timeout: 120_000,
    })
      .then((result) => {
        if (result.exitCode !== 0) {
          reject(new Error(result.stderr.trim() || `ffmpeg exited with code ${result.exitCode}`))
        } else {
          resolve()
        }
      })
      .catch((err) => {
        if (err instanceof Error && err.message.includes('binary not found')) {
          reject(new BinaryNotFoundError('ffmpeg'))
        } else {
          reject(err)
        }
      })
  })
}

export function getFileSize(filePath: string): number {
  return fs.statSync(filePath).size
}

export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath)
}
