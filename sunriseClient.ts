import { URL } from "url";
import * as https from 'https';

import { LatLon } from "./latLon";

const baseUrl = new URL("https://api.sunrise-sunset.org/json");

/** Set maximum concurrent calls to 5 by limiting the number of sockets.
 * If the overhead of allocating the promise closures became a performance issue, we could also limit at a higher level.
 * KeepAlive to save on connection requests to the same domain. 
 */
const httpsAgent = new https.Agent({maxSockets: 5, keepAlive: true});

const defaultOpts = {
  agent: httpsAgent
};

/** Wrap the standard https.get in a Promise API for convenience. */
function httpGetJson<T>(url: URL): Promise<T> {
  return new Promise((resolve, reject) => {
    var req = https.get(
      url,
      defaultOpts,
      (res) => {
        // reject on bad status
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error('statusCode=' + res.statusCode));
        }

        res.setEncoding("utf8");
        let body = "";

        res.on("data", (data) => {
          body += data;
        });

        res.on("end", () => {
          try {
            let result = JSON.parse(body);
            resolve(result);
          } catch (e) {
            reject(e);
          }
        });
      }
    );

    req.on("error", err => {
      reject(err);
    });

    req.end();

    return req;
  });
}

export default {
  /** Get a SunriseResult based on the location */
  get: async (location: LatLon): Promise<SunriseResult> => {
    let apiUrl = baseUrl;

    // 7 decimal places is the maximum that sunrise-sunset can handle.
    apiUrl.searchParams.set('lat', location.lat.toFixed(7));
    apiUrl.searchParams.set('lng', location.lon.toFixed(7));
    // return iso formatted dates so they can be easily parsed.
    apiUrl.searchParams.set('formatted', '0');
    
    let retries = 0;

    // While testing the API it frequently returned responses where the day_length was zero
    // To handle these incorrect responses, retrying the request was necessary, but immediate retries were
    // also likely to return the same bad result, likely due to caching, so a wait time was inserted to handle this.
    // exponential backoff or other error handling mechanisms could be used if this simple one was an issue.
    while(true){
      var resp = await httpGetJson<SunriseResponse>(apiUrl);
      
      if(resp.status === "OK" && resp.results.day_length != 0){
        return resp.results;
      } else {
        if(retries < 5 && (resp.status === "OK" || resp.status === "UNKNOWN_ERROR")) {
          retries++;
          await sleep(10);
          continue;
        } else {
          throw new Error("Sunrise API status: " + resp.status + "  Day length: " + resp.results.day_length);
        }
      }
    }
  },
};

/** helper function awaitable sleep */
async function sleep(millis: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, millis));
}


// Public API Interfaces
export interface SunriseResult {
  sunrise: string,
  sunset: string,
  solar_noon: string,
  day_length: number,
  civil_twilight_begin: string,
  civil_twilight_end: string,
  nautical_twilight_begin: string,
  nautical_twilight_end: string,
  astronomical_twilight_begin: string,
  astronomical_twilight_end: string
}

// private interfaces
interface SunriseResponse {
  results: SunriseResult,

  ///"OK": indicates that no errors occurred;
  ///"INVALID_REQUEST": indicates that either lat or lng parameters are missing or invalid;
  ///"INVALID_DATE": indicates that date parameter is missing or invalid;
  ///"UNKNOWN_ERROR": indicates that the request could not be processed due to a server error. The request may succeed if you try again.
  status: "OK" | "INVALID_REQUEST" | "INVALID_DATE" | "UNKNOWN_ERROR"
}
