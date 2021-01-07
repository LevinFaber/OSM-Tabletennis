let GLOBAL_POINTS = [];
let GLOBAL_GEO = null;



const mapInstance = L.map('mapid').setView([50.937599587518676, 6.954994823413924], 10);
L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
    attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
    maxZoom: 18,
    id: 'mapbox/streets-v11',
    tileSize: 512,
    zoomOffset: -1,
    accessToken: 'pk.eyJ1IjoibGZhLXRpbWV0b2FjdCIsImEiOiJjazQwMzVpMnAxdnl0M2xvcGR6MTN1NXJyIn0.Im9rwBa3gF7jjD3cUUlzlg'
}).addTo(mapInstance);

// Search GEOJSON
async function searchPlace(name) {

    const response = await (fetch(`https://nominatim.openstreetmap.org/search.php?q=${name}&polygon_geojson=1&accept-language=de&countrycodes=de&polygon_threshold=0.001&format=jsonv2`).catch(e => console.error(e)));

    const data = await response.json();
    if (data) {
        processData(data, name);
    }


}

function processData(data, query, poped = false) {
    const place = data.find(result => result.category === "boundary" && result.type === "administrative");

    if (place) {
        clearOverlay();
        input.value = ""; input.placeholder = place.display_name;

        mapInstance.setView([place.lat, place.lon], 9);

        if (!poped) {
            const newUrl = new URL(window.location.href);
            newUrl.pathname = `/${capitalize(query)}`;
            window.history.pushState({ data, query }, "", newUrl.href);
            setTitle(query);
        }

        const geojson = place.geojson;
        const points = geojson.type === "MultiPolygon" ? geojson.coordinates.flat(2) : geojson.coordinates.flat();
        GLOBAL_POINTS = points.map((point) => L.circle([point[1], point[0]], { radius: 15000, stroke: 0, fillOpacity: 1 }).addTo(mapInstance));
        GLOBAL_GEO = L.geoJSON(geojson, { style: { color: "#FF0" } }).addTo(mapInstance);
    }
}

function setTitle(place) {
    const decoded  = decodeURIComponent(place);
    window.document.title = `${capitalize(decoded)} + 15km`
}
function capitalize(str) { return str.charAt(0).toUpperCase() + str.slice(1)}
function clearOverlay() {
    GLOBAL_POINTS.forEach((px) => { mapInstance.removeLayer(px) });
    if (GLOBAL_GEO) mapInstance.removeLayer(GLOBAL_GEO);
}

const query = window.location.pathname.slice(1) || "Köln";
searchPlace(query);

const form = document.querySelector("form");
const input = document.querySelector("input");
form.addEventListener("submit", (e) => {
    e.preventDefault();
    searchPlace(input.value);
})

window.onpopstate = function (e) {
    if (e.state) {
        processData(e.state.data, e.state.query, true);
    }
};



