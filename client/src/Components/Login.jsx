import React, { useState } from "react";
import { Grid, Paper, TextField, Typography, Button } from "@mui/material";
import { Link, useNavigate } from "react-router-dom";

export const Login = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const paperstyle = {
    padding: "2rem",
    margin: "80px auto",
    borderRadius: "1rem",
  };
  const row = { display: "flex", marginTop: "1.2rem" };
  const btnStyle = {
    marginTop: "1.6rem",
    fontSize: "1rem",
    fontWeight: 700,
    borderRadius: "0.5rem",
  };

  const handleChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.email || !form.password) {
      setError("Please fill all fields");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, password: form.password }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.message || "Login failed");
        setLoading(false);
        return;
      }


      if (data.token) localStorage.setItem("token", data.token);
      if (data.user) localStorage.setItem("user", JSON.stringify(data.user));

      setLoading(false);

      const userName = data.user?.name || "User";
      localStorage.setItem("medzoomUser", userName);

      window.location.href = `/dashboard.html?name=${encodeURIComponent(
        userName
      )}`;
    } catch (err) {
      setError("Network error");
      setLoading(false);
    }
  };

  // 3D tilt handlers for the card
  const handleCardMouseMove = (e) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    const rotateX = (-y / 25).toFixed(2);
    const rotateY = (x / 25).toFixed(2);
    card.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(0)`;
  };

  const handleCardLeave = (e) => {
    e.currentTarget.style.transform =
      "rotateX(0deg) rotateY(0deg) translateZ(0)";
  };

  return (
    <Grid align="center" className="auth-card-wrapper">
      <Paper
        style={paperstyle}
        sx={{
          width: { xs: "90vw", sm: "60vw", md: "45vw", lg: "35vw" },
        }}
        elevation={0}
        className="auth-card ai-login-card"
        onMouseMove={handleCardMouseMove}
        onMouseLeave={handleCardLeave}
      >
        <Typography
          sx={{ fontSize: "2rem", fontWeight: 700 }}
          className="auth-card-title"
        >
          Login
        </Typography>

        <form onSubmit={handleSubmit}>
          <TextField
            name="email"
            value={form.email}
            onChange={handleChange}
            type="email"
            style={row}
            label="Enter Email"
            fullWidth
            className="auth-input"
          />
          <TextField
            name="password"
            value={form.password}
            onChange={handleChange}
            type="password"
            style={row}
            label="Enter Password"
            fullWidth
            className="auth-input"
          />

          <Button
            type="submit"
            variant="contained"
            style={btnStyle}
            fullWidth
            disabled={loading}
            className="auth-btn-primary"
          >
            {loading ? "Logging in..." : "Login"}
          </Button>
        </form>

        {error && (
          <Typography color="error" sx={{ mt: 1 }}>
            {error}
          </Typography>
        )}

        <Typography sx={{ mt: 2 }} className="auth-switch-text">
          Don't have an account? <Link to="/signup">Signup</Link>
        </Typography>
      </Paper>
    </Grid>
  );
};
