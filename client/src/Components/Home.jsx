// src/Components/Home.jsx

import React, { useState } from "react";
import { Grid, Box, Typography } from "@mui/material";
import { Signup } from "./Signup";
import { Login } from "./Login";
import { motion, AnimatePresence } from "framer-motion";
import secImg from "./sec-img.webp";

// 🔹 Abstract Space Background (no 3D, super smooth)
const SpaceBackground = () => {
return (
  <div
    style={{
      position: "absolute",
      inset: 0,
      overflow: "hidden",
      zIndex: 0,
      background:
        "radial-gradient(circle at top, #1b2640 0%, #050814 55%, #02030a 100%)",
    }}
  >
    {/* soft blue nebula left */}
    <motion.div
      style={{
        position: "absolute",
        width: 420,
        height: 420,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(65, 150, 255,0.6), transparent 60%)",
        left: -120,
        top: "18%",
        filter: "blur(8px)",
      }}
      animate={{ x: [0, 20, -10, 0], y: [0, -10, 8, 0] }}
      transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
    />

    {/* purple nebula right bottom */}
    <motion.div
      style={{
        position: "absolute",
        width: 500,
        height: 500,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(155, 89, 182,0.55), transparent 60%)",
        right: -150,
        bottom: -120,
        filter: "blur(10px)",
      }}
      animate={{ x: [0, -25, 10, 0], y: [0, 15, -10, 0] }}
      transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
    />

    {/* vertical light streak */}
    <motion.div
      style={{
        position: "absolute",
        width: 3,
        height: "120vh",
        left: "50%",
        top: "-10vh",
        background:
          "linear-gradient(to bottom, transparent, rgba(135,206,250,0.7), transparent)",
        opacity: 0.5,
      }}
      animate={{ opacity: [0.1, 0.7, 0.2] }}
      transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
    />

    {/* tiny stars */}
    {Array.from({ length: 80 }).map((_, i) => (
      <motion.div
        key={i}
        style={{
          position: "absolute",
          width: 2,
          height: 2,
          borderRadius: "50%",
          background: "#ffffff",
          opacity: 0.4,
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
        }}
        animate={{ opacity: [0.1, 0.8, 0.2] }}
        transition={{
          duration: 6 + Math.random() * 6,
          repeat: Infinity,
          ease: "easeInOut",
          delay: Math.random() * 3,
        }}
      />
    ))}
  </div>
);
};

export const Home = ({ mode = "signup" }) => {
const [showSecond, setShowSecond] = useState(false);
const RightComponent = mode === "login" ? Login : Signup;

return (
  <>
    {/* WRAPPER WITH SPACE BACKGROUND */}
    <Box sx={{ position: "relative", minHeight: "100vh", overflow: "hidden" }}>
      <SpaceBackground />

      {/* MAIN FIRST SCREEN */}
      <Grid
        container
        sx={{
          minHeight: "100vh",
          position: "relative",
          zIndex: 1, // content above space bg
          color: "#ffffff",
        }}
      >
        {/* LEFT SIDE – Image + Info */}
        <Grid
          component={motion.div}
          size={{ xs: 12, md: 6 }}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            p: { xs: 3, md: 6 },
          }}
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        >
          <Box sx={{ maxWidth: 520 }}>
            <motion.img
              src="https://thumbs.dreamstime.com/b/close-up-group-doctors-discussing-something-sitting-table-326527438.jpg"
              alt="MedZoom AI"
              style={{
                width: "100%",
                borderRadius: "1.25rem",
                marginBottom: "2rem",
                boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
              }}
              animate={{ y: [-8, 8, -8] }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            />

            <Typography
              variant="h4"
              fontWeight={800}
              sx={{ mb: 2, letterSpacing: "0.03em" }}
            >
              Welcome to{" "}
              <span style={{ color: "#4fc3f7" }}>MedZoom AI</span>
            </Typography>

            <Typography
              sx={{
                fontSize: "1.05rem",
                opacity: 0.92,
                maxWidth: 460,
                lineHeight: 1.7,
              }}
            >
              MedZoom AI helps doctors and patients connect through secure
              online consultations and real-time X-ray AI analysis. Host video
              calls, share medical images, and get instant AI-powered insights
              in one place.
            </Typography>
          </Box>
        </Grid>

        {/* RIGHT SIDE – Login / Signup */}
        <Grid
          component={motion.div}
          size={{ xs: 12, md: 6 }}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            p: { xs: 3, md: 6 },
            textAlign: "center",
            flexDirection: "column",
          }}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        >
          {/* card will keep its own white bg from MUI Paper inside Login/Signup */}
          <RightComponent />

          {/* DOWN ARROW BUTTON */}
          {/* ===== FIXED CENTER DOWN ARROW BUTTON (Go Back) ===== */}
          {/* ===== CENTER DOWN ARROW BUTTON (Go Back) ===== */}
          {/* FIXED CENTER DOWN ARROW (OPEN second screen) */}
          <motion.div
            onClick={() => setShowSecond(true)}
            style={{
              position: "absolute",
              bottom: "40px",
              left: "50%",
              transform: "translateX(-50%)",
              transformOrigin: "center",      // ⭐ fixes shifting issue
              fontSize: "2rem",
              cursor: "pointer",
              color: "#4fc3f7",
              zIndex: 2000,
              fontWeight: 600,
              textShadow: "0 0 12px rgba(79,195,247,0.8)",
            }}
            animate={{ y: [0, 8, 0] }}          // ⭐ float animation
            transition={{
              duration: 1.8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            whileTap={{ scale: 0.9 }}
          >
            ⬇
          </motion.div>






        </Grid>
      </Grid>
    </Box>

    {/* ========================================================= */}
    {/* SECOND SCREEN — SLIDES UP LIKE SPACEDU SHORT            */}
    {/* ========================================================= */}

    <AnimatePresence>
      {showSecond && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{
            duration: 1,
            ease: [0.25, 0.8, 0.25, 1],
          }}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100vh",
            zIndex: 999,
            background:
              "radial-gradient(circle at top, #151b2f 0%, #050816 55%, #02030a 100%)",
            color: "white",
            padding: "3rem 2rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >

          {/* ===== TOP UP ARROW BUTTON ===== */}
          {/* ===== FIXED TOP UP ARROW BUTTON BELOW NAVBAR ===== */}
          {/* FIXED CENTER UP ARROW (CLOSE second screen) */}
          <motion.div
            onClick={() => setShowSecond(false)}
            style={{
              position: "absolute",
              top: "90px",
              left: "50%",
              transform: "translateX(-50%)",
              transformOrigin: "center",       // ⭐ keeps arrow centered
              fontSize: "2rem",
              cursor: "pointer",
              color: "#4fc3f7",
              zIndex: 2000,
              fontWeight: 600,
              textShadow: "0 0 12px rgba(79,195,247,0.8)",
            }}
            animate={{ y: [0, -8, 0] }}         // ⭐ float animation (upwards)
            transition={{
              duration: 1.8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            whileTap={{ scale: 0.9 }}
          >
            ↑
          </motion.div>




          {/* ===== BACKGROUND GLOW ===== */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              overflow: "hidden",
              zIndex: 0,
            }}
          >
            <motion.div
              style={{
                position: "absolute",
                width: 420,
                height: 420,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle, rgba(79,195,247,0.55), transparent 60%)",
                left: -120,
                top: "15%",
                filter: "blur(8px)",
              }}
              animate={{ x: [0, 20, -10, 0], y: [0, -10, 8, 0] }}
              transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
            />

            <motion.div
              style={{
                position: "absolute",
                width: 480,
                height: 480,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle, rgba(155,89,182,0.6), transparent 60%)",
                right: -140,
                bottom: -120,
                filter: "blur(10px)",
              }}
              animate={{ x: [0, -20, 10, 0], y: [0, 15, -10, 0] }}
              transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>

          {/* ===== MAIN CONTENT (TEXT LEFT + IMAGE RIGHT) ===== */}
          <div
            style={{
              position: "relative",
              zIndex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "90%",
              maxWidth: "1150px",
              gap: "3rem",
            }}
          >
            {/* LEFT TEXT SECTION */}
            <div style={{ flex: 1 }}>
              <h1
                style={{
                  fontSize: "2.6rem",
                  fontWeight: 800,
                  marginBottom: "1rem",
                  letterSpacing: "0.05em",
                  textAlign: "left",
                  textTransform: "uppercase",
                }}
              >
                About <span style={{ color: "#4fc3f7" }}>MedZoom AI</span>
              </h1>

              <p
                style={{
                  maxWidth: 600,
                  fontSize: "1.15rem",
                  opacity: 0.94,
                  lineHeight: 1.75,
                  textAlign: "left",
                }}
              >
                MedZoom AI connects doctors and patients with real-time video
                consultation, instant AI diagnosis, and secure collaboration tools.
                <br /><br />
                It enhances medical communication, improves remote healthcare
                workflows, and brings advanced imaging analysis directly to doctors
                and patients.
                <br /><br />
                With AI-assisted radiology, telemedicine integration, and instant
                report generation — MedZoom AI represents the future of modern
                clinical care.
                <br /><br />
                Welcome to the next generation of digital healthcare.
              </p>
            </div>

            {/* RIGHT IMAGE SECTION */}
            <motion.img
              src={secImg}
              alt="MedZoom AI Telemedicine"
              style={{
                width: "33%",
                minWidth: 260,
                borderRadius: "1.2rem",
                boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
              }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>

        </motion.div>
      )}
    </AnimatePresence>

  </>
);
};
