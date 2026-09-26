import React from "react";
import { AppBar, Toolbar, Typography, Button } from "@mui/material";
import { useNavigate } from "react-router-dom";

export const Navbar1 = () => {
  const navigate = useNavigate();
  const user = localStorage.getItem("user");

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.dispatchEvent(new Event("authChanged"));
    navigate("/");
  };

  return (
    <AppBar position="static" sx={{ padding: "8px" }}>
      <Toolbar>

        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          MedZoom AI
        </Typography>

        {user ? (
          <Button color="inherit" onClick={handleLogout}>
            Logout
          </Button>
        ) : (
          <Button color="inherit" onClick={() => navigate("/login")}>
            Login
          </Button>
        )}

      </Toolbar>
    </AppBar>
  );
};
