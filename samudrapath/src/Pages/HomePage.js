import React, { useState, useEffect, useContext, useRef } from "react";
import Navbar from "../components/Homepage/Navbar";
import Sidebar from "../components/Homepage/Sidebar";
import MapView from "../components/Homepage/MapView";
import Papa from "papaparse";
import { ShipContext } from "../ShipContext";

const shipCategories = {
  "Cargo Ships": [
    "General Cargo Ship",
    "Refrigerated Cargo Ship",
    "Heavy Lift Cargo Ship",
  ],
  Tankers: ["Crude Oil Tanker", "Product Tanker", "Chemical Tanker"],
  "Container Ships": [
    "Feeder Ship",
    "Panamax Ship",
    "Ultra Large Container Ship (ULCS)",
  ],
  "Passenger Ships": ["Cruise Ship", "Ferries", "Yachts"],
  "Fishing Vessels": ["Trawler", "Longliner", "Seiner"],
  "Naval Ships": ["Aircraft Carrier", "Destroyer", "Frigate"],
  "Bulk Carriers": [
    "Handysize Bulk Carrier",
    "Panamax Bulk Carrier",
    "Capesize Bulk Carrier",
  ],
  "Research Vessels": [
    "Oceanographic Research Vessel",
    "Marine Research Vessel",
  ],
  "Offshore Vessels": [
    "Platform Supply Vessel (PSV)",
    "Anchor Handling Tug Supply Vessel (AHTS)",
    "Offshore Support Vessel (OSV)",
  ],
  Tugboats: ["Harbor Tug", "Ocean-going Tug"],
};

const HomePage = () => {
  const { source, setSource, destination, setDestination } = useContext(ShipContext);

  const [departureDate, setDepartureDate] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSubtype, setSelectedSubtype] = useState("");
  const [sourceCoordinates, setSourceCoordinates] = useState(null);
  const [destinationCoordinates, setDestinationCoordinates] = useState(null);
  const [nsgaPathsLength, setNsgaPathsLength] = useState(0); // Number of dynamic paths

  const [routes, setRoutes] = useState([
    {
      id: 1,
      coordinates: [],
      color: "#00ff00",
      visible: true,
      name: "Safest Path",
      description: "Safest Path",
    },
    {
      id: 2,
      coordinates: [],
      color: "#0000FF",
      visible: true,
      name: "Fuel Efficient Path",
      description: "Fuel Efficient Path",
    },
    {
      id: 3,
      coordinates: [],
      color: "#FFA500",
      visible: true,
      name: "Shortest Path",
      description: "Shortest Path",
    },
    // Dynamic routes will start from id >= 4
  ]);

  const dynamicRouteIdRef = useRef(4); // Starting ID for dynamic routes
  const fetchedDynamicRoutesRef = useRef(new Set()); // To track fetched dynamic routes

  const [pirateCoordinates, setPirateCoordinates] = useState([]);
  const [routeData, setRouteData] = useState({});

  // Define a color palette for dynamic routes
  const dynamicColors = [
    "#FF0000", // Red
    "#00FFFF", // Cyan
    "#FF00FF", // Magenta
    "#800000", // Maroon
    "#808000", // Olive
    "#008080", // Teal
    "#800080", // Purple
    "#008000", // Green
    "#000080", // Navy
    "#FFA500", // Orange
    // Add more colors if needed
  ];

  // Helper function to get color for dynamic routes
  const getDynamicColor = (index) => {
    return dynamicColors[index % dynamicColors.length];
  };

  const handleCategoryChange = (event) => {
    setSelectedCategory(event.target.value);
    setSelectedSubtype("");
  };

  const handleSubtypeChange = (event) => {
    setSelectedSubtype(event.target.value);
  };

  const handleMapClick = (event) => {
    const { lng, lat } = event.lngLat;

    if (!sourceCoordinates && !source) {
      setSourceCoordinates({ lat, lng });
      setSource(`${lat}, ${lng}`);
    } else if (!destinationCoordinates && !destination) {
      setDestinationCoordinates({ lat, lng });
      setDestination(`${lat}, ${lng}`);
    }
  };

  // Update route coordinates by ID
  const updateCoordinates = (id, newCoordinates) => {
    setRoutes((prevRoutes) =>
      prevRoutes.map((route) =>
        route.id === id ? { ...route, coordinates: newCoordinates } : route
      )
    );
  };

  // Update route visibility by ID
  const updateVisibility = (id, visibility) => {
    setRoutes((prevRoutes) =>
      prevRoutes.map((route) =>
        route.id === id ? { ...route, visible: visibility } : route
      )
    );
  };

  // Function to fetch and parse a CSV file
  const fetchCSV = (url, parseFunction, isPirate = false, dynamicIndex = null) => {
    fetch(`${url}?t=${Date.now()}`) // Cache busting with timestamp
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Network response was not ok for ${url}`);
        }
        return response.text();
      })
      .then((data) => {
        Papa.parse(data, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const coordinates = results.data
              .map((row) => {
                const lng = parseFloat(row.Longitude || row.longitude);
                const lat = parseFloat(row.Latitude || row.latitude);

                // Validate coordinates
                if (isNaN(lng) || isNaN(lat)) {
                  console.error("Invalid coordinates:", lng, lat);
                  return null; // Skip invalid coordinates
                }
                return [lng, lat];
              })
              .filter(Boolean); // Remove null or invalid coordinates

            if (isPirate) {
              setPirateCoordinates(coordinates);
            } else {
              const predefinedRouteKeys = {
                safe: 1,
                fuel: 2,
                short: 3,
              };

              const match = url.match(/path_(\w+)_smoothed\.csv$/);
              if (match) {
                const key = match[1];
                const routeId = predefinedRouteKeys[key];
                if (routeId) {
                  parseFunction(routeId, coordinates);
                }
              } 
              if (dynamicIndex !== null) {
                // Handle dynamic route
                const dynamicUrl = url; // e.g., /path_1_smoothed.csv
                if (!fetchedDynamicRoutesRef.current.has(dynamicUrl)) {
                  const newRoute = {
                    id: dynamicRouteIdRef.current,
                    coordinates: coordinates,
                    color: getDynamicColor(dynamicRouteIdRef.current - 4),
                    visible: true, // Only first dynamic route is visible by default
                    name: `Optimal Path ${dynamicRouteIdRef.current - 3}`,
                    description: `Optimal Path ${dynamicRouteIdRef.current - 3}`,
                  };
                  setRoutes((prevRoutes) => [...prevRoutes, newRoute]);
                  fetchedDynamicRoutesRef.current.add(dynamicUrl);
                  console.log(`Added new dynamic route: ${newRoute.name}`);
                  dynamicRouteIdRef.current += 1;
                } else {
                  console.log(`Dynamic route ${url} already fetched.`);
                  // Optionally, update existing dynamic route coordinates
                  const existingRoute = routes.find(
                    (route) => route.coordinates.length > 0 && route.coordinates[0][0] === coordinates[0][0] // Simple check, adjust as needed
                  );
                  if (existingRoute) {
                    updateCoordinates(existingRoute.id, coordinates);
                  }
                }
              }
            }
          },
        });
      })
      .catch((error) => {
        console.error(`Error fetching ${url}:`, error);
      });
  };

  // useEffect to fetch results.csv and set nsgaPathsLength
  useEffect(() => {
    const fetchResultsCsv = async () => {
      try {
        const response = await fetch('/results.csv');
        if (!response.ok) {
          throw new Error(`Failed to fetch results.csv: ${response.statusText}`);
        }
        const text = await response.text();

        Papa.parse(text, {
          complete: (result) => {
            // Assuming each row represents a dynamic path
            setNsgaPathsLength(Math.min(8, result.data.length)); // Set number of dynamic paths (max 8)
          },
          header: true,
          skipEmptyLines: true,
        });
      } catch (error) {
        console.error('Error fetching or parsing results.csv:', error);
      }
    };

    fetchResultsCsv();
  }, []); // Run once on mount

  // useEffect to fetch all necessary CSV data based on nsgaPathsLength
  useEffect(() => {
    if (nsgaPathsLength <= 0) return; // Avoid fetching if not set

    const fetchAllData = () => {
      // Fetch pirate coordinates
      fetchCSV("/filtered_coordinates.csv", null, true);

      // Fetch predefined routes
      fetchCSV("/path_safe_smoothed.csv", updateCoordinates);
      fetchCSV("/path_fuel_smoothed.csv", updateCoordinates);
      fetchCSV("/path_short_smoothed.csv", updateCoordinates);
      // Removed fetchCSV("/path_1_smoothed.csv", updateCoordinates) to avoid conflict

      // Fetch dynamic routes using a loop
      for (let i = 1; i <= nsgaPathsLength; i++) {
        const routePath = `/path_${i}_smoothed.csv`;
        fetchCSV(routePath, updateCoordinates, false, i);
      }
    };

    fetchAllData();

    const intervalId = setInterval(fetchAllData, 3000); // Poll every 3 seconds

    return () => clearInterval(intervalId); // Cleanup on unmount
  }, [nsgaPathsLength]); // Run when nsgaPathsLength changes

  return (
    <div className="flex flex-col h-screen">
      <Navbar />
      <div className="flex flex-row flex-grow overflow-hidden">
        <Sidebar
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          selectedSubtype={selectedSubtype}
          setSelectedSubtype={setSelectedSubtype}
          departureDate={departureDate}
          setDepartureDate={setDepartureDate}
          departureTime={departureTime}
          setDepartureTime={setDepartureTime}
          shipCategories={shipCategories}
          handleCategoryChange={handleCategoryChange}
          handleSubtypeChange={handleSubtypeChange}
          setSourceCoordinates={setSourceCoordinates}
          setDestinationCoordinates={setDestinationCoordinates}
          routes={routes}
          updateVisibility={updateVisibility}
        />
        <MapView
          handleMapClick={handleMapClick}
          routes={routes}
          pirateCoordinates={pirateCoordinates}
        />
      </div>
    </div>
  );
};

export default HomePage;
