import { format as formatDate } from '@citation-js/date'
import { format as formatName } from '@citation-js/name'
import { util } from '@citation-js/core'
import wbs from 'wikibase-sdk'

function getWikiDataProps(){
    return {
            P50: 'author',
            P212: 'ISBN',
            P304: 'page',
            P356: 'DOI',
            P407: 'language',
            P433: 'issue',
            P478: 'volume',
            P577: 'issued',
            P496: 'ORCID',
            P698: 'PMID',
            P856: 'URL',
            P932: 'PMCID',
            P1104: 'number-of-pages',
            P1433: 'ISSN',
            P1476: 'title',
            P2093: 'author'
    }
}
  
function getWikiDataTypes(){
  // the below mappings should follow the following Wikidata SPARQL query:
  //
  // SELECT * WHERE{
  //   ?s wdt:P2888 ?o .
  //   FILTER(STRSTARTS(STR(?o), "https://citationstyles.org/ontology/type/"))
  // }
  //
  // Except when noted otherwise
  return {
    article: 'Q191067',
    'article-journal': 'Q13442814',
    'article-magazine': 'Q30070590',
    'article-newspaper': 'Q5707594',
    bill: 'Q686822',
    broadcast: 'Q11578774',
    chapter: 'Q1980247',
    dataset: 'Q1172284',
    entry: 'Q10389811',
    'entry-dictionary': 'Q1580166',
    'entry-encyclopedia': 'Q13433827',
    figure: 'Q30070753',
    interview: 'Q178651',
    legal_case: 'Q2334719',
    legislation: 'Q49371',
    manuscript: 'Q87167',
    map: 'Q4006',
    motion_picture: 'Q11424',
    musical_score: 'Q187947',
    'paper-conference': 'Q23927052',
    patent: 'Q253623',
    post: 'Q7216866',
    'post-weblog': 'Q17928402',
    report: 'Q10870555',
    review: 'Q265158',
    'review-book': 'Q637866',
    song: 'Q7366',
    speech: 'Q861911',
    thesis: 'Q1266946',
    treaty: 'Q131569',
    webpage: 'Q36774',
  
    // Exception: each book edition has a unique ISBN; otherwise use Q571 (book)
    book: 'Q3331189',
  
    // Three types have no exact match in Wikidata; these are alternatives
    // Q4502142 (visual artwork) does not include non-artwork graphics (in theory)
    graphic: 'Q4502142',
    // pamphlet: unsure whether exact match
    pamphlet: 'Q190399',
    // Q628523 (message) also includes prophecies, protests, animal scent marks
    personal_communication: 'Q628523'
  }
}

function getWdPropsDefinition(){
    return {
        "author": "P50",
        "issn": "P236",
        "orcidId": "P496",
        "isoLanguageCodeTwoLetter": "P218",
        "ordinalNumber": "P1545",
        "statedAs": "P1932",
        "statedIn": "P248",
        "instanceOf": "P31",
        "pmcId": "P932",
        "retrieved": "P813"
    }
}

function getQidsSearchEngines(){
    return {
        "crossRef": "Q5188229",
        "pubMed": "Q180686"
    }
}

function createCaches(propsDefinition){
    const caches = {
        issn (items) {
          const issns = items
            .map(item => item.ISSN)
            .filter((value, index, array) => array.indexOf(value) === index)
            .join('" "')
        //   return `VALUES ?key { "${issns}" } . ?value wdt:${propsDefinition?.issn ?? "P236"} ?key .`
        return `VALUES ?key { "${issns}" } . ?value wdt:${propsDefinition.issn} ?key .`
        },
        orcid (items) {
          const orcids = []
            .concat(...items.map(
              item => item.author
                ? item.author.map(
                    author => author.ORCID && author.ORCID.replace(/^https?:\/\/orcid\.org\//, '')
                  )
                : undefined
            ))
            .filter((value, index, array) => value && array.indexOf(value) === index)
            .join('" "')
            // return `VALUES ?key { "${orcids}" } . ?value wdt:${propsDefinition?.orcidId ?? "P496"} ?key .`
          return `VALUES ?key { "${orcids}" } . ?value wdt:${propsDefinition.orcidId} ?key .`
        },
        language (items) {
          const languages = []
            .concat(...items.map(
              item => item.language
            ))
            .filter((value, index, array) => value && array.indexOf(value) === index)
            .join('" "')
            // return `VALUES ?key { "${languages}" } . ?value wdt:${propsDefinition?.isoLanguageCodeTwoLetter ?? "P218"} ?key .`
          return `VALUES ?key { "${languages}" } . ?value wdt:${propsDefinition.isoLanguageCodeTwoLetter} ?key .`
        }
    }
    return caches
}




function formatDateForWikidata (dateStr) {
  const isoDate = formatDate(dateStr)
  switch (isoDate.length) {
    case 4:
      return '+' + isoDate + '-01-01T00:00:00Z/9'
    case 7:
      return '+' + isoDate + '-01T00:00:00Z/10'
    case 10:
      return '+' + isoDate + 'T00:00:00Z/11'

    default: return '+' + dateStr
  }
}

function serialize (prop, value, wd, cslType, caches, propsDefinition) {
  switch (prop) {
    case 'page':
      return `"${value.replace('--', '-')}"`
    case 'issued':
      return `${formatDateForWikidata(value)}`
    case 'author':
      if (wd === propsDefinition.author) {
        return value.map((author, index) => {
          if (author.ORCID) {
            const orcid = author.ORCID.replace(/^https?:\/\/orcid\.org\//, '')
            const authorQID = caches.orcid[orcid]
            if (authorQID) {
              const name = formatName(author)
              return name ? `${authorQID}\t${propsDefinition.statedAs}\t"${name}"\t${propsDefinition.ordinalNumber}\t"${index + 1}"` : `${authorQID}\t${propsDefinition.ordinalNumber}\t"${index + 1}"`
            }
          }
          return undefined
        }).filter(Boolean)
      } else {
        return value.map((author, index) => {
          if (author.ORCID) {
            const orcid = author.ORCID.replace(/^https?:\/\/orcid\.org\//, '')
            const authorQID = caches.orcid[orcid]
            if (authorQID) {
              return undefined
            } else {
              const name = formatName(author)
              return name ? `"${name}"\t${propsDefinition.orcidId}\t"${orcid}"\t${propsDefinition.ordinalNumber}\t"${index + 1}"` : undefined
            }
          } else {
            const name = formatName(author)
            return name ? `"${name}"\t${propsDefinition.ordinalNumber}\t"${index + 1}"` : undefined
          }
        }).filter(Boolean)
      }
    case 'ISSN':
      return caches.issn[value]
    case 'DOI':
      return `"${value.toUpperCase()}"`
    case 'ISBN':
      return cslType === 'chapter' ? undefined : `"${value}"`
    case 'URL':
      return cslType === 'article-journal' || cslType === 'chapter' ? undefined : `"${value}"`
    case 'language':
      return caches.language[value]
    case 'number-of-pages':
      return value
    case 'title':
      return `en:"${value}"`

    default: return `"${value}"`
  }
}

export default {
  quickstatements (csl, options) {
    // fill caches
    const types = options?.types ??  getWikiDataTypes();
    const props = options?.props ??  getWikiDataProps();
    const propsDefinition = options?.propsDefinition ??  getWdPropsDefinition();
    const qidsLinkingAssociations = getQidsSearchEngines = options?.qidLargePublishers ?? getQidsSearchEngines();
    const caches = createCaches(propsDefinition);
    const queries = Object.keys(caches)
      .map(cache => {
        const makeQuery = caches[cache]
        //caches[cache] = {}
        return `{ ${makeQuery(csl)} BIND("${cache}" AS ?cache) }`
    })
    .join(' UNION ')
    //console.log(caches)
    const query = `SELECT ?key ?value ?cache WHERE { ${queries} }`

    try {
      const wikibaseInstance = wbs(options.wikibaseConfig ?? {
        instance: 'https://www.wikidata.org',
        sparqlEndpoint: 'https://query.wikidata.org/sparql'
      });
      const url = wikibaseInstance.sparqlQuery(query)
      const response = JSON.parse(util.fetchFile(url))
      const results = wikibaseInstance.simplify.sparqlResults(response)

      for (const { key, value, cache } of results) {
        caches[cache][key] = value
      }
    } catch (e) {
      console.error(e)
    }

    // generate output
    let output = ''
    for (const item of csl) {
      let prov = ''
      if (item.source) {
        if (item.source === 'PubMed') {
          prov = `${prov}\t${(propsDefinition.statedIn).replace("P", "S")}\t${qidsLinkingAssociations.pubMed}`
        } else if (item.source === 'Crossref') {
          prov = `${prov}\t${(propsDefinition.statedIn).replace("P", "S")}\t${qidsLinkingAssociations.crossRef}`
        }
        if (item.accessed) {
          prov = `${prov}'\t${(propsDefinition.retrieved).replace("P", "S")}\t${formatDateForWikidata(item.accessed)}`
        } else {
          prov = `${prov}\t${(propsDefinition.statedIn).replace("P", "S")}\t+${new Date().toISOString().substring(0, 10)}T00:00:00Z/11`
        }
        if (item._graph && item._graph[0] && item._graph[0].type === '@pubmed/pmcid' && item._graph[0].data) {
          prov = `${prov}'\t${(propsDefinition.pmcId).replace("P", "S")}\t"${item._graph[0].data}"`
          // FIXME: if data is a list
        }
      }
      if (types[item.type]) {
        const wdType = types[item.type]
        output = `${output}\tCREATE\n\n\tLAST\t${propsDefinition.instanceOf}\t${wdType}${prov}\n`
        output = `${output}\tLAST\tLen\t"${item.title}"\n`

        for (const wd in props) {
          const prop = props[wd]
          const value = item[prop]

          if (value == null) continue

          const serializedValue = serialize(prop, value, wd, item.type, caches, options.propsDefinition)

          if (serializedValue == null) continue

          output += []
            .concat(serializedValue)
            .map(value => `\tLAST\t${wd}\t${value}${prov}\n`)
            .join('')
        }
        output = output + '\n'
      }
    }
    return output
  }
}
