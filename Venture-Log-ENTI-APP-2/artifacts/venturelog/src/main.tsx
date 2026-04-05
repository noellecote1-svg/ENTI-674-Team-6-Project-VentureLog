/**
 * main.tsx — Frontend Entry Point
 *
 * This is the very first file that runs when the VentureLog frontend loads
 * in the browser. Its only job is to find the empty <div id="root"> in the
 * HTML file and mount the entire React application inside it.
 *
 * Every component, page, and feature in the app flows down from here.
 * Think of it as the "on switch" for the frontend.
 */

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css"; // Import global styles so they apply to the entire app

// Find the root HTML element and render the App component into it.
// The "!" tells TypeScript we're certain this element exists in index.html.
createRoot(document.getElementById("root")!).render(<App />);
