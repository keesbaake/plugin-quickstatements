import "@babel/register"
import "../src/index.js"
import { Cite} from '@citation-js/core'
import '@citation-js/plugin-doi'
import '@citation-js/plugin-isbn'
import '@citation-js/plugin-ris'
import '@citation-js/plugin-pubmed'

const options = {
    "wikibaseConfig": {
      "instance": "http://informationliteracy-wb.westeurope.cloudapp.azure.com",
      "sparqlEndpoint": "http://informationliteracy-wb.westeurope.cloudapp.azure.com/proxy/wdqs/bigdata/namespace/wdq/sparql"
    },
    "propMapping": {
      "P4": "author",
      "P45": "ISBN",
      "P47": "Page",
      "P26": "DOI",
      "P8": "language",
      "P27": "issue",
      "P28": "volume",
      "P29": "issued",
      "P44": "ORCID",
      "P50": "PMID",
      "P36": "URL",
      "P48": "PMCID",
      "P49": "number-of-pages",
      "P46": "ISSN",
      "P30": "title",
      "P31": "author",
      "P22": "citesWork" 
      //"PX": "keyword"
    },
    "types": {
      "article": "Q26",
      "article-journal": "Q27",
      "article-magazine": "Q33",
      "article-newspaper": "Q29",
      //"bill":"",
      "broadcast": "Q30",
      "chapter": "Q31",
      "dataset": "Q32",
      "entry": "Q33",
      "entry-dictionary": "Q34",
      "entry-encyclopedia": "Q35",
      "figure": "Q36",
      //"interview":"Q178651",
      //"legal_case":"Q2334719",
      //"legislation":"Q49371",
      "manuscript": "Q38",
      //"map":"Q4006",
      //"motion_picture":"Q11424",
      //"musical_score":"Q187947",
      "paper-conference": "Q39",
      //"patent":"",
      "post": "Q40",
      "post-weblog": "Q41",
      "report": "Q42",
      "review": "Q43",
      "review-book": "Q44",
      //"song":"Q7366",
      "speech": "Q45",
      "thesis": "Q46",
      //"treaty":"Q131569",
      "webpage": "Q47",
      "graphic": "Q48",
      //"pamphlet":"Q190399",
      "personal_communication": "Q49"
    },
    "propsDefinition": {
      "author": "P4",
      "issn": "P46",
      "orcidId": "P44",
      "isoLanguageCodeTwoLetter": "P42",
      "ordinalNumber": "P43",
      "statedAs": "P41",
      "statedIn": "P2",
      "instanceOf": "P1",
      "pmcId": "P50",
      "retrieved": "P25",
      "doi": "P26",
      "citesWork": "P22",
      "isbn": "P45"
    },
    "qidsLinkingAssociations": {
      "crossRef": "Q54",
      "pubMed": "Q101"
    },
}




Cite.async([
    '10.1108/EUM0000000007083',
    '10.2190/8DD8-NUNF-AMQ5-B0QF',
    '1135434980',
    '10.1007/BF03172655',
    '9051892268',
    '0893917575',
    '0938865978',
    '10.1108/eb026919',
    '10.1007/BF02299474',
    '10.1007/BF02299682',
    '10.1007/BF02504914',
    '10.1016/S1389-1286(00)00031-1',
    '10.1108/eb026960',
    '0435805207',
    '10.1080/0158791970180111',
    '1591580943',
    '10.1007/BF02313485',
    '10.1046/j.1365-2729.2000.00145.x',
    '10.1023/A:1024510531605',
    '10.1111/1467-8535.00211',
    '0521586747',
    '10.1006/ceps.1995.1001',
    '10.3102/0013189X018001016',
    '1136778276',
    '10.1016/1041-6080(89)90011-3',
    // '10.1002/(SICI)1097-4571(199705)48:5<382::AID-ASI2>3.0.CO;2-R',
    '0938865978',
    '0872876381',
    '10.1016/S0953-5438(98)00013-7',
    '0877782989',
    '10.1007/BF03172925',
    '10.1111/j.2044-8279.1998.tb01281.x',
    '10.1108/EUM0000000007145',
    '10.1080/15391523.2003.10782389',
    // '10.1002/1097-4571(2000)9999:9999<::AID-ASI1034>3.0.CO;2-2',
    '10.1016/J.CHB.2004.10.005'
])
  .then(async (c) => {
    //options['references'] = [["10.1016/j.chb.2004.10.005","10.1016/j.compedu.2009.06.004","10.1016/j.chb.2007.01.024","10.1016/j.learninstruc.2010.02.003","10.2304/plat.2013.12.1.96","10.1016/j.acalib.2004.09.008","10.1016/j.acalib.2014.04.012","10.1007/BF02505024","10.1007/BF02504993","10.1007/978-1-4419-8126-4_13","10.1108/CWIS-07-2013-0029","10.3102/003465430298487"]];
    options.hasFlagAuthorsOnly = true;
    const output = await c.format('quickstatements', options);
    
    console.log(output);
    
  })
 .catch(console.error)





 