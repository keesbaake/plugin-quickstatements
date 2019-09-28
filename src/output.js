import { format as formatDate } from '@citation-js/date'
import { format as formatName } from '@citation-js/name'
import { util } from '@citation-js/core'
import wdk from 'wikidata-sdk'

const caches = {
  issn (items) {
    const issns = items
      .map(item => item.ISSN)
      .filter((value, index, array) => array.indexOf(value) === index)
      .join('" "')

    return `VALUES ?key { "${issns}" } . ?value wdt:P236 ?key .`
  },
  orcid (items) {
    const orcids = []
      .concat(...items.map(
        item => item.author.map(
          author => author.ORCID && author.ORCID.replace(/^https?:\/\/orcid\.org\//, '')
        )
      ))
      .filter((value, index, array) => value && array.indexOf(value) === index)
      .join('" "')

    return `VALUES ?key { "${orcids}" } . ?value wdt:P496 ?key .`
  }
}

const props = {
  P50: 'author',
  P304: 'page',
  P356: 'DOI',
  P433: 'issue',
  P478: 'volume',
  P577: 'issued',
  P496: 'ORCID',
  P698: 'PMID',
  P932: 'PMCID',
  P1433: 'ISSN',
  P1476: 'title',
  P2093: 'author'
}

function serialize (prop, value, wd) {
  switch (prop) {
    case 'page':
      return `"${value.replace('--', '-')}"`
    case 'issued':
      return `"${formatDate(value)}"`
    case 'author':
      if (wd === "P50") {
        return value.map((author, index) => {
          let orcid = author.ORCID
          if (orcid) {
            orcid = orcid.replace(/^https?:\/\/orcid\.org\//, '')
            let authorQID = caches.orcid[orcid]
            if (authorQID) {
              const name = formatName(author)
              return name ? `${authorQID}\tP1932\t"${name}"\tP1545\t"${index + 1}"` : `${authorQID}\tP1545\t"${index + 1}"`
            }
          }
        }).filter(Boolean)
      } else {
        return value.map((author, index) => {
          if (author.ORCID) {
            let orcid = author.ORCID.replace(/^https?:\/\/orcid\.org\//, '')
            let authorQID = caches.orcid[orcid]
            if (authorQID) {
              return undefined
            } else {
              const name = formatName(author)
              return name ? `"${name}"\tP496\t"${orcid}\"\tP1545\t"${index + 1}"` : undefined
            }
          } else {
            const name = formatName(author)
            return name ? `"${name}"\tP1545\t"${index + 1}"` : undefined
          }
        }).filter(Boolean)
      }
    case 'ISSN':
      return caches.issn[value]

    default: return `"${value}"`
  }
}

export default {
  quickstatements (csl) {
    // fill caches
    const queries = Object.keys(caches)
      .map(cache => {
        const makeQuery = caches[cache]
        caches[cache] = {}
        return `{ ${makeQuery(csl)} BIND("${cache}" AS ?cache) }`
      })
      .join(' UNION ')
    let query = `SELECT ?key ?value ?cache WHERE { ${queries} }`

    try {
      const url = wdk.sparqlQuery(query)
      const response = JSON.parse(util.fetchFile(url))
      const results = wdk.simplify.sparqlResults(response)

      for (let { key, value, cache } of results) {
        caches[cache][key] = value
      }
    } catch (e) {
      console.error(e)
    }

    // generate output
    let output = ''
    for (const item of csl) {
      var prov = "";
      if (item.source) {
        if (item.source === 'PubMed') {
          prov = prov + "\tS248\tQ180686"
        } else if (item.source === 'Crossref') {
          prov = prov + "\tS248\tQ5188229"
        }
        if (item.accessed) {
          prov = prov + `\tS813\t"` + formatDate(item.accessed) + `T00:00:00Z/9"`
        } else {
          prov = prov + `\tS813\t"` + new Date().toISOString() + `/18"`
        }
        if (item._graph && item._graph[0] && item._graph[0].type === "@pubmed/pmcid" && item._graph[0].data) {
          prov = prov + `\tS932\t"` + item._graph[0].data + `"`
          // FIXME: if data is a list
        }
      }
      if (item.type === 'article-journal') {
        output = output + '\tCREATE\n\n\tLAST\tP31\tQ13442814' + prov + '\n';
        output = output + `\tLAST\tLen\t"` + item.title + `"\n`

        for (const wd in props) {
          const prop = props[wd]
          const value = item[prop]

          if (value == null) continue

          const serializedValue = serialize(prop, value, wd)

          if (serializedValue == null) continue

          output += []
            .concat(serializedValue)
            .map(value => `\tLAST\t${wd}\t${value}${prov}\n`)
            .join('')
        }
        output = output + "\n"
      }
    }
    return output
  }
}
