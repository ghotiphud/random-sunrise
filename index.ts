import { LatLon } from "./latLon";
import sunriseClient, { SunriseResult } from "./sunriseClient";

// Generate a list of 100 random lat / long points around the world 
let locations: LatLon[] = Array.from({ length: 100 }, () => randomLatLon());

// Fetch sunrise/sunset times for all points, but never run more than 5 in parallel
// sunriseClient handles the 5 in parallel requirement.
Promise.all(locations.map(loc => sunriseClient.get(loc)))
  .then(sunrises => {
    // Find earliest sunrise and list the day length for this time
    var earliest = findEarliestSunrise(sunrises);
    console.log(earliest);
    console.log(earliest.day_length);
  })
  .catch(err => {
    console.error(err);
  });

// Due to the structure of the ISO 8601 date format returned by the API, unparsed strings here are directly comparable
// If we were doing more sophisticated things with the dates/times, the client should probably return them as parsed values instead of raw strings.
function findEarliestSunrise(sunrises: SunriseResult[]): SunriseResult {
  return sunrises.reduce((a,b) => {
    return a.sunrise < b.sunrise ? a : b;
  });
}

/** Returns a random number between from and to */
function randomInRange(from: number, to: number) {
  return Math.random() * (to - from) + from;
}

/** Returns a random Latitude and Longitude */
function randomLatLon(): LatLon {
  return {
    lat: randomInRange(-180, 180),
    lon: randomInRange(-180, 180),
  };
}