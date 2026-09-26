import React, { useState } from "react";
import { Button, TextField, Typography, Paper, Grid } from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";

export const VerifyOTP = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const email = new URLSearchParams(location.search).get("email");
  const devOtp = location.state?.devOtp;
  const [otp, setOtp] = useState(devOtp || "");
  const [error, setError] = useState("");

  const handleVerify = async () => {
    if (!otp) {
      setError("Enter OTP");
      return;
    }

    const res = await fetch("/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp })
    });

    const data = await res.json();

    if (!data.success) {
      setError(data.message || "Invalid OTP");
      return;
    }

    // save user + token
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    localStorage.setItem("medzoomUser", data.user.name);

    // redirect to create/join page
    window.location.href =
      `/dashboard.html?name=${encodeURIComponent(data.user.name)}`;
  };

  return (
    <Grid align="center">
      <Paper sx={{ padding: "2rem", marginTop: "6rem", width: "350px" }}>
        <Typography variant="h5" fontWeight={700}>OTP Verification</Typography>

        <Typography sx={{ mt: 1, mb: 2 }}>
          OTP sent to <b>{email}</b>
        </Typography>

        {devOtp && (
          <Typography sx={{ mb: 2, p: 1, bgcolor: "#e8f5e9", color: "#2e7d32", borderRadius: "6px", fontSize: "0.85rem", fontWeight: 600 }}>
            ⚡ Dev Mode OTP: {devOtp} (Auto-filled)
          </Typography>
        )}

        <TextField
          fullWidth
          label="Enter OTP"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
        />

        <Button
          variant="contained"
          fullWidth
          sx={{ mt: 2 }}
          onClick={handleVerify}
        >
          Verify OTP
        </Button>

        {error && <Typography color="error" sx={{ mt: 2 }}>{error}</Typography>}
      </Paper>
    </Grid>
  );
};
