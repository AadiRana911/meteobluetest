let catchMarkers = [];
let catches = [];
let speedUnit = "mph";
let temperatureUnit = "F";
let lengthUnit = "imperial";
let mapboxMap;
let mapsPlugin;

let locationMarker = null;

// Function to display location marker
function displayLocationMarker(lat, lon) {
  // Remove existing location marker if any
  if (locationMarker) {
    locationMarker.remove();
  }

  // Create location marker with different style
  locationMarker = new mapboxgl.Marker({
    color: "#007bff", // Blue color for location marker
    scale: 1.2, // Slightly larger than catch markers
  })
    .setLngLat([lon, lat])
    .addTo(mapboxMap);

  console.log("Location marker displayed at:", lat, lon);
}

// Function to clear location marker
function clearLocationMarker() {
  if (locationMarker) {
    locationMarker.remove();
    locationMarker = null;
  }
}

function sendMessageToApp(message) {
  // Log for debugging in the browser console
  console.log(message);
  // Send the message to React Native
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(message);
  }
}

function movePositionToTopCenter({ lat, lng }) {
  // Calculate offset to position clicked point at top center (5% from top)
  const bounds = mapboxMap.getBounds();
  const latRange = bounds.getNorth() - bounds.getSouth();
  const offsetLat = lat - latRange * 0.4; // Subtract to show point at top center

  mapboxMap.easeTo({
    center: [lng, offsetLat],
    duration: 500, // Smooth animation
  });
}

function areCoordinatesValid({ lat, lng }) {
  return (
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

// Listen for messages from React Native app
window.addEventListener("message", function (event) {
  try {
    const data = JSON.parse(event.data);
    console.log("window message listener", data);

    if (data.type === "moveToLocation" && data.lat && data.lng) {
      const lat = parseFloat(data.lat);
      const lng = parseFloat(data.lng);

      // Validate coordinates
      if (areCoordinatesValid({ lat, lng })) {
        console.log(
          "Moving map to coordinates from app - Lat:",
          lat,
          "Lng:",
          lng
        );

        // Display location marker
        displayLocationMarker(lat, lng);

        movePositionToTopCenter({ lat, lng });
      } else {
        console.warn("Invalid coordinates received from app:", data);
      }
    }
  } catch (error) {
    console.error("Error parsing message from app:", error);
  }
});

// For React Native WebView specifically
if (window.ReactNativeWebView) {
  document.addEventListener("message", function (event) {
    try {
      const data = JSON.parse(event.data);
      console.log("window.reactnative web view", data);

      if (data.type === "moveToLocation" && data.lat && data.lng) {
        const lat = parseFloat(data.lat);
        const lng = parseFloat(data.lng);

        // Validate coordinates
        if (areCoordinatesValid({ lat, lng })) {
          console.log(
            "Moving map to coordinates from app - Lat:",
            lat,
            "Lng:",
            lng
          );

          // Display location marker
          displayLocationMarker(lat, lng);

          movePositionToTopCenter({ lat, lng });
        } else {
          console.warn("Invalid coordinates received from app:", data);
        }
      }
    } catch (error) {
      console.error("Error parsing message from app:", error);
    }
  });
}

// Create and add loading indicator
const loadingIndicator = document.createElement("div");
loadingIndicator.className = "loading-indicator";
loadingIndicator.innerHTML = `
    <div class="loading-spinner"></div>
    <span>Loading catches...</span>
`;
document.body.appendChild(loadingIndicator);

function createToggle(initialState = false) {
  const toggleContainer = document.createElement("div");
  toggleContainer.className = "toggle-container";

  const toggleWrapper = document.createElement("div");
  toggleWrapper.className = "toggle-wrapper";

  const toggleBall = document.createElement("div");
  toggleBall.className = "toggle-ball";

  const toggleOffText = document.createElement("span");
  toggleOffText.className = "toggle-text toggle-off-text";
  toggleOffText.textContent = "OFF";

  const toggleOnText = document.createElement("span");
  toggleOnText.className = "toggle-text toggle-on-text";
  toggleOnText.textContent = "ON";

  toggleWrapper.appendChild(toggleBall);
  toggleWrapper.appendChild(toggleOffText);
  toggleWrapper.appendChild(toggleOnText);
  toggleContainer.appendChild(toggleWrapper);

  if (initialState) {
    toggleWrapper.classList.add("active");
  }

  toggleWrapper.addEventListener("click", function (e) {
    e.stopPropagation();
    toggleWrapper.classList.toggle("active");

    const event = new CustomEvent("toggleChange", {
      detail: {
        isActive: toggleWrapper.classList.contains("active"),
      },
    });
    toggleContainer.dispatchEvent(event);
  });

  return toggleContainer;
}

// API call to fetch user catches
async function fetchUserCatches(userId) {
  const { env } = getUrlParams();
  const baseApi = env?.startsWith("prod")
    ? "https://api-v2.log.fish"
    : env?.startsWith("local")
    ? "http://localhost:8000"
    : "https://api-dta.log.fish";

  const response = await fetch(`${baseApi}/catch/${userId}`);
  const data = await response.json();

  return data.map((item) => ({
    id: item.id,
    species: item.species,
    date: item.catchDate?.split("T")[0],
    latitude: item.latitude,
    longitude: item.longitude,
    media: item.media,
  }));
}

// Load and display user catches on the map
async function loadUserCatches() {
  const params = getUrlParams();
  if (!params.userId) {
    console.log("No user ID found in URL parameters");
    return;
  }

  try {
    // Show loading indicator
    loadingIndicator.classList.add("show");

    console.log("Loading catches for user:", params.userId);
    catches = await fetchUserCatches(params.userId);
    displayCatchMarkers(catches);
  } catch (error) {
    console.error("Error loading user catches:", error);
  } finally {
    // Hide loading indicator
    loadingIndicator.classList.remove("show");
  }
}

// Display catch markers on the map
function displayCatchMarkers(catches) {
  try {
    // Clear existing markers first
    clearCatchMarkers();

    catches.forEach((item) => {
      // Create popup content
      const popupContent = `
                <div class="catch-popup">
                    <h4>${item.species}</h4>
                    <p><strong>Date:</strong> ${item.date}</p>
                    ${
                      item.media
                        ? `<img src="${item.media}" alt="catch" />`
                        : ""
                    }
                </div>
            `;

      // Create popup
      const popup = new mapboxgl.Popup({
        offset: 25,
        closeButton: true,
        closeOnClick: false,
      }).setHTML(popupContent);

      // Create marker with default Mapbox marker (no custom element)
      const marker = new mapboxgl.Marker({
        color: "#ff6b6b", // Custom color for catch markers
      })
        .setLngLat([item.longitude, item.latitude])
        .setPopup(popup)
        .addTo(mapboxMap);

      // Store marker reference
      catchMarkers.push(marker);
    });

    console.log(`Displayed ${catches.length} catch markers`);
  } catch (err) {
    console.log("error in displaying catches:", err);
  }
}

// Clear all catch markers from the map
function clearCatchMarkers() {
  catchMarkers.forEach((marker) => marker.remove());
  catchMarkers = [];
}

const customMenu = document.createElement("div");
customMenu.classList.add("custom-menu");
document.body.appendChild(customMenu); // Ensure menu is in the DOM

// Remove menuToggle from body, will be managed dynamically
const menuToggle = document.getElementById("menuToggle");
menuToggle.style.display = "none";

// Add event listeners to both toggles
menuToggle.addEventListener("click", () => {
  if (customMenu.classList.contains("open")) {
    customMenu.classList.remove("open");
    menuToggle.classList.remove("menu-toggle-open");
  } else {
    customMenu.classList.add("open");
    menuToggle.classList.add("menu-toggle-open");
  }
});

// My Catches button
const myCatchesBtn = document.createElement("div");
myCatchesBtn.className = "my-catches-btn";
myCatchesBtn.innerHTML = `<div><img src="assets/fish.svg" alt="catch" /> <p>My Catches<p> </div>`;

// Add toggle instead of span
const myCatchesToggle = createToggle(false);
myCatchesBtn.appendChild(myCatchesToggle);

myCatchesToggle.addEventListener("toggleChange", function (event) {
  console.log("toggle change event:", event.detail);
  const isActive = event.detail.isActive;

  if (isActive) {
    console.log("Toggle ON - Loading user catches");
    loadUserCatches();
  } else {
    console.log("Toggle OFF - Clearing catch markers");
    clearCatchMarkers();
    catches = [];
  }
  closeMenu();
});

const apiKey = "7WeUN89fIC4t6PKl";
const maps = [
  {
    value: "noaaMap",
    label: "NOAA Map",
    icon: `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `,
  },
  {
    value: "windAnimation",
    label: "Wind",
    icon: `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M4 13.75H18.5C19.2415 13.75 19.9664 13.9699 20.583 14.3818C21.1996 14.7938 21.681 15.3794 21.9648 16.0645C22.2487 16.7496 22.3224 17.504 22.1777 18.2314C22.033 18.9589 21.6758 19.6269 21.1514 20.1514C20.6269 20.6758 19.9589 21.033 19.2314 21.1777C18.5951 21.3043 17.9384 21.2638 17.3252 21.0615L17.0645 20.9648C16.3794 20.681 15.7938 20.1996 15.3818 19.583C14.9699 18.9664 14.75 18.2415 14.75 17.5V17C14.75 16.9337 14.7764 16.8701 14.8232 16.8232C14.8701 16.7764 14.9337 16.75 15 16.75C15.0663 16.75 15.1299 16.7764 15.1768 16.8232C15.2236 16.8701 15.25 16.9337 15.25 17V17.5C15.25 18.1428 15.4407 18.7712 15.7979 19.3057C16.1549 19.84 16.6621 20.2569 17.2559 20.5029C17.8496 20.7489 18.5034 20.8128 19.1338 20.6875C19.7642 20.5621 20.3433 20.2524 20.7979 19.7979C21.2524 19.3433 21.5621 18.7642 21.6875 18.1338C21.8128 17.5034 21.7489 16.8496 21.5029 16.2559C21.2569 15.6621 20.84 15.1549 20.3057 14.7979C19.7712 14.4407 19.1428 14.25 18.5 14.25H4C3.9337 14.25 3.87013 14.2236 3.82324 14.1768C3.77636 14.1299 3.75 14.0663 3.75 14C3.75 13.9337 3.77636 13.8701 3.82324 13.8232C3.87013 13.7764 3.9337 13.75 4 13.75ZM17.0645 4.03516C17.7496 3.75134 18.504 3.6776 19.2314 3.82227C19.9589 3.96696 20.6269 4.32419 21.1514 4.84863C21.6104 5.30766 21.9418 5.87643 22.1143 6.49902L22.1777 6.76855C22.3224 7.49595 22.2487 8.25035 21.9648 8.93555C21.681 9.62064 21.1996 10.2062 20.583 10.6182C19.9664 11.0301 19.2415 11.25 18.5 11.25H2C1.95028 11.25 1.90209 11.2352 1.86133 11.208L1.82324 11.1768C1.77636 11.1299 1.75 11.0663 1.75 11C1.75 10.9503 1.76481 10.9021 1.79199 10.8613L1.82324 10.8232C1.87013 10.7764 1.9337 10.75 2 10.75H18.5C19.1428 10.75 19.7712 10.5593 20.3057 10.2021C20.84 9.84509 21.2569 9.33786 21.5029 8.74414C21.7489 8.15035 21.8128 7.49658 21.6875 6.86621C21.5621 6.23577 21.2524 5.65667 20.7979 5.20215C20.3433 4.74763 19.7642 4.4379 19.1338 4.3125C18.5034 4.18716 17.8496 4.25112 17.2559 4.49707C16.6621 4.74305 16.1549 5.16 15.7979 5.69434C15.4407 6.22879 15.25 6.85721 15.25 7.5V8C15.25 8.0663 15.2236 8.12987 15.1768 8.17676C15.1299 8.22364 15.0663 8.25 15 8.25C14.9337 8.25 14.8701 8.22364 14.8232 8.17676C14.7764 8.12987 14.75 8.0663 14.75 8V7.5C14.75 6.75845 14.9699 6.0336 15.3818 5.41699C15.7423 4.87751 16.2359 4.44194 16.8125 4.15137L17.0645 4.03516ZM8.44727 2.95898C8.94965 2.75089 9.5028 2.69672 10.0361 2.80273C10.503 2.8956 10.9371 3.10767 11.2959 3.41699L11.4443 3.55566C11.8289 3.94026 12.0912 4.43042 12.1973 4.96387C12.29 5.43042 12.2596 5.91177 12.1113 6.36133L12.041 6.55273C11.8329 7.05515 11.4795 7.48399 11.0273 7.78613C10.5751 8.08825 10.0438 8.25 9.5 8.25H3C2.9337 8.25 2.87013 8.22364 2.82324 8.17676C2.77636 8.12987 2.75 8.0663 2.75 8C2.75 7.9337 2.77636 7.87013 2.82324 7.82324C2.87013 7.77636 2.9337 7.75 3 7.75H9.5C9.94495 7.75 10.38 7.61826 10.75 7.37109C11.12 7.12388 11.4088 6.77241 11.5791 6.36133C11.7493 5.95035 11.7937 5.49782 11.707 5.06152C11.6202 4.62507 11.4055 4.22385 11.0908 3.90918C10.7762 3.59451 10.3749 3.37979 9.93848 3.29297C9.50218 3.20629 9.04965 3.25067 8.63867 3.4209C8.22759 3.5912 7.87612 3.88002 7.62891 4.25C7.38174 4.61998 7.25 5.05505 7.25 5.5V5.85742C7.24989 5.92357 7.22354 5.98739 7.17676 6.03418C7.12989 6.08093 7.06621 6.10742 7 6.10742C6.93379 6.10742 6.87011 6.08093 6.82324 6.03418C6.77646 5.98739 6.75011 5.92357 6.75 5.85742V5.5C6.75 5.02419 6.87324 4.55761 7.10645 4.14551L7.21387 3.97266C7.47828 3.57694 7.83971 3.25703 8.2627 3.04395L8.44727 2.95898Z" fill="black" stroke="currentColor"/>
</svg>
          `,
  },
  {
    value: "radar",
    label: "Radar",
    icon: `
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M17.07 2.93L15.66 4.34C16.4027 5.0835 16.9916 5.96604 17.3931 6.9372C17.7946 7.90836 18.0008 8.94911 18 10C18 12.1217 17.1571 14.1566 15.6569 15.6569C14.1566 17.1571 12.1217 18 10 18C7.87827 18 5.84344 17.1571 4.34315 15.6569C2.84285 14.1566 2 12.1217 2 10C2 5.92 5.05 2.56 9 2.07V4.09C6.16 4.57 4 7.03 4 10C4 11.5913 4.63214 13.1174 5.75736 14.2426C6.88258 15.3679 8.4087 16 10 16C11.5913 16 13.1174 15.3679 14.2426 14.2426C15.3679 13.1174 16 11.5913 16 10C16 8.34 15.33 6.84 14.24 5.76L12.83 7.17C13.55 7.9 14 8.9 14 10C14 11.0609 13.5786 12.0783 12.8284 12.8284C12.0783 13.5786 11.0609 14 10 14C8.93913 14 7.92172 13.5786 7.17157 12.8284C6.42143 12.0783 6 11.0609 6 10C6 8.14 7.28 6.59 9 6.14V8.28C8.4 8.63 8 9.26 8 10C8 10.5304 8.21071 11.0391 8.58579 11.4142C8.96086 11.7893 9.46957 12 10 12C10.5304 12 11.0391 11.7893 11.4142 11.4142C11.7893 11.0391 12 10.5304 12 10C12 9.26 11.6 8.62 11 8.28V0H10C8.68678 0 7.38642 0.258658 6.17317 0.761205C4.95991 1.26375 3.85752 2.00035 2.92893 2.92893C1.05357 4.8043 0 7.34784 0 10C0 12.6522 1.05357 15.1957 2.92893 17.0711C3.85752 17.9997 4.95991 18.7362 6.17317 19.2388C7.38642 19.7413 8.68678 20 10 20C12.6522 20 15.1957 18.9464 17.0711 17.0711C18.9464 15.1957 20 12.6522 20 10C20 7.24 18.88 4.74 17.07 2.93Z" fill="currentColor"/>
</svg>
`,
  },
  {
    value: "cloudsAndPrecipitation",
    label: "Clouds & Precipitation",
    icon: `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M12 2V4M4.92996 4.93L6.33996 6.34M20 12H22M19.07 4.93L17.66 6.34M15.947 12.65C16.07 11.9045 15.9794 11.1394 15.6857 10.4432C15.3919 9.74711 14.9069 9.14841 14.287 8.71648C13.667 8.28455 12.9374 8.03704 12.1826 8.00262C11.4278 7.96821 10.6787 8.14828 10.022 8.522M13 22H6.99996C6.05393 21.9998 5.12737 21.7312 4.32788 21.2255C3.5284 20.7197 2.8888 19.9975 2.48339 19.1427C2.07797 18.288 1.92336 17.3358 2.03752 16.3966C2.15168 15.4575 2.52992 14.5701 3.12832 13.8373C3.72672 13.1046 4.52071 12.5567 5.41808 12.2572C6.31545 11.9577 7.27938 11.9189 8.1979 12.1454C9.11642 12.3718 9.95185 12.8542 10.6072 13.5366C11.2625 14.2189 11.7108 15.0731 11.9 16H13C13.7956 16 14.5587 16.3161 15.1213 16.8787C15.6839 17.4413 16 18.2044 16 19C16 19.7956 15.6839 20.5587 15.1213 21.1213C14.5587 21.6839 13.7956 22 13 22Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
          `,
  },
  {
    value: "satellite",
    label: "Satellite",
    icon: `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M9 22L6 15L3 22H9Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M18.1919 13.3351C19.4849 14.6281 20.1319 15.2751 19.9779 16.2731C19.9683 16.3308 19.957 16.3881 19.9439 16.4451C19.7039 17.4251 19.0439 17.6991 17.7279 18.2451C15.9136 18.9971 13.9169 19.194 11.9906 18.8109C10.0643 18.4279 8.29488 17.4821 6.90621 16.0932C5.51754 14.7043 4.57202 12.9348 4.18926 11.0084C3.8065 9.08201 4.00372 7.0854 4.75594 5.27113C5.30094 3.95413 5.57394 3.29613 6.55594 3.05513C6.60094 3.04513 6.68094 3.02813 6.72594 3.02113C7.72594 2.86813 8.37194 3.51413 9.66494 4.80713L18.1919 13.3351Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M19 6C20.1046 6 21 5.10457 21 4C21 2.89543 20.1046 2 19 2C17.8954 2 17 2.89543 17 4C17 5.10457 17.8954 6 19 6Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M12.5 7.1333L17.713 5.5293L15.877 10.5293" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
          `,
  },
  {
    value: "temperature",
    label: "Temperature",
    icon: `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M12.0059 2.5C12.9017 2.5015 13.7629 2.84641 14.4121 3.46387C15.0595 4.07965 15.447 4.91969 15.4951 5.81152V5.8125L15.5 6.0127L15.501 12.7285V12.9277L15.6387 13.0723L15.6875 13.123V13.124C16.369 13.8682 16.8084 14.8 16.9502 15.7959L16.9746 15.9961L16.9941 16.2598L17 16.5127C16.9979 17.3109 16.8047 18.0973 16.4365 18.8057C16.0665 19.5175 15.5305 20.1297 14.874 20.5908C14.2173 21.0521 13.4585 21.3486 12.6631 21.4551C11.8678 21.5615 11.0585 21.4753 10.3037 21.2031C9.64315 20.9649 9.04095 20.5904 8.53613 20.1055L8.32617 19.8906C7.84997 19.3747 7.48804 18.7655 7.26367 18.1025L7.17578 17.8145C6.96476 17.0403 6.94364 16.2267 7.11328 15.4424C7.28295 14.658 7.63917 13.9264 8.15137 13.3086L8.15039 13.3076L8.32129 13.1133L8.3623 13.0713L8.49902 12.9258V12.7275L8.5 6L8.51465 5.67676C8.57417 5.03407 8.81067 4.42016 9.19727 3.90332L9.40332 3.65332C9.98483 3.0099 10.7846 2.60495 11.6475 2.51758L11.6465 2.5166L11.8281 2.50391L12.0059 2.5ZM12 3.5C11.3694 3.49984 10.7622 3.73823 10.2998 4.16699C9.83734 4.59585 9.55415 5.18357 9.50684 5.8125L9.50586 5.82324L9.50488 5.83301L9.5 5.9834V13.3691L9.33398 13.5186C8.73782 14.0517 8.31467 14.7516 8.12012 15.5273C7.95 16.2061 7.96134 16.9158 8.15039 17.5859L8.24219 17.8701C8.51618 18.6214 9.00903 19.2738 9.65723 19.7422C10.3055 20.2106 11.0795 20.4738 11.8789 20.498C12.6783 20.5223 13.4671 20.3062 14.1426 19.8779C14.8178 19.4497 15.349 18.8288 15.668 18.0957C15.9869 17.3623 16.0788 16.5498 15.9316 15.7637C15.7844 14.9775 15.4046 14.2538 14.8418 13.6855L14.8369 13.6797L14.8311 13.6738L14.6777 13.5293L14.6729 13.5244L14.667 13.5195L14.5 13.3701V6C14.5 5.33696 14.2364 4.70126 13.7676 4.23242C13.2987 3.76358 12.663 3.5 12 3.5ZM12 8.5C12.1326 8.5 12.2597 8.55272 12.3535 8.64648C12.4473 8.74025 12.5 8.86739 12.5 9V14.5352L12.7998 14.666C13.2209 14.8498 13.5665 15.1729 13.7773 15.5811C13.9618 15.9382 14.0331 16.3418 13.9854 16.7383L13.958 16.9082C13.8641 17.3577 13.618 17.761 13.2617 18.0508C12.9052 18.3406 12.4595 18.499 12 18.499C11.5978 18.499 11.2065 18.3779 10.876 18.1533L10.7383 18.0508C10.382 17.761 10.1359 17.3577 10.042 16.9082C9.94812 16.4584 10.0118 15.9893 10.2227 15.5811C10.4335 15.1729 10.7791 14.8498 11.2002 14.666L11.5 14.5352V9C11.5 8.86739 11.5527 8.74025 11.6465 8.64648C11.7403 8.55272 11.8674 8.5 12 8.5Z" fill="currentColor" stroke="currentColor"/>
</svg>
`,
  },
  {
    value: "waveHeight",
    label: "Wave Height",
    icon: `
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M20.2783 20.0591C19.8009 19.9166 19.3611 19.6696 18.9909 19.3361C18.6208 19.0025 18.3295 18.5907 18.1383 18.1306C17.8438 18.8175 17.3404 19.3942 16.6996 19.7789C16.0588 20.1636 15.3131 20.3366 14.5683 20.2734C13.8236 20.3362 13.0781 20.1628 12.4376 19.7779C11.797 19.393 11.2939 18.8161 10.9997 18.1291C10.7053 18.8158 10.2022 19.3924 9.56162 19.777C8.92108 20.1617 8.17568 20.3348 7.43118 20.272C6.68667 20.3348 5.94128 20.1617 5.30073 19.777C4.66019 19.3924 4.15702 18.8158 3.86261 18.1291C3.67109 18.5896 3.3794 19.0015 3.00873 19.3351C2.63807 19.6687 2.19774 19.9156 1.71975 20.0577M20.2783 14.3491C19.8022 14.2039 19.3637 13.9559 18.994 13.6227C18.6242 13.2895 18.3321 12.8791 18.1383 12.4206C17.5412 13.8148 15.9955 14.5634 14.5683 14.5634C11.714 14.5634 9.57261 12.4206 9.57261 10.2806C9.57118 7.42484 10.9997 4.57056 14.5683 5.9977C14.3312 4.56913 12.8569 1.71484 8.85832 1.71484C4.85975 1.71484 2.43403 4.57056 1.72118 5.9977" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`,
  },
  {
    value: "wavePeriod",
    label: "Wave Period",
    icon: `
         <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M16.5 22.5H12.75C11.3582 22.498 10.024 21.9443 9.03988 20.9601C8.05574 19.976 7.50198 18.6418 7.5 17.25C7.50923 16.5919 7.64804 15.942 7.9085 15.3376C8.16897 14.7331 8.54598 14.1859 9.018 13.7272C8.52876 13.5761 8.01955 13.4995 7.5075 13.5C3.78225 13.5353 3 18.4132 3 22.5H1.5C1.5 13.8675 4.75875 12.0255 7.4925 12C8.66216 12.0161 9.81221 12.3028 10.8525 12.8378C10.9686 12.8996 11.0663 12.991 11.1359 13.1026C11.2055 13.2141 11.2446 13.3421 11.2491 13.4735C11.2537 13.605 11.2236 13.7353 11.1619 13.8514C11.1002 13.9676 11.009 14.0655 10.8975 14.1353C10.1778 14.5293 9.61158 15.1539 9.28972 15.9086C8.96785 16.6633 8.90908 17.5043 9.12285 18.2965C9.33661 19.0886 9.8105 19.7859 10.4683 20.2762C11.1262 20.7666 11.9298 21.0215 12.75 21H16.5V22.5ZM12.75 6H14.25V12H12.75V6Z" fill="currentColor"/>
<path d="M21 4.0605L19.9395 3L18.243 4.6965C17.1049 3.76156 15.7156 3.18433 14.25 3.0375V1.5H12.75V3.0375C10.9009 3.22554 9.18716 4.09263 7.94033 5.47106C6.69351 6.8495 6.00216 8.64133 6 10.5H7.5C7.5 9.31331 7.85189 8.15327 8.51118 7.16658C9.17047 6.17988 10.1075 5.41085 11.2039 4.95672C12.3003 4.5026 13.5067 4.38378 14.6705 4.61529C15.8344 4.8468 16.9035 5.41824 17.7426 6.25736C18.5818 7.09647 19.1532 8.16557 19.3847 9.32946C19.6162 10.4933 19.4974 11.6997 19.0433 12.7961C18.5892 13.8925 17.8201 14.8295 16.8334 15.4888C15.8467 16.1481 14.6867 16.5 13.5 16.5V18C14.9194 18.0009 16.3099 17.5987 17.5097 16.8402C18.7094 16.0817 19.6692 14.9982 20.2772 13.7155C20.8851 12.4329 21.1164 11.004 20.944 9.59512C20.7717 8.18621 20.2028 6.85521 19.3035 5.757L21 4.0605Z" fill="currentColor"/>
</svg>

`,
  },
  {
    value: "salinity",
    label: "Sea Water Salinity",
    icon: `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M3 10C5.483 10 7.345 7 7.345 7C7.345 7 9.207 10 11.69 10C14.173 10 16.655 7 16.655 7C16.655 7 19.138 10 21 10M3 17C5.483 17 7.345 14 7.345 14C7.345 14 9.207 17 11.69 17C14.173 17 16.655 14 16.655 14C16.655 14 19.138 17 21 17" fill="currentColor"/>
<path d="M3 10C5.483 10 7.345 7 7.345 7C7.345 7 9.207 10 11.69 10C14.173 10 16.655 7 16.655 7C16.655 7 19.138 10 21 10M3 17C5.483 17 7.345 14 7.345 14C7.345 14 9.207 17 11.69 17C14.173 17 16.655 14 16.655 14C16.655 14 19.138 17 21 17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
          `,
  },
  {
    value: "seaSurfaceTemperature",
    label: "Sea Surface Temperature",
    icon: `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M6.74976 1.75C7.38801 1.75 8.00354 1.972 8.49292 2.37305L8.69409 2.55566C9.20982 3.07139 9.49976 3.77065 9.49976 4.5V5.5H10.5144C11.0752 5.46702 11.614 5.2677 12.0613 4.92773C12.4527 4.63017 12.7587 4.23609 12.9509 3.78613L13.0261 3.58984L13.0281 3.58398C13.0591 3.48535 13.1218 3.39912 13.2058 3.33887C13.2688 3.29377 13.3417 3.26551 13.4177 3.25488L13.4949 3.25H13.4978C13.5767 3.25054 13.6546 3.26932 13.7244 3.30469L13.7917 3.3457C13.8558 3.39187 13.9077 3.45224 13.9441 3.52148L13.9753 3.59375V3.59473C14.1577 4.1251 14.4935 4.58956 14.9402 4.92871C15.3871 5.26793 15.925 5.46698 16.4851 5.5H16.5144C17.0752 5.46702 17.614 5.2677 18.0613 4.92773C18.4527 4.63017 18.7587 4.23609 18.9509 3.78613L19.0261 3.58984L19.0271 3.58789C19.0598 3.48901 19.1231 3.40249 19.2078 3.3418C19.2711 3.29641 19.3443 3.26747 19.4207 3.25586L19.4978 3.25C19.5767 3.25054 19.6546 3.26932 19.7244 3.30469L19.7917 3.3457C19.8558 3.39187 19.9077 3.45224 19.9441 3.52148L19.9753 3.59375V3.59473C20.1577 4.1251 20.4935 4.58956 20.9402 4.92871C21.324 5.22006 21.7753 5.40651 22.2498 5.47461V6.49219C21.7925 6.46337 21.3442 6.3452 20.9324 6.14062C20.4464 5.89919 20.0248 5.54571 19.7009 5.11035L19.5017 4.84375L19.3005 5.1084C18.9727 5.5407 18.5491 5.89146 18.0632 6.13281C17.5774 6.37407 17.0422 6.5 16.4998 6.5C16.0251 6.49997 15.5562 6.40348 15.1208 6.21777L14.9363 6.13281C14.4504 5.89147 14.0268 5.54067 13.699 5.1084L13.4978 4.84375L13.2996 5.11035C12.9756 5.54578 12.5532 5.89918 12.0671 6.14062C11.642 6.35176 11.1784 6.47244 10.7058 6.49609L10.5027 6.5H9.49976V12.25H10.5144C11.0053 12.2211 11.479 12.0643 11.8894 11.7979L12.0613 11.6777C12.4527 11.3802 12.7587 10.9861 12.9509 10.5361L13.0261 10.3398L13.0281 10.334C13.0514 10.2598 13.0926 10.1929 13.1472 10.1387L13.2058 10.0889C13.2688 10.0438 13.3417 10.0155 13.4177 10.0049L13.4949 10H13.4978C13.5767 10.0005 13.6546 10.0193 13.7244 10.0547L13.7917 10.0957C13.8558 10.1419 13.9077 10.2022 13.9441 10.2715L13.9753 10.3438V10.3447C14.1349 10.8089 14.412 11.2226 14.7781 11.5459L14.9402 11.6787C15.3871 12.0179 15.925 12.217 16.4851 12.25H16.5144C17.0053 12.2211 17.479 12.0643 17.8894 11.7979L18.0613 11.6777C18.4527 11.3802 18.7587 10.9861 18.9509 10.5361L19.0261 10.3398L19.0271 10.3379C19.0598 10.239 19.1231 10.1525 19.2078 10.0918C19.2711 10.0464 19.3443 10.0175 19.4207 10.0059L19.4978 10C19.5767 10.0005 19.6546 10.0193 19.7244 10.0547L19.7917 10.0957C19.8558 10.1419 19.9077 10.2022 19.9441 10.2715L19.9753 10.3438V10.3447C20.1349 10.8089 20.412 11.2226 20.7781 11.5459L20.9402 11.6787C21.324 11.9701 21.7753 12.1565 22.2498 12.2246V13.2422C21.8599 13.2176 21.4766 13.1286 21.1169 12.9756L20.9324 12.8906C20.4464 12.6492 20.0248 12.2957 19.7009 11.8604L19.5017 11.5938L19.3005 11.8584C18.9727 12.2907 18.5491 12.6415 18.0632 12.8828C17.5774 13.1241 17.0422 13.25 16.4998 13.25C16.0251 13.25 15.5562 13.1535 15.1208 12.9678L14.9363 12.8828C14.4504 12.6415 14.0268 12.2907 13.699 11.8584L13.4978 11.5938L13.2996 11.8604C13.0161 12.2413 12.6576 12.5597 12.2468 12.7949L12.0671 12.8906C11.642 13.1018 11.1784 13.2224 10.7058 13.2461L10.5027 13.25H9.78882L10.2312 13.6797C10.8793 14.3092 11.3437 15.1001 11.5779 15.9678L11.6638 16.3438C11.8553 17.3583 11.729 18.4078 11.3015 19.3477C10.9274 20.1701 10.3384 20.8737 9.60034 21.3867L9.27515 21.5947C8.49606 22.0516 7.61008 22.2885 6.71167 22.2832L6.32593 22.2656C5.42563 22.1908 4.56452 21.8742 3.83276 21.3525L3.5271 21.1162C2.83414 20.5367 2.3124 19.7823 2.0144 18.9346L1.90112 18.5654C1.6681 17.6928 1.67541 16.7758 1.91968 15.9111L2.03882 15.5439C2.39528 14.5749 3.04302 13.7395 3.89233 13.1523L3.99976 13.0771V4.5C3.99976 3.77071 4.28977 3.07138 4.80542 2.55566C5.32109 2.04 6.0205 1.75007 6.74976 1.75ZM4.99976 13.6445L4.74976 13.79C4.08308 14.175 3.5441 14.7433 3.19409 15.4238L3.05542 15.7217C2.76068 16.4331 2.67856 17.2127 2.81519 17.9658L2.88745 18.2871C3.08683 19.0311 3.49607 19.6995 4.06323 20.2139L4.31616 20.4238C4.9273 20.8926 5.65857 21.1736 6.42163 21.2363L6.74976 21.25C7.51987 21.2502 8.27115 21.0277 8.91479 20.6133L9.18433 20.4238C9.79539 19.955 10.2562 19.3213 10.5144 18.6006L10.6121 18.2871C10.8114 17.5433 10.7912 16.7601 10.5574 16.0312L10.4441 15.7217C10.1072 14.9087 9.511 14.2299 8.74878 13.79H8.74976L8.49976 13.6445V10.25H4.99976V13.6445ZM6.74976 2.75C6.34381 2.75006 5.95267 2.89147 5.64136 3.14648L5.51245 3.2627C5.18434 3.59087 4.99976 4.03593 4.99976 4.5V9.25H8.49976V4.5C8.49976 4.09372 8.35862 3.70209 8.10327 3.39062L7.98706 3.2627C7.65888 2.93458 7.21383 2.75 6.74976 2.75Z" fill="currentColor" stroke="currentColor" stroke-width="0.5"/>
</svg>
`,
  },
  {
    value: "oceanCurrents",
    label: "Ocean Currents",
    icon: `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<mask id="path-1-inside-1_3959_1091" fill="currentColor">
<path d="M20 14H22V16H20C18.62 16 17.26 15.65 16 15C13.5 16.3 10.5 16.3 8 15C6.74 15.65 5.37 16 4 16H2V14H4C5.39 14 6.78 13.53 8 12.67C10.44 14.38 13.56 14.38 16 12.67C17.22 13.53 18.61 14 20 14ZM20 20H22V22H20C18.62 22 17.26 21.65 16 21C13.5 22.3 10.5 22.3 8 21C6.74 21.65 5.37 22 4 22H2V20H4C5.39 20 6.78 19.53 8 18.67C10.44 20.38 13.56 20.38 16 18.67C17.22 19.53 18.61 20 20 20ZM22 6L18 2V5H13V7H18V10"/>
</mask>
<path d="M20 14H22V16H20C18.62 16 17.26 15.65 16 15C13.5 16.3 10.5 16.3 8 15C6.74 15.65 5.37 16 4 16H2V14H4C5.39 14 6.78 13.53 8 12.67C10.44 14.38 13.56 14.38 16 12.67C17.22 13.53 18.61 14 20 14ZM20 20H22V22H20C18.62 22 17.26 21.65 16 21C13.5 22.3 10.5 22.3 8 21C6.74 21.65 5.37 22 4 22H2V20H4C5.39 20 6.78 19.53 8 18.67C10.44 20.38 13.56 20.38 16 18.67C17.22 19.53 18.61 20 20 20ZM22 6L18 2V5H13V7H18V10" fill="currentColor"/>
<path d="M22 14H23V13H22V14ZM22 16V17H23V16H22ZM16 15L16.4585 14.1113L15.9982 13.8738L15.5386 14.1128L16 15ZM8 15L8.46135 14.1128L8.00183 13.8738L7.54154 14.1113L8 15ZM2 16H1V17H2V16ZM2 14V13H1V14H2ZM8 12.67L8.57391 11.8511L7.99832 11.4477L7.42384 11.8527L8 12.67ZM16 12.67L16.5762 11.8527L16.0017 11.4477L15.4261 11.8511L16 12.67ZM22 20H23V19H22V20ZM22 22V23H23V22H22ZM16 21L16.4585 20.1113L15.9982 19.8738L15.5386 20.1128L16 21ZM8 21L8.46135 20.1128L8.00183 19.8738L7.54154 20.1113L8 21ZM2 22H1V23H2V22ZM2 20V19H1V20H2ZM8 18.67L8.57391 17.8511L7.99832 17.4477L7.42384 17.8527L8 18.67ZM16 18.67L16.5762 17.8527L16.0017 17.4477L15.4261 17.8511L16 18.67ZM18 2L18.7071 1.29289L17 -0.414214V2H18ZM18 5V6H19V5H18ZM13 5V4H12V5H13ZM13 7H12V8H13V7ZM18 7H19V6H18V7ZM20 15H22V13H20V15ZM21 14V16H23V14H21ZM22 15H20V17H22V15ZM20 15C18.7911 15 17.5874 14.6937 16.4585 14.1113L15.5415 15.8887C16.9326 16.6063 18.4489 17 20 17V15ZM15.5386 14.1128C13.3278 15.2624 10.6722 15.2624 8.46135 14.1128L7.53865 15.8872C10.3278 17.3376 13.6722 17.3376 16.4614 15.8872L15.5386 14.1128ZM7.54154 14.1113C6.41318 14.6934 5.19948 15 4 15V17C5.54052 17 7.06682 16.6066 8.45846 15.8887L7.54154 14.1113ZM4 15H2V17H4V15ZM3 16V14H1V16H3ZM2 15H4V13H2V15ZM4 15C5.61718 15 7.20545 14.4536 8.57616 13.4873L7.42384 11.8527C6.35455 12.6064 5.16282 13 4 13V15ZM7.42609 13.4889C10.2106 15.4404 13.7894 15.4404 16.5739 13.4889L15.4261 11.8511C13.3306 13.3196 10.6694 13.3196 8.57391 11.8511L7.42609 13.4889ZM15.4238 13.4873C16.7945 14.4536 18.3828 15 20 15V13C18.8372 13 17.6455 12.6064 16.5762 11.8527L15.4238 13.4873ZM20 21H22V19H20V21ZM21 20V22H23V20H21ZM22 21H20V23H22V21ZM20 21C18.7911 21 17.5874 20.6937 16.4585 20.1113L15.5415 21.8887C16.9326 22.6063 18.4489 23 20 23V21ZM15.5386 20.1128C13.3278 21.2624 10.6722 21.2624 8.46135 20.1128L7.53865 21.8872C10.3278 23.3376 13.6722 23.3376 16.4614 21.8872L15.5386 20.1128ZM7.54154 20.1113C6.41318 20.6934 5.19948 21 4 21V23C5.54052 23 7.06682 22.6066 8.45846 21.8887L7.54154 20.1113ZM4 21H2V23H4V21ZM3 22V20H1V22H3ZM2 21H4V19H2V21ZM4 21C5.61718 21 7.20545 20.4536 8.57616 19.4873L7.42384 17.8527C6.35455 18.6064 5.16282 19 4 19V21ZM7.42609 19.4889C10.2106 21.4404 13.7894 21.4404 16.5739 19.4889L15.4261 17.8511C13.3306 19.3196 10.6694 19.3196 8.57391 17.8511L7.42609 19.4889ZM15.4238 19.4873C16.7945 20.4536 18.3828 21 20 21V19C18.8372 19 17.6455 18.6064 16.5762 17.8527L15.4238 19.4873ZM22.7071 5.29289L18.7071 1.29289L17.2929 2.70711L21.2929 6.70711L22.7071 5.29289ZM17 2V5H19V2H17ZM18 4H13V6H18V4ZM12 5V7H14V5H12ZM13 8H18V6H13V8ZM17 7V10H19V7H17Z" fill="currentColor" mask="url(#path-1-inside-1_3959_1091)"/>
</svg>
          `,
  },
];

// const inventoryUrl =
function getInventoryUrl() {
  console.log("get inventory url", speedUnit, temperatureUnit, lengthUnit);
  return (
    "https://maps-api.meteoblue.com/v1/map/inventory/filter?lang=en&apikey=" +
    apiKey +
    `&maps=${maps
      .filter((map) => map.value !== "noaaMap")
      .map((map) => map.value)
      .join(",")}` +
    `&temperatureUnit=${temperatureUnit}` +
    `&velocityUnit=${encodeURIComponent(speedUnit)}` +
    `&lengthUnit=${lengthUnit}` +
    `&overlays=pressure2mOverlay,graticuleOverlay`
  );
}

// Map Selection
const mapSelection = document.createElement("div");
mapSelection.classList.add("map-selection");

function getUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  return {
    userId: urlParams.get("userId"),
    lat: urlParams.get("lat"),
    lon: urlParams.get("lon"),
    env: urlParams.get("env"),
  };
}

const params = getUrlParams();

// Set default map center and zoom
let defaultCenter = [-71.13483215584, 42.3142475]; // Default center (Boston)
let defaultZoom = 8;

// If lat and lon are provided in URL, use them
if (params.lat && params.lon) {
  const lat = parseFloat(params.lat);
  const lon = parseFloat(params.lon);

  // Validate coordinates
  if (
    !isNaN(lat) &&
    !isNaN(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  ) {
    defaultCenter = [lon, lat]; // Mapbox uses [longitude, latitude]
    defaultZoom = 10; // Zoom in more when coordinates are provided
    console.log("Using coordinates from URL:", defaultCenter);
  } else {
    console.warn("Invalid coordinates in URL parameters");
  }
}

function loadMeteoblue(selectedMapId) {
  console.log("loading meteoblue", selectedMapId);
  if (isMeteoblueLoaded) return;
}

const meteoblueMapboxMap = new mapboxgl.Map({
  container: "map_container",
  center: defaultCenter,
  zoom: defaultZoom,
  minZoom: 0,
  maxZoom: 24,
  hash: false,
  attributionControl: false,
  keyboard: false,
});
const noaaMapboxMap = new mapboxgl.Map({
  container: "map_container_noaa",
  center: defaultCenter,
  zoom: defaultZoom,
  minZoom: 0,
  maxZoom: 24,
  hash: false,
  attributionControl: false,
  keyboard: false,
  style: "./style_v1.json",
});

// Add click event listener to meteoblue map
meteoblueMapboxMap.on("click", (e) => {
  const { lng, lat } = e.lngLat;
  console.log("Meteoblue map clicked - Lat:", lat, "Lng:", lng);
  displayLocationMarker(lat, lng);

  movePositionToTopCenter({ lat, lng });

  sendMessageToApp(
    JSON.stringify({
      type: "mapClick",
      lat: lat,
      lng: lng,
    })
  );
});

// Add click event listener to NOAA map
noaaMapboxMap.on("click", (e) => {
  const { lng, lat } = e.lngLat;
  console.log("NOAA map clicked - Lat:", lat, "Lng:", lng);
  displayLocationMarker(lat, lng);

  movePositionToTopCenter({ lat, lng });

  sendMessageToApp(
    JSON.stringify({
      type: "mapClick",
      lat: lat,
      lng: lng,
    })
  );
});

function getMapsPlugin() {
  return new meteoblueMapsPlugin({
    mapboxMap: meteoblueMapboxMap,
    inventory: getInventoryUrl(),
    apiKey: apiKey,
    canUseRestricted: true,
    showSidebar: false,
    showLegend: true,
    showTimeSelection: false,
    content: {
      main: "",
    },
  });
}

function closeMenu() {
  if (customMenu.classList.contains("open")) {
    customMenu.classList.remove("open");
    menuToggle.classList.remove("menu-toggle-open");
  }
}

function changeMap(event) {
  Array.from(mapSelection.children).forEach((child) =>
    child.classList.remove("active")
  );
  const isMapSelector = event.target.classList.contains("map-selector");
  if (isMapSelector) {
    event.target.classList.add("active");
  } else {
    event.target.parentElement.classList.add("active");
  }

  const selectedMapId = isMapSelector
    ? event.target.id
    : event.target.parentElement.id;

  if (selectedMapId === "noaaMap") {
    // Switch to NOAA map style
    setNoaaMap();
  } else {
    // Switch to meteoblue map
    mapsPlugin.setMap({
      map: selectedMapId,
    });

    resetNoaaMap();
  }

  if (catches?.length) {
    displayCatchMarkers(catches);
  }

  closeMenu();
}

async function getUserPreferences() {
  const { env, userId } = getUrlParams();
  const baseApi = env?.startsWith("prod")
    ? "https://api-v2.log.fish"
    : env?.startsWith("local")
    ? "http://localhost:8000"
    : "https://api-dta.log.fish";
  const response = await fetch(`${baseApi}/user/${userId}`);
  const data = await response.json();
  console.log("user preferences", data);
  if (data) {
    lengthUnit = data.unitType;
    temperatureUnit = data.temperatureUnit;
    if (data.speedUnit === "kts") {
      speedUnit = "kn";
    } else if (data.speedUnit === "kph") {
      speedUnit = "km/h";
    } else {
      speedUnit = data.speedUnit;
    }
  }
  mapsPlugin = getMapsPlugin();
  return data;
}

// Wait for map to load, then setup menu
noaaMapboxMap.on("load", () => {
  setupMapMenu();
  setNoaaMap();
  const params = getUrlParams();
  if (params.userId) {
    getUserPreferences();

    const toggleWrapper = myCatchesToggle.querySelector(".toggle-wrapper");
    if (toggleWrapper) {
      toggleWrapper.classList.add("active");
      loadUserCatches();
    }
  }
});

// Setup the map menu function
function setupMapMenu() {
  // Clear previous mapSelection children
  while (mapSelection.firstChild)
    mapSelection.removeChild(mapSelection.firstChild);

  // Add My Catches button at the top
  mapSelection.appendChild(myCatchesBtn);

  // Get all available maps
  maps.forEach((map) => {
    const mapDiv = document.createElement("div");
    mapDiv.classList.add("map-selector");
    const mapIcon = document.createElement("span");
    mapIcon.innerHTML = map.icon;
    mapDiv.appendChild(mapIcon);
    const mapText = document.createElement("span");
    mapText.innerText = map.label;
    mapDiv.appendChild(mapText);
    mapDiv.id = map.value;
    mapDiv.addEventListener("click", changeMap);

    // Set NOAA Map as active by default
    if (map.value === "noaaMap") {
      mapDiv.classList.add("active");
    }

    mapSelection.appendChild(mapDiv);
  });

  // Show menuToggle
  menuToggle.style.display = "flex";
  // Append to menu
  customMenu.appendChild(mapSelection);
}

function setNoaaMap() {
  console.log("setting noaa map");
  mapboxMap = noaaMapboxMap;
  noaaMapboxMap?.on("zoomend", () => {
    const currentZoom = noaaMapboxMap.getZoom();

    defaultZoom = currentZoom;
  });
  noaaMapboxMap?.on("moveend", () => {
    const center = noaaMapboxMap.getCenter();
    defaultCenter = center;
  });
  noaaMapboxMap.setCenter(defaultCenter);
  noaaMapboxMap.setZoom(defaultZoom);

  const meteoblueMapContainer = document.querySelector("#map_container");
  meteoblueMapContainer.style.visibility = "hidden";
  meteoblueMapContainer.style.zIndex = -1;

  const noaaMapContainer = document.querySelector("#map_container_noaa");
  noaaMapContainer.style.visibility = "visible";
  noaaMapContainer.style.zIndex = 10;
  noaaMapboxMap.setStyle("./style_v1.json");

  // Re-display location marker if coordinates exist
  const params = getUrlParams();
  if (params.lat && params.lon) {
    const lat = parseFloat(params.lat);
    const lon = parseFloat(params.lon);
    if (!isNaN(lat) && !isNaN(lon)) {
      displayLocationMarker(lat, lon);
    }
  }
}

function resetNoaaMap() {
  mapboxMap = meteoblueMapboxMap;
  console.log("resetting noaa map");
  meteoblueMapboxMap?.on("zoomend", () => {
    const currentZoom = meteoblueMapboxMap.getZoom();

    defaultZoom = currentZoom;
  });
  meteoblueMapboxMap.on("moveend", () => {
    const center = meteoblueMapboxMap.getCenter();
    defaultCenter = center;
  });
  meteoblueMapboxMap.setCenter(defaultCenter);
  meteoblueMapboxMap.setZoom(defaultZoom);

  const meteoblueMapContainer = document.querySelector("#map_container");
  meteoblueMapContainer.style.visibility = "visible";
  meteoblueMapContainer.style.zIndex = 10;

  const noaaMapContainer = document.querySelector("#map_container_noaa");
  noaaMapContainer.style.visibility = "hidden";
  noaaMapContainer.style.zIndex = -1;

  // Re-display location marker if coordinates exist
  const params = getUrlParams();
  if (params.lat && params.lon) {
    const lat = parseFloat(params.lat);
    const lon = parseFloat(params.lon);
    if (!isNaN(lat) && !isNaN(lon)) {
      displayLocationMarker(lat, lon);
    }
  }
}
