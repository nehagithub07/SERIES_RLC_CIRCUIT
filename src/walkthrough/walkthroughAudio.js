const audioModules = import.meta.glob('./audios/*.wav', {
  eager: true,
  import: 'default',
  query: '?url',
})

const audioUrlsByName = new Map()

Object.entries(audioModules).forEach(([path, url]) => {
  const fileName = path.split('/').pop()

  audioUrlsByName.set(fileName, url)
  audioUrlsByName.set(fileName.toLowerCase(), url)
})

const isDirectAudioUrl = (source) => /^(?:https?:|blob:|data:|\/)/i.test(source)

export const resolveWalkthroughAudio = (source) => {
  if (!source || source === '#') {
    return null
  }

  if (isDirectAudioUrl(source)) {
    return source
  }

  return audioUrlsByName.get(source) ?? audioUrlsByName.get(source.toLowerCase()) ?? null
}
