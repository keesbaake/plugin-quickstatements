import { format as formatDate } from "@citation-js/date";
import { format as formatName } from "@citation-js/name";
import { util } from "@citation-js/core";
import wbs from "wikibase-sdk";
// import * as https from "https";
// import { escape } from "querystring";

async function searchOrcidApi(queryString) {
  let rawResponse;
  let orcids = [];
  try {
    rawResponse = await util.fetchFileAsync(
        `https://pub.orcid.org/v3.0/search?q=${escape(queryString)}`,
        {
          headers: { accept: "application/json" },
        }
      );
  } catch (error) {
      return orcids;
  }
  const responseJson = JSON.parse(rawResponse);
  const orcidRecords = responseJson.result;

  if (orcidRecords && orcidRecords.length) {
    orcids = orcidRecords.map(
      (orcidRecord) => orcidRecord["orcid-identifier"].path
    );
  }
  return orcids;
}

async function getOrcidPerson(orcid) {
  const person = { orcid: orcid };
  let personResponse;
  try {
    personResponse = await util.fetchFileAsync(
        `https://pub.orcid.org/v3.0/${orcid}/person`,
        {
          headers: { accept: "application/json" },
        }
      );
  } catch (error) {
      return person;
  }

  const dataJson = JSON.parse(personResponse);
  if (dataJson.name) {
    if (dataJson.name["given-names"])
      person.given = dataJson.name["given-names"].value;
    if (dataJson.name["family-name"])
      person.family = dataJson.name["family-name"].value;
  }
  return person;
}

function getMatchingOrcid(author, orcidPersons) {
  const matchingPerson = orcidPersons.find((orcidPerson) => {
    return (
      author.family.toLowerCase() == orcidPerson.family.toLowerCase() &&
      author.given.toLowerCase() == orcidPerson.given.toLowerCase()
    );
  });
  if (!matchingPerson) {
    orcidPersons.find((orcidPerson) => {
      return (
        author.family.toLowerCase() == orcidPerson.family.toLowerCase() &&
        author.given.split(" ")[0].toLowerCase() ==
          orcidPerson.given.toLowerCase()
      );
    });
  }
  return matchingPerson?.orcid;
}

function getWikiDataProps() {
  return {
    P50: "author",
    P212: "ISBN",
    P304: "page",
    P356: "DOI",
    P407: "language",
    P433: "issue",
    P478: "volume",
    P577: "issued",
    P496: "ORCID",
    P698: "PMID",
    P856: "URL",
    P932: "PMCID",
    P1104: "number-of-pages",
    P1433: "ISSN",
    P1476: "title",
    P2093: "author",
  };
}

function getWikiDataTypes() {
  // the below mappings should follow the following Wikidata SPARQL query:
  //
  // SELECT * WHERE{
  //   ?s wdt:P2888 ?o .
  //   FILTER(STRSTARTS(STR(?o), "https://citationstyles.org/ontology/type/"))
  // }
  //
  // Except when noted otherwise
  return {
    article: "Q191067",
    "article-journal": "Q13442814",
    "article-magazine": "Q30070590",
    "article-newspaper": "Q5707594",
    bill: "Q686822",
    broadcast: "Q11578774",
    chapter: "Q1980247",
    dataset: "Q1172284",
    entry: "Q10389811",
    "entry-dictionary": "Q1580166",
    "entry-encyclopedia": "Q13433827",
    figure: "Q30070753",
    interview: "Q178651",
    legal_case: "Q2334719",
    legislation: "Q49371",
    manuscript: "Q87167",
    map: "Q4006",
    motion_picture: "Q11424",
    musical_score: "Q187947",
    "paper-conference": "Q23927052",
    patent: "Q253623",
    post: "Q7216866",
    "post-weblog": "Q17928402",
    report: "Q10870555",
    review: "Q265158",
    "review-book": "Q637866",
    song: "Q7366",
    speech: "Q861911",
    thesis: "Q1266946",
    treaty: "Q131569",
    webpage: "Q36774",

    // Exception: each book edition has a unique ISBN; otherwise use Q571 (book)
    book: "Q3331189",

    // Three types have no exact match in Wikidata; these are alternatives
    // Q4502142 (visual artwork) does not include non-artwork graphics (in theory)
    graphic: "Q4502142",
    // pamphlet: unsure whether exact match
    pamphlet: "Q190399",
    // Q628523 (message) also includes prophecies, protests, animal scent marks
    personal_communication: "Q628523",
  };
}

function getWdPropsDefinition() {
  return {
    author: "P50",
    issn: "P236",
    orcidId: "P496",
    isoLanguageCodeTwoLetter: "P218",
    ordinalNumber: "P1545",
    statedAs: "P1932",
    statedIn: "P248",
    instanceOf: "P31",
    pmcId: "P932",
    retrieved: "P813",
  };
}

function getQidsSearchEngines() {
  return {
    crossRef: "Q5188229",
    pubMed: "Q180686",
  };
}

function createCaches(propsDefinition) {
  const caches = {
    doi(items) {
      const dois = items
        .map((item) => item.DOI)
        .filter((value, index, array) => array.indexOf(value) === index)
        .join('" "');
      return `?value wdt:${propsDefinition.doi} ?doi . VALUES ?key { "${dois}" } . FILTER (lcase(str(?doi)) = lcase(?key))`;
    },
    issn(items) {
      const issns = items
        .map((item) => item.ISSN)
        .filter((value, index, array) => array.indexOf(value) === index)
        .join('" "');
      return `VALUES ?key { "${issns}" } . ?value wdt:${propsDefinition.issn} ?key .`;
    },
    orcidStatements(items) {
      const dois = items
        .map((item) => item.DOI)
        .filter((value, index, array) => array.indexOf(value) === index)
        .join('" "');
      return `?item wdt:${propsDefinition.doi} ?doi . VALUES ?dois { "${dois}" } . FILTER (lcase(str(?doi)) = lcase(?dois)).
       ?item wdt:${propsDefinition.author} ?value. ?value wdt:${propsDefinition.orcidId} ?orcid.
       BIND(concat(str(?orcid), "_", STRAFTER(STR(?item), STR(wd:))) as ?key ).`;
    },
    referenceStatements(items) {
      const dois = items
        .map((item) => item.DOI)
        .filter((value, index, array) => array.indexOf(value) === index)
        .join('" "');
      return `?item wdt:${propsDefinition.doi} ?doi . VALUES ?dois { "${dois}" } . FILTER (lcase(str(?doi)) = lcase(?dois)).
         ?item wdt:${propsDefinition.citesWork} ?value. ?value wdt:${propsDefinition.isbn}|wdt:${propsDefinition.doi} ?refDoi.
         BIND(concat(str(?refDoi), "_", STRAFTER(STR(?item), STR(wd:))) as ?key ).`;
    },
    references(referenceIds) {
      const ids = referenceIds
        .map((ref) => ref.toUpperCase())
        .filter((value, index, array) => array.indexOf(value) === index)
        .join('" "');
      return `?value (wdt:${propsDefinition.doi} | wdt:${propsDefinition.isbn}) ?identifier . VALUES ?key { "${ids}" } . FILTER (lcase(str(?identifier)) = lcase(?key))`;
    },
    orcid(items) {
      const orcids = []
        .concat(
          ...items.map((item) =>
            item.author
              ? item.author.map(
                  (author) =>
                    author.ORCID &&
                    author.ORCID.replace(/^https?:\/\/orcid\.org\//, "")
                )
              : undefined
          )
        )
        .filter(
          (value, index, array) => value && array.indexOf(value) === index
        )
        .join('" "');
      return `VALUES ?key { "${orcids}" } . ?value wdt:${propsDefinition.orcidId} ?key .`;
    },
    language(items) {
      const languages = []
        .concat(...items.map((item) => item.language))
        .filter(
          (value, index, array) => value && array.indexOf(value) === index
        )
        .join('" "');
      return `VALUES ?key { "${languages}" } . ?value wdt:${propsDefinition.isoLanguageCodeTwoLetter} ?key .`;
    },
  };
  return caches;
}

function formatDateForWikidata(dateStr) {
  const isoDate = formatDate(dateStr);
  switch (isoDate.length) {
    case 4:
      return "+" + isoDate + "-01-01T00:00:00Z/9";
    case 7:
      return "+" + isoDate + "-01T00:00:00Z/10";
    case 10:
      return "+" + isoDate + "T00:00:00Z/11";

    default:
      return "+" + dateStr;
  }
}

function authorQuickstatement(author, index, wdProp, propsDefinition, caches) {
  const name = formatName(author);
  if (!author.ORCID?.length) {
    return name && wdProp !== propsDefinition.author
      ? `"${name}"\t${propsDefinition.ordinalNumber}\t"${index + 1}"`
      : undefined;
  }
  const orcid = author.ORCID.replace(/^https?:\/\/orcid\.org\//, "");
  const authorQID = caches.orcid[orcid];
  if (!authorQID) {
    return name
      ? `"${name}"\t${propsDefinition.orcidId}\t"${orcid}"\t${
          propsDefinition.ordinalNumber
        }\t"${index + 1}"`
      : undefined;
  }
  if (wdProp === propsDefinition.author) {
    return name
      ? `${authorQID}\t${propsDefinition.statedAs}\t"${name}"\t${
          propsDefinition.ordinalNumber
        }\t"${index + 1}"`
      : `${authorQID}\t${propsDefinition.ordinalNumber}\t"${index + 1}"`;
  }
  return undefined;
}

function serialize(item, cslProp, wdProp, caches, propsDefinition) {
  const itemType = item.type;
  const value = item[cslProp];
  switch (cslProp) {
    case "author":
      return value
        .map((author, index) => {
          const formattedAuthor = authorQuickstatement(
            author,
            index,
            wdProp,
            propsDefinition,
            caches
          );
          return formattedAuthor;
        })
        .filter(Boolean);
    case "page":
      return `"${value.replace("--", "-")}"`;
    case "issued":
      return `${formatDateForWikidata(value)}`;
    case "ISSN":
      return caches.issn[value];
    case "DOI":
      return `"${value.toUpperCase()}"`;
    case "ISBN":
      return itemType === "chapter" ? undefined : `"${value}"`;
    case "URL":
      return itemType === "article-journal" || itemType === "chapter"
        ? undefined
        : `"${value}"`;
    case "language":
      return caches.language[value];
    case "number-of-pages":
      return value;
    case "title":
      return `en:"${value}"`;
    default:
      return `"${value}"`;
  }
}

function exportAuthorsToQuickstatements(authors, propsDefinition) {
  let output = "";
  authors.forEach((author) => {
    const name = formatName(author);
    output = `${output}\tCREATE\n\n\tLAST\tLen\t"${name}"\n`;
    output = `${output}\tLAST\tDen\t"Researcher"\n`;
    output = `${output}\tLAST\t${
      propsDefinition.orcidId
    }\t"${author.ORCID.replace(/^https?:\/\/orcid\.org\//, "")}"\n`;
    output = `${output}\n`;
  });
  return output;
}

function addAuthors(item, qidMainArticle, propsDefinition, prov, caches) {
  const wdPropAuthor = propsDefinition.author;
  const orcidAuthors = item.author.filter((author) => author.ORCID?.length);
  const authorQuickStatements = orcidAuthors
    .map((author, index) => {
      const cacheKey = `${author.ORCID}_${qidMainArticle}`;
      const authorCache = caches["orcidStatements"][cacheKey];
      if (authorCache) {
        return undefined;
      }
      return authorQuickstatement(
        author,
        index,
        wdPropAuthor,
        propsDefinition,
        caches
      );
    })
    .filter(Boolean)
    .map((stub) => `\t${qidMainArticle}\t${wdPropAuthor}\t${stub}${prov}\n`)
    .join("");
  return authorQuickStatements;
}

function addReferences(item, qidMainArticle, propsDefinition, prov, caches) {
  console.log("addReferences");
  const wdPropCitesWork = propsDefinition.citesWork;
  if (!item.references?.length) {
    return undefined;
  }
  const referenceQuickStatements = item.references
    .map((ref) => {
      const cacheKey = `${ref}_${qidMainArticle}`;
      const refCache = caches["referenceStatements"][cacheKey];
      if (refCache) {
        return undefined;
      }
      const refQid = caches["references"][ref.toUpperCase()];
      return refQid ? refQid : undefined;
    })
    .filter(Boolean)
    .map(
      (refQid) => `\t${qidMainArticle}\t${wdPropCitesWork}\t${refQid}${prov}\n`
    )
    .join("");
  return referenceQuickStatements;
}

function getProv(item, propsDefinition, qidsLinkingAssociations) {
  let prov = "";
  if (item.source) {
    if (item.source === "PubMed") {
      prov = `${prov}\t${propsDefinition.statedIn.replace("P", "S")}\t${
        qidsLinkingAssociations.pubMed
      }`;
    } else if (item.source === "Crossref") {
      prov = `${prov}\t${propsDefinition.statedIn.replace("P", "S")}\t${
        qidsLinkingAssociations.crossRef
      }`;
    }
    if (item.accessed) {
      prov = `${prov}'\t${propsDefinition.retrieved.replace(
        "P",
        "S"
      )}\t${formatDateForWikidata(item.accessed)}`;
    } else {
      prov = `${prov}\t${propsDefinition.retrieved.replace(
        "P",
        "S"
      )}\t+${new Date().toISOString().substring(0, 10)}T00:00:00Z/11`;
    }
    if (
      item._graph &&
      item._graph[0] &&
      item._graph[0].type === "@pubmed/pmcid" &&
      item._graph[0].data
    ) {
      prov = `${prov}'\t${propsDefinition.pmcId.replace("P", "S")}\t"${
        item._graph[0].data
      }"`;
      // FIXME: if data is a list
    }

    return prov;
  }
}

export default {
  async quickstatements(csl, options) {
    const types = options?.types ?? getWikiDataTypes();
    const propMapping = options?.propMapping ?? getWikiDataProps();
    const propsDefinition = options?.propsDefinition ?? getWdPropsDefinition();
    const qidsLinkingAssociations = (getQidsSearchEngines =
      options?.qidsLinkingAssociations ?? getQidsSearchEngines());

    if (options?.references?.length) {
      csl.forEach(
        (cslEntry, i) => (cslEntry.references = options.references[i])
      );
    }

    const isQueryOrcidApiOn = options?.isQueryOrcidApiOn ?? true;
    if (isQueryOrcidApiOn) {
      await Promise.all(
        csl.map(async (cslEntry) => {
          let queryString = `doi-self:${cslEntry.DOI}`;
          let orcids = await searchOrcidApi(queryString);
          let orcidPersons =  await Promise.all(orcids.map(getOrcidPerson));
          orcidPersons = orcidPersons.filter((person) => person.name?.given && person.name?.family);
          for (const author of cslEntry.author) {
            author.ORCID ??= getMatchingOrcid(author, orcidPersons);
            if (!author.ORCID?.length) {
              const name = formatName(author);
              queryString = `(family-name:${author.family} AND given-names:${author.given})`;
              orcids = await searchOrcidApi(queryString);
              if (orcids.length === 1) {
                author.ORCID = orcids[0];
                continue;
              }
              queryString = `(family-name:${author.family} AND given-names:${
                author.given
              }) OR (family-name:${author.family} AND given-names:${
                name.split(" ")[0]
              })`;
              orcids = await searchOrcidApi(queryString);
              if (orcids.length === 1) {
                author.ORCID = orcids[0];
              }
            }
          }
        })
      );
    }
    const caches = createCaches(propsDefinition);
    const queries = Object.keys(caches)
      .map((cache) => {
        const makeQuery = caches[cache];
        if (cache === "references") {
          const flattedRefs = csl
            .flatMap((item) => item.references)
            .filter(Boolean);
          return flattedRefs.length
            ? `{ ${makeQuery(flattedRefs)} BIND("${cache}" AS ?cache) }`
            : "";
        }
        return `{ ${makeQuery(csl)} BIND("${cache}" AS ?cache) }`;
      })
      .filter(Boolean)
      .join(" UNION ");
    const query = `SELECT ?key ?value ?cache WHERE { ${queries} }`;

    try {
      const wikibaseInstance = wbs(
        options?.wikibaseConfig ?? {
          instance: "https://www.wikidata.org",
          sparqlEndpoint: "https://query.wikidata.org/sparql",
        }
      );
      const url = wikibaseInstance.sparqlQuery(query);
      const response = JSON.parse(util.fetchFile(url));
      const results = wikibaseInstance.simplify.sparqlResults(response);

      for (const { key, value, cache } of results) {
        caches[cache][key] = value;
      }
    } catch (e) {
      console.error(e);
    }

    if (options?.hasFlagAuthorsOnly) {
      let authors = csl.flatMap((cslEntry) => cslEntry.author);
      authors = authors.filter((author) => author.ORCID?.length);
      //   if (options.hasCheckForDuplicates) {
      authors = authors.filter((author) => !caches.orcid[author.ORCID]);
      //   }
      authors = authors.filter(
        (author, index) =>
          authors.map((x) => x.ORCID).indexOf(author.ORCID) === index
      );
      return exportAuthorsToQuickstatements(authors, propsDefinition);
    }

    // generate output
    let output = "";
    // for (const item of csl) {
    csl.forEach((item) => {
      const prov = getProv(item, propsDefinition, qidsLinkingAssociations);
      if (types[item.type]) {
        const wdType = types[item.type];
        if (caches.doi[item.DOI]) {
          const qidMainArticle = caches.doi[item.DOI];
          output += addAuthors(
            item,
            qidMainArticle,
            propsDefinition,
            prov,
            caches
          );
          output += addReferences(
            item,
            qidMainArticle,
            propsDefinition,
            prov,
            caches
          );
          return;
        }

        output = `${output}\tCREATE\n\n\tLAST\t${propsDefinition.instanceOf}\t${wdType}${prov}\n`;
        output = `${output}\tLAST\tLen\t"${item.title}"\n`;

        // for (const wdProp in propMapping) {
        Object.keys(propMapping).forEach((wdProp) => {
          const cslProp = propMapping[wdProp];
          const value = item[cslProp];
          if (value == null) return;

          const serializedValue = serialize(
            item,
            cslProp,
            wdProp,
            caches,
            propsDefinition
          );

          if (serializedValue == null) return;

          output += []
            .concat(serializedValue)
            .map((value) => `\tLAST\t${wdProp}\t${value}${prov}\n`)
            .join("");
        });
        output = output + "\n";
      }
    });

    return output;
  },
};

// function handleAuthor(value, wd, propsDefinition){
//     if (wd === propsDefinition.author) {
//         return value
//           .map((author, index) => {
//             if (author.ORCID) {
//               const orcid = author.ORCID.replace(
//                 /^https?:\/\/orcid\.org\//,
//                 ""
//               );
//               const authorQID = caches.orcid[orcid];
//               if (authorQID) {
//                 const name = formatName(author);
//                 return name
//                   ? `${authorQID}\t${propsDefinition.statedAs}\t"${name}"\t${
//                       propsDefinition.ordinalNumber
//                     }\t"${index + 1}"`
//                   : `${authorQID}\t${propsDefinition.ordinalNumber}\t"${
//                       index + 1
//                     }"`;
//               }
//             }
//             return undefined;
//           })
//           .filter(Boolean);
//       } else {
//         return value
//           .map((author, index) => {
//             if (author.ORCID) {
//               const orcid = author.ORCID.replace(
//                 /^https?:\/\/orcid\.org\//,
//                 ""
//               );
//               const authorQID = caches.orcid[orcid];
//               if (authorQID) {
//                 return undefined;
//               } else {
//                 const name = formatName(author);
//                 return name
//                   ? `"${name}"\t${propsDefinition.orcidId}\t"${orcid}"\t${
//                       propsDefinition.ordinalNumber
//                     }\t"${index + 1}"`
//                   : undefined;
//               }
//             } else {
//               const name = formatName(author);
//               return name
//                 ? `"${name}"\t${propsDefinition.ordinalNumber}\t"${index + 1}"`
//                 : undefined;
//             }
//           })
//           .filter(Boolean);
//       }
// }
