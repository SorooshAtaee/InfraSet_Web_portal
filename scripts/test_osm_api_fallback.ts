// Standalone test of the OSM API fallback extractor (run with bun from project root).
import { extractFromOsmMapApi, OsmApiTooLargeError } from '@/lib/osmApiExtract'
import { DEFAULT_CLASS_TOGGLES } from '@/lib/infraset'

async function main() {
  console.log('== small Belgian bbox ==')
  const t0 = Date.now()
  const fb = await extractFromOsmMapApi([50.663, 4.555, 50.673, 4.575], DEFAULT_CLASS_TOGGLES)
  console.log(`elements: ${fb.elements.length} (nodes ${fb.nodesInResponse}, ways ${fb.waysInResponse}) in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  const ways = fb.elements.filter((e) => e.type === 'way').length
  const nodes = fb.elements.filter((e) => e.type === 'node').length
  console.log(`ways: ${ways}, node POIs: ${nodes}`)
  const rail = fb.elements.filter((e) => e.tags?.railway === 'rail').length
  console.log(`rail ways: ${rail}`)

  console.log('== oversized dense bbox (expect OsmApiTooLargeError) ==')
  try {
    await extractFromOsmMapApi([50.79, 4.30, 50.93, 4.50], DEFAULT_CLASS_TOGGLES)
    console.log('ERROR: no exception thrown')
  } catch (e) {
    console.log('caught:', e instanceof OsmApiTooLargeError ? 'OsmApiTooLargeError (correct)' : `other: ${e}`)
  }
}

main()
