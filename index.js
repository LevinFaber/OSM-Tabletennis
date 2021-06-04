const INTERPRETER = "https://lz4.overpass-api.de/api/interpreter";

const mapInstance = L.map("mapid").setView([50.937599587518676, 6.954994823413924], 10);
L.tileLayer("https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}", {
    attribution: "Map data &copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors, Imagery © <a href=\"https://www.mapbox.com/\">Mapbox</a>",
    maxZoom: 18,
    id: "mapbox/streets-v11",
    tileSize: 512,
    zoomOffset: -1,
    accessToken: "pk.eyJ1IjoibGZhLXRpbWV0b2FjdCIsImEiOiJjazQwMzVpMnAxdnl0M2xvcGR6MTN1NXJyIn0.Im9rwBa3gF7jjD3cUUlzlg"
}).addTo(mapInstance);
const markerClusterGroup = L.markerClusterGroup({
    disableClusteringAtZoom: 16,
    spiderfyOnMaxZoom: false,
});
mapInstance.addLayer(markerClusterGroup);
window.map = mapInstance;
function init() {
    window.knownChunks = [];
    window.drawnMarkers = [];
    initalizeFromLocalstorage();
    reDrawMarkers();
    mapInstance.on("moveend", () => {
        reDrawMarkers();
    });

    /*     mapInstance.on('zoomend', () => {
            removeMarkers();
        }); */
}
init();

function initalizeFromLocalstorage() {
    const data = localStorage.getItem("knownChunks");

    if (data != null) {
        window.knownChunks = JSON.parse(data);
    }
    const limit = mapInstance.getBounds();
    window.knownChunks.forEach(chunk => {
        if (Array.isArray(chunk)) {
            chunk.forEach(slot => {
                if (Array.isArray(slot)) {
                    slot.forEach(markerData => { addMarker(markerData, limit); });
                }
            });
        }
    });
}

function isInBounds(lat, lng, limit) {
    const { _southWest: lower, _northEast: upper } = limit;
    return lower.lat < lat && lower.lng < lng && upper.lat > lat && upper.lng > lng;
}

function addMarker(markerData) {
    const { lat, lon, tags } = markerData;

    const exists = window.drawnMarkers.findIndex(({ _latlng }) => _latlng.lat === lat && _latlng.lng === lon);
    if (exists != -1) {
        return;
    }

    const marker = L.marker([lat, lon]);
    markerClusterGroup.addLayer(marker);
    // marker.addTo(mapInstance);
    window.drawnMarkers.push(marker);
    if (tags) {
        const popupText = Object.entries(tags)
            .filter(([tagName]) => tagName != "leisure" || tagName != "sport")
            .reduce((acc, curr) => {
                return acc + `${curr[0]}: ${curr[1]}<br>`;
            }, "");

        marker.bindPopup(popupText);

        marker.on("mouseover", function (e) {
            this.openPopup();
        });
        marker.on("mouseout", function (e) {
            this.closePopup();
        });
        marker.on("touch", function (e) {
            this.openPopup();
        });
    }
}

/* function removeMarkers() {
    const limit = mapInstance.getBounds();
    for (let i = 0; i < window.drawnMarkers.length; i++) {
        const marker = window.drawnMarkers[i];
        const { _latlng } = marker;
        if (!isInBounds(_latlng.lat, _latlng.lng, limit)) {
            mapInstance.removeLayer(marker);
            window.drawnMarkers[i] = false;
        }
    }

    window.drawnMarkers = window.drawnMarkers.filter(Boolean);
} */

async function reDrawMarkers() {
    if (mapInstance.getZoom() > 11) {
        const { _northEast, _southWest } = mapInstance.getBounds();
        const southWest = getChunkId(_southWest);
        const northEast = getChunkId(_northEast);
        const chunksToDraw = [];

        for (let i = southWest.ids[0]; i <= northEast.ids[0]; i++) {
            for (let j = southWest.ids[1]; j <= northEast.ids[1]; j++) {
                chunksToDraw.push([i, j]);
            }
        }

        const elementsFromKnownChunks = [];
        const missingChunks = [];
        for (let chunkId of chunksToDraw) {
            const knownElements = getChunk(chunkId);
            if (knownElements === false) {
                missingChunks.push(chunkId);
            } else {
                elementsFromKnownChunks.push(...knownElements);
            }
        }
        console.log("Drawing Markers: ", elementsFromKnownChunks.length);
        elementsFromKnownChunks.forEach((markerData) => { addMarker(markerData); });



        const center = mapInstance.getCenter();
        const { bounds, ids } = getChunkId(center);
        const knownChunk = checkCoords(ids);
        if (knownChunk === null) {
            const query = getQueryForBounds(bounds);
            const data = await sendQuery(query);
            if (data) {
                const validMakers = data.elements.filter(marker => marker.lat != null && marker.lon != null);

                addChunk(ids, validMakers);
                validMakers.forEach(markerData => { addMarker(markerData); });

                /*             const leafletBounds = [[bounds.southWest.lat, bounds.southWest.lng], [bounds.northEast.lat, bounds.northEast.lng]];
                            L.rectangle(leafletBounds, { color: "#ff7800", weight: 1 }).addTo(mapInstance); */
            }
        } else {
            knownChunk.forEach(markerData => { addMarker(markerData); });
        }
    }
}

async function sendQuery(query) {
    try {
        setLoading(true);
        const response = await fetch(INTERPRETER, {
            body: `data=${query}`,
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            method: "POST",
        });

        const body = await response.json();
        return body;
    } catch (error) {
        console.error(error);
    } finally {
        setLoading(false);
    }
}

function checkCoords(ids) {
    const [a, b] = ids;

    if (knownChunks[a] && knownChunks[a][b]) {
        console.log("Chunk founds");
        return knownChunks[a][b];
    } else {
        console.log("New chunk");
        return null;
    }
}

function addChunk(ids, data) {
    const [a, b] = ids;
    if (knownChunks[a] == null) {
        knownChunks[a] = [];
    }
    knownChunks[a][b] = data;
    updateLocalstorage();
}

function getChunk(ids) {
    const [a, b] = ids;
    if (!Array.isArray(knownChunks[a])) {
        return false;
    }
    if (!Array.isArray(knownChunks[a][b])) {
        return false;
    }
    return knownChunks[a][b];
}

function tenth(num, offset = 0) {
    let tenTimes = Math.floor(num * 10);
    tenTimes += offset * 10;
    const rounded = Math.round(tenTimes);
    return rounded / 10;
}

function getChunkId({ lat, lng }) {
    const rootCoords = {
        lat: tenth(lat),
        lng: tenth(lng)
    };

    if ((rootCoords.lat * 10) % 2 === 1) {
        rootCoords.lat = tenth(rootCoords.lat, -0.1);
    }

    if ((rootCoords.lng * 10) % 2 === 1) {
        rootCoords.lng = tenth(rootCoords.lng, -0.1);
    }


    const bounds = {
        southWest: {
            lat: rootCoords.lat,
            lng: rootCoords.lng
        },
        northEast: {
            lat: tenth(rootCoords.lat, 0.2),
            lng: tenth(rootCoords.lng, 0.2),
        }
    };
    const ids = [
        rootCoords.lat * 10,
        rootCoords.lng * 10
    ];

    return {
        ids,
        bounds
    };
}

function updateLocalstorage() {
    const str = JSON.stringify(knownChunks);
    localStorage.setItem("knownChunks", str);
}

function setLoading(setTo) {
    const overlay = document.querySelector("#loading");
    isLoading = setTo;
    if (setTo) {
        overlay.classList.add("active");
    } else {
        overlay.classList.remove("active");
    }
}

function getQueryForBounds(boundsObject) {
    const { southWest: lower, northEast: upper } = boundsObject;
    return dataTemplate(lower.lat, lower.lng, upper.lat, upper.lng);
}
function dataTemplate(bbLowerLat, bbLowerLng, bbUpperLat, bbUpperLng) {
    return `/*
This has been generated by the overpass-turbo wizard.
The original search was:
“sport=table_tennis”
*/
[out:json][timeout:25];
// gather results
(
  // query part for: “sport=table_tennis”
  node["sport"="table_tennis"](${bbLowerLat},${bbLowerLng},${bbUpperLat},${bbUpperLng});
  way["sport"="table_tennis"](${bbLowerLat},${bbLowerLng},${bbUpperLat},${bbUpperLng});
  relation["sport"="table_tennis"](${bbLowerLat},${bbLowerLng},${bbUpperLat},${bbUpperLng});
);
// print results
out body;
>;
out skel qt;`;
}