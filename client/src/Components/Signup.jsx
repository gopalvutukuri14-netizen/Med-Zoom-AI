import React, { useState } from "react";
import { Grid, Paper, TextField, Typography, Button } from "@mui/material";
import { useNavigate, Link } from "react-router-dom";

export const Signup = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: ""
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleGenerateOTP = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.name || !form.email || !form.password) {
      setError("Please fill all fields");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });

      const data = await res.json();
      setLoading(false);

      if (!data.success) {
        setError(data.message || "Failed to send OTP");
        return;
      }

      // OTP sent → go to OTP page
      navigate(`/verify-otp?email=${encodeURIComponent(form.email)}`, {
        state: { devOtp: data.devOtp }
      });

    } catch (err) {
      setError("Network error");
      setLoading(false);
    }
  };

  return (
    <Grid align="center">
      <Paper style={{ padding: "2rem", margin: "80px auto", borderRadius: "1rem" }}
        sx={{ width: { xs: "90vw", sm: "60vw", md: "45vw", lg: "35vw" } }}>

        <Typography sx={{ fontSize: "2rem", fontWeight: 700 }}>Signup</Typography>

        <form onSubmit={handleGenerateOTP}>
          <TextField name="name" value={form.name} onChange={handleChange}
            label="Enter Name" fullWidth style={{ marginTop: "1rem" }} />

          <TextField name="email" value={form.email} onChange={handleChange}
            label="Enter Email" fullWidth style={{ marginTop: "1rem" }} />

          <TextField name="password" type="password" value={form.password} onChange={handleChange}
            label="Create Password" fullWidth style={{ marginTop: "1rem" }} />

          <TextField name="confirmPassword" type="password"
            value={form.confirmPassword} onChange={handleChange}
            label="Confirm Password" fullWidth style={{ marginTop: "1rem" }} />

          <Button type="submit" variant="contained"
            fullWidth disabled={loading}
            style={{ marginTop: "2rem", fontSize: "1rem", fontWeight: 700 }}>
            {loading ? "Sending OTP..." : "Generate OTP"}
          </Button>
        </form>

        {error && <Typography color="error" sx={{ mt: 1 }}>{error}</Typography>}

        <Typography sx={{ mt: 2 }}>
          Already have an account? <Link to="/login">Login</Link>
        </Typography>
      </Paper>
    </Grid>
  );
};
