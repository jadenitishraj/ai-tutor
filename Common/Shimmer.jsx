import React from "react";

export const ShimmerBlock = ({ width = "100%", height = "20px" }) => {
  return (
    <div
      style={{
        width,
        height,
        backgroundColor: "#e0e0e0",
        borderRadius: "4px",
        animation: "shimmer 1.5s infinite linear",
        backgroundImage: "linear-gradient(to right, #f6f7f8 0%, #edeef1 20%, #f6f7f8 40%, #f6f7f8 100%)",
        backgroundRepeat: "no-repeat",
        backgroundSize: "800px 104px",
        display: "inline-block",
        position: "relative"
      }}
    />
  );
};
