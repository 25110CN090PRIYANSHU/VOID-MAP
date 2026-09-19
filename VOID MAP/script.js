// ==========================================
// VOID MAPS
// Complete script.js
// Driving + Walking + Cycling
// ==========================================


// ==========================================
// MAP INITIALIZATION
// ==========================================

const map = L.map("map").setView(
    [28.6139, 77.2090],
    5
);


// ==========================================
// MAP LAYERS
// ==========================================

const normalMap = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
    }
);

const satelliteMap = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
        maxZoom: 19,
        attribution: "Tiles &copy; Esri"
    }
);

normalMap.addTo(map);


// ==========================================
// VARIABLES
// ==========================================

let searchMarker = null;
let userMarker = null;
let routeLine = null;

let currentPlace = null;
let userLocation = null;

let satelliteMode = false;
let darkMode = false;

let selectedTransport = "driving";


// ==========================================
// ELEMENTS
// ==========================================

const searchInput =
    document.getElementById("searchInput");

const searchBtn =
    document.getElementById("searchBtn");

const clearBtn =
    document.getElementById("clearBtn");

const locationBtn =
    document.getElementById("locationBtn");

const suggestions =
    document.getElementById("suggestions");

const placeCard =
    document.getElementById("placeCard");

const closeCard =
    document.getElementById("closeCard");

const placeName =
    document.getElementById("placeName");

const placeAddress =
    document.getElementById("placeAddress");

const savePlaceBtn =
    document.getElementById("savePlaceBtn");

const directionsBtn =
    document.getElementById("directionsBtn");

const directionsCard =
    document.getElementById("directionsCard");

const closeDirections =
    document.getElementById("closeDirections");

const routeDistance =
    document.getElementById("routeDistance");

const routeTime =
    document.getElementById("routeTime");

const routeStatus =
    document.getElementById("routeStatus");

const zoomIn =
    document.getElementById("zoomIn");

const zoomOut =
    document.getElementById("zoomOut");

const darkModeBtn =
    document.getElementById("darkModeBtn");

const satelliteBtn =
    document.getElementById("satelliteBtn");


// ==========================================
// TRANSPORT BUTTONS
// ==========================================

const transportButtons =
    document.querySelectorAll(".transport-btn");


transportButtons.forEach(button => {

    button.addEventListener("click", () => {

        transportButtons.forEach(btn => {
            btn.classList.remove("active");
        });

        button.classList.add("active");

        selectedTransport =
            button.dataset.mode;

        console.log(
            "VOID transport mode:",
            selectedTransport
        );

        if (
            currentPlace &&
            userLocation
        ) {
            getRoute();
        }

    });

});


// ==========================================
// SEARCH PLACE
// ==========================================

async function searchPlace(place) {

    if (!place || !place.trim()) {
        return;
    }

    suggestions.style.display =
        "none";

    try {

        const url =
            `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(place)}`;

        const response =
            await fetch(url);

        if (!response.ok) {
            throw new Error(
                "Search request failed"
            );
        }

        const data =
            await response.json();

        if (!data.length) {

            alert(
                "Place not found."
            );

            return;
        }

        const location =
            data[0];

        const lat =
            parseFloat(location.lat);

        const lon =
            parseFloat(location.lon);

        currentPlace =
            location;


        // ==================================
        // MOVE MAP
        // ==================================

        map.setView(
            [lat, lon],
            14
        );


        // ==================================
        // REMOVE OLD SEARCH MARKER
        // ==================================

        if (searchMarker) {

            map.removeLayer(
                searchMarker
            );

        }


        // ==================================
        // ADD SEARCH MARKER
        // ==================================

        searchMarker =
            L.marker(
                [lat, lon]
            )
            .addTo(map)
            .bindPopup(
                `<b>${escapeHTML(
                    location.display_name
                )}</b>`
            )
            .openPopup();


        // ==================================
        // UPDATE PLACE CARD
        // ==================================

        if (placeName) {

            placeName.textContent =
                location.name ||
                location.display_name
                    .split(",")[0];

        }

        if (placeAddress) {

            placeAddress.textContent =
                location.display_name;

        }

        if (placeCard) {

            placeCard.style.display =
                "block";

        }

        if (savePlaceBtn) {

            savePlaceBtn.textContent =
                "⭐ Save";

        }


        // ==================================
        // SAVE RECENT SEARCH
        // ==================================

        saveRecentSearch(
            location.display_name
        );


    } catch (error) {

        console.error(
            "VOID search error:",
            error
        );

        alert(
            "Unable to search right now."
        );

    }

}


// ==========================================
// SEARCH BUTTON
// ==========================================

if (searchBtn) {

    searchBtn.addEventListener(
        "click",
        () => {

            searchPlace(
                searchInput.value
            );

        }
    );

}


// ==========================================
// ENTER TO SEARCH
// ==========================================

if (searchInput) {

    searchInput.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter"
            ) {

                searchPlace(
                    searchInput.value
                );

            }

        }
    );

}


// ==========================================
// SEARCH INPUT
// ==========================================

if (searchInput) {

    searchInput.addEventListener(
        "input",
        () => {

            if (clearBtn) {

                clearBtn.style.display =
                    searchInput.value.length > 0
                        ? "block"
                        : "none";

            }

            showSuggestions(
                searchInput.value
            );

        }
    );

}


// ==========================================
// CLEAR SEARCH
// ==========================================

if (clearBtn) {

    clearBtn.addEventListener(
        "click",
        () => {

            searchInput.value =
                "";

            clearBtn.style.display =
                "none";

            suggestions.style.display =
                "none";

        }
    );

}


// ==========================================
// SEARCH SUGGESTIONS
// ==========================================

let suggestionTimer = null;


function showSuggestions(query) {

    clearTimeout(
        suggestionTimer
    );

    if (
        !query ||
        query.trim().length < 3
    ) {

        suggestions.style.display =
            "none";

        return;

    }

    suggestionTimer =
        setTimeout(
            async () => {

                try {

                    const url =
                        `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`;

                    const response =
                        await fetch(url);

                    if (!response.ok) {
                        return;
                    }

                    const data =
                        await response.json();

                    suggestions.innerHTML =
                        "";

                    if (
                        !data.length
                    ) {

                        suggestions.style.display =
                            "none";

                        return;

                    }

                    data.forEach(
                        place => {

                            const item =
                                document.createElement(
                                    "div"
                                );

                            item.className =
                                "suggestion";

                            item.innerHTML = `
                                <span class="suggestion-icon">
                                    📍
                                </span>

                                <span class="suggestion-text">
                                    ${escapeHTML(
                                        place.display_name
                                    )}
                                </span>
                            `;

                            item.addEventListener(
                                "click",
                                () => {

                                    searchInput.value =
                                        place.display_name;

                                    clearBtn.style.display =
                                        "block";

                                    suggestions.style.display =
                                        "none";

                                    searchPlace(
                                        place.display_name
                                    );

                                }
                            );

                            suggestions.appendChild(
                                item
                            );

                        }
                    );

                    suggestions.style.display =
                        "block";


                } catch (error) {

                    console.error(
                        "Suggestion error:",
                        error
                    );

                }

            },
            500
        );

}


// ==========================================
// MY LOCATION
// ==========================================

if (locationBtn) {

    locationBtn.addEventListener(
        "click",
        () => {

            if (
                !navigator.geolocation
            ) {

                alert(
                    "Geolocation is not supported by your browser."
                );

                return;

            }

            locationBtn.innerHTML =
                "📍 Locating...";


            navigator.geolocation.getCurrentPosition(

                position => {

                    const lat =
                        position.coords.latitude;

                    const lon =
                        position.coords.longitude;


                    // Save location

                    userLocation = {
                        lat: lat,
                        lon: lon
                    };


                    // Move map

                    map.setView(
                        [lat, lon],
                        16
                    );


                    // Remove old marker

                    if (userMarker) {

                        map.removeLayer(
                            userMarker
                        );

                    }


                    // ==================================
                    // BLUE LOCATION DOT
                    // ==================================

                    const locationIcon =
                        L.divIcon({

                            className:
                                "my-location-wrapper",

                            html: `
                                <div class="my-location-dot"></div>
                            `,

                            iconSize: [
                                20,
                                20
                            ],

                            iconAnchor: [
                                10,
                                10
                            ]

                        });


                    // Add marker

                    userMarker =
                        L.marker(
                            [lat, lon],
                            {
                                icon:
                                    locationIcon
                            }
                        )
                        .addTo(map)
                        .bindPopup(
                            "📍 You are here"
                        )
                        .openPopup();


                    locationBtn.innerHTML =
                        "📍 <span>My Location</span>";


                    console.log(
                        "VOID user location:",
                        userLocation
                    );


                },

                error => {

                    console.error(
                        "Location error:",
                        error
                    );

                    alert(
                        "Please allow location access in your browser."
                    );

                    locationBtn.innerHTML =
                        "📍 <span>My Location</span>";

                },

                {
                    enableHighAccuracy: true,
                    timeout: 15000,
                    maximumAge: 0
                }

            );

        }
    );

}


// ==========================================
// DIRECTIONS BUTTON
// ==========================================

if (directionsBtn) {

    directionsBtn.addEventListener(
        "click",
        () => {

            if (!currentPlace) {

                alert(
                    "First search for a destination."
                );

                return;

            }

            if (!userLocation) {

                alert(
                    "Click '📍 My Location' first."
                );

                return;

            }

            getRoute();

        }
    );

}


// ==========================================
// ROUTE FUNCTION
// ==========================================

async function getRoute() {

    if (
        !currentPlace ||
        !userLocation
    ) {

        return;

    }


    // ==================================
    // SHOW DIRECTIONS CARD
    // ==================================

    if (directionsCard) {

        directionsCard.style.display =
            "block";

    }


    if (placeCard) {

        placeCard.style.display =
            "none";

    }


    // ==================================
    // LOADING STATE
    // ==================================

    if (routeStatus) {

        routeStatus.textContent =
            `Finding ${getTransportName(
                selectedTransport
            ).toLowerCase()} route...`;

    }

    if (routeDistance) {

        routeDistance.textContent =
            "Calculating...";

    }

    if (routeTime) {

        routeTime.textContent =
            "Calculating...";

    }


    // ==================================
    // REMOVE OLD ROUTE
    // ==================================

    if (routeLine) {

        map.removeLayer(
            routeLine
        );

        routeLine =
            null;

    }


    // ==================================
    // COORDINATES
    // ==================================

    const startLon =
        Number(
            userLocation.lon
        );

    const startLat =
        Number(
            userLocation.lat
        );

    const endLon =
        Number(
            currentPlace.lon
        );

    const endLat =
        Number(
            currentPlace.lat
        );


    if (
        !Number.isFinite(startLon) ||
        !Number.isFinite(startLat) ||
        !Number.isFinite(endLon) ||
        !Number.isFinite(endLat)
    ) {

        if (routeStatus) {

            routeStatus.textContent =
                "Invalid location coordinates.";

        }

        return;

    }


    // ==================================
    // TRANSPORT PROFILE
    // ==================================

    const profileMap = {

        driving:
            "driving",

        walking:
            "walking",

        cycling:
            "cycling"

    };


    const profile =
        profileMap[
            selectedTransport
        ] || "driving";


    // ==================================
    // OSRM ROUTE URL
    // ==================================

    const url =
        `https://router.project-osrm.org/route/v1/${profile}/${startLon},${startLat};${endLon},${endLat}?overview=full&geometries=geojson&steps=true&alternatives=false`;


    console.log(
        "VOID route request:",
        url
    );


    try {

        // ==================================
        // FETCH ROUTE
        // ==================================

        const response =
            await fetch(url);


        const data =
            await response.json();


        console.log(
            "VOID route response:",
            data
        );


        // ==================================
        // API ERROR
        // ==================================

        if (
            !response.ok ||
            data.code !== "Ok" ||
            !data.routes ||
            data.routes.length === 0
        ) {

            const message =
                data.message ||
                "No route was found.";

            if (routeStatus) {

                routeStatus.textContent =
                    `${getTransportName(
                        selectedTransport
                    )} route unavailable.`;

            }

            console.error(
                "Routing failed:",
                message
            );

            return;

        }


        // ==================================
        // GET BEST ROUTE
        // ==================================

        const route =
            data.routes[0];


        // ==================================
        // DRAW ROUTE
        // ==================================

        routeLine =
            L.geoJSON(
                route.geometry,
                {

                    style: {

                        weight: 6,

                        opacity: 0.9

                    }

                }

            ).addTo(map);


        // ==================================
        // FIT MAP TO ROUTE
        // ==================================

        map.fitBounds(
            routeLine.getBounds(),
            {
                padding: [
                    50,
                    50
                ]
            }
        );


        // ==================================
        // DISTANCE
        // ==================================
        // OSRM gives distance in meters.

        const distanceMeters =
            Number(
                route.distance
            );


        const distanceKm =
            distanceMeters / 1000;


        if (routeDistance) {

            if (
                distanceKm < 1
            ) {

                routeDistance.textContent =
                    `${Math.round(
                        distanceMeters
                    )} m`;

            } else {

                routeDistance.textContent =
                    `${distanceKm.toFixed(
                        1
                    )} km`;

            }

        }


        // ==================================
        // ETA
        // ==================================
        // OSRM gives duration in seconds.

        const durationSeconds =
            Number(
                route.duration
            );


        const totalMinutes =
            Math.round(
                durationSeconds / 60
            );


        if (routeTime) {

            routeTime.textContent =
                formatDuration(
                    totalMinutes
                );

        }


        // ==================================
        // SUCCESS STATUS
        // ==================================

        if (routeStatus) {

            routeStatus.textContent =
                `${getTransportName(
                    selectedTransport
                )} route ready`;

        }


        console.log(
            `${getTransportName(
                selectedTransport
            )} route:`,
            distanceKm.toFixed(2),
            "km",
            totalMinutes,
            "minutes"
        );


    } catch (error) {

        console.error(
            "VOID routing error:",
            error
        );


        if (routeStatus) {

            routeStatus.textContent =
                "Unable to calculate route.";

        }

    }

}


// ==========================================
// FORMAT DURATION
// ==========================================

function formatDuration(minutes) {

    if (
        minutes < 1
    ) {

        return "< 1 min";

    }


    if (
        minutes < 60
    ) {

        return `${minutes} min`;

    }


    const hours =
        Math.floor(
            minutes / 60
        );


    const remainingMinutes =
        minutes % 60;


    if (
        remainingMinutes === 0
    ) {

        return `${hours}h`;

    }


    return `${hours}h ${remainingMinutes}m`;

}


// ==========================================
// TRANSPORT NAME
// ==========================================

function getTransportName(mode) {

    const names = {

        driving:
            "Driving",

        walking:
            "Walking",

        cycling:
            "Cycling"

    };


    return (
        names[mode] ||
        "Driving"
    );

}


// ==========================================
// CLOSE DIRECTIONS
// ==========================================

if (closeDirections) {

    closeDirections.addEventListener(
        "click",
        () => {

            directionsCard.style.display =
                "none";


            if (routeLine) {

                map.removeLayer(
                    routeLine
                );

                routeLine =
                    null;

            }

        }
    );

}


// ==========================================
// CLOSE PLACE CARD
// ==========================================

if (closeCard) {

    closeCard.addEventListener(
        "click",
        () => {

            placeCard.style.display =
                "none";

        }
    );

}


// ==========================================
// SAVE PLACE
// ==========================================

if (savePlaceBtn) {

    savePlaceBtn.addEventListener(
        "click",
        () => {

            if (!currentPlace) {

                return;

            }


            let savedPlaces =
                JSON.parse(
                    localStorage.getItem(
                        "voidSavedPlaces"
                    )
                ) || [];


            const exists =
                savedPlaces.some(
                    place =>
                        place.display_name ===
                        currentPlace.display_name
                );


            if (exists) {

                savePlaceBtn.textContent =
                    "⭐ Saved";

                return;

            }


            savedPlaces.push({

                name:
                    currentPlace.name,

                display_name:
                    currentPlace.display_name,

                lat:
                    currentPlace.lat,

                lon:
                    currentPlace.lon

            });


            localStorage.setItem(
                "voidSavedPlaces",
                JSON.stringify(
                    savedPlaces
                )
            );


            savePlaceBtn.textContent =
                "⭐ Saved";

        }
    );

}


// ==========================================
// ZOOM IN
// ==========================================

if (zoomIn) {

    zoomIn.addEventListener(
        "click",
        () => {

            map.zoomIn();

        }
    );

}


// ==========================================
// ZOOM OUT
// ==========================================

if (zoomOut) {

    zoomOut.addEventListener(
        "click",
        () => {

            map.zoomOut();

        }
    );

}


// ==========================================
// SATELLITE MODE
// ==========================================

if (satelliteBtn) {

    satelliteBtn.addEventListener(
        "click",
        () => {

            if (satelliteMode) {

                map.removeLayer(
                    satelliteMap
                );

                normalMap.addTo(
                    map
                );

                satelliteMode =
                    false;

                satelliteBtn.textContent =
                    "🛰️";

            } else {

                map.removeLayer(
                    normalMap
                );

                satelliteMap.addTo(
                    map
                );

                satelliteMode =
                    true;

                satelliteBtn.textContent =
                    "🗺️";

            }

        }
    );

}


// ==========================================
// DARK MODE
// ==========================================

if (darkModeBtn) {

    darkModeBtn.addEventListener(
        "click",
        () => {

            darkMode =
                !darkMode;


            if (darkMode) {

                document.body.classList.add(
                    "void-dark"
                );

                darkModeBtn.textContent =
                    "☀️";

            } else {

                document.body.classList.remove(
                    "void-dark"
                );

                darkModeBtn.textContent =
                    "🌙";

            }

        }
    );

}


// ==========================================
// RECENT SEARCHES
// ==========================================

function saveRecentSearch(place) {

    let searches =
        JSON.parse(
            localStorage.getItem(
                "voidRecentSearches"
            )
        ) || [];


    searches =
        searches.filter(
            item =>
                item !== place
        );


    searches.unshift(
        place
    );


    searches =
        searches.slice(
            0,
            5
        );


    localStorage.setItem(
        "voidRecentSearches",
        JSON.stringify(
            searches
        )
    );

}


// ==========================================
// CLOSE SUGGESTIONS
// ==========================================

document.addEventListener(
    "click",
    event => {

        if (
            !event.target.closest(
                ".search-container"
            )
        ) {

            if (suggestions) {

                suggestions.style.display =
                    "none";

            }

        }

    }
);


// ==========================================
// HTML ESCAPE
// ==========================================

function escapeHTML(text) {

    if (
        text === null ||
        text === undefined
    ) {

        return "";

    }


    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        String(text);


    return div.innerHTML;

}


// ==========================================
// STARTUP
// ==========================================

console.log(
    "🗺️ VOID Maps started successfully."
);

console.log(
    "Default transport:",
    selectedTransport
);