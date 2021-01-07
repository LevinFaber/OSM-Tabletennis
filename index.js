// import { geojson } from "./cologne";
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
        const place = data[0];
        const geojson = place.geojson;
        const points = geojson.coordinates[0];
        points.forEach((point) => {
            L.circle([point[1], point[0]], {radius: 15000, stroke: 0, fillOpacity: 1}).addTo(mapInstance);
        });

        L.geoJSON(geojson, { style: { color: "#FF0"}}).addTo(mapInstance);
    }
}

const query = window.location.pathname.slice(1);
searchPlace(query);





