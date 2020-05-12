const fs = require('fs');
const axios = require('axios').default
const cheerio = require('cheerio')

const extractPoets = async (text) => {
  var $ = await cheerio.load(text)
  
  var result = [];
  
  $('div#mw-content-text > div > div > ul > li').each((i, aElem) => { 
    var m = $(aElem).text().match(/(.*).\((....).(....)\)/); 
    if (m) {
      result.push({
        name: m[1], 
        birth_year: m[2], 
        death_year: m[3],
        href: 'https://de.wikipedia.org' + $(aElem).find('a').attr('href')
      })
    }
  })

  return result
 }

 const extractPoetDetails = async (text, poet) => {
  var $ = await cheerio.load(text)
  
  var result = poet
  
  var firstPara = $('div#mw-content-text > div > p').text()
  //console.log(firstPara)

  var re = new RegExp(`\\(.*?\\*.*? in (.*?)\\;(.*?)[\\)\\;]`)
  var matches = firstPara.match(re)

  if (!matches) {
    // retry
    matches = firstPara.match(`geboren .*? in (.*?)[\\)\\;](.*?)\\)`)
  }

  //console.log(matches)
  if (matches[1].match(/(.*) als/)) {
    // filter als ... 
    result.birth_place = matches[1].match(/(.*) als/)[1]
  } else if (matches[1].match(/(.*?)[\;\,\(]/)) {
    // filter Wien (Österreich) 
    result.birth_place = matches[1].match(/(.*?)[\;\,\(]/)[1]
  } else {
    result.birth_place = matches[1]
  }

  /// ebenda
  if (matches[2].match(/ebenda/)) {
    result.death_place = matches[1]
  } else if (matches[2].match(/in/)) {
    result.death_place = matches[2].match(/.*? in (.*)/)[1]
  } else {
    result.death_place = ""
  }

  if (result.death_place.match(/(.*?)[\;\,\(]/)) {
    // filter Wien (Österreich) 
    result.death_place = result.death_place.match(/(.*?)[\;\,\(]/)[1]
  }

  return result
 }


 (async () => {
  //const textList = await axios.get('https://de.wikipedia.org/wiki/Liste_deutscher_Komponisten_klassischer_Musik').data
  const textList = await fs.readFileSync('./Liste_deutscher_Komponisten_klassischer_Musik')
  const poets = await extractPoets(textList);
  
  var poetDetails = [];
  for (p of poets) {
    try {
        //const poet_text = await fs.readFileSync('./Minna_Bachem-Sieger')
        const poet_text = await (await axios.get(p.href)).data
        //console.log(poet_text)
        const np = await extractPoetDetails(poet_text, p)
//        console.log(np)
        
        try {
          // get geolocation
          console.log(`geolocating ${np.birth_place} and ${np.death_place}`)

          //const birth_geoloc = await (await axios.get(`https://geocode.xyz/${encodeURIComponent(np.birth_place)}?json=1`)).data
          const birth_geoloc = await (await axios.get(`https://eu1.locationiq.com/v1/search.php?key=6e244205b93cbe&q=${encodeURIComponent(np.birth_place)}&format=json`)).data
//          np.birth_loc = { lat: birth_geoloc.latt, lon: birth_geoloc.longt }
          np.birth_loc = { lat: birth_geoloc[0].lat, lon: birth_geoloc[0].lon }
          if (np.death_year) {
            await new Promise(resolve => setTimeout(resolve, 1000))
            const death_geoloc = await (await axios.get(`https://eu1.locationiq.com/v1/search.php?key=6e244205b93cbe&q=${encodeURIComponent(np.death_place)}&format=json`)).data
//            const death_geoloc = await (await axios.get(`https://geocode.xyz/${encodeURIComponent(np.death_place)}?json=1`)).data
//            np.death_loc = { lat: death_geoloc.latt, lon: death_geoloc.longt }
            np.death_loc = { lat: death_geoloc[0].lat, lon: death_geoloc[0].lon }
          } else {
            np.death_loc = null
          }
          console.log(np)
        } catch (err) {
          console.log('failed to add lat/lon: ' + err)
        }
        poetDetails.push(np)
    } catch (err) {
        console.log(err)
    }
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  fs.writeFileSync('./allComposers.json', JSON.stringify(poetDetails));
 })()