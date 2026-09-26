// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Navbar } from "./Components/Navbar";
import { Navbar1 } from "./Components/Navbar1";
import { Home } from "./Components/Home";
import { Inside } from "./Components/Inside";
import { VerifyOTP } from "./Components/VerifyOTP";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<><Navbar /><Home mode="signup" /></>} />
        <Route path="/signup" element={<><Navbar /><Home mode="signup" /></>} />
        <Route path="/login" element={<><Navbar /><Home mode="login" /></>} />
        <Route path="/inside" element={<><Navbar1 /><Inside /></>} />
        <Route path="/verify-otp" element={<VerifyOTP />} />
      </Routes>
    </BrowserRouter>
  );
}
