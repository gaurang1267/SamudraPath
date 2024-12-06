import React, { useState } from "react";
// import React from "react";
import Map, { Source, Layer, NavigationControl } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const MapView = ({ handleMapClick, routes, pirateCoordinates }) => {
  return (
    <Map
      initialViewState={{
        longitude: 74.5,
        latitude: 10.5,
        zoom: 5,
      }}
      style={{ width: "100%", height: "100%" }}
      mapStyle="mapbox://styles/mapbox/streets-v11"
      mapboxAccessToken={process.env.REACT_APP_MAPBOX_TOKEN}
      onClick={handleMapClick}
    >
      <Source id="pirates" type="geojson" data={{
        type: "FeatureCollection",
        features: pirateCoordinates.map((coord) => ({
        type: "Feature",
        geometry: {
        type: "Point",
        coordinates: coord,
      },
      })),
      }}>
        <Layer
          id="pirate-circles"
          type="circle"
          paint={{
            "circle-color": "#FFC1C3", // Red color for pirate infestation
            "circle-radius": 5, // Circle size
            "circle-stroke-color": "#FF7074", // White border
            "circle-stroke-width": 0.7, // Border width
          }}
        />
      </Source>
      {routes.map((route, index) => (
        <Source
          key={index}
          id={`route-${index}`}
          type="geojson"
          data={{
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: route.coordinates, // Use the route coordinates here
            },
          }}
        >
          <Layer
            id={`route-layer-${index}`}
            type="line"
            paint={{
              "line-color": route.color || "#FF5733", // You can pass different colors for each route
              "line-width": 4,
            }}
          />
        </Source>
      ))}
      <NavigationControl />
    </Map>
  );
};

export default MapView;
